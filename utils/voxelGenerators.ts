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
    Alien: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        const AY = CONFIG.FLOOR_Y + 1; const AX = 0, AZ = 0;
        const ALIEN_GREY = 0x94a3b8;
        const ALIEN_GREY_DARK = 0x64748b;
        const EYE_BLACK = 0x020617;
        const EYE_GLOW = 0x38bdf8;
        const SUIT_DARK = 0x1e293b;
        const RAY_GREEN = 0xa3e635;

        // Feet & Boots
        generateSphere(map, AX - 1.5, AY + 0.5, AZ, 1.2, SUIT_DARK);
        generateSphere(map, AX + 1.5, AY + 0.5, AZ, 1.2, SUIT_DARK);

        // Slender Legs
        for (let y = 1; y <= 5; y++) {
            setBlock(map, AX - 1.2, AY + y, AZ, ALIEN_GREY);
            setBlock(map, AX - 1.2, AY + y, AZ + 0.5, ALIEN_GREY);
            setBlock(map, AX + 1.2, AY + y, AZ, ALIEN_GREY);
            setBlock(map, AX + 1.2, AY + y, AZ + 0.5, ALIEN_GREY);
        }

        // Torso / Body (Space Suit with glowing green chest reactor)
        for (let y = 6; y <= 12; y++) {
            const r = 2.2 - (y - 6) * 0.15;
            generateSphere(map, AX, AY + y, AZ, r, ALIEN_GREY);
            setBlock(map, AX, AY + y, AZ + 1.5, RAY_GREEN);
        }

        // Arms & Ray Blaster
        for (let y = 8; y <= 11; y++) {
            setBlock(map, AX - 2.2, AY + y, AZ, ALIEN_GREY);
            setBlock(map, AX + 2.2, AY + y, AZ, ALIEN_GREY);
        }
        // Blaster in right hand
        setBlock(map, AX + 2.5, AY + 8, AZ + 1, SUIT_DARK);
        setBlock(map, AX + 2.5, AY + 8, AZ + 2, RAY_GREEN);

        // Neck
        setBlock(map, AX, AY + 13, AZ, ALIEN_GREY_DARK);
        setBlock(map, AX, AY + 14, AZ, ALIEN_GREY);

        // Massive Iconic Gray Alien Oval Head
        const HEAD_Y = AY + 18;
        generateSphere(map, AX, HEAD_Y, AZ, 3.8, ALIEN_GREY, 1.2);
        generateSphere(map, AX, HEAD_Y + 1.5, AZ, 4.2, ALIEN_GREY, 0.9);

        // Large Black Almond Eyes
        // Left Eye
        setBlock(map, AX - 1.8, HEAD_Y, AZ + 3.2, EYE_BLACK);
        setBlock(map, AX - 1.5, HEAD_Y + 0.8, AZ + 3.2, EYE_BLACK);
        setBlock(map, AX - 2.2, HEAD_Y - 0.8, AZ + 3.0, EYE_BLACK);
        setBlock(map, AX - 1.5, HEAD_Y + 0.5, AZ + 3.3, EYE_GLOW);

        // Right Eye
        setBlock(map, AX + 1.8, HEAD_Y, AZ + 3.2, EYE_BLACK);
        setBlock(map, AX + 1.5, HEAD_Y + 0.8, AZ + 3.2, EYE_BLACK);
        setBlock(map, AX + 2.2, HEAD_Y - 0.8, AZ + 3.0, EYE_BLACK);
        setBlock(map, AX + 1.5, HEAD_Y + 0.5, AZ + 3.3, EYE_GLOW);

        // Small Slit Nostrils
        setBlock(map, AX - 0.3, HEAD_Y - 1.5, AZ + 3.5, ALIEN_GREY_DARK);
        setBlock(map, AX + 0.3, HEAD_Y - 1.5, AZ + 3.5, ALIEN_GREY_DARK);

        return Array.from(map.values());
    },

    UFO: (): VoxelData[] => {
      return Generators.AnimatedUFO().data;
    },

    // --- ANIMATED PRESETS ---

    AnimatedAlien: (): SavedModel => {
      const base = Generators.Alien();
      const frames = proceduralAnimate(base, 'walk', 6);
      return {
        name: 'Walking Alien',
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

