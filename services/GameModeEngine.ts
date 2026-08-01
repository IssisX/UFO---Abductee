/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlayerMode, GameModeTelemetry, VoxelData, Quest } from '../types';
import { CityGenerator, CityWorld } from './CityGenerator';
import { CONFIG } from '../utils/voxelConstants';

class GameAudioEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playLaserSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  public playExplosionSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Low noise rumble + frequency sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.52);
    } catch {}
  }

  public playBounceSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.25);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    } catch {}
  }

  public playWindBoostSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.36);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.37);
    } catch {}
  }

  public playMeowSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(650, now + 0.15);
      osc.frequency.linearRampToValueAtTime(500, now + 0.35);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }

  public playPickupSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.16);
      });
    } catch {}
  }

  public playAbductionSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.linearRampToValueAtTime(1300, now + 0.35);
      osc.frequency.linearRampToValueAtTime(750, now + 0.6);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.62);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.63);
    } catch {}
  }

  public playQuestSound() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 987.77, 1046.50];
      chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.25, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.45);
      });
    } catch {}
  }
}

interface ActiveRagdoll {
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

const UFO_QUESTS: Quest[] = [
  { id: 'u0', title: 'First Abduction', description: 'Abduct 1 Civilian with Tractor Beam [F]', progress: 0, target: 1, completed: false, reward: 800 },
  { id: 'u1', title: 'Crystal Harvester', description: 'Collect 3 Cyber Crystals', progress: 0, target: 3, completed: false, reward: 500 },
  { id: 'a50', title: 'High Altitude', description: 'Reach 45m Altitude in Flight', progress: 0, target: 45, completed: false, reward: 750 },
  { id: 'emp3', title: 'Shockwave Master', description: 'Fire Action Ability 3 Times', progress: 0, target: 3, completed: false, reward: 1000 },
  { id: 'u2', title: 'Alien Scientist', description: 'Abduct 3 Civilians & Launch Ragdolls!', progress: 0, target: 3, completed: false, reward: 1500 }
];

const CAT_QUESTS: Quest[] = [
  { id: 'c1', title: 'Fish Feast', description: 'Collect 3 Fish Treats on Streets', progress: 0, target: 3, completed: false, reward: 500 },
  { id: 'c2', title: 'Rooftop Leap', description: 'Use 2 Parkour Bounce Pads', progress: 0, target: 2, completed: false, reward: 800 },
  { id: 'c3', title: 'Catnip Rush', description: 'Collect 2 Catnip Bushes', progress: 0, target: 2, completed: false, reward: 900 },
  { id: 'c4', title: 'Alley Meow', description: 'Meow [F] 3 Times near Traffic', progress: 0, target: 3, completed: false, reward: 1000 }
];

const EAGLE_QUESTS: Quest[] = [
  { id: 'e1', title: 'Thermal Soarer', description: 'Fly through 2 Sky Thermal Rings', progress: 0, target: 2, completed: false, reward: 600 },
  { id: 'e2', title: 'Golden Feathers', description: 'Collect 3 Golden Feathers in Sky', progress: 0, target: 3, completed: false, reward: 800 },
  { id: 'e3', title: 'Sky High', description: 'Soar above 60m Altitude', progress: 0, target: 60, completed: false, reward: 1000 },
  { id: 'e4', title: 'Eagle Speed', description: 'Reach Speed of 55+ MPH', progress: 0, target: 55, completed: false, reward: 1200 }
];

export class GameModeEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private audio: GameAudioEngine;

  private cityWorld: CityWorld | null = null;
  private playerGroup: THREE.Group;
  private playerMesh: THREE.InstancedMesh | null = null;
  private tractorBeamMesh: THREE.Mesh | null = null;
  private particleGroup: THREE.Group;

  private isActive = false;
  private playerMode: PlayerMode = 'UFO';
  
  // Gamification State
  private score = 0;
  private highScore = 0;
  private energy = 100;
  private comboMultiplier = 1;
  private comboTimer = 0;
  private wantedLevel = 0; // 0 to 5 Stars
  private currentQuestIndex = 0;
  private quests: Quest[] = JSON.parse(JSON.stringify(UFO_QUESTS));
  private questCompletedFlash: string | null = null;
  private screenShake = 0;

  // Cinematic Camera State
  public isCinematicCamera: boolean = true;
  private userCamOverrideTimer: number = 0;

  // Police Chaser Entities
  private policeChasers: { mesh: THREE.Group; vel: THREE.Vector3; sirenLight: THREE.PointLight }[] = [];

  // Transform & Physics
  private posX = 0;
  private posY = 15;
  private posZ = 0;
  private rotY = 0;
  private velX = 0;
  private velY = 0;
  private velZ = 0;
  private isGrounded = false;

  // Input State
  private keys: { [key: string]: boolean } = {};
  private isMouseDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private camYaw = 0;
  private camPitch = 0.3;

  // Callbacks
  private onTelemetryUpdate?: (telemetry: GameModeTelemetry) => void;

  // Abduction & Ragdoll State
  private abductedCount = 0;
  private abductionTriggerTime = 0;
  private alienTestLog: string | null = null;
  private activeRagdolls: ActiveRagdoll[] = [];
  private groundScannerMesh: THREE.Group | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.audio = new GameAudioEngine();

    this.playerGroup = new THREE.Group();
    this.playerGroup.name = "PlayerEntityGroup";
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = "GameParticlesGroup";

    try {
      const saved = localStorage.getItem('voxel_high_score');
      if (saved) this.highScore = parseInt(saved, 10) || 0;
    } catch {}

