import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AppState, SimulationVoxel, RebuildTarget, VoxelData, SavedModel, AnimationState, PlayerMode, GameModeTelemetry, WeaponMode, MothershipUpgrades } from '../types';
import { CONFIG, COLORS } from '../utils/voxelConstants';
import { GameModeEngine } from './GameModeEngine';

class SupernovaAudio {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playImplosion() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(40, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 3.0);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 2.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 3.1);
    } catch {}
  }

  public playDetonation() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Deep Sub-Bass Impact
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(220, now);
      subOsc.frequency.exponentialRampToValueAtTime(10, now + 1.5);

      subGain.gain.setValueAtTime(1.0, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 2.1);

      // Noise Blast Wave
      const bufferSize = Math.floor(this.ctx.sampleRate * 2.0);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 1.5);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
    } catch {}
  }

  public playReassembly() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const startTime = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, startTime);

        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch {}
  }
}

export class VoxelEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private controls: OrbitControls;
  private instanceMesh: THREE.InstancedMesh | null = null;
  private ghostMesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  
  private voxels: SimulationVoxel[] = [];
  private ghostVoxels: VoxelData[] = [];
  private currentModelData: VoxelData[] = [];
  // --- LOD System State ---
  private lodVoxels: { [level: number]: SimulationVoxel[] } = {};
  private currentLodLevel: number = -1;
  private cameraDistance: number = 0;
  
  private generateLod(voxels: SimulationVoxel[], lodFactor: number): SimulationVoxel[] {
      if (lodFactor <= 1) return voxels;
      const voxelMap = new Map<string, SimulationVoxel>();
      for (const v of voxels) {
          const gridX = Math.round(v.x / lodFactor) * lodFactor;
          const gridY = Math.round(v.y / lodFactor) * lodFactor;
          const gridZ = Math.round(v.z / lodFactor) * lodFactor;
          const key = `${gridX},${gridY},${gridZ}`;
          if (!voxelMap.has(key)) {
              // Copy physics/color properties from original
              voxelMap.set(key, { ...v, x: gridX, y: gridY, z: gridZ });
          }
      }
      return Array.from(voxelMap.values());
  }

  private highResGeo = new RoundedBoxGeometry(CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05, 2, 0.08);
  private lowResGeo = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05);

  private updateLODSystem() {
      // Calculate distance from camera to model center
      this.cameraDistance = this.camera.position.distanceTo(this.controls.target);
      
      let desiredLevel = 1;
      if (this.cameraDistance > 120) {
          desiredLevel = 4; // High decimation
      } else if (this.cameraDistance > 80) {
          desiredLevel = 3; // Medium decimation
      } else if (this.cameraDistance > 50) {
          desiredLevel = 2; // Low decimation
      } else {
          desiredLevel = 1; // Full detail
      }

      if (this.currentLodLevel !== desiredLevel && this.state === AppState.STABLE && !this.isPlayingAnimation) {
          this.currentLodLevel = desiredLevel;
          
          if (this.instanceMesh) {
              this.instanceMesh.geometry = desiredLevel === 1 ? this.highResGeo : this.lowResGeo;
          }

          // Apply LOD if available
          if (this.lodVoxels[desiredLevel]) {
              this.applyLodVoxels(this.lodVoxels[desiredLevel]);
          }
      }
  }

  private applyLodVoxels(lodArray: SimulationVoxel[]) {
      if (!this.instanceMesh) return;
      // Re-populate instanced mesh with decimated set
      for (let i = 0; i < lodArray.length; i++) {
          const v = lodArray[i];
          this.dummy.position.set(v.x, v.y, v.z);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.instanceMesh.setMatrixAt(i, this.dummy.matrix);
          this.instanceMesh.setColorAt(i, v.color);
      }
      this.instanceMesh.count = lodArray.length;
      this.instanceMesh.instanceMatrix.needsUpdate = true;
      if (this.instanceMesh.instanceColor) {
          this.instanceMesh.instanceColor.needsUpdate = true;
      }
      this.onCountChange(lodArray.length);
  }

  private rebuildTargets: RebuildTarget[] = [];
  private rebuildStartTime: number = 0;
  private supernovaStartTime: number = 0;
  
  private supernovaAudio = new SupernovaAudio();
  private supernovaCenter = new THREE.Vector3();
  private baseCameraPos = new THREE.Vector3();
  private baseControlsTarget = new THREE.Vector3();
  private audioPhasePlayed = { implosion: false, detonation: false, reassembly: false };
  private shockwaveRingMesh: THREE.Mesh | null = null;
  private shockwaveSphereMesh: THREE.Mesh | null = null;

  private state: AppState = AppState.STABLE;
  private onStateChange: (state: AppState) => void;
  private onCountChange: (count: number) => void;
  private animationId: number = 0;

  // Animation Engine Fields
  private animationFrames: VoxelData[][] = [];
  private animationFps: number = 6;
  private currentFrameIndex: number = 0;
  private isPlayingAnimation: boolean = false;
  private isInterpolatedAnimation: boolean = true;
  private isLoopingAnimation: boolean = true;
  private lastAnimationFrameTime: number = 0;
  private onAnimationStateChangeCallback?: (state: AnimationState) => void;

  // Game Mode Engine Field
  private gameModeEngine: GameModeEngine;
  private isGameModeActive: boolean = false;

  constructor(
    container: HTMLElement, 
    onStateChange: (state: AppState) => void,
    onCountChange: (count: number) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onCountChange = onCountChange;

    // Init Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR); // Clean studio background
    this.scene.fog = new THREE.Fog(CONFIG.BG_COLOR, 80, 220);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(40, 40, 80);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.gameModeEngine = new GameModeEngine(this.scene, this.camera);

    // Post-processing setup
    const renderScene = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    this.bloomPass.threshold = 0.85; // Clean & crisp by default
    this.bloomPass.strength = 0.25;
    this.bloomPass.radius = 0.3;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.target.set(0, 5, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.bias = -0.0003;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xd0e2ff, 0.7);
    fillLight.position.set(-50, 40, -40);
    this.scene.add(fillLight);

    const pointLight = new THREE.PointLight(0xffd700, 0, 150);
    pointLight.position.set(0, 10, 0);
    pointLight.name = "supernovaPointLight";
    this.scene.add(pointLight);

    // Studio Floor
    const planeMat = new THREE.MeshStandardMaterial({ 
      color: 0xe2e8f0, 
      roughness: 0.8, 
      metalness: 0.05
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Supernova Shockwave Ring Mesh
    const ringGeo = new THREE.RingGeometry(0.5, 2.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.shockwaveRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRingMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.shockwaveRingMesh);

    // Supernova Plasma Core Sphere Mesh
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.shockwaveSphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.scene.add(this.shockwaveSphereMesh);

    this.animate = this.animate.bind(this);
    this.animate();
  }

  public setOnAnimationStateChange(cb: (state: AnimationState) => void) {
    this.onAnimationStateChangeCallback = cb;
    this.notifyAnimationState();
  }

  public notifyAnimationState() {
    if (this.onAnimationStateChangeCallback) {
      this.onAnimationStateChangeCallback(this.getAnimationState());
    }
  }

  public getAnimationState(): AnimationState {
    return {
      isAnimated: this.animationFrames.length > 1,
      isPlaying: this.isPlayingAnimation,
      currentFrame: this.currentFrameIndex,
      totalFrames: this.animationFrames.length,
      fps: this.animationFps,
      isInterpolated: this.isInterpolatedAnimation,
      isLooping: this.isLoopingAnimation
    };
  }

  public loadAnimatedModel(savedModel: SavedModel) {
    if (savedModel.frames && savedModel.frames.length > 0) {
      this.animationFrames = savedModel.frames;
      this.animationFps = savedModel.fps || 6;
      this.currentFrameIndex = 0;
      this.isPlayingAnimation = true;
      this.lastAnimationFrameTime = performance.now();
      this.loadInitialModel(savedModel.frames[0]);
    } else {
      this.clearAnimation();
      this.loadInitialModel(savedModel.data);
    }
    this.notifyAnimationState();
  }

  public setAnimationFrames(frames: VoxelData[][], fps: number = 6) {
    if (!frames || frames.length === 0) {
      this.clearAnimation();
      return;
    }
    this.animationFrames = frames;
    this.animationFps = fps;
    this.currentFrameIndex = 0;
    this.isPlayingAnimation = frames.length > 1;
    this.lastAnimationFrameTime = performance.now();
    this.loadInitialModel(frames[0]);
    this.notifyAnimationState();
  }

  public clearAnimation() {
    this.animationFrames = [];
    this.isPlayingAnimation = false;
    this.currentFrameIndex = 0;
    this.notifyAnimationState();
  }

  public playAnimation() {
    if (this.animationFrames.length > 1) {
      this.isPlayingAnimation = true;
      this.lastAnimationFrameTime = performance.now();
      this.notifyAnimationState();
    }
  }

  public pauseAnimation() {
    this.isPlayingAnimation = false;
    this.notifyAnimationState();
  }

  public togglePlayAnimation() {
    if (this.isPlayingAnimation) {
      this.pauseAnimation();
    } else {
      this.playAnimation();
    }
  }

  public setFrame(index: number) {
    if (this.animationFrames.length === 0) return;
    this.currentFrameIndex = Math.max(0, Math.min(index, this.animationFrames.length - 1));
    this.applyFrame(this.animationFrames[this.currentFrameIndex]);
    this.notifyAnimationState();
  }

  public setFps(fps: number) {
    this.animationFps = Math.max(1, Math.min(fps, 30));
    this.notifyAnimationState();
  }

  public toggleInterpolation() {
    this.isInterpolatedAnimation = !this.isInterpolatedAnimation;
    this.notifyAnimationState();
  }

  public toggleLoop() {
    this.isLoopingAnimation = !this.isLoopingAnimation;
    this.notifyAnimationState();
  }

  private applyFrame(frameVoxels: VoxelData[]) {
    if (this.voxels.length !== frameVoxels.length) {
      this.createVoxels(frameVoxels);
      this.onCountChange(this.voxels.length);
      return;
    }
    frameVoxels.forEach((fv, i) => {
      if (this.voxels[i]) {
        this.voxels[i].x = fv.x;
        this.voxels[i].y = fv.y;
        this.voxels[i].z = fv.z;
        this.voxels[i].color.set(fv.color);
      }
    });
    this.draw();
  }

  public getCurrentVoxels(): VoxelData[] {
    return this.voxels.map(v => ({
      x: Math.round(v.x),
      y: Math.round(v.y),
      z: Math.round(v.z),
      color: v.color.getHex()
    }));
  }

  public loadInitialModel(data: VoxelData[]) {
    this.currentModelData = data;
    this.createVoxels(data);
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
  }

  private createVoxels(data: VoxelData[]) {
    // Clear existing
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.geometry.dispose();
      if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach(m => m.dispose());
      } else {
          this.instanceMesh.material.dispose();
      }
    }

    this.voxels = data.map((v, i) => {
        const c = new THREE.Color(v.color);
        // Slight color variation for realism
        c.offsetHSL(0, 0, (Math.random() * 0.1) - 0.05);
        return {
            id: i,
            x: v.x, y: v.y, z: v.z, color: c,
            vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
            rvx: 0, rvy: 0, rvz: 0
        };
    });
    this.lodVoxels[1] = this.voxels;
    this.lodVoxels[2] = this.generateLod(this.voxels, 2);
    this.lodVoxels[3] = this.generateLod(this.voxels, 3);
    this.lodVoxels[4] = this.generateLod(this.voxels, 4);
    this.currentLodLevel = -1;

    const material = new THREE.MeshStandardMaterial({ 
      roughness: 0.4, 
      metalness: 0.1
    });
    this.instanceMesh = new THREE.InstancedMesh(this.highResGeo, material, this.voxels.length);
    this.instanceMesh.castShadow = true;
    this.instanceMesh.receiveShadow = true;
    this.instanceMesh.frustumCulled = false;
    this.scene.add(this.instanceMesh);

    this.draw();
  }

  private draw() {
    if (!this.instanceMesh) return;
    this.voxels.forEach((v, i) => {
        this.dummy.position.set(v.x, v.y, v.z);
        this.dummy.rotation.set(v.rx, v.ry, v.rz);
        this.dummy.updateMatrix();
        this.instanceMesh!.setMatrixAt(i, this.dummy.matrix);
        this.instanceMesh!.setColorAt(i, v.color);
    });
    this.instanceMesh.instanceMatrix.needsUpdate = true;
    if (this.instanceMesh.instanceColor) {
        this.instanceMesh.instanceColor.needsUpdate = true;
    }
  }

  public dismantle() {
    if (this.state !== AppState.STABLE) return;
    this.state = AppState.DISMANTLING;
    this.onStateChange(this.state);

    this.voxels.forEach(v => {
        v.vx = (Math.random() - 0.5) * 0.8;
        v.vy = Math.random() * 0.5;
        v.vz = (Math.random() - 0.5) * 0.8;
        v.rvx = (Math.random() - 0.5) * 0.2;
        v.rvy = (Math.random() - 0.5) * 0.2;
        v.rvz = (Math.random() - 0.5) * 0.2;
    });
  }

  private getColorDist(c1: THREE.Color, hex2: number | string): number {
    const c2 = new THREE.Color(hex2);
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  public rebuild(targetModel: VoxelData[]) {
    this.currentModelData = targetModel;
    if (this.state === AppState.REBUILDING) return;

    const available = this.voxels.map((v, i) => ({ index: i, color: v.color, taken: false }));
    const targetTaken = new Array(targetModel.length).fill(false);
    const mappings: RebuildTarget[] = new Array(this.voxels.length).fill(null);

    // Build pairs of (targetIndex, availableIndex, distance)
    const pairs: { tIdx: number; aIdx: number; dist: number }[] = [];
    for (let t = 0; t < targetModel.length; t++) {
        const targetHex = targetModel[t].color;
        for (let a = 0; a < available.length; a++) {
            const dist = this.getColorDist(available[a].color, targetHex);
            pairs.push({ tIdx: t, aIdx: a, dist });
        }
    }

    // Sort pairs by color distance ascending to prioritize exact color matches
    pairs.sort((p1, p2) => p1.dist - p2.dist);

    // Assign closest color matches first
    for (let p = 0; p < pairs.length; p++) {
        const { tIdx, aIdx } = pairs[p];
        if (targetTaken[tIdx] || available[aIdx].taken) continue;

        targetTaken[tIdx] = true;
        available[aIdx].taken = true;

        const target = targetModel[tIdx];
        const h = Math.max(0, (target.y - CONFIG.FLOOR_Y) / 15);
        mappings[available[aIdx].index] = {
            x: target.x, 
            y: target.y, 
            z: target.z,
            targetColor: new THREE.Color(target.color),
            delay: h * 800
        };
    }

    // Leftover voxels become rubble
    for (let i = 0; i < this.voxels.length; i++) {
        if (!mappings[i]) {
            mappings[i] = {
                x: this.voxels[i].x, 
                y: this.voxels[i].y, 
                z: this.voxels[i].z,
                targetColor: this.voxels[i].color.clone(),
                isRubble: true, 
                delay: 0
            };
        }
    }

    this.rebuildTargets = mappings;
    this.rebuildStartTime = Date.now();
    this.state = AppState.REBUILDING;
    this.onStateChange(this.state);
  }

  public rebuildCurrent() {
    if (this.currentModelData.length > 0) {
      this.rebuild(this.currentModelData);
    }
  }

  public setCurrentModelData(data: VoxelData[]) {
    this.currentModelData = data;
  }

  private updatePhysics() {
    if (this.state === AppState.DISMANTLING) {
        this.voxels.forEach(v => {
            v.vy -= 0.025; // Gravity
            v.x += v.vx; v.y += v.vy; v.z += v.vz;
            v.rx += v.rvx; v.ry += v.rvy; v.rz += v.rvz;

            // Floor bounce
            if (v.y < CONFIG.FLOOR_Y + 0.5) {
                v.y = CONFIG.FLOOR_Y + 0.5;
                v.vy *= -0.5; v.vx *= 0.9; v.vz *= 0.9;
                v.rvx *= 0.8; v.rvy *= 0.8; v.rvz *= 0.8;
            }
        });
    } else if (this.state === AppState.REBUILDING) {
        const now = Date.now();
        const elapsed = now - this.rebuildStartTime;
        let allDone = true;

        this.voxels.forEach((v, i) => {
            const t = this.rebuildTargets[i];
            if (t.isRubble) return;

            if (elapsed < t.delay) {
                allDone = false;
                return;
            }

            const speed = 0.12;
            v.x += (t.x - v.x) * speed;
            v.y += (t.y - v.y) * speed;
            v.z += (t.z - v.z) * speed;
            // Rotate back to zero
            v.rx += (0 - v.rx) * speed;
            v.ry += (0 - v.ry) * speed;
            v.rz += (0 - v.rz) * speed;

            // Color transition towards target color
            if (t.targetColor) {
                v.color.lerp(t.targetColor, 0.15);
            }

            // Check if reached
            if ((t.x - v.x) ** 2 + (t.y - v.y) ** 2 + (t.z - v.z) ** 2 > 0.01) {
                allDone = false;
            } else {
                // Snap to grid and exact color
                v.x = t.x; v.y = t.y; v.z = t.z;
                v.rx = 0; v.ry = 0; v.rz = 0;
                if (t.targetColor) {
                    v.color.copy(t.targetColor);
                }
            }
        });

        if (allDone) {
            // Final pass to ensure 100% exact colors on completion
            this.voxels.forEach((v, i) => {
                const t = this.rebuildTargets[i];
                if (t && t.targetColor && !t.isRubble) {
                    v.color.copy(t.targetColor);
                }
            });
            this.state = AppState.STABLE;
            this.onStateChange(this.state);
        }
    } else if (this.state === AppState.STABLE && this.isPlayingAnimation && this.animationFrames.length > 1) {
        const now = performance.now();
        const frameDuration = 1000 / this.animationFps;
        const elapsed = now - this.lastAnimationFrameTime;

        const currentFrame = this.animationFrames[this.currentFrameIndex];
        const nextFrameIndex = (this.currentFrameIndex + 1) % this.animationFrames.length;
        const nextFrame = this.animationFrames[nextFrameIndex];

        if (elapsed >= frameDuration) {
            this.lastAnimationFrameTime = now;
            this.currentFrameIndex = nextFrameIndex;
            if (this.currentFrameIndex === 0 && !this.isLoopingAnimation) {
                this.isPlayingAnimation = false;
            }
            this.notifyAnimationState();
            if (!this.isInterpolatedAnimation && currentFrame) {
                this.applyFrame(currentFrame);
            }
        } else if (this.isInterpolatedAnimation && currentFrame && nextFrame) {
            // Buttery smooth 60fps frame interpolation
            const alpha = Math.min(1.0, elapsed / frameDuration);
            const easeAlpha = alpha * alpha * (3 - 2 * alpha);

            const minLen = Math.min(this.voxels.length, currentFrame.length, nextFrame.length);
            for (let i = 0; i < minLen; i++) {
                const curr = currentFrame[i];
                const nxt = nextFrame[i];
                this.voxels[i].x = curr.x + (nxt.x - curr.x) * easeAlpha;
                this.voxels[i].y = curr.y + (nxt.y - curr.y) * easeAlpha;
                this.voxels[i].z = curr.z + (nxt.z - curr.z) * easeAlpha;

                const cCurr = new THREE.Color(curr.color);
                const cNxt = new THREE.Color(nxt.color);
                this.voxels[i].color.copy(cCurr).lerp(cNxt, easeAlpha);
            }
        }
    } else if (this.state === AppState.SUPERNOVA) {
        const now = Date.now();
        const elapsed = now - this.supernovaStartTime;
        const pLight = this.scene.getObjectByName("supernovaPointLight") as THREE.PointLight | null;
        const cx = this.supernovaCenter.x;
        const cy = this.supernovaCenter.y;
        const cz = this.supernovaCenter.z;

        if (pLight) {
          pLight.position.set(cx, cy, cz);
        }

        // Lock OrbitControls during animation sequence
        this.controls.enabled = false;

        const dxBase = this.baseCameraPos.x - cx;
        const dzBase = this.baseCameraPos.z - cz;
        const baseAngle = Math.atan2(dzBase, dxBase);
        const initialDist = Math.hypot(dxBase, dzBase);

        if (elapsed < 3000) {
            // PHASE 1: IMPLOSION, SLOW-MO & CINEMATIC 360 (0 - 3000ms)
            if (!this.audioPhasePlayed.implosion) {
              this.supernovaAudio.playImplosion();
              this.audioPhasePlayed.implosion = true;
            }

            const progress = elapsed / 3000;
            const easeProgress = Math.pow(progress, 2.5);

            this.bloomPass.threshold = 0.85 - easeProgress * 0.8;
            this.bloomPass.strength = 0.25 + Math.pow(progress, 4) * 5.0;
            
            if (pLight) pLight.intensity = Math.pow(progress, 3) * 15.0;

            // Cinematic 360 orbit around (cx, cz) with controlled framing
            const currentDist = Math.max(25, initialDist * (1.0 - easeProgress * 0.35));
            const currentAngle = baseAngle + progress * Math.PI * 2.0;

            let camX = cx + Math.cos(currentAngle) * currentDist;
            let camY = cy + (this.baseCameraPos.y - cy) * (1.0 - easeProgress * 0.2);
            let camZ = cz + Math.sin(currentAngle) * currentDist;

            // Camera tremble near the end
            if (progress > 0.8) {
              const jitter = Math.pow((progress - 0.8) * 5, 2) * 0.6;
              camX += (Math.random() - 0.5) * jitter;
              camY += (Math.random() - 0.5) * jitter;
              camZ += (Math.random() - 0.5) * jitter;
            }

            this.camera.position.set(camX, camY, camZ);
            this.controls.target.set(cx, cy, cz);
            this.camera.lookAt(cx, cy, cz);

            // Shrinking plasma sphere
            if (this.shockwaveSphereMesh) {
              this.shockwaveSphereMesh.position.set(cx, cy, cz);
              const sphereScale = Math.max(0.01, (1 - easeProgress) * 7.0);
              this.shockwaveSphereMesh.scale.set(sphereScale, sphereScale, sphereScale);
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).opacity = progress * 0.95;
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ffff);
            }

            this.voxels.forEach(v => {
                const pullPower = 0.05 + easeProgress * 0.4;
                v.x += (cx - v.x) * pullPower;
                v.y += (cy - v.y) * pullPower;
                v.z += (cz - v.z) * pullPower;

                const angle = 0.1 + easeProgress * 0.5;
                const relX = v.x - cx;
                const relZ = v.z - cz;
                v.x = cx + relX * Math.cos(angle) - relZ * Math.sin(angle);
                v.z = cz + relX * Math.sin(angle) + relZ * Math.cos(angle);

                v.color.lerp(new THREE.Color(0xffffff), 0.1);
            });
        } else if (elapsed < 4500) {
            // PHASE 2: THERMONUCLEAR DETONATION BLAST (3000 - 4500ms)
            if (!this.audioPhasePlayed.detonation) {
              this.supernovaAudio.playDetonation();
              this.audioPhasePlayed.detonation = true;
            }

            const blastProgress = (elapsed - 3000) / 1500;
            const decay = Math.exp(-blastProgress * 4.0);

            // Camera frame centered with shockwave kickback (non-accumulating)
            const detDist = Math.max(25, initialDist * 0.8);
            let camX = cx + Math.cos(baseAngle) * detDist;
            let camY = cy + (this.baseCameraPos.y - cy);
            let camZ = cz + Math.sin(baseAngle) * detDist;

            const shakeMag = decay * 3.5;
            camX += (Math.random() - 0.5) * shakeMag;
            camY += (Math.random() - 0.5) * shakeMag;
            camZ += (Math.random() - 0.5) * shakeMag;

            this.camera.position.set(camX, camY, camZ);
            this.controls.target.set(cx, cy, cz);
            this.camera.lookAt(cx, cy, cz);

            // Flash & Bloom Flare
            this.bloomPass.strength = 5.0 * decay + 0.3;
            this.bloomPass.threshold = 0.05;
            if (pLight) pLight.intensity = 50.0 * decay;

            // 3D Shockwave Ring Expansion
            if (this.shockwaveRingMesh) {
              this.shockwaveRingMesh.position.set(cx, cy, cz);
              const ringScale = 0.1 + blastProgress * 200.0;
              this.shockwaveRingMesh.scale.set(ringScale, ringScale, ringScale);
              (this.shockwaveRingMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - blastProgress) * 1.0);
            }

            // Expanding Plasma Sphere
            if (this.shockwaveSphereMesh) {
              this.shockwaveSphereMesh.position.set(cx, cy, cz);
              const sphereScale = 0.1 + blastProgress * 120.0;
              this.shockwaveSphereMesh.scale.set(sphereScale, sphereScale, sphereScale);
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - blastProgress) * 0.9);
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00);
            }

            this.voxels.forEach(v => {
                v.x += v.vx;
                v.y += v.vy;
                v.z += v.vz;

                v.vx *= 0.95;
                v.vy *= 0.95;
                v.vz *= 0.95;

                v.rx += v.rvx;
                v.ry += v.rvy;
                v.rz += v.rvz;

                if (blastProgress < 0.2) {
                  v.color.lerp(new THREE.Color(0xffffff), 0.5);
                } else if (blastProgress < 0.5) {
                  v.color.lerp(new THREE.Color(0xff6600), 0.2);
                } else {
                  v.color.lerp(new THREE.Color(v.id % 2 === 0 ? 0x00ffff : 0xaa00ff), 0.15);
                }
            });
        } else if (elapsed < 7500) {
            // PHASE 3: MAGNETIZED VORTEX RE-ASSEMBLY (4500 - 7500ms)
            if (!this.audioPhasePlayed.reassembly) {
              this.supernovaAudio.playReassembly();
              this.audioPhasePlayed.reassembly = true;
            }

            const reassembleProgress = (elapsed - 4500) / 3000;
            const easeOutProgress = 1.0 - Math.pow(1.0 - reassembleProgress, 3);
            
            // Smoothly lerp camera and target back to user baseline
            const detDist = Math.max(25, initialDist * 0.8);
            const startCamX = cx + Math.cos(baseAngle) * detDist;
            const startCamY = cy + (this.baseCameraPos.y - cy);
            const startCamZ = cz + Math.sin(baseAngle) * detDist;

            this.camera.position.x = startCamX + (this.baseCameraPos.x - startCamX) * easeOutProgress;
            this.camera.position.y = startCamY + (this.baseCameraPos.y - startCamY) * easeOutProgress;
            this.camera.position.z = startCamZ + (this.baseCameraPos.z - startCamZ) * easeOutProgress;

            this.controls.target.x = cx + (this.baseControlsTarget.x - cx) * easeOutProgress;
            this.controls.target.y = cy + (this.baseControlsTarget.y - cy) * easeOutProgress;
            this.controls.target.z = cz + (this.baseControlsTarget.z - cz) * easeOutProgress;

            this.camera.lookAt(this.controls.target);

            this.bloomPass.strength = 0.8 * (1 - reassembleProgress) + 0.25;
            this.bloomPass.threshold = 0.85;
            if (pLight) pLight.intensity = 5.0 * (1 - reassembleProgress);

            if (this.shockwaveRingMesh) {
              (this.shockwaveRingMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }
            if (this.shockwaveSphereMesh) {
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }

            this.voxels.forEach((v, i) => {
                const t = this.rebuildTargets[i];
                if (!t) return;

                const dx = t.x - v.x;
                const dy = t.y - v.y;
                const dz = t.z - v.z;

                const pull = 0.08 + reassembleProgress * 0.12;
                const orbit = (1 - reassembleProgress) * 0.35;
                const spinX = -dz * orbit;
                const spinZ = dx * orbit;

                v.x += dx * pull + spinX;
                v.y += dy * pull;
                v.z += dz * pull + spinZ;

                v.rx += (0 - v.rx) * 0.12;
                v.ry += (0 - v.ry) * 0.12;
                v.rz += (0 - v.rz) * 0.12;

                if (t.targetColor) {
                    v.color.lerp(t.targetColor, 0.15);
                }
            });
        } else {
            // PHASE 4: CRYSTALLINE SNAP & STABLE COMPLETION (> 7500ms)
            this.camera.position.copy(this.baseCameraPos);
            this.controls.target.copy(this.baseControlsTarget);
            this.camera.lookAt(this.controls.target);

            this.controls.enabled = true;
            this.controls.update();

            this.bloomPass.threshold = 0.85;
            this.bloomPass.strength = 0.25;
            if (pLight) pLight.intensity = 0;

            if (this.shockwaveRingMesh) {
              (this.shockwaveRingMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }
            if (this.shockwaveSphereMesh) {
              (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }

            this.voxels.forEach((v, i) => {
                const t = this.rebuildTargets[i];
                if (t) {
                    v.x = t.x;
                    v.y = t.y;
                    v.z = t.z;
                    v.rx = 0; v.ry = 0; v.rz = 0;
                    if (t.targetColor) {
                        v.color.copy(t.targetColor);
                    }
                }
            });

            this.state = AppState.STABLE;
            this.onStateChange(this.state);
        }
    }
  }

  public triggerSupernova() {
    if (this.state === AppState.SUPERNOVA) return;
    this.supernovaStartTime = Date.now();
    this.audioPhasePlayed = { implosion: false, detonation: false, reassembly: false };
    this.state = AppState.SUPERNOVA;
    this.onStateChange(this.state);

    this.baseCameraPos.copy(this.camera.position);
    this.baseControlsTarget.copy(this.controls.target);

    // Compute actual model centroid
    let cx = 0, cy = 0, cz = 0;
    if (this.voxels.length > 0) {
      this.voxels.forEach(v => { cx += v.x; cy += v.y; cz += v.z; });
      cx /= this.voxels.length;
      cy /= this.voxels.length;
      cz /= this.voxels.length;
    } else {
      cy = 8;
    }
    this.supernovaCenter.set(cx, cy, cz);

    if (this.shockwaveRingMesh) {
      this.shockwaveRingMesh.position.set(cx, cy, cz);
      this.shockwaveRingMesh.scale.set(0.1, 0.1, 0.1);
      (this.shockwaveRingMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.shockwaveSphereMesh) {
      this.shockwaveSphereMesh.position.set(cx, cy, cz);
      this.shockwaveSphereMesh.scale.set(0.1, 0.1, 0.1);
      (this.shockwaveSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    const targetModel = this.currentModelData.length > 0 
      ? this.currentModelData 
      : this.voxels.map(v => ({ x: v.x, y: v.y, z: v.z, color: '#' + v.color.getHexString() }));
    
    // Assign targets with exact greedy color matching
    const available = this.voxels.map((v, i) => ({ index: i, color: v.color }));
    this.rebuildTargets = new Array(this.voxels.length).fill(null);

    for (let t = 0; t < targetModel.length; t++) {
      const targetHex = targetModel[t].color;
      let bestDist = 9999;
      let bestIdx = -1;
      for (let a = 0; a < available.length; a++) {
        if (this.rebuildTargets[a] !== null) continue;
        const d = this.getColorDist(available[a].color, targetHex);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = a;
        }
      }
      if (bestIdx !== -1) {
        const target = targetModel[t];
        this.rebuildTargets[bestIdx] = {
          x: target.x,
          y: target.y,
          z: target.z,
          targetColor: new THREE.Color(target.color),
          delay: 0
        };
      }
    }

    // Fill remaining targets if any
    for (let i = 0; i < this.voxels.length; i++) {
      if (!this.rebuildTargets[i]) {
        this.rebuildTargets[i] = {
          x: this.voxels[i].x,
          y: this.voxels[i].y,
          z: this.voxels[i].z,
          targetColor: this.voxels[i].color.clone(),
          delay: 0
        };
      }
    }

    // High velocity 3D radial blast vectors outwards from model centroid
    this.voxels.forEach((v) => {
      const dx = v.x - cx;
      const dy = v.y - cy;
      const dz = v.z - cz;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
      
      const speed = 2.8 + Math.random() * 3.8;
      v.vx = (dx / len) * speed + (Math.random() - 0.5) * 1.5;
      v.vy = (dy / len) * speed + (Math.random() - 0.2) * 1.8;
      v.vz = (dz / len) * speed + (Math.random() - 0.5) * 1.5;
      
      v.rvx = (Math.random() - 0.5) * 1.4;
      v.rvy = (Math.random() - 0.5) * 1.4;
      v.rvz = (Math.random() - 0.5) * 1.4;
    });
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.isGameModeActive) {
      this.gameModeEngine.update(1 / 60);
    } else {
      this.controls.update();
      this.updatePhysics();
      
      this.updateLODSystem(); // Execute Dynamic LOD system
      
      // Always draw during active animation, rotation, or dynamic physics state
      if (this.state !== AppState.STABLE || this.controls.autoRotate || (this.isPlayingAnimation && this.animationFrames.length > 1)) {
          this.currentLodLevel = 1; // Force full detail during animations/explosions
          this.draw();
      }
    }
    
    this.composer.render();
  }

  // --- GAME MODE PUBLIC INTERFACE ---
  public startGameMode(playerMode: PlayerMode, customVoxels?: VoxelData[]) {
    this.isGameModeActive = true;
    if (this.instanceMesh) {
      this.instanceMesh.visible = false;
    }
    this.controls.enabled = false;
    
    // Sunset Magic Hour Atmospheric Overhaul
    this.scene.background = new THREE.Color(0x1a0a2a);
    this.scene.fog = new THREE.FogExp2(0x280e3d, 0.007);
    this.bloomPass.strength = 1.35;
    this.bloomPass.threshold = 0.32;
    this.bloomPass.radius = 0.90;

    const voxelsToUse = customVoxels || this.getCurrentVoxels();
    this.gameModeEngine.start(playerMode, voxelsToUse);
  }

  public stopGameMode() {
    if (!this.isGameModeActive) return;
    this.isGameModeActive = false;
    this.gameModeEngine.stop();

    if (this.instanceMesh) {
      this.instanceMesh.visible = true;
    }
    this.controls.enabled = true;
    
    // Revert to Studio Lighting Mode
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR);
    this.scene.fog = new THREE.Fog(CONFIG.BG_COLOR, 80, 220);
    this.bloomPass.strength = 0.25;
    this.bloomPass.threshold = 0.85;
    this.bloomPass.radius = 0.3;

    this.camera.position.set(40, 40, 80);
    this.controls.target.set(0, 5, 0);
    this.draw();
  }

  public setPlayerMode(mode: PlayerMode) {
    this.gameModeEngine.setPlayerMode(mode);
  }

  public setPlayerVoxels(voxels: VoxelData[]) {
    this.gameModeEngine.setPlayerVoxels(voxels);
  }

  public triggerGameAction() {
    this.gameModeEngine.triggerAction();
  }

  public setGameVirtualInput(fwd: number, strafe: number, ascend: number = 0, boost: boolean = false) {
    this.gameModeEngine.setVirtualInput(fwd, strafe, ascend, boost);
  }

  public rotateGameCamera(deltaYaw: number, deltaPitch: number = 0) {
    this.gameModeEngine.rotateCamera(deltaYaw, deltaPitch);
  }

  public toggleCinematicCamera(): boolean {
    return this.gameModeEngine.toggleCinematicCamera();
  }

  public triggerGameJump() {
    this.gameModeEngine.triggerJump();
  }

  public setGameWeaponMode(mode: WeaponMode) {
    this.gameModeEngine.setWeaponMode(mode);
  }

  public purchaseGameUpgrade(key: keyof MothershipUpgrades): boolean {
    return this.gameModeEngine.purchaseUpgrade(key);
  }

  public deployGameMutant(): boolean {
    return this.gameModeEngine.deployMutant();
  }

  public triggerGameBarrelRoll(): boolean {
    return this.gameModeEngine.triggerBarrelRoll();
  }

  public setOnGameTelemetryUpdate(cb: (t: GameModeTelemetry) => void) {
    this.gameModeEngine.setOnTelemetryUpdate(cb);
  }

  public handleResize() {
      if (this.camera && this.renderer) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
  }
  
  public setAutoRotate(enabled: boolean) {
    if (this.controls) {
        this.controls.autoRotate = enabled;
    }
  }

  public clearForStreaming() {
    this.voxels = [];
    this.clearGhosts();
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.geometry.dispose();
      if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach(m => m.dispose());
      } else {
          this.instanceMesh.material.dispose();
      }
    }
    const geometry = this.highResGeo;
    const material = new THREE.MeshStandardMaterial({ 
      roughness: 0.4, 
      metalness: 0.1
    });
    this.instanceMesh = new THREE.InstancedMesh(geometry, material, 5000); 
    this.instanceMesh.count = 0;
    this.instanceMesh.castShadow = true;
    this.instanceMesh.receiveShadow = true;
    this.instanceMesh.frustumCulled = false;
    this.scene.add(this.instanceMesh);
    
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
    this.onCountChange(0);
  }

  public addStreamedVoxel(v: VoxelData) {
    if (!this.instanceMesh) return;
    if (this.voxels.length >= 5000) return;
    
    const c = new THREE.Color(v.color);
    c.offsetHSL(0, 0, (Math.random() * 0.1) - 0.05);
    
    const simVoxel = {
        id: this.voxels.length,
        x: v.x, y: v.y, z: v.z, color: c,
        vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
        rvx: 0, rvy: 0, rvz: 0
    };
    this.voxels.push(simVoxel);
    
    const i = this.voxels.length - 1;
    this.dummy.position.set(simVoxel.x, simVoxel.y, simVoxel.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    
    this.instanceMesh.setMatrixAt(i, this.dummy.matrix);
    this.instanceMesh.setColorAt(i, simVoxel.color);
    
    this.instanceMesh.count = this.voxels.length;
    this.instanceMesh.instanceMatrix.needsUpdate = true;
    if (this.instanceMesh.instanceColor) {
        this.instanceMesh.instanceColor.needsUpdate = true;
    }
    
    this.onCountChange(this.voxels.length);
  }

  public clearGhostsForStreaming() {
    this.ghostVoxels = [];
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh.geometry.dispose();
      if (Array.isArray(this.ghostMesh.material)) {
          this.ghostMesh.material.forEach(m => m.dispose());
      } else {
          this.ghostMesh.material.dispose();
      }
    }
    const geometry = this.highResGeo;
    const material = new THREE.MeshPhysicalMaterial({ 
        roughness: 0.2, 
        metalness: 0.9, 
        clearcoat: 1.0,
        transparent: true, 
        opacity: 0.3,
        emissive: new THREE.Color(0x222244)
    });
    this.ghostMesh = new THREE.InstancedMesh(geometry, material, 5000); 
    this.ghostMesh.count = 0;
    this.scene.add(this.ghostMesh);
  }

  public addStreamedGhostVoxel(v: VoxelData) {
    if (!this.ghostMesh) return;
    if (this.ghostVoxels.length >= 5000) return;
    
    this.ghostVoxels.push(v);
    
    const i = this.ghostVoxels.length - 1;
    this.dummy.position.set(v.x, v.y, v.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    
    this.ghostMesh.setMatrixAt(i, this.dummy.matrix);
    this.ghostMesh.setColorAt(i, new THREE.Color(v.color));
    
    this.ghostMesh.count = this.ghostVoxels.length;
    this.ghostMesh.instanceMatrix.needsUpdate = true;
    if (this.ghostMesh.instanceColor) {
        this.ghostMesh.instanceColor.needsUpdate = true;
    }
  }
  
  public clearGhosts() {
      if (this.ghostMesh) {
          this.scene.remove(this.ghostMesh);
          this.ghostMesh = null;
      }
      this.ghostVoxels = [];
  }

  public getJsonData(): string {
      const data = this.voxels.map((v, i) => ({
          id: i,
          x: +v.x.toFixed(2),
          y: +v.y.toFixed(2),
          z: +v.z.toFixed(2),
          c: '#' + v.color.getHexString()
      }));
      return JSON.stringify(data, null, 2);
  }
  
  public getUniqueColors(): string[] {
    const colors = new Set<string>();
    this.voxels.forEach(v => {
        colors.add('#' + v.color.getHexString());
    });
    return Array.from(colors);
  }

  public dispose() {
    this.cleanup();
  }

  public cleanup() {
    cancelAnimationFrame(this.animationId);
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
