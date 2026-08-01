/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VoxelData } from '../types';
import { CONFIG } from '../utils/voxelConstants';

export interface TrafficCar {
  mesh: THREE.Group;
  speed: number;
  dirX: number;
  dirZ: number;
  minBound: number;
  maxBound: number;
  colorHex: number;
}

export interface FlyingBird {
  mesh: THREE.Group;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
  speed: number;
  angle: number;
  height: number;
}

export interface Pedestrian {
  mesh: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  axis: 'X' | 'Z';
  axisPos: number;
  minPos: number;
  maxPos: number;
  speed: number;
  sign: number;
  isPanicked?: boolean;
  panicTimer?: number;
  panicDirX?: number;
  panicDirZ?: number;
}

export interface CollectibleItem {
  mesh: THREE.Mesh | THREE.Group;
  pos: THREE.Vector3;
  type: 'crystal' | 'fish' | 'catnip' | 'feather' | 'thermal_ring' | 'bounce_pad' | 'nest' | 'trash_can';
}

export interface CityConfig {
  seed?: number;
  gridSize?: number;
  blockSize?: number;
  roadWidth?: number;
  buildingHeightRange?: [number, number];
  windowLightDensity?: number;
  propDensity?: number;
}

export type DistrictType = 'COMMERCIAL' | 'DOWNTOWN' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'CIVIC_PARK';

export interface CityWorld {
  cityGroup: THREE.Group;
  colliders: { x: number; z: number; width: number; depth: number; height: number }[];
  collectibleVoxels: CollectibleItem[];
  trafficCars: TrafficCar[];
  birds: FlyingBird[];
  pedestrians: Pedestrian[];
  fountainMesh: THREE.InstancedMesh | null;
  seed: number;
  dispose: () => void;
}

