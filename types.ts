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

export type PlayerMode = 'UFO' | 'Cat' | 'Eagle' | 'Custom';

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: number;
}

export interface RadarBlip {
  x: number; // relative X (-1 to +1)
  z: number; // relative Z (-1 to +1)
  type: 'crystal' | 'police' | 'car' | 'fish' | 'feather' | 'person';
}

export interface GameModeTelemetry {
  speed: number;
  altitude: number;
  posX: number;
  posY: number;
  posZ: number;
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
