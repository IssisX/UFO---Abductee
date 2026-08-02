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

        // PROPORTIONAL SLEEK EXTRATERRESTRIAL (Height: ~42 voxels)
        
        // 1. Sleek Boots & Feet (y: 1 to 3)
        generateSphere(map, AX - 2.8, AY + 1.5, AZ + 0.5, 2.2, SUIT_DARK);
        generateSphere(map, AX + 2.8, AY + 1.5, AZ + 0.5, 2.2, SUIT_DARK);

        // 2. Slender Long Legs (y: 3 to 13)
        for (let y = 3; y <= 13; y++) {
            generateSphere(map, AX - 2.8, AY + y, AZ, 1.4, ALIEN_GREY);
            generateSphere(map, AX + 2.8, AY + y, AZ, 1.4, ALIEN_GREY);
        }

        // 3. Tapered Sleek Torso (y: 14 to 28)
        for (let y = 14; y <= 28; y++) {
            // Waist at y=14 is r=3.2, Chest at y=24 is r=4.5, Shoulders at y=28 is r=4.8
            const t = (y - 14) / 14;
            const r = 3.2 + Math.sin(t * Math.PI) * 1.6;
            generateSphere(map, AX, AY + y, AZ, r, ALIEN_GREY);
        }
        
        // Glowing Bio-Core Reactor on chest
        generateSphere(map, AX, AY + 23, AZ + 3.6, 2.0, RAY_GREEN);

        // 4. Slender Articulated Arms & Quantum Blaster
        // Left Arm (y: 18 to 28, x: -5.5)
        for (let y = 18; y <= 28; y++) {
            generateSphere(map, AX - 5.5, AY + y, AZ, 1.3, ALIEN_GREY);
        }
        // Right Arm (y: 18 to 28, x: +5.5)
        for (let y = 18; y <= 28; y++) {
            generateSphere(map, AX + 5.5, AY + y, AZ, 1.3, ALIEN_GREY);
        }

        // Plasma Blaster in Right Hand
        generateSphere(map, AX + 6.0, AY + 18, AZ + 2.5, 2.2, SUIT_DARK);
        generateSphere(map, AX + 6.0, AY + 18, AZ + 5.0, 1.6, RAY_GREEN);
        setBlock(map, AX + 6.0, AY + 18, AZ + 7.0, EYE_GLOW);

        // 5. Elongated Neck (y: 29 to 31)
        for (let y = 29; y <= 31; y++) {
            generateSphere(map, AX, AY + y, AZ, 1.6, ALIEN_GREY_DARK);
        }

        // 6. Sleek Aerodynamic Alien Head (y: 32 to 42, Sleek & Proportional!)
        const HEAD_Y = AY + 36;
        // Oval chin & cheeks
        generateSphere(map, AX, HEAD_Y - 2, AZ + 1.0, 3.2, ALIEN_GREY, 1.1);
        // Main skull dome (slightly extended to back for alien cranium shape)
        generateSphere(map, AX, HEAD_Y + 1, AZ - 0.5, 4.6, ALIEN_GREY, 0.95);
        generateSphere(map, AX, HEAD_Y + 4, AZ - 1.2, 4.2, ALIEN_GREY, 0.85);

        // Slanted Glossy Black Almond Eyes (Sleek & Iconic)
        // Left Eye
        generateSphere(map, AX - 2.2, HEAD_Y, AZ + 3.2, 1.8, EYE_BLACK, 1.3);
        setBlock(map, AX - 1.8, HEAD_Y + 0.8, AZ + 4.2, EYE_GLOW);

        // Right Eye
        generateSphere(map, AX + 2.2, HEAD_Y, AZ + 3.2, 1.8, EYE_BLACK, 1.3);
        setBlock(map, AX + 1.8, HEAD_Y + 0.8, AZ + 4.2, EYE_GLOW);

        // Subtle Nostrils & Small Lips
        setBlock(map, AX - 0.4, HEAD_Y - 2.5, AZ + 3.8, ALIEN_GREY_DARK);
        setBlock(map, AX + 0.4, HEAD_Y - 2.5, AZ + 3.8, ALIEN_GREY_DARK);
        setBlock(map, AX, HEAD_Y - 3.5, AZ + 3.6, EYE_BLACK);

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
        const floatY = Math.sin(phase) * 2.4 + 12;

        // Saucer Central Dome (Glass/Cyan) - doubled from 3.0 to 6.0
        generateSphere(map, 0, floatY + 5.0, 0, 6.0, 0x00F0FF, 0.8);

        // Saucer Main Disk (Metallic Slate) - doubled from 7.5 to 15.0
        generateSphere(map, 0, floatY, 0, 15.0, 0x4B5563, 0.3);

        // Perimeter Spinning LED Lights
        const numLights = 12; // increased lights for higher fidelity
        for (let i = 0; i < numLights; i++) {
          const angle = phase + (i / numLights) * Math.PI * 2;
          const lx = Math.cos(angle) * 14.4;
          const lz = Math.sin(angle) * 14.4;
          const lightCol = (i + f) % 2 === 0 ? 0x00FF66 : 0xFF00AA;
          setBlock(map, lx, floatY - 0.4, lz, lightCol);
          setBlock(map, lx, floatY - 0.4, lz + 1, lightCol);
          setBlock(map, lx + 1, floatY - 0.4, lz, lightCol);
        }

        // Pulsing Neon Tractor Beam Below UFO
        const beamPhase = (f / numFrames);
        for (let dy = 2; dy <= 24; dy+=2) {
          const beamR = 2.0 + (dy * 0.35);
          const beamY = floatY - dy;
          const opacityStep = (dy + f) % 3 === 0;
          if (opacityStep) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
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