    this.setupTractorBeam();
    this.setupGroundScanner();
    this.bindInputs();
  }

  private setupGroundScanner() {
    const scannerGroup = new THREE.Group();
    scannerGroup.name = "GroundScanner";

    const ringGeo = new THREE.RingGeometry(2.2, 3.0, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;

    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.9 });
    const line1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 7.0), lineMat);
    const line2 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.05, 0.25), lineMat);

    scannerGroup.add(ringMesh, line1, line2);
    this.groundScannerMesh = scannerGroup;
    this.scene.add(this.groundScannerMesh);
  }

  private setupTractorBeam() {
    const geo = new THREE.CylinderGeometry(0.5, 4.0, 20, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.tractorBeamMesh = new THREE.Mesh(geo, mat);
    this.tractorBeamMesh.position.set(0, -10, 0);
    this.playerGroup.add(this.tractorBeamMesh);
  }

  public setOnTelemetryUpdate(cb: (t: GameModeTelemetry) => void) {
    this.onTelemetryUpdate = cb;
  }

  public start(mode: PlayerMode, playerVoxels: VoxelData[]) {
    if (this.isActive) this.stop();

    this.isActive = true;
    this.playerMode = mode;
    this.score = 0;

    // 1. Generate City
    this.cityWorld = CityGenerator.generateVoxelCity();
    this.scene.add(this.cityWorld.cityGroup);

    // 2. Build Player Entity Mesh
    this.buildPlayerMesh(playerVoxels);
    this.scene.add(this.playerGroup);
    this.scene.add(this.particleGroup);

    // Initial Position
    if (mode === 'UFO') {
      this.posX = 0;
      this.posY = 35;
      this.posZ = 0;
    } else {
      this.posX = 0;
      this.posY = CONFIG.FLOOR_Y + 2;
      this.posZ = 12;
    }
    this.rotY = 0;
    this.velX = 0; this.velY = 0; this.velZ = 0;

    // Reset Camera
    this.camYaw = 0;
    this.camPitch = 0.35;
  }

  public stop() {
    if (!this.isActive) return;
    this.isActive = false;

    if (this.cityWorld) {
      this.scene.remove(this.cityWorld.cityGroup);
      this.cityWorld.dispose();
      this.cityWorld = null;
    }

    this.scene.remove(this.playerGroup);
    this.scene.remove(this.particleGroup);

    if (this.playerMesh) {
      this.playerMesh.geometry.dispose();
      if (Array.isArray(this.playerMesh.material)) this.playerMesh.material.forEach(m => m.dispose());
      else this.playerMesh.material.dispose();
      this.playerMesh = null;
    }
  }

  public setPlayerVoxels(voxels: VoxelData[]) {
    if (this.isActive) {
      this.buildPlayerMesh(voxels);
    }
  }

  public toggleCinematicCamera(): boolean {
    this.isCinematicCamera = !this.isCinematicCamera;
    this.userCamOverrideTimer = 0;
    return this.isCinematicCamera;
  }

  public setPlayerMode(mode: PlayerMode) {
    this.playerMode = mode;
    const questSet = mode === 'Cat' ? CAT_QUESTS : mode === 'Eagle' ? EAGLE_QUESTS : UFO_QUESTS;
    this.quests = JSON.parse(JSON.stringify(questSet));
    this.currentQuestIndex = 0;

    if (mode === 'UFO' && this.posY < 25) {
      this.posY = 32;
    }
  }

  private buildPlayerMesh(voxels: VoxelData[]) {
    if (this.playerMesh) {
      this.playerGroup.remove(this.playerMesh);
      this.playerMesh.geometry.dispose();
      if (Array.isArray(this.playerMesh.material)) this.playerMesh.material.forEach(m => m.dispose());
      else this.playerMesh.material.dispose();
    }

    if (!voxels || voxels.length === 0) return;

    // Center player voxels around (0,0,0)
    let cx = 0, cy = 0, cz = 0;
    voxels.forEach(v => { cx += v.x; cy += v.y; cz += v.z; });
    cx /= voxels.length; cy /= voxels.length; cz /= voxels.length;

    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 });
    this.playerMesh = new THREE.InstancedMesh(geo, mat, voxels.length);
    this.playerMesh.castShadow = true;
    this.playerMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    voxels.forEach((v, i) => {
      dummy.position.set(v.x - cx, v.y - cy, v.z - cz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.playerMesh!.setMatrixAt(i, dummy.matrix);
      this.playerMesh!.setColorAt(i, new THREE.Color(v.color));
    });

    this.playerMesh.instanceMatrix.needsUpdate = true;
    if (this.playerMesh.instanceColor) this.playerMesh.instanceColor.needsUpdate = true;

    this.playerGroup.add(this.playerMesh);
  }

  private bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyF') {
        this.triggerAction();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      this.isMouseDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive || !this.isMouseDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.camYaw -= deltaX * 0.008;
      this.camPitch = Math.max(0.05, Math.min(Math.PI / 2.2, this.camPitch + deltaY * 0.008));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
  }

  public triggerAction() {
    if (!this.isActive) return;
    if (this.playerMode === 'UFO' || this.playerMode === 'Eagle') {
      this.audio.playLaserSound();
      this.screenShake = 0.8;
      if (this.tractorBeamMesh) {
        (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
      }
      if (this.playerMode === 'UFO') {
        this.attemptAbduction();
      }
      this.spawnEMPWave();
    } else {
      this.audio.playMeowSound();
      this.spawnHeartParticles();
    }

    // Quest check: Shockwave
    const currentQ = this.quests[this.currentQuestIndex];
    if (currentQ && currentQ.id === 'emp3' && !currentQ.completed) {
      currentQ.progress += 1;
      if (currentQ.progress >= currentQ.target) {
        this.completeQuest(currentQ);
      }
    }
  }

  private attemptAbduction() {
    if (!this.cityWorld) return;

    const ufoX = this.posX;
    const ufoZ = this.posZ;
    const beamRadius = 14;

    // Find pedestrians within tractor beam radius
    let abductedTargetIndex = -1;
    let closestDist = Infinity;

    this.cityWorld.pedestrians.forEach((ped, idx) => {
      const dx = ped.mesh.position.x - ufoX;
      const dz = ped.mesh.position.z - ufoZ;
      const dist = Math.hypot(dx, dz);
      if (dist < beamRadius && dist < closestDist) {
        closestDist = dist;
        abductedTargetIndex = idx;
      }
    });

    if (abductedTargetIndex !== -1) {
      const targetPed = this.cityWorld.pedestrians[abductedTargetIndex];

      // Play abduction sound
      this.audio.playAbductionSound();
      this.screenShake = 1.2;
      this.abductedCount++;
      this.abductionTriggerTime = Date.now();

      // Humorous Alien Test Results
      const testQuotes = [
        `🧪 PROBED: Subject #${Math.floor(Math.random()*900+100)} - IQ: ${Math.floor(Math.random()*60+60)} - Memory Cleared!`,
        `🧪 ANALYZED: Subject #${Math.floor(Math.random()*900+100)} - Brain size: ${Math.floor(Math.random()*20+5)}% - DNA = 98% Banana!`,
        `🧪 INSPECTED: Subject #${Math.floor(Math.random()*900+100)} - Found 1x Shiny Coin in pocket!`,
        `🧪 LAB TEST: Subject #${Math.floor(Math.random()*900+100)} - Caloric value: 2400 kcal - Tastes like chicken!`,
        `🧪 SCAN COMPLETE: Subject #${Math.floor(Math.random()*900+100)} - Teleported donut directly into stomach!`
      ];
      this.alienTestLog = testQuotes[Math.floor(Math.random() * testQuotes.length)];

      this.score += 500 * this.comboMultiplier;
      this.comboMultiplier = Math.min(5, this.comboMultiplier + 1);
      this.comboTimer = 4.0;

      // Quest progress
      const currentQ = this.quests[this.currentQuestIndex];
      if (currentQ && (currentQ.id === 'u0' || currentQ.id === 'u2') && !currentQ.completed) {
        currentQ.progress += 1;
        if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
      }

      // Remove pedestrian from sidewalk
      this.scene.remove(targetPed.mesh);
      this.cityWorld.pedestrians.splice(abductedTargetIndex, 1);

      // Spawn Ragdoll tossing down from UFO!
      this.spawnRagdoll(new THREE.Vector3(ufoX, this.posY - 1.5, ufoZ));

      // Respawn replacement sidewalk pedestrian after 4 seconds to keep city populated
      setTimeout(() => {
        if (this.cityWorld) {
          const newPedGroup = new THREE.Group();
          const pMat = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x38bdf8 : 0xf43f5e });
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), pMat);
          body.position.y = 0.7;
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xfde047 }));
          head.position.y = 1.7;
          const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
          legL.position.set(-0.2, -0.4, 0);
          const legR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
          legR.position.set(0.2, -0.4, 0);
          newPedGroup.add(body, head, legL, legR);

          const spawnX = ufoX + (Math.random() - 0.5) * 60;
          const spawnZ = ufoZ + (Math.random() - 0.5) * 60;
          newPedGroup.position.set(spawnX, CONFIG.FLOOR_Y + 0.4, spawnZ);
          this.scene.add(newPedGroup);

          this.cityWorld.pedestrians.push({
            mesh: newPedGroup,
            legL, legR,
            axis: Math.random() > 0.5 ? 'X' : 'Z',
            axisPos: spawnZ,
            minPos: spawnX - 25,
            maxPos: spawnX + 25,
            speed: 0.08 + Math.random() * 0.04,
            sign: Math.random() > 0.5 ? 1 : -1
          });
        }
      }, 4000);
    }
  }

  private spawnRagdoll(spawnPos: THREE.Vector3) {
    const ragdollGroup = new THREE.Group();
    ragdollGroup.name = "RagdollPedestrian";

    const pMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.2 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), pMat);
    torso.position.y = 0.7;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), headMat);
    head.position.y = 1.7;

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), pMat);
    armL.position.set(-0.6, 1.0, 0);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), pMat);
    armR.position.set(0.6, 1.0, 0);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), legMat);
    legL.position.set(-0.2, -0.4, 0);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), legMat);
    legR.position.set(0.2, -0.4, 0);

    ragdollGroup.add(torso, head, armL, armR, legL, legR);
    ragdollGroup.position.copy(spawnPos);
    this.scene.add(ragdollGroup);

    // Initial toss velocities
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.6,
      -0.4 - Math.random() * 0.3,
      (Math.random() - 0.5) * 1.6
    );

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    );

    this.activeRagdolls.push({
      mesh: ragdollGroup,
      bodyParts: { head, torso, legL, legR, armL, armR },
      pos: spawnPos.clone(),
      vel,
      rot: new THREE.Vector3(0, 0, 0),
      rotVel,
      bouncesLeft: 3,
      timeAlive: 0,
      recovered: false
    });
  }

  private updateRagdolls(deltaTime: number) {
    const now = performance.now();
    for (let i = this.activeRagdolls.length - 1; i >= 0; i--) {
      const r = this.activeRagdolls[i];
      r.timeAlive += deltaTime;

      if (!r.recovered) {
        // Gravity
        r.vel.y -= 0.05;

        // Apply velocities
        r.pos.add(r.vel);

        // Tumbling angular physics
        r.rot.add(r.rotVel);
        r.mesh.rotation.set(r.rot.x, r.rot.y, r.rot.z);

        // Flail arms and legs comically
        r.bodyParts.armL.rotation.z = Math.sin(now * 0.02) * 2.0;
        r.bodyParts.armR.rotation.z = -Math.sin(now * 0.02) * 2.0;
        r.bodyParts.legL.rotation.x = Math.cos(now * 0.02) * 1.5;
        r.bodyParts.legR.rotation.x = -Math.cos(now * 0.02) * 1.5;

        // Ground Collision & Bouncing
        const floorY = CONFIG.FLOOR_Y + 0.6;
        if (r.pos.y <= floorY) {
          r.pos.y = floorY;
          if (r.bouncesLeft > 0) {
            r.vel.y = -r.vel.y * 0.6; // bounce back up
            r.vel.x *= 0.7;
            r.vel.z *= 0.7;
            r.bouncesLeft--;

            // Comic bounce FX & audio
            this.audio.playBounceSound();
            this.spawnImpactSparks(r.pos);
          } else {
            // Settled on ground
            r.vel.set(0, 0, 0);
            r.rotVel.set(0, 0, 0);
            r.mesh.rotation.set(0, r.rot.y, 0); // stand straight
            r.recovered = true;

            // Spawn dazed cartoon stars
            this.spawnDazedStars(r.pos);
          }
        }

        r.mesh.position.copy(r.pos);
      } else {
        // Recovered pedestrian walks away slowly
        r.pos.x += Math.sin(r.rot.y) * 0.05;
        r.pos.z += Math.cos(r.rot.y) * 0.05;
        r.mesh.position.copy(r.pos);

        // Clean up after 6 seconds
        if (r.timeAlive > 6.0) {
          this.scene.remove(r.mesh);
          this.activeRagdolls.splice(i, 1);
        }
      }
    }
  }

  private spawnImpactSparks(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.2, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(pos.x + (Math.random() - 0.5), pos.y + 0.5, pos.z + (Math.random() - 0.5));
      this.particleGroup.add(p);

      const startTime = performance.now();
      const anim = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 0.3) {
          p.position.y += 0.05;
          p.scale.multiplyScalar(0.9);
          mat.opacity = 0.9 * (1 - elapsed / 0.3);
          requestAnimationFrame(anim);
        } else {
          this.particleGroup.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      anim();
    }
  }

  private spawnDazedStars(pos: THREE.Vector3) {
    const geo = new THREE.OctahedronGeometry(0.2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 1 });
    const stars: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(geo, mat);
      this.particleGroup.add(s);
      stars.push(s);
    }

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 2.0) {
        stars.forEach((s, idx) => {
          const angle = elapsed * 5 + (idx * Math.PI * 2) / 3;
          s.position.set(
            pos.x + Math.cos(angle) * 0.8,
            pos.y + 2.2 + Math.sin(elapsed * 3) * 0.2,
            pos.z + Math.sin(angle) * 0.8
          );
        });
        requestAnimationFrame(anim);
      } else {
        stars.forEach(s => this.particleGroup.remove(s));
        geo.dispose();
        mat.dispose();
      }
    };
    anim();
  }

  private completeQuest(q: Quest) {
    q.completed = true;
    q.progress = q.target;
    this.score += q.reward;
    this.questCompletedFlash = `QUEST COMPLETED: ${q.title} (+${q.reward} PTS)!`;
    this.audio.playQuestSound();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try { localStorage.setItem('voxel_high_score', this.highScore.toString()); } catch {}
    }

    setTimeout(() => {
      this.questCompletedFlash = null;
      if (this.currentQuestIndex < this.quests.length - 1) {
        this.currentQuestIndex++;
      }
    }, 3000);
  }

  private explodeObject(pos: THREE.Vector3, colorHex: number = 0xff4400) {
    this.screenShake = 1.4;
    this.audio.playExplosionSound();
    this.wantedLevel = Math.min(5, this.wantedLevel + 1);
    this.score += 500 * this.comboMultiplier;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try { localStorage.setItem('voxel_high_score', this.highScore.toString()); } catch {}
    }

    // Spawn 16 physics debris voxels bursting outward
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const boxMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.5 });

    const debrisList: { mesh: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.copy(pos);
      this.particleGroup.add(mesh);

      const vx = (Math.random() - 0.5) * 1.2;
      const vy = Math.random() * 1.5 + 0.5; // upward force
      const vz = (Math.random() - 0.5) * 1.2;
      debrisList.push({ mesh, vx, vy, vz });
    }

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 1.2) {
        for (const item of debrisList) {
          item.mesh.position.x += item.vx;
          item.mesh.position.y += item.vy;
          item.mesh.position.z += item.vz;
          item.vy -= 0.08; // gravity
          item.mesh.rotation.x += 0.2;
          item.mesh.rotation.y += 0.2;
          item.mesh.scale.multiplyScalar(0.97);
        }
        requestAnimationFrame(anim);
      } else {
        for (const item of debrisList) {
          this.particleGroup.remove(item.mesh);
        }
        boxGeo.dispose();
        boxMat.dispose();
      }
    };
    anim();

    // Spawn Police Chaser if wanted level is up and < 3 active
    if (this.policeChasers.length < Math.min(4, this.wantedLevel)) {
      this.spawnPoliceChaser();
    }
  }

  private spawnPoliceChaser() {
    const policeGroup = new THREE.Group();
    policeGroup.name = "PoliceChaser";

    // Cyber Police UFO Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 0.8, 12), bodyMat);
    policeGroup.add(disc);

    // Flashing Siren PointLight
    const sirenLight = new THREE.PointLight(0xff0000, 3, 25);
    sirenLight.position.set(0, 1, 0);
    policeGroup.add(sirenLight);

    // Initial position relative to player
    const spawnAngle = Math.random() * Math.PI * 2;
    policeGroup.position.set(
      this.posX + Math.cos(spawnAngle) * 50,
      this.posY + 8 + Math.random() * 10,
      this.posZ + Math.sin(spawnAngle) * 50
    );

    this.scene.add(policeGroup);
    this.policeChasers.push({ mesh: policeGroup, vel: new THREE.Vector3(), sirenLight });
  }

  private spawnEMPWave() {
    const ringGeo = new THREE.RingGeometry(1, 2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(this.posX, this.posY - 1, this.posZ);
    this.particleGroup.add(ring);

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.6) {
        const scale = 1 + elapsed * 60;
        ring.scale.set(scale, scale, 1);
        ringMat.opacity = 0.9 * (1 - elapsed / 0.6);

        if (this.cityWorld) {
          // 1. Pull floating crystals
          for (const item of this.cityWorld.collectibleVoxels) {
            const dist = item.mesh.position.distanceTo(this.playerGroup.position);
            if (dist < 40) {
              item.mesh.position.lerp(this.playerGroup.position, 0.15);
            }
          }

          // 2. Explode Traffic Cars in Range
          for (const car of this.cityWorld.trafficCars) {
            const dist = car.mesh.position.distanceTo(this.playerGroup.position);
            if (dist < 28) {
              this.explodeObject(car.mesh.position, car.colorHex);
              car.mesh.position.x = car.minBound; // respawn offscreen
            }
          }
        }

        // 3. Explode Police Chasers in Range
        for (let pIdx = this.policeChasers.length - 1; pIdx >= 0; pIdx--) {
          const police = this.policeChasers[pIdx];
          const dist = police.mesh.position.distanceTo(this.playerGroup.position);
          if (dist < 32) {
            this.explodeObject(police.mesh.position, 0xef4444);
            this.scene.remove(police.mesh);
            this.policeChasers.splice(pIdx, 1);
            this.score += 1000; // Police bust bonus
          }
        }

        requestAnimationFrame(anim);
      } else {
        this.particleGroup.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    anim();
  }

  private spawnHeartParticles() {
    const geo = new THREE.SphereGeometry(0.3, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3388, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        this.posX + (Math.random() - 0.5) * 2,
        this.posY + 2 + Math.random(),
        this.posZ + (Math.random() - 0.5) * 2
      );
      this.particleGroup.add(p);
      
      // Animate up & fade
      const startTime = performance.now();
      const anim = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 1.0) {
          p.position.y += 0.08;
          mat.opacity = 0.9 * (1 - elapsed);
          requestAnimationFrame(anim);
        } else {
          this.particleGroup.remove(p);
          p.geometry.dispose();
          mat.dispose();
        }
      };
      anim();
    }
  }

  // Virtual Control Input state
  private virtualInput = {
    fwd: 0,
    strafe: 0,
    ascend: 0,
    boost: false
  };

  public setVirtualInput(fwd: number, strafe: number, ascend: number = 0, boost: boolean = false) {
    this.virtualInput.fwd = fwd;
    this.virtualInput.strafe = strafe;
    this.virtualInput.ascend = ascend;
    this.virtualInput.boost = boost;
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number = 0) {
    this.userCamOverrideTimer = 2.5;
    this.camYaw += deltaYaw;
    this.camPitch = Math.max(0.05, Math.min(Math.PI / 2.2, this.camPitch + deltaPitch));
  }

  public triggerJump() {
    if (this.isGrounded) {
      this.velY = 1.1;
      this.isGrounded = false;
    }
  }

  public update(deltaTime: number) {
    if (!this.isActive) return;

    // --- Nitro Energy Consumption & Regeneration ---
    const isWantBoost = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.virtualInput.boost);
    let isBoost = false;

    if (isWantBoost && this.energy > 5) {
      isBoost = true;
      this.energy = Math.max(0, this.energy - 0.35);
      this.screenShake = Math.max(this.screenShake, 0.2);
    } else {
      this.energy = Math.min(100, this.energy + 0.2);
    }

    const moveSpeed = (isBoost ? 1.8 : 0.9) * (this.playerMode === 'UFO' ? 1.2 : 0.8);

    // Movement Vector relative to Camera Yaw
    let inputFwd = this.virtualInput.fwd;
    let inputStrafe = this.virtualInput.strafe;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) inputFwd += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) inputFwd -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) inputStrafe -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) inputStrafe += 1;

    // Clamp Inputs
    inputFwd = Math.max(-1, Math.min(1, inputFwd));
    inputStrafe = Math.max(-1, Math.min(1, inputStrafe));

    // Compute Direction relative to Camera View
    if (inputFwd !== 0 || inputStrafe !== 0) {
      const inputLen = Math.hypot(inputFwd, inputStrafe);
      const normFwd = inputLen > 0 ? inputFwd / Math.max(1, inputLen) : 0;
      const normStrafe = inputLen > 0 ? inputStrafe / Math.max(1, inputLen) : 0;

      // Camera orientation vectors in world space
      const forwardX = Math.sin(this.camYaw);
      const forwardZ = Math.cos(this.camYaw);
      const rightX = -Math.cos(this.camYaw);
      const rightZ = Math.sin(this.camYaw);

      // Project thumbstick inputs onto camera forward and right directions
      const targetVelX = (forwardX * normFwd + rightX * normStrafe) * moveSpeed;
      const targetVelZ = (forwardZ * normFwd + rightZ * normStrafe) * moveSpeed;

      const lerpFactor = 0.22;
      this.velX += (targetVelX - this.velX) * lerpFactor;
      this.velZ += (targetVelZ - this.velZ) * lerpFactor;

      const targetRot = Math.atan2(this.velX, this.velZ);
      let rotDiff = targetRot - this.rotY;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      this.rotY += rotDiff * 0.25;
    } else {
      this.velX *= 0.82;
      this.velZ *= 0.82;
    }

    // --- Physics by Player Mode ---
    if (this.playerMode === 'UFO' || this.playerMode === 'Eagle') {
      let ascendInput = this.virtualInput.ascend;
      if (this.keys['Space']) ascendInput += 1;
      if (this.keys['KeyE'] || this.keys['ControlLeft']) ascendInput -= 1;

      this.velY += (ascendInput * moveSpeed * 0.8 - this.velY) * 0.12;

      const hoverBob = Math.sin(performance.now() * 0.003) * 0.05;
      this.posY += this.velY + hoverBob;
      this.posY = Math.max(CONFIG.FLOOR_Y + 2, Math.min(120, this.posY));

      const bankAngle = -this.velX * 0.2;
      const pitchAngle = this.velZ * 0.15;
      this.playerGroup.rotation.set(pitchAngle, this.rotY, bankAngle);

      if (this.tractorBeamMesh) {
        const mat = this.tractorBeamMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - 0.03);
      }

      if (isBoost || Math.abs(this.velX) > 0.5 || Math.abs(this.velZ) > 0.5) {
        this.spawnThrusterParticle();
      }
    } else {
      const gravity = -0.06;
      this.velY += gravity;

      if (this.keys['Space'] && this.isGrounded) {
        this.triggerJump();
      }

      this.posY += this.velY;
      const minGroundY = CONFIG.FLOOR_Y + 1.2;

      if (this.posY <= minGroundY) {
        this.posY = minGroundY;
        this.velY = 0;
        this.isGrounded = true;
      }

      const moveMag = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
      const gaitBob = this.isGrounded && moveMag > 0.1 ? Math.abs(Math.sin(performance.now() * 0.015)) * 0.3 : 0;
      this.playerGroup.rotation.set(0, this.rotY, 0);
      this.playerGroup.position.set(this.posX, this.posY + gaitBob, this.posZ);
    }

    // Apply Position & Building Collision Resolution
    let nextX = this.posX + this.velX;
    let nextZ = this.posZ + this.velZ;

    if (this.cityWorld) {
      const playerRadius = this.playerMode === 'UFO' ? 3.5 : 1.2;
      
      for (const col of this.cityWorld.colliders) {
        const topY = col.height + CONFIG.FLOOR_Y;
        if (this.posY < topY) {
          const halfW = col.width / 2 + playerRadius;
          const halfD = col.depth / 2 + playerRadius;

          const dx = nextX - col.x;
          const dz = nextZ - col.z;

          if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
            // Penetration depth along both axes
            const overlapX = halfW - Math.abs(dx);
            const overlapZ = halfD - Math.abs(dz);

            // Push out along axis of minimum overlap
            if (overlapX < overlapZ) {
              nextX += Math.sign(dx) * overlapX;
              this.velX = 0; // stop momentum into wall
            } else {
              nextZ += Math.sign(dz) * overlapZ;
              this.velZ = 0; // stop momentum into wall
            }
          }
        }
      }
    }

    this.posX = nextX;
    this.posZ = nextZ;

    this.playerGroup.position.set(this.posX, this.posY, this.posZ);

    // Combo Timer Decay
    if (this.comboTimer > 0) {
      this.comboTimer -= deltaTime;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
      }
    }

    // Quests Real-time progress evaluator
    const currentQ = this.quests[this.currentQuestIndex];
    if (currentQ && !currentQ.completed) {
      if (currentQ.id === 'a50') {
        const alt = Math.round(this.posY - CONFIG.FLOOR_Y);
        currentQ.progress = Math.max(currentQ.progress, alt);
        if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
      } else if (currentQ.id === 'sp60') {
        const curSpd = Math.round(Math.sqrt(this.velX * this.velX + this.velY * this.velY + this.velZ * this.velZ) * 45);
        if (curSpd >= currentQ.target) this.completeQuest(currentQ);
      }
    }

    // --- Dynamic Living City Entities Update ---
    if (this.cityWorld) {
      const now = performance.now();

      // 1. Moving Traffic Cars
      for (const car of this.cityWorld.trafficCars) {
        car.mesh.position.x += car.dirX * car.speed;
        car.mesh.position.z += car.dirZ * car.speed;

        if (car.dirX > 0 && car.mesh.position.x > car.maxBound) car.mesh.position.x = car.minBound;
        else if (car.dirX < 0 && car.mesh.position.x < car.minBound) car.mesh.position.x = car.maxBound;

        if (car.dirZ > 0 && car.mesh.position.z > car.maxBound) car.mesh.position.z = car.minBound;
        else if (car.dirZ < 0 && car.mesh.position.z < car.minBound) car.mesh.position.z = car.maxBound;
      }

      // 2. Flying Overhead Birds
      for (const bird of this.cityWorld.birds) {
        bird.angle += bird.speed;
        const bx = bird.center.x + Math.cos(bird.angle) * bird.radius;
        const bz = bird.center.z + Math.sin(bird.angle) * bird.radius;
        const by = bird.height + Math.sin(bird.angle * 2) * 3;

        bird.mesh.position.set(bx, by, bz);
        bird.mesh.rotation.y = -bird.angle + Math.PI / 2;

        const flap = Math.sin(now * 0.012 + bird.radius) * 0.4;
        bird.wingLeft.rotation.z = flap;
        bird.wingRight.rotation.z = -flap;
      }

      // 3. Sidewalk Pedestrians
      for (const ped of this.cityWorld.pedestrians) {
        if (ped.axis === 'X') {
          ped.mesh.position.x += ped.speed * ped.sign;
          if (ped.mesh.position.x > ped.maxPos || ped.mesh.position.x < ped.minPos) {
            ped.sign *= -1;
            ped.mesh.rotation.y = ped.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        } else {
          ped.mesh.position.z += ped.speed * ped.sign;
          if (ped.mesh.position.z > ped.maxPos || ped.mesh.position.z < ped.minPos) {
            ped.sign *= -1;
            ped.mesh.rotation.y = ped.sign > 0 ? 0 : Math.PI;
          }
        }
        ped.legL.rotation.x = Math.sin(now * 0.01) * 0.5;
        ped.legR.rotation.x = -Math.sin(now * 0.01) * 0.5;
      }

      // 4. Floating Collectibles & Props Interaction
      for (let i = this.cityWorld.collectibleVoxels.length - 1; i >= 0; i--) {
        const item = this.cityWorld.collectibleVoxels[i];
        item.mesh.rotation.y += 0.03;
        if (item.type !== 'bounce_pad' && item.type !== 'trash_can') {
          item.mesh.position.y = item.pos.y + Math.sin(now * 0.004 + i) * 0.4;
        }

        const dist = item.mesh.position.distanceTo(this.playerGroup.position);

        // Magnetic Attraction for crystals, fish, feathers, catnip
        if (dist < 18 && (item.type === 'crystal' || item.type === 'fish' || item.type === 'feather' || item.type === 'catnip')) {
          item.mesh.position.lerp(this.playerGroup.position, 0.08);
        }

        // Special interaction: Parkour Bounce Pad (Cat/Ground Leap)
        if (item.type === 'bounce_pad' && dist < 3.2) {
          this.velY = 1.8; // Huge bounce onto roofs!
          this.isGrounded = false;
          this.audio.playBounceSound();
          this.spawnHeartParticles();
          
          if (currentQ && (currentQ.id === 'c2' || currentQ.id === 'r2') && !currentQ.completed) {
            currentQ.progress += 1;
            if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
          }
        }

        // Special interaction: Sky Thermal Updraft Ring (Eagle Surge)
        if (item.type === 'thermal_ring' && dist < 4.8) {
          this.velY = 1.3;
          this.velX *= 1.8;
          this.velZ *= 1.8;
          this.audio.playWindBoostSound();
          this.spawnThrusterParticle();

          if (currentQ && currentQ.id === 'e1' && !currentQ.completed) {
            currentQ.progress += 1;
            if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
          }
        }

        // Pickup Collectible (Crystal, Fish, Feather, Catnip, Trash Can)
        if (dist < 3.8) {
          const pts = (item.type === 'catnip' ? 250 : 100) * this.comboMultiplier;
          this.score += pts;
          this.comboMultiplier = Math.min(5, this.comboMultiplier + 1);
          this.comboTimer = 3.5;

          if (this.score > this.highScore) {
            this.highScore = this.score;
            try { localStorage.setItem('voxel_high_score', this.highScore.toString()); } catch {}
          }

          if (item.type === 'trash_can') {
            this.audio.playExplosionSound();
            this.explodeObject(item.mesh.position, 0x64748b);
          } else {
            this.audio.playPickupSound();
            this.spawnHeartParticles();
          }

          this.scene.remove(item.mesh);
          if (item.mesh instanceof THREE.Mesh) {
            item.mesh.geometry.dispose();
            if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
            else item.mesh.material.dispose();
          }

          this.cityWorld.collectibleVoxels.splice(i, 1);

          // Quest Progress Check
          if (currentQ && !currentQ.completed) {
            if ((item.type === 'crystal' && currentQ.id === 'u1') ||
                (item.type === 'fish' && currentQ.id === 'c1') ||
                (item.type === 'feather' && currentQ.id === 'e2') ||
                (item.type === 'catnip' && currentQ.id === 'c3')) {
              currentQ.progress += 1;
              if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
            }
          }
        }
      }
    }

    // --- Update Police Chasers AI ---
    const now = performance.now();
    for (let i = this.policeChasers.length - 1; i >= 0; i--) {
      const police = this.policeChasers[i];
      const targetPos = new THREE.Vector3(this.posX, this.posY + 5, this.posZ);
      police.mesh.position.lerp(targetPos, 0.035);
      police.mesh.rotation.y += 0.05;

      const flash = Math.floor(now / 150) % 2 === 0;
      police.sirenLight.color.setHex(flash ? 0xff0000 : 0x0066ff);
    }

    // Update Ragdoll Physics
    this.updateRagdolls(deltaTime);

    // Update Ground Scanner Reticle Position & Color
    if (this.groundScannerMesh) {
      if (this.playerMode === 'UFO') {
        this.groundScannerMesh.visible = true;
        this.groundScannerMesh.position.set(this.posX, CONFIG.FLOOR_Y + 0.15, this.posZ);
        this.groundScannerMesh.rotation.y += 0.02;

        let pedUnderScanner = false;
        if (this.cityWorld) {
          pedUnderScanner = this.cityWorld.pedestrians.some(p => Math.hypot(p.mesh.position.x - this.posX, p.mesh.position.z - this.posZ) < 14);
        }

        const ringMesh = this.groundScannerMesh.children[0] as THREE.Mesh;
        if (ringMesh && ringMesh.material instanceof THREE.MeshBasicMaterial) {
          ringMesh.material.color.setHex(pedUnderScanner ? 0xfacc15 : 0x00f0ff);
        }
      } else {
        this.groundScannerMesh.visible = false;
      }
    }

    // --- Calculate Radar Blips (relative to player, max radius 80) ---
    const radarBlips: { x: number; z: number; type: 'crystal' | 'police' | 'car' | 'fish' | 'feather' | 'person' }[] = [];
    const maxRadarDist = 80;
    let nearestPedDist: number | null = null;

    if (this.cityWorld) {
      for (const item of this.cityWorld.collectibleVoxels) {
        const dx = item.mesh.position.x - this.posX;
        const dz = item.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= maxRadarDist) {
          const blipType = item.type === 'fish' ? 'fish' : item.type === 'feather' ? 'feather' : 'crystal';
          radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: blipType });
        }
      }

      for (const car of this.cityWorld.trafficCars) {
        const dx = car.mesh.position.x - this.posX;
        const dz = car.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= maxRadarDist) {
          radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: 'car' });
        }
      }

      for (const ped of this.cityWorld.pedestrians) {
        const dx = ped.mesh.position.x - this.posX;
        const dz = ped.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (nearestPedDist === null || dist < nearestPedDist) {
          nearestPedDist = dist;
        }
        if (dist <= maxRadarDist) {
          radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: 'person' });
        }
      }
    }

    for (const police of this.policeChasers) {
      const dx = police.mesh.position.x - this.posX;
      const dz = police.mesh.position.z - this.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= maxRadarDist) {
        radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: 'police' });
      }
    }

    // --- Cinematic Camera Auto-Pan & Smooth Motion Tracking ---
    if (this.userCamOverrideTimer > 0) {
      this.userCamOverrideTimer -= deltaTime;
    } else if (this.isCinematicCamera) {
      const spd = Math.hypot(this.velX, this.velZ);
      if (spd > 0.04) {
        // Automatically align camera yaw with movement heading so camera follows behind player
        const targetYaw = Math.atan2(this.velX, this.velZ);
        let diff = targetYaw - this.camYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.camYaw += diff * 0.03;
      }
      
      // Continuous subtle broadcast orbit
      this.camYaw += 0.001;

      // Pitch angle: when in UFO mode, tilt down to see pedestrians clearly
      const targetPitch = (this.playerMode === 'UFO' ? 0.42 : 0.32) + Math.sin(now * 0.001) * 0.04;
      this.camPitch = THREE.MathUtils.lerp(this.camPitch, targetPitch, 0.02);
    }

    // --- Camera Follow Controller with Screen Shake ---
    const camDist = this.playerMode === 'UFO' ? 24 : 14;
    const camHeight = this.playerMode === 'UFO' ? 8 : 4;

    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;
    this.screenShake = Math.max(0, this.screenShake - 0.05);

    const cx = this.posX - Math.sin(this.camYaw) * camDist * Math.cos(this.camPitch) + shakeX;
    const cz = this.posZ - Math.cos(this.camYaw) * camDist * Math.cos(this.camPitch) + shakeX;
    const cy = this.posY + Math.sin(this.camPitch) * camDist + camHeight + shakeY;

    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.12);
    this.camera.lookAt(this.posX, this.posY + 2, this.posZ);

    // --- Send Telemetry ---
    const currentSpeed = Math.round(Math.sqrt(this.velX * this.velX + this.velY * this.velY + this.velZ * this.velZ) * 45);
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        speed: currentSpeed,
        altitude: Math.round(this.posY - CONFIG.FLOOR_Y),
        posX: Math.round(this.posX),
        posY: Math.round(this.posY),
        posZ: Math.round(this.posZ),
        boostActive: isBoost,
        actionActive: !!(this.tractorBeamMesh && (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity > 0.1),
        score: this.score,
        highScore: this.highScore,
        energy: Math.round(this.energy),
        comboMultiplier: this.comboMultiplier,
        wantedLevel: this.wantedLevel,
        isCinematicCamera: this.isCinematicCamera,
        activeQuest: this.quests[this.currentQuestIndex] || null,
        questCompletedFlash: this.questCompletedFlash,
        radarBlips,
        abductedCount: this.abductedCount,
        abductionTriggerTime: this.abductionTriggerTime,
        alienTestLog: this.alienTestLog,
        nearestPedestrianDist: nearestPedDist !== null ? Math.round(nearestPedDist) : null
      });
    }
  }

  private spawnThrusterParticle() {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(
      this.posX + (Math.random() - 0.5) * 1.5,
      this.posY - 1,
      this.posZ + (Math.random() - 0.5) * 1.5
    );
    this.particleGroup.add(p);

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.4) {
        p.position.y -= 0.1;
        p.scale.multiplyScalar(0.92);
        mat.opacity = 0.8 * (1 - elapsed / 0.4);
        requestAnimationFrame(anim);
      } else {
        this.particleGroup.remove(p);
        geo.dispose();
        mat.dispose();
      }
    };
    anim();
  }
}
