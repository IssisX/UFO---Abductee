/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SynthesizedVoxel } from '../../types';
import { Pedestrian } from '../CityGenerator';

export interface ActiveRagdoll {
  mesh: THREE.Group;
  bodyParts: {
    head: THREE.Mesh;
    torso: THREE.Mesh;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
  };
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  rotVel: THREE.Vector3;
  bouncesLeft: number;
  timeAlive: number;
  recovered: boolean;
}

export interface SummonedAIObject {
  id: string;
  name: string;
  description: string;
  group: THREE.Group;
  body: CANNON.Body;
  animationType: string;
  physicsType: string;
  placementDomain?: 'ground' | 'air' | 'high_sky';
  recommendedSpawnHeightMeters?: number;
  locomotionType?: 'walk' | 'flight' | 'hover_drift' | 'stationary';
  baseSpeed?: number;
  abilities?: string[];
  canBePossessed?: boolean;
  styleScheme?: string;
  energyOutput?: string;
  massKg?: number;
  threatLevel?: string;
  composition?: any[];
  voxels: SynthesizedVoxel[];
  creationTime: number;
  pointLight?: THREE.PointLight;
}

export interface PossessedObject {
  id: string;
  name: string;
  description: string;
  placementDomain: 'ground' | 'air' | 'high_sky';
  locomotionType: 'walk' | 'flight' | 'hover_drift' | 'stationary';
  baseSpeed: number;
  abilities: string[];
  voxels: SynthesizedVoxel[];
  energyOutput?: string;
  massKg?: number;
}

export interface PoliceChaser {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  sirenLight: THREE.PointLight;
}

export interface DebrisObject {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}
