/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import * as THREE from 'three';

export enum AppState {
  STABLE = 'STABLE',
  DISMANTLING = 'DISMANTLING',
  REBUILDING = 'REBUILDING',
  SUPERNOVA = 'SUPERNOVA'
}

export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: number;
}

export interface SimulationVoxel {
  id: number;
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  // Physics state
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  rvx: number;
  rvy: number;
  rvz: number;
}

export interface RebuildTarget {
  x: number;
  y: number;
  z: number;
  delay: number;
  targetColor?: THREE.Color;
  isRubble?: boolean;
}

export interface SavedModel {
  name: string;
  data: VoxelData[];
  frames?: VoxelData[][];
  fps?: number;
  baseModel?: string;
  isAnimated?: boolean;
}

export interface AnimationState {
  isAnimated: boolean;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  isInterpolated: boolean;
  isLooping: boolean;
}

export type PlayerMode = 'UFO' | 'Alien' | 'Custom';

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: number;
}

export type WeaponMode = 'tractor' | 'repulsor' | 'disintegrator' | 'vortex' | 'orbital_laser';

export interface MothershipUpgrades {
  beamForce: number; // 1 to 5
  engineSpeed: number; // 1 to 5
  repulsorRadius: number; // 1 to 5
  disintegratorPower: number; // 1 to 5
  vortexRange: number; // 1 to 5
  energyCore: number; // 1 to 5
  mutagenEfficiency?: number; // 1 to 5
}

export interface CityColliderData {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface RadarBlip {
  x: number; // normalized relative to player radar range (-1 to 1)
  z: number; // normalized relative to player radar range (-1 to 1)
  type: 'crystal' | 'police' | 'car' | 'fish' | 'feather' | 'person' | 'debris' | 'jet';
  isTarget?: boolean;
}

export interface GameModeTelemetry {
  speed: number;
  altitude: number;
  posX: number;
  posY: number;
  posZ: number;
  heading?: number; // radians (rotY)
  camYaw?: number; // radians
  boostActive: boolean;
  actionActive: boolean;
  score: number;
  highScore?: number;
  energy?: number; // 0 to 100%
  comboMultiplier?: number;
  wantedLevel?: number; // 0 to 5 stars
  isCinematicCamera?: boolean;
  activeQuest?: Quest | null;
  questCompletedFlash?: string | null;
  radarBlips?: RadarBlip[];
  abductedCount?: number;
  abductionTriggerTime?: number;
  alienTestLog?: string | null;
  nearestPedestrianDist?: number | null;
  targetAlignmentState?: 'SEARCHING' | 'ALIGNING' | 'LOCK_STABLE' | 'ABDUCTING' | 'SUCCESS' | 'ALIGNMENT_LOST';
  alignmentProgress?: number; // 0 to 100%
  abductionProgress?: number; // 0 to 100%
  targetName?: string;
  alignmentWarning?: string | null;
  physicsActive?: boolean;
  debrisCount?: number;
  weaponMode?: WeaponMode;
  upgrades?: MothershipUpgrades;
  credits?: number;
  bioSpecimens?: number;
  mutantsDeployed?: number;
  interceptorJetsCount?: number;
  targetJetName?: string;
  targetJetDist?: number;
  rollAngle?: number;
  pitchAngle?: number;
  gForce?: number;
  isBarrelRolling?: boolean;
  subagentProposal?: string;
  cityColliders?: CityColliderData[];
  lastInputDevice?: 'keyboard' | 'gamepad';
}

export interface GameModeState {
  isActive: boolean;
  playerMode: PlayerMode;
  telemetry: GameModeTelemetry;
}

export type AIModelId = 'gemini-3.6-flash' | 'gemini-3.1-pro-preview';

export interface AIModelOption {
  id: AIModelId;
  name: string;
  displayName: string;
  description: string;
  badge: string;
  speed: string;
}

export const AI_MODELS: AIModelOption[] = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    displayName: 'Gemini 3.6 Flash',
    description: 'Ultra-fast & cost-efficient generation',
    badge: 'Fast & Recommended',
    speed: '⚡ Ultra Fast',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    displayName: 'Gemini 3.1 Pro',
    description: 'Advanced reasoning for complex 3D structures',
    badge: 'Pro Intelligence',
    speed: '🧠 High Reasoning',
  },
];
