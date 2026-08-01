/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { VoxelData, SavedModel } from '../types';
import { COLORS, CONFIG } from './voxelConstants';

// Helper to prevent overlapping voxels
function setBlock(map: Map<string, VoxelData>, x: number, y: number, z: number, color: number) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rz = Math.round(z);
    const key = `${rx},${ry},${rz}`;
    map.set(key, { x: rx, y: ry, z: rz, color });
}

function generateSphere(map: Map<string, VoxelData>, cx: number, cy: number, cz: number, r: number, col: number, sy = 1) {
    const r2 = r * r;
    const xMin = Math.floor(cx - r);
    const xMax = Math.ceil(cx + r);
    const yMin = Math.floor(cy - r * sy);
    const yMax = Math.ceil(cy + r * sy);
    const zMin = Math.floor(cz - r);
    const zMax = Math.ceil(cz + r);

    for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
            for (let z = zMin; z <= zMax; z++) {
                const dx = x - cx;
                const dy = (y - cy) / sy;
                const dz = z - cz;
                if (dx * dx + dy * dy + dz * dz <= r2) {
                    setBlock(map, x, y, z, col);
                }
            }
        }
    }
}

/**
 * Procedurally generates a multi-frame animation from any base voxel model!
 */
export function proceduralAnimate(
  baseVoxels: VoxelData[],
  type: 'fly' | 'walk' | 'pulse' | 'float' | 'spin' = 'float',
  numFrames = 6
): VoxelData[][] {
  const frames: VoxelData[][] = [];
  
  // Calculate center of model
  let cx = 0, cy = 0, cz = 0;
  if (baseVoxels.length > 0) {
    baseVoxels.forEach(v => { cx += v.x; cy += v.y; cz += v.z; });
    cx /= baseVoxels.length;
    cy /= baseVoxels.length;
    cz /= baseVoxels.length;
  }

  for (let f = 0; f < numFrames; f++) {
    const progress = f / numFrames;
    const phase = progress * Math.PI * 2;
    const map = new Map<string, VoxelData>();

    baseVoxels.forEach(v => {
      let nx = v.x;
      let ny = v.y;
      let nz = v.z;
      let ncol = v.color;

      const relX = v.x - cx;
      const relY = v.y - cy;
      const relZ = v.z - cz;
      const distFromCenter = Math.sqrt(relX * relX + relZ * relZ);

      if (type === 'fly') {
        // Wing flap motion (voxels away from center on X-axis move up/down)
        const wingDist = Math.abs(relX);
        if (wingDist > 2) {
          const flapAngle = Math.sin(phase) * 0.4 * (wingDist / 6);
          ny += Math.sin(phase) * wingDist * 0.35;
          nx += relX > 0 ? -Math.sin(phase) * 0.2 : Math.sin(phase) * 0.2;
        } else {
          ny += Math.sin(phase) * 0.5; // Body hover
        }
      } else if (type === 'walk') {
        // Gait motion (feet/legs move back and forth, body bobs)
        if (relY < -2) {
          const legPhase = relX > 0 ? phase : phase + Math.PI;
          nz += Math.sin(legPhase) * 1.5;
          ny += Math.max(0, Math.cos(legPhase)) * 0.8;
        } else {
          ny += Math.abs(Math.sin(phase * 2)) * 0.6;
        }
      } else if (type === 'pulse') {
        // Expanding/contracting heartbeat pulse
        const scale = 1.0 + Math.sin(phase) * 0.12;
        nx = cx + relX * scale;
        ny = cy + relY * scale;
        nz = cz + relZ * scale;
      } else if (type === 'float') {
        // Smooth floating bob with gentle wave
        ny += Math.sin(phase) * 1.2;
        nx += Math.cos(phase * 0.5) * 0.5;
      } else if (type === 'spin') {
        // Rotation around Y axis
        const rotAngle = phase;
        nx = cx + relX * Math.cos(rotAngle) - relZ * Math.sin(rotAngle);
        nz = cz + relX * Math.sin(rotAngle) + relZ * Math.cos(rotAngle);
      }

      setBlock(map, nx, ny, nz, ncol);
    });

    frames.push(Array.from(map.values()));
  }

  return frames;
}