export class CityGenerator {
  /**
   * Generates a 3D Voxel City Group using deterministic PRNG seed and District variation
   */
  public static generateVoxelCity(config?: CityConfig): CityWorld {
    const seed = config?.seed ?? 42891;
    
    // Mulberry32 PRNG for deterministic seed regeneration
    let seedState = seed;
    function random(): number {
      let t = (seedState += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    const cityGroup = new THREE.Group();
    cityGroup.name = "VoxelCityGroup";

    const colliders: { x: number; z: number; width: number; depth: number; height: number }[] = [];
    const collectibleVoxels: CollectibleItem[] = [];
    const trafficCars: TrafficCar[] = [];
    const birds: FlyingBird[] = [];
    const pedestrians: Pedestrian[] = [];

    // City Dimensions
    const gridSize = config?.gridSize ?? 9; // 9x9 block grid
    const blockSize = config?.blockSize ?? 28; // width of each block
    const roadWidth = config?.roadWidth ?? 10; // width of roads
    const halfCity = (gridSize * blockSize + (gridSize + 1) * roadWidth) / 2;

    const materialsMap = new Map<number, THREE.MeshStandardMaterial>();
    function getMaterial(colorHex: number, emissive = false): THREE.MeshStandardMaterial {
      if (!materialsMap.has(colorHex)) {
        materialsMap.set(colorHex, new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: emissive ? 0.2 : 0.65,
          metalness: emissive ? 0.8 : 0.15,
          emissive: emissive ? colorHex : 0x000000,
          emissiveIntensity: emissive ? 0.85 : 0.0
        }));
      }
      return materialsMap.get(colorHex)!;
    }

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const voxelInstancedMap = new Map<number, { pos: THREE.Vector3[]; scale: THREE.Vector3[] }>();

    function addVoxel(x: number, y: number, z: number, color: number, sx = 1, sy = 1, sz = 1) {
      if (!voxelInstancedMap.has(color)) {
        voxelInstancedMap.set(color, { pos: [], scale: [] });
      }
      const item = voxelInstancedMap.get(color)!;
      item.pos.push(new THREE.Vector3(x, y, z));
      item.scale.push(new THREE.Vector3(sx, sy, sz));
    }

    // --- Helpers for Collectible Props ---
    const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
    const crystalMat = getMaterial(0x00f0ff, true);
    
    function createCollectible(pos: THREE.Vector3, type: CollectibleItem['type'] = 'crystal') {
      let mesh: THREE.Mesh | THREE.Group;

      if (type === 'fish') {
        // Golden Fish Treat
        const fishGroup = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.2), getMaterial(0xf59e0b, true));
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 4), getMaterial(0xfbbf24, true));
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0, -0.7);
        fishGroup.add(body, tail);
        fishGroup.position.copy(pos);
        mesh = fishGroup;
      } else if (type === 'catnip') {
        // Glowing Green Catnip Bush
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7), getMaterial(0x10b981, true));
        mesh.position.copy(pos);
      } else if (type === 'feather') {
        // Golden Eagle Feather
        const featherGroup = new THREE.Group();
        const fMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.4), getMaterial(0xfacc15, true));
        featherGroup.add(fMesh);
        featherGroup.position.copy(pos);
        mesh = featherGroup;
      } else if (type === 'thermal_ring') {
        // Glowing Sky Thermal Ring for Eagle
        mesh = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.4, 8, 16), getMaterial(0x38bdf8, true));
        mesh.rotation.x = Math.PI / 2;
        mesh.position.copy(pos);
      } else if (type === 'bounce_pad') {
        // Rooftop/Park Parkour Spring Pad for Cat
        const padGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 2.5), getMaterial(0xec4899, true));
        const center = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.5, 8), getMaterial(0xf43f5e, true));
        center.position.y = 0.3;
        padGroup.add(base, center);
        padGroup.position.copy(pos);
        mesh = padGroup;
      } else if (type === 'trash_can') {
        // Sidewalk Alley Trash Can
        const trashGroup = new THREE.Group();
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.4, 8), getMaterial(0x64748b));
        can.position.y = 0.7;
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 8), getMaterial(0x475569));
        lid.position.y = 1.4;
        trashGroup.add(can, lid);
        trashGroup.position.copy(pos);
        mesh = trashGroup;
      } else {
        // Cyber Crystal
        mesh = new THREE.Mesh(crystalGeo, crystalMat);
        mesh.position.copy(pos);
      }

      cityGroup.add(mesh);
      collectibleVoxels.push({ mesh, pos, type });
    }

    // --- 1. Base City Ground & Asphalt Roads ---
    const groundY = CONFIG.FLOOR_Y;
    
    // Large Dark City Base
    const cityBaseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(halfCity * 2 + 20, 1, halfCity * 2 + 20), cityBaseMat);
    baseMesh.position.set(0, groundY - 0.5, 0);
    baseMesh.receiveShadow = true;
    cityGroup.add(baseMesh);

    // --- 2. Build City Grid Blocks ---
    const startOffset = -halfCity + roadWidth / 2 + blockSize / 2;

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const bx = startOffset + gx * (blockSize + roadWidth);
        const bz = startOffset + gz * (blockSize + roadWidth);

        // Determine District Type based on grid coordinate
        const mid = Math.floor(gridSize / 2);
        const distFromCenter = Math.max(Math.abs(gx - mid), Math.abs(gz - mid));
        const isCorner = (gx === 0 || gx === gridSize - 1) && (gz === 0 || gz === gridSize - 1);

        let district: DistrictType = 'DOWNTOWN';
        if (gx === mid && gz === mid) {
          district = 'CIVIC_PARK';
        } else if (isCorner) {
          district = 'INDUSTRIAL';
        } else if (distFromCenter <= 1) {
          district = 'COMMERCIAL';
        } else if (distFromCenter === 2) {
          district = 'DOWNTOWN';
        } else {
          district = 'RESIDENTIAL';
        }

        // Central Park in middle block
        if (district === 'CIVIC_PARK') {
          // Park Grass
          const grassMat = getMaterial(0x16a34a);
          const grass = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 0.4, blockSize), grassMat);
          grass.position.set(bx, groundY + 0.2, bz);
          grass.receiveShadow = true;
          cityGroup.add(grass);

          // Park Fountain in Center
          const fountainMat = getMaterial(0x0284c7, true);
          const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 1.4, 12), fountainMat);
          fountain.position.set(bx, groundY + 0.9, bz);
          cityGroup.add(fountain);

          // Park Trees & Benches
          const treePositions = [
            { x: bx - 8, z: bz - 8 },
            { x: bx + 8, z: bz - 8 },
            { x: bx - 8, z: bz + 8 },
            { x: bx + 8, z: bz + 8 },
            { x: bx - 10, z: bz },
            { x: bx + 10, z: bz }
          ];

          treePositions.forEach(tp => {
            // Trunk
            addVoxel(tp.x, groundY + 2.5, tp.z, 0x78350f, 1.2, 4, 1.2);
            // Foliage
            addVoxel(tp.x, groundY + 6, tp.z, 0x15803d, 4, 4, 4);
            addVoxel(tp.x, groundY + 8, tp.z, 0x22c55e, 2.8, 2.5, 2.8);
          });

          // Floating collectibles in Central Park
          createCollectible(new THREE.Vector3(bx, groundY + 3.5, bz), 'crystal');
          createCollectible(new THREE.Vector3(bx - 6, groundY + 1.2, bz - 6), 'fish');
          createCollectible(new THREE.Vector3(bx + 6, groundY + 1.2, bz + 6), 'catnip');
          createCollectible(new THREE.Vector3(bx - 10, groundY + 0.4, bz + 10), 'bounce_pad');
          createCollectible(new THREE.Vector3(bx + 10, groundY + 0.4, bz - 10), 'trash_can');
          continue;
        }

        // Sidewalk Base for Building Block
        const sidewalkColor = district === 'COMMERCIAL' ? 0x475569 : district === 'INDUSTRIAL' ? 0x334155 : 0x64748b;
        const sidewalkMat = getMaterial(sidewalkColor);
        const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 0.4, blockSize), sidewalkMat);
        sidewalk.position.set(bx, groundY + 0.2, bz);
        sidewalk.receiveShadow = true;
        cityGroup.add(sidewalk);

        // Building Height & Style by District
        let height = 20;
        let bodyColor = 0x334155;
        let windowColor = 0xfcd34d;

        if (district === 'COMMERCIAL') {
          height = 42 + random() * 32;
          bodyColor = random() > 0.5 ? 0x0f172a : 0x1e1b4b;
          windowColor = random() > 0.4 ? 0x00f0ff : 0xf472b6;
        } else if (district === 'DOWNTOWN') {
          height = 26 + random() * 24;
          bodyColor = random() > 0.5 ? 0x1e293b : 0x334155;
          windowColor = random() > 0.5 ? 0xfcd34d : 0x38bdf8;
        } else if (district === 'RESIDENTIAL') {
          height = 14 + random() * 14;
          bodyColor = random() > 0.5 ? 0x475569 : 0x3f3f46;
          windowColor = 0xfbbf24;
        } else {
          // INDUSTRIAL
          height = 10 + random() * 12;
          bodyColor = 0x27272a;
          windowColor = 0x22c55e;
        }

        const bWidth = blockSize - 4;
        const bDepth = blockSize - 4;
        const bY = groundY + height / 2 + 0.4;

        // Main Building Structure
        const bMat = getMaterial(bodyColor);
        const buildingMesh = new THREE.Mesh(new THREE.BoxGeometry(bWidth, height, bDepth), bMat);
        buildingMesh.position.set(bx, bY, bz);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        cityGroup.add(buildingMesh);

        // Add to colliders
        colliders.push({
          x: bx,
          z: bz,
          width: bWidth,
          depth: bDepth,
          height: height + 0.4
        });

        // Glowing Windows Grid
        const winRows = Math.floor(height / 4);
        
        for (let r = 1; r < winRows; r++) {
          const wy = groundY + r * 4;
          for (let c = -1; c <= 1; c++) {
            // Front & Back Windows
            const fx = bx + c * (bWidth / 4);
            addVoxel(fx, wy, bz + bDepth / 2 + 0.1, windowColor, 1.8, 1.8, 0.2);
            addVoxel(fx, wy, bz - bDepth / 2 - 0.1, windowColor, 1.8, 1.8, 0.2);
            // Left & Right Windows
            const fz = bz + c * (bDepth / 4);
            addVoxel(bx + bWidth / 2 + 0.1, wy, fz, windowColor, 0.2, 1.8, 1.8);
            addVoxel(bx - bWidth / 2 - 0.1, wy, fz, windowColor, 0.2, 1.8, 1.8);
          }
        }

        // Rooftop Structures, Collectibles & Props
        const roofY = groundY + height + 0.4;
        
        if (district === 'COMMERCIAL') {
          // Helipad with glowing red H or Antenna
          if (random() > 0.4) {
            addVoxel(bx, roofY + 0.2, bz, 0xef4444, 8, 0.2, 8);
            addVoxel(bx, roofY + 0.3, bz, 0xffffff, 4, 0.2, 1);
            addVoxel(bx, roofY + 6, bz, 0x00f0ff, 0.4, 12, 0.4); // Radio spire
            createCollectible(new THREE.Vector3(bx, roofY + 2, bz), 'crystal');
          } else {
            createCollectible(new THREE.Vector3(bx, roofY + 1.5, bz), 'feather');
            createCollectible(new THREE.Vector3(bx + 3, roofY + 0.2, bz + 3), 'bounce_pad');
          }
        } else if (district === 'DOWNTOWN') {
          // Water Tower or HVAC Box
          addVoxel(bx - 3, roofY + 2.0, bz - 3, 0x78350f, 2.5, 3.5, 2.5); // Water tank
          createCollectible(new THREE.Vector3(bx + 2, roofY + 0.2, bz + 2), 'bounce_pad');
          createCollectible(new THREE.Vector3(bx, roofY + 1.0, bz), 'fish');
        } else {
          // Residential / Industrial
          createCollectible(new THREE.Vector3(bx, roofY + 0.2, bz), 'bounce_pad');
          if (random() > 0.5) createCollectible(new THREE.Vector3(bx - 3, roofY + 1.0, bz - 3), 'catnip');
        }

        // High Sky Thermal Rings & Feathers overhead
        if (random() > 0.5) {
          createCollectible(new THREE.Vector3(bx, roofY + 12 + random() * 15, bz), 'thermal_ring');
          createCollectible(new THREE.Vector3(bx + 12, roofY + 8 + random() * 10, bz + 12), 'feather');
        }

        // Sidewalk Fish treats and Trash cans
        if (random() > 0.4) {
          createCollectible(new THREE.Vector3(bx - bWidth / 2 - 1.5, groundY + 0.6, bz), 'fish');
        }
        if (random() > 0.4) {
          createCollectible(new THREE.Vector3(bx + bWidth / 2 + 1.5, groundY + 0.4, bz + 4), 'trash_can');
        }

        // Street Lights along block edges
        const lightOffsets = [
          { x: bx - blockSize / 2 + 1, z: bz - blockSize / 2 + 1 },
          { x: bx + blockSize / 2 - 1, z: bz - blockSize / 2 + 1 },
          { x: bx - blockSize / 2 + 1, z: bz + blockSize / 2 - 1 },
          { x: bx + blockSize / 2 - 1, z: bz + blockSize / 2 - 1 }
        ];

        lightOffsets.forEach(lo => {
          // Pole
          addVoxel(lo.x, groundY + 2.5, lo.z, 0x475569, 0.3, 4.5, 0.3);
          // Lamp Glow
          const lampColor = district === 'COMMERCIAL' ? 0x00f0ff : district === 'RESIDENTIAL' ? 0xfbbf24 : 0x38bdf8;
          addVoxel(lo.x, groundY + 5, lo.z, lampColor, 0.8, 0.8, 0.8);
        });

        // Sidewalk Pedestrians
        const pedCount = Math.floor(random() * 2) + 1;
        for (let p = 0; p < pedCount; p++) {
          const pedGroup = new THREE.Group();
          const pMat = getMaterial(random() > 0.5 ? 0x38bdf8 : 0xf43f5e);
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), pMat);
          body.position.y = 0.7;
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), getMaterial(0xfde047));
          head.position.y = 1.7;
          const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), getMaterial(0x1e293b));
          legL.position.set(-0.2, -0.4, 0);
          const legR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), getMaterial(0x1e293b));
          legR.position.set(0.2, -0.4, 0);
          pedGroup.add(body, head, legL, legR);

          const isAlongX = random() > 0.5;
          const px = isAlongX ? bx + (random() - 0.5) * (blockSize - 4) : bx + (blockSize / 2 - 1);
          const pz = isAlongX ? bz + (blockSize / 2 - 1) : bz + (random() - 0.5) * (blockSize - 4);
          pedGroup.position.set(px, groundY + 0.4, pz);
          cityGroup.add(pedGroup);

          pedestrians.push({
            mesh: pedGroup,
            legL, legR,
            axis: isAlongX ? 'X' : 'Z',
            axisPos: isAlongX ? pz : px,
            minPos: (isAlongX ? bx : bz) - blockSize / 2 + 2,
            maxPos: (isAlongX ? bx : bz) + blockSize / 2 - 2,
            speed: 0.08 + random() * 0.04,
            sign: random() > 0.5 ? 1 : -1
          });
        }
      }
    }

    // --- 3. Roads, Lane Markings & Crosswalks ---
    const roadLanes: { pos: number; axis: 'X' | 'Z' }[] = [];

    for (let i = 0; i <= gridSize; i++) {
      const pos = startOffset - blockSize / 2 - roadWidth / 2 + i * (blockSize + roadWidth);
      roadLanes.push({ pos, axis: 'X' });
      roadLanes.push({ pos, axis: 'Z' });

      // Main Road Avenues (East-West)
      const roadEW = new THREE.Mesh(
        new THREE.BoxGeometry(halfCity * 2 + 10, 0.2, roadWidth),
        getMaterial(0x1e293b)
      );
      roadEW.position.set(0, groundY + 0.1, pos);
      roadEW.receiveShadow = true;
      cityGroup.add(roadEW);

      // Main Road Avenues (North-South)
      const roadNS = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, 0.2, halfCity * 2 + 10),
        getMaterial(0x1e293b)
      );
      roadNS.position.set(pos, groundY + 0.1, 0);
      roadNS.receiveShadow = true;
      cityGroup.add(roadNS);

      // Double Yellow Center Lines & White Dashes
      for (let d = -halfCity; d <= halfCity; d += 6) {
        addVoxel(d, groundY + 0.22, pos, 0xfcd34d, 3, 0.05, 0.4);
        addVoxel(pos, groundY + 0.22, d, 0xfcd34d, 0.4, 0.05, 3);
      }
    }

    // --- 4. Dynamic Moving Traffic Voxel Cars ---
    const carColors = [0xef4444, 0x3b82f6, 0xeab308, 0x10b981, 0xa855f7, 0x00f0ff, 0xf97316];
    
    // Spawn 30 Traffic Cars driving along road lanes
    for (let c = 0; c < 30; c++) {
      const lane = roadLanes[c % roadLanes.length];
      const carGroup = new THREE.Group();
      const carColor = carColors[c % carColors.length];

      // Car Body
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 4.2), getMaterial(carColor));
      bodyMesh.position.y = 0.6;
      const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 2.4), getMaterial(0x0f172a));
      cabinMesh.position.set(0, 1.3, -0.2);

      // Headlights (Glowing)
      const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), getMaterial(0xfef08a, true));
      headlightL.position.set(-0.8, 0.6, 2.15);
      const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), getMaterial(0xfef08a, true));
      headlightR.position.set(0.8, 0.6, 2.15);

      // Taillights
      const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), getMaterial(0xef4444, true));
      taillightL.position.set(-0.8, 0.6, -2.15);
      const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), getMaterial(0xef4444, true));
      taillightR.position.set(0.8, 0.6, -2.15);

      carGroup.add(bodyMesh, cabinMesh, headlightL, headlightR, taillightL, taillightR);

      // Lane offset (Drive on right side of road lane)
      const laneOffset = (c % 2 === 0 ? 2.5 : -2.5);
      const startPos = (Math.random() - 0.5) * (halfCity * 1.8);

      if (lane.axis === 'X') {
        // Driving East-West along Z = lane.pos
        carGroup.position.set(startPos, groundY + 0.3, lane.pos + laneOffset);
        carGroup.rotation.y = c % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
        trafficCars.push({
          mesh: carGroup,
          speed: 0.35 + Math.random() * 0.25,
          dirX: c % 2 === 0 ? 1 : -1,
          dirZ: 0,
          minBound: -halfCity - 10,
          maxBound: halfCity + 10,
          colorHex: carColor
        });
      } else {
        // Driving North-South along X = lane.pos
        carGroup.position.set(lane.pos + laneOffset, groundY + 0.3, startPos);
        carGroup.rotation.y = c % 2 === 0 ? 0 : Math.PI;
        trafficCars.push({
          mesh: carGroup,
          speed: 0.35 + Math.random() * 0.25,
          dirX: 0,
          dirZ: c % 2 === 0 ? 1 : -1,
          minBound: -halfCity - 10,
          maxBound: halfCity + 10,
          colorHex: carColor
        });
      }

      cityGroup.add(carGroup);
    }

    // --- 5. Flying Animated Voxel Birds Overhead ---
    for (let b = 0; b < 6; b++) {
      const birdGroup = new THREE.Group();
      const bMat = getMaterial(0x38bdf8);
      const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.4), bMat);
      
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.8), getMaterial(0x0284c7));
      wingL.position.set(-1.0, 0, 0);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.8), getMaterial(0x0284c7));
      wingR.position.set(1.0, 0, 0);

      birdGroup.add(bBody, wingL, wingR);
      cityGroup.add(birdGroup);

      birds.push({
        mesh: birdGroup,
        wingLeft: wingL,
        wingRight: wingR,
        center: new THREE.Vector3((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80),
        radius: 25 + Math.random() * 35,
        speed: 0.015 + Math.random() * 0.01,
        angle: Math.random() * Math.PI * 2,
        height: 35 + Math.random() * 25
      });
    }

    // --- 6. Build Instanced Voxels for Static City Decor ---
    voxelInstancedMap.forEach((data, colorHex) => {
      const mat = getMaterial(colorHex, colorHex === 0x00f0ff || colorHex === 0xef4444);
      const instMesh = new THREE.InstancedMesh(boxGeo, mat, data.pos.length);
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < data.pos.length; i++) {
        dummy.position.copy(data.pos[i]);
        dummy.scale.copy(data.scale[i]);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      cityGroup.add(instMesh);
    });

    return {
      cityGroup,
      colliders,
      collectibleVoxels,
      trafficCars,
      birds,
      pedestrians,
      fountainMesh: null,
      seed,
      dispose: () => {
        cityGroup.traverse(child => {
          if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
        materialsMap.clear();
      }
    };
  }
}