export const Generators = {
    Eagle: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        // Branch
        for (let x = -8; x < 8; x++) {
            const y = Math.sin(x * 0.2) * 1.5;
            const z = Math.cos(x * 0.1) * 1.5;
            generateSphere(map, x, y, z, 1.8, COLORS.WOOD);
            if (Math.random() > 0.7) generateSphere(map, x, y + 2, z + (Math.random() - 0.5) * 3, 1.5, COLORS.GREEN);
        }
        // Body
        const EX = 0, EY = 2, EZ = 2;
        generateSphere(map, EX, EY + 6, EZ, 4.5, COLORS.DARK, 1.4);
        // Chest
        for (let x = EX - 2; x <= EX + 2; x++) for (let y = EY + 4; y <= EY + 9; y++) setBlock(map, x, y, EZ + 3, COLORS.LIGHT);
        // Wings (Rough approximation)
        for (let x of [-4, -3, 3, 4]) for (let y = EY + 4; y <= EY + 10; y++) for (let z = EZ - 2; z <= EZ + 3; z++) setBlock(map, x, y, z, COLORS.DARK);
        // Tail
        for (let x = EX - 2; x <= EX + 2; x++) for (let y = EY; y <= EY + 4; y++) for (let z = EZ - 5; z <= EZ - 3; z++) setBlock(map, x, y, z, COLORS.WHITE);
        // Head
        const HY = EY + 12, HZ = EZ + 1;
        generateSphere(map, EX, HY, HZ, 2.8, COLORS.WHITE);
        generateSphere(map, EX, HY - 2, HZ, 2.5, COLORS.WHITE);
        // Talons
        [[-2, 0], [-2, 1], [2, 0], [2, 1]].forEach(o => setBlock(map, EX + o[0], EY + o[1], EZ, COLORS.TALON));
        // Beak
        [[0, 1], [0, 2], [1, 1], [-1, 1]].forEach(o => setBlock(map, EX + o[0], HY, HZ + 2 + o[1], COLORS.GOLD));
        setBlock(map, EX, HY - 1, HZ + 3, COLORS.GOLD);
        // Eyes
        [[-1.5, COLORS.BLACK], [1.5, COLORS.BLACK]].forEach(o => setBlock(map, EX + o[0], HY + 0.5, HZ + 1.5, o[1]));
        [[-1.5, COLORS.WHITE], [1.5, COLORS.WHITE]].forEach(o => setBlock(map, EX + o[0], HY + 1.5, HZ + 1.5, o[1]));

        return Array.from(map.values());
    },

    Cat: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        const CY = CONFIG.FLOOR_Y + 1; const CX = 0, CZ = 0;
        // Paws
        generateSphere(map, CX - 3, CY + 2, CZ, 2.2, COLORS.DARK, 1.2);
        generateSphere(map, CX + 3, CY + 2, CZ, 2.2, COLORS.DARK, 1.2);
        // Body
        for (let y = 0; y < 7; y++) {
            const r = 3.5 - (y * 0.2);
            generateSphere(map, CX, CY + 2 + y, CZ, r, COLORS.DARK);
            generateSphere(map, CX, CY + 2 + y, CZ + 2, r * 0.6, COLORS.WHITE);
        }
        // Legs
        for (let y = 0; y < 5; y++) {
            setBlock(map, CX - 1.5, CY + y, CZ + 3, COLORS.WHITE); setBlock(map, CX + 1.5, CY + y, CZ + 3, COLORS.WHITE);
            setBlock(map, CX - 1.5, CY + y, CZ + 2, COLORS.WHITE); setBlock(map, CX + 1.5, CY + y, CZ + 2, COLORS.WHITE);
        }
        // Head
        const CHY = CY + 9;
        generateSphere(map, CX, CHY, CZ, 3.2, COLORS.LIGHT, 0.8);
        // Ears
        [[-2, 1], [2, 1]].forEach(side => {
            setBlock(map, CX + side[0], CHY + 3, CZ, COLORS.DARK); setBlock(map, CX + side[0] * 0.8, CHY + 3, CZ + 1, COLORS.WHITE);
            setBlock(map, CX + side[0], CHY + 4, CZ, COLORS.DARK);
        });
        // Tail
        for (let i = 0; i < 12; i++) {
            const a = i * 0.3, tx = Math.cos(a) * 4.5, tz = Math.sin(a) * 4.5;
            if (tz > -2) { setBlock(map, CX + tx, CY, CZ + tz, COLORS.DARK); setBlock(map, CX + tx, CY + 1, CZ + tz, COLORS.DARK); }
        }
        // Face
        setBlock(map, CX - 1, CHY + 0.5, CZ + 2.5, COLORS.GOLD); setBlock(map, CX + 1, CHY + 0.5, CZ + 2.5, COLORS.GOLD);
        setBlock(map, CX - 1, CHY + 0.5, CZ + 3, COLORS.BLACK); setBlock(map, CX + 1, CHY + 0.5, CZ + 3, COLORS.BLACK);
        setBlock(map, CX, CHY, CZ + 3, COLORS.TALON);
        return Array.from(map.values());
    },

    Rabbit: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        const LOG_Y = CONFIG.FLOOR_Y + 2.5;
        const RX = 0, RZ = 0;
        // Log
        for (let x = -6; x <= 6; x++) {
            const radius = 2.8 + Math.sin(x * 0.5) * 0.2;
            generateSphere(map, x, LOG_Y, 0, radius, COLORS.DARK);
            if (x === -6 || x === 6) generateSphere(map, x, LOG_Y, 0, radius - 0.5, COLORS.WOOD);
            if (Math.random() > 0.8) setBlock(map, x, LOG_Y + radius, (Math.random() - 0.5) * 2, COLORS.GREEN);
        }
        // Body
        const BY = LOG_Y + 2.5;
        generateSphere(map, RX - 1.5, BY + 1.5, RZ - 1.5, 1.8, COLORS.WHITE);
        generateSphere(map, RX + 1.5, BY + 1.5, RZ - 1.5, 1.8, COLORS.WHITE);
        generateSphere(map, RX, BY + 2, RZ, 2.2, COLORS.WHITE, 0.8);
        generateSphere(map, RX, BY + 2.5, RZ + 1.5, 1.5, COLORS.WHITE);
        setBlock(map, RX - 1.2, BY, RZ + 2.2, COLORS.LIGHT); setBlock(map, RX + 1.2, BY, RZ + 2.2, COLORS.LIGHT);
        setBlock(map, RX - 2.2, BY, RZ - 0.5, COLORS.WHITE); setBlock(map, RX + 2.2, BY, RZ - 0.5, COLORS.WHITE);
        generateSphere(map, RX, BY + 1.5, RZ - 2.5, 1.0, COLORS.WHITE);
        // Head
        const HY = BY + 4.5; const HZ = RZ + 1;
        generateSphere(map, RX, HY, HZ, 1.7, COLORS.WHITE);
        generateSphere(map, RX - 1.1, HY - 0.5, HZ + 0.5, 1.0, COLORS.WHITE);
        generateSphere(map, RX + 1.1, HY - 0.5, HZ + 0.5, 1.0, COLORS.WHITE);
        // Ears
        for (let y = 0; y < 5; y++) {
            const curve = y * 0.2;
            setBlock(map, RX - 0.8, HY + 1.5 + y, HZ - curve, COLORS.WHITE); setBlock(map, RX - 1.2, HY + 1.5 + y, HZ - curve, COLORS.WHITE);
            setBlock(map, RX - 1.0, HY + 1.5 + y, HZ - curve + 0.5, COLORS.LIGHT);
            setBlock(map, RX + 0.8, HY + 1.5 + y, HZ - curve, COLORS.WHITE); setBlock(map, RX + 1.2, HY + 1.5 + y, HZ - curve, COLORS.WHITE);
            setBlock(map, RX + 1.0, HY + 1.5 + y, HZ - curve + 0.5, COLORS.LIGHT);
        }
        setBlock(map, RX - 0.8, HY + 0.2, HZ + 1.5, COLORS.BLACK); setBlock(map, RX + 0.8, HY + 0.2, HZ + 1.5, COLORS.BLACK);
        setBlock(map, RX, HY - 0.5, HZ + 1.8, COLORS.TALON);
        return Array.from(map.values());
    },

    Twins: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        function buildMiniEagle(offsetX: number, offsetZ: number, mirror: boolean) {
            // Branch
            for (let x = -5; x < 5; x++) {
                const y = Math.sin(x * 0.4) * 0.5;
                generateSphere(map, offsetX + x, y, offsetZ, 1.2, COLORS.WOOD);
                if (Math.random() > 0.8) generateSphere(map, offsetX + x, y + 1, offsetZ, 1, COLORS.GREEN);
            }
            const EX = offsetX, EY = 1.5, EZ = offsetZ;
            generateSphere(map, EX, EY + 4, EZ, 3.0, COLORS.DARK, 1.4);
            for (let x = EX - 1; x <= EX + 1; x++) for (let y = EY + 2; y <= EY + 6; y++) setBlock(map, x, y, EZ + 2, COLORS.LIGHT);
            for (let x = EX - 1; x <= EX + 1; x++) for (let y = EY + 2; y <= EY + 3; y++) setBlock(map, x, y, EZ - 3, COLORS.WHITE);
            for (let y = EY + 2; y <= EY + 6; y++) for (let z = EZ - 1; z <= EZ + 2; z++) { setBlock(map, EX - 3, y, z, COLORS.DARK); setBlock(map, EX + 3, y, z, COLORS.DARK); }
            const HY = EY + 8, HZ = EZ + 1;
            generateSphere(map, EX, HY, HZ, 2.0, COLORS.WHITE);
            setBlock(map, EX, HY, HZ + 2, COLORS.GOLD); setBlock(map, EX, HY - 0.5, HZ + 2, COLORS.GOLD);
            setBlock(map, EX - 1, HY + 0.5, HZ + 1, COLORS.BLACK); setBlock(map, EX + 1, HY + 0.5, HZ + 1, COLORS.BLACK);
            setBlock(map, EX - 1, EY, EZ, COLORS.TALON); setBlock(map, EX + 1, EY, EZ, COLORS.TALON);
        }
        buildMiniEagle(-10, 2, false);
        buildMiniEagle(10, -2, true);
        return Array.from(map.values());
    },

    UFO: (): VoxelData[] => {
      return Generators.AnimatedUFO().data;
    },

    // --- ANIMATED PRESETS ---

    AnimatedEagle: (): SavedModel => {
      const base = Generators.Eagle();
      const frames = proceduralAnimate(base, 'fly', 6);
      return {
        name: 'Flapping Eagle',
        data: frames[0],
        frames,
        fps: 6,
        isAnimated: true
      };
    },

    AnimatedCat: (): SavedModel => {
      const base = Generators.Cat();
      const frames = proceduralAnimate(base, 'walk', 6);
      return {
        name: 'Walking Cat',
        data: frames[0],
        frames,
        fps: 6,
        isAnimated: true
      };
    },

    AnimatedHeart: (): SavedModel => {
      const frames: VoxelData[][] = [];
      const numFrames = 6;
      
      for (let f = 0; f < numFrames; f++) {
        const map = new Map<string, VoxelData>();
        const phase = (f / numFrames) * Math.PI * 2;
        const pulse = 1.0 + Math.sin(phase) * 0.18; // Heart beat pulse

        // 3D Heart Shape equation
        for (let x = -6; x <= 6; x += 1) {
          for (let y = -6; y <= 6; y += 1) {
            for (let z = -4; z <= 4; z += 1) {
              const nx = x / (3.2 * pulse);
              const ny = y / (3.2 * pulse);
              const nz = z / (2.2 * pulse);

              const a = nx * nx + (9/4) * ny * ny + nz * nz - 1;
              if (a * a * a - nx * nx * nz * nz * nz - (9/80) * ny * ny * nz * nz * nz <= 0) {
                // Heart color gradient: core deep crimson, outer bright pink/magenta
                const dist = Math.sqrt(x*x + y*y + z*z);
                let col = 0xE60033; // Crimson
                if (dist < 2) col = 0xFFD700; // Glowing gold core
                else if (dist > 4) col = 0xFF3388; // Pink edge
                setBlock(map, x, y + 4, z, col);
              }
            }
          }
        }

        // Orbiting energy crystal voxels
        const numEmbers = 12;
        for (let i = 0; i < numEmbers; i++) {
          const orbitAngle = phase + (i / numEmbers) * Math.PI * 2;
          const radius = 7 + Math.sin(phase * 2 + i) * 1.5;
          const ox = Math.cos(orbitAngle) * radius;
          const oz = Math.sin(orbitAngle) * radius;
          const oy = 4 + Math.sin(orbitAngle * 2) * 2;
          const emberColor = i % 2 === 0 ? 0x00E5FF : 0xFFD700;
          setBlock(map, ox, oy, oz, emberColor);
        }

        frames.push(Array.from(map.values()));
      }

      return {
        name: 'Pulsing Crystal Heart',
        data: frames[0],
        frames,
        fps: 8,
        isAnimated: true
      };
    },

    AnimatedUFO: (): SavedModel => {
      const frames: VoxelData[][] = [];
      const numFrames = 6;

      for (let f = 0; f < numFrames; f++) {
        const map = new Map<string, VoxelData>();
        const phase = (f / numFrames) * Math.PI * 2;
        const floatY = Math.sin(phase) * 1.2 + 6;

        // Saucer Central Dome (Glass/Cyan)
        generateSphere(map, 0, floatY + 2.5, 0, 3.0, 0x00F0FF, 0.8);

        // Saucer Main Disk (Metallic Slate)
        generateSphere(map, 0, floatY, 0, 7.5, 0x4B5563, 0.3);

        // Perimeter Spinning LED Lights
        const numLights = 8;
        for (let i = 0; i < numLights; i++) {
          const angle = phase + (i / numLights) * Math.PI * 2;
          const lx = Math.cos(angle) * 7.2;
          const lz = Math.sin(angle) * 7.2;
          const lightCol = (i + f) % 2 === 0 ? 0x00FF66 : 0xFF00AA;
          setBlock(map, lx, floatY - 0.2, lz, lightCol);
        }

        // Pulsing Neon Tractor Beam Below UFO
        const beamPhase = (f / numFrames);
        for (let dy = 1; dy <= 12; dy++) {
          const beamR = 1.0 + (dy * 0.35);
          const beamY = floatY - dy;
          const opacityStep = (dy + f) % 3 === 0;
          if (opacityStep) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
              const bx = Math.cos(a + phase) * beamR;
              const bz = Math.sin(a + phase) * beamR;
              setBlock(map, bx, beamY, bz, 0x00E5FF);
            }
          }
        }

        frames.push(Array.from(map.values()));
      }

      return {
        name: 'Hovering UFO',
        data: frames[0],
        frames,
        fps: 7,
        isAnimated: true
      };
    },

    AnimatedFire: (): SavedModel => {
      const frames: VoxelData[][] = [];
      const numFrames = 6;

      for (let f = 0; f < numFrames; f++) {
        const map = new Map<string, VoxelData>();
        const phase = (f / numFrames) * Math.PI * 2;
        const fy = CONFIG.FLOOR_Y + 1;

        // Wooden Logs
        for (let x = -4; x <= 4; x++) {
          setBlock(map, x, fy, 0, COLORS.WOOD);
          setBlock(map, x, fy + 1, 0, COLORS.WOOD);
          setBlock(map, 0, fy, x, COLORS.WOOD);
        }

        // Fire Core (Yellow/Orange/White)
        for (let y = 1; y <= 8; y++) {
          const r = Math.max(0.5, (9 - y) * 0.5);
          const jitterX = Math.sin(phase + y * 0.8) * (y * 0.2);
          const jitterZ = Math.cos(phase + y * 0.8) * (y * 0.2);

          let col = 0xFF1100; // Red
          if (y < 3) col = 0xFFFFFF; // White hot base
          else if (y < 5) col = 0xFFD700; // Gold/Yellow
          else if (y < 7) col = 0xFF5500; // Orange

          for (let dx = -r; dx <= r; dx += 1) {
            for (let dz = -r; dz <= r; dz += 1) {
              if (dx*dx + dz*dz <= r*r) {
                setBlock(map, jitterX + dx, fy + y, jitterZ + dz, col);
              }
            }
          }
        }

        // Dancing Sparks & Embers Rising
        for (let i = 0; i < 8; i++) {
          const sparkY = fy + 8 + ((f * 2 + i * 3) % 10);
          const sparkAngle = phase + i * 1.2;
          const sparkR = 1.2 + Math.sin(sparkY * 0.5) * 1.5;
          const sx = Math.cos(sparkAngle) * sparkR;
          const sz = Math.sin(sparkAngle) * sparkR;
          const sparkCol = i % 2 === 0 ? 0xFFD700 : 0xFF3300;
          setBlock(map, sx, sparkY, sz, sparkCol);
        }

        frames.push(Array.from(map.values()));
      }

      return {
        name: 'Dancing Campfire',
        data: frames[0],
        frames,
        fps: 8,
        isAnimated: true
      };
    }
};

