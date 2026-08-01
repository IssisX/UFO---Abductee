/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PlayerMode, GameModeTelemetry, VoxelData, Quest, WeaponMode, MothershipUpgrades, RadarBlip } from '../types';
import { CityGenerator, CityWorld, Pedestrian } from './CityGenerator';
import { CONFIG } from '../utils/voxelConstants';
import { SpatialHashGrid } from './SpatialHashGrid';
import { GameAudioEngine } from './GameAudioEngine';
import { UFO_QUESTS, ALIEN_QUESTS } from './GameQuests';

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

export class GameModeEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private audio: GameAudioEngine;

  private cityWorld: CityWorld | null = null;
  private playerGroup: THREE.Group;
  private playerMesh: THREE.InstancedMesh | null = null;
  private tractorBeamMesh: THREE.Mesh | null = null;
  private tractorBeamGroup: THREE.Group | null = null;
  private beamEnergyCore: THREE.Mesh | null = null;
  private beamGroundRing: THREE.Mesh | null = null;
  private beamSurfaceLight: THREE.PointLight | null = null;
  private beamSpiralParticles: THREE.Mesh[] = [];
  private particleGroup: THREE.Group;

  // Abduction & Target Alignment Engine State
  private targetAlignmentState: 'SEARCHING' | 'ALIGNING' | 'LOCK_STABLE' | 'ABDUCTING' | 'SUCCESS' | 'ALIGNMENT_LOST' = 'SEARCHING';
  private alignmentProgress: number = 0; // 0-100%
  private abductionProgress: number = 0; // 0-100%
  private activeAbductee: Pedestrian | null = null;
  private activeAbducteeIdx: number = -1;
  private abductionTimer: number = 0; // 0 to 4.5s
  private alignmentHoldTimer: number = 0;
  private targetName: string = "CIVILIAN";

  // Spatial Hash Grid Optimization for O(1) Pedestrian Lookup
  private pedSpatialHash = new SpatialHashGrid<Pedestrian>(25);

  private isActive = false;
  private playerMode: PlayerMode = 'UFO';
  
  // Gamification State
  private score = 0;
  private highScore = 0;
  private energy = 100;
  private comboMultiplier = 1;
  private comboTimer = 0;
  private wantedLevel = 0; // 0 to 5 Stars
  private abductionCount = 0;
  private policeSpawnCooldown = 0;
  private lastSirenSoundTime = 0;
  private wantedDecayTimer = 0;
  private currentQuestIndex = 0;
  private quests: Quest[] = JSON.parse(JSON.stringify(UFO_QUESTS));
  private questCompletedFlash: string | null = null;
  
  // Advanced Flight Sim State
  private flightMode: 'hover' | 'jet' = 'hover';
  private jetPitch: number = 0;
  private jetRoll: number = 0;
  private jetThrottle: number = 0;
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

  // --- PHYSICS ENGINE ---
  private physicsWorld: CANNON.World;
  private ufoBody: CANNON.Body | null = null;
  private terrainBodies: CANNON.Body[] = [];
  private debrisBodies: { mesh: THREE.Mesh, body: CANNON.Body }[] = [];
  private physicsActive = false;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.audio = new GameAudioEngine();

    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
    });
    this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
    (this.physicsWorld.solver as CANNON.GSSolver).iterations = 10;
    
    // Add default floor plane
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material({ friction: 0.1, restitution: 0.1 }) });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, CONFIG.FLOOR_Y, 0);
    this.physicsWorld.addBody(groundBody);

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
    this.tractorBeamGroup = new THREE.Group();
    this.tractorBeamGroup.name = "TractorBeamGroup";

    // 1. Outer Volumetric Cone Cylinder
    const outerGeo = new THREE.CylinderGeometry(0.8, 5.5, 30, 24, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.tractorBeamMesh = new THREE.Mesh(outerGeo, outerMat);
    this.tractorBeamMesh.position.set(0, -15, 0);

    // 2. Inner Concentrated Energy Core Column
    const coreGeo = new THREE.CylinderGeometry(0.3, 2.2, 30, 16, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.beamEnergyCore = new THREE.Mesh(coreGeo, coreMat);
    this.beamEnergyCore.position.set(0, -15, 0);

    // 3. Ground Contact Light Ring Pool
    const ringGeo = new THREE.RingGeometry(0.5, 5.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.beamGroundRing = new THREE.Mesh(ringGeo, ringMat);
    this.beamGroundRing.position.set(0, CONFIG.FLOOR_Y + 0.1, 0);

    // 4. Ground Surface Illuminator Point Light
    this.beamSurfaceLight = new THREE.PointLight(0x00f0ff, 0, 35);
    this.beamSurfaceLight.position.set(0, CONFIG.FLOOR_Y + 2, 0);

    // 5. Ascending Particle Spirals
    const pGeo = new THREE.OctahedronGeometry(0.3, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
    this.beamSpiralParticles = [];
    for (let i = 0; i < 12; i++) {
      const pMesh = new THREE.Mesh(pGeo, pMat);
      this.tractorBeamGroup.add(pMesh);
      this.beamSpiralParticles.push(pMesh);
    }

    this.tractorBeamGroup.add(this.tractorBeamMesh, this.beamEnergyCore);
    this.playerGroup.add(this.tractorBeamGroup);
    this.scene.add(this.beamGroundRing, this.beamSurfaceLight);
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

    // --- PHYSICS INIT ---
    this.physicsActive = true;
    if (this.ufoBody) {
      this.physicsWorld.removeBody(this.ufoBody);
    }
    this.terrainBodies.forEach(b => this.physicsWorld.removeBody(b));
    this.terrainBodies = [];
    this.debrisBodies.forEach(d => {
      this.physicsWorld.removeBody(d.body);
      this.scene.remove(d.mesh);
    });
    this.debrisBodies = [];

    // Sunset Magic Hour Lighting
    const sunsetSunLight = new THREE.DirectionalLight(0xffa044, 3.2);
    sunsetSunLight.position.set(-180, 55, -220);
    sunsetSunLight.castShadow = true;
    this.scene.add(sunsetSunLight);

    const sunsetHemiLight = new THREE.HemisphereLight(0xff8866, 0x2a1038, 1.6);
    this.scene.add(sunsetHemiLight);

    // Glowing Sunset Sun Object on horizon
    const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });
    const sunDiscMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 16), sunDiscMat);
    sunDiscMesh.position.set(-320, 45, -380);
    this.scene.add(sunDiscMesh);

    const mass = mode === 'UFO' ? 500 : 80;
    const startY = mode === 'UFO' ? 85 : CONFIG.FLOOR_Y + 2; // Start UFO much higher over city skyline
    this.ufoBody = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(0, startY, mode === 'UFO' ? 0 : 12),
      shape: new CANNON.Sphere(mode === 'UFO' ? 3.5 : 1.2),
      linearDamping: 0.8,
      angularDamping: 0.9,
    });
    
    if (mode === 'UFO') {
      this.ufoBody.addEventListener('collide', (e: any) => {
        const contactNormal = new CANNON.Vec3();
        e.contact.ni.negate(contactNormal);
        
        // Calculate impact velocity magnitude
        const impactVelocity = e.contact.getImpactVelocityAlongNormal();
        if (Math.abs(impactVelocity) > 15) {
          this.handleUfoImpact(e.body.position, impactVelocity);
        }
      });
    }

    this.physicsWorld.addBody(this.ufoBody);

    // Add building colliders to physics world
    this.cityWorld.colliders.forEach(col => {
      const shape = new CANNON.Box(new CANNON.Vec3(col.width / 2, col.height / 2, col.depth / 2));
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(col.x, CONFIG.FLOOR_Y + col.height / 2, col.z);
      this.physicsWorld.addBody(body);
      this.terrainBodies.push(body);
    });

    // 2. Build Player Entity Mesh
    this.buildPlayerMesh(playerVoxels);
    this.scene.add(this.playerGroup);
    this.scene.add(this.particleGroup);

    // Initial Position
    if (mode === 'UFO') {
      this.posX = 0;
      this.posY = 85;
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

  // --- WEAPON & MOTHERSHIP UPGRADES STATE ---
  public weaponMode: WeaponMode = 'tractor';
  public credits: number = 2500;
  public upgrades: MothershipUpgrades = {
    beamForce: 1,
    engineSpeed: 1,
    repulsorRadius: 1,
    disintegratorPower: 1,
    vortexRange: 1,
    energyCore: 1,
  };

  // --- AERODYNAMIC FLIGHT & BARREL ROLL STATE ---
  public barrelRollTimer: number = 0;
  public barrelRollCooldown: number = 0;
  public currentRollAngle: number = 0;
  public currentPitchAngle: number = 0;
  public currentGForce: number = 1.0;
  public lastInputDevice: 'keyboard' | 'gamepad' = 'keyboard';

  public triggerBarrelRoll(): boolean {
    if (this.playerMode !== 'UFO' || this.barrelRollCooldown > 0) return false;
    this.barrelRollTimer = 0.5;
    this.barrelRollCooldown = 1.8;
    this.audio.playWindBoostSound();
    this.screenShake = 1.8;
    
    if (this.flightMode === 'jet') {
      this.jetThrottle = 1.5; // Boost throttle
    } else {
      this.velX *= 1.6;
      this.velZ *= 1.6;
    }

    // Sonic boom shockwave ring
    const ringGeo = new THREE.RingGeometry(2, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(this.posX, this.posY, this.posZ);
    this.particleGroup.add(ring);

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.4) {
        ring.scale.addScalar(0.4);
        ringMat.opacity = 0.9 * (1 - elapsed / 0.4);
        requestAnimationFrame(anim);
      } else {
        this.particleGroup.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    anim();
    return true;
  }

  private fireHomingTorpedoes() {
    if (this.interceptorJets.length === 0 && this.policeChasers.length === 0) return;
    
    let targetJet: any = null;
    let targetPolice: any = null;
    let minDist = Infinity;
    
    let closestJetIdx = -1;
    for (let i = 0; i < this.interceptorJets.length; i++) {
        const jet = this.interceptorJets[i];
        const dist = Math.hypot(jet.posX - this.posX, jet.posY - this.posY, jet.posZ - this.posZ);
        if (dist < minDist) {
          minDist = dist;
          closestJetIdx = i;
        }
    }

    if (this.flightMode === 'jet') {
        // Enforce lock-on for jets to fire in flight mode
        if (closestJetIdx !== -1 && minDist < 120) {
            targetJet = this.interceptorJets[closestJetIdx];
        } else {
            return; // No lock, can't fire
        }
    } else {
        // Hover mode auto-targets closest
        if (closestJetIdx !== -1) {
            targetJet = this.interceptorJets[closestJetIdx];
        }
    }

    if (!targetJet) {
      for (const p of this.policeChasers) {
        const dist = p.mesh.position.distanceTo(this.playerGroup.position);
        if (dist < minDist) {
          minDist = dist;
          targetPolice = p;
        }
      }
    }

    if ((!targetJet && !targetPolice) || minDist > 120) return;

    this.audio.playLaserSound();
    const missileGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.5, 2.5, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.rotation.x = Math.PI / 2;
    missileGroup.add(bodyMesh);

    missileGroup.position.set(this.posX, this.posY, this.posZ);
    this.scene.add(missileGroup);

    const startTime = performance.now();

    const updateMissile = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 3.0) { // Extended lifetime for moving targets
        let currentTargetPos = new THREE.Vector3();
        if (targetJet) {
            currentTargetPos.set(targetJet.posX, targetJet.posY, targetJet.posZ);
        } else if (targetPolice) {
            currentTargetPos.copy(targetPolice.mesh.position);
        }
        
        // Homing turn logic (fast turn rate)
        missileGroup.lookAt(currentTargetPos);
        // Move forward constantly at high speed
        const speed = 150.0 * (1 / 60); // approx delta per frame at 60fps
        missileGroup.translateZ(speed);

        if (Math.random() < 0.6) {
          const sGeo = new THREE.SphereGeometry(0.3, 4, 4);
          const sMat = new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.8 });
          const sMesh = new THREE.Mesh(sGeo, sMat);
          sMesh.position.copy(missileGroup.position);
          this.scene.add(sMesh);
          setTimeout(() => {
            this.scene.remove(sMesh);
            sGeo.dispose();
            sMat.dispose();
          }, 200);
        }

        if (missileGroup.position.distanceTo(currentTargetPos) < 10.0) {
          this.explodeObject(currentTargetPos, 0xef4444);
          this.audio.playExplosionSound();
          this.screenShake = 2.5;
          this.score += 1500;
          this.credits += 400;

          if (targetJet) {
              const idx = this.interceptorJets.indexOf(targetJet);
              if (idx !== -1) {
                  this.scene.remove(this.interceptorJets[idx].mesh);
                  this.interceptorJets.splice(idx, 1);
              }
          } else if (targetPolice) {
              const idx = this.policeChasers.indexOf(targetPolice);
              if (idx !== -1) {
                  this.physicsWorld.removeBody(targetPolice.body);
                  this.scene.remove(targetPolice.mesh);
                  this.policeChasers.splice(idx, 1);
              }
          }

          this.scene.remove(missileGroup);
          bodyGeo.dispose();
          bodyMat.dispose();
        } else {
          requestAnimationFrame(updateMissile);
        }
      } else {
        this.scene.remove(missileGroup);
        bodyGeo.dispose();
        bodyMat.dispose();
      }
    };
    updateMissile();
  }

  public setWeaponMode(mode: WeaponMode) {
    this.weaponMode = mode;
    this.updateBeamVisuals();
  }

  public purchaseUpgrade(key: keyof MothershipUpgrades): boolean {
    const currentLvl = this.upgrades[key];
    if (currentLvl >= 5) return false;
    const cost = currentLvl * 1000;
    if (this.credits >= cost) {
      this.credits -= cost;
      this.upgrades[key] += 1;
      this.audio.playAbductionSound();
      return true;
    }
    return false;
  }

  private updateBeamVisuals() {
    if (!this.tractorBeamMesh || !this.beamEnergyCore || !this.beamGroundRing) return;
    
    let outerColor = 0x00f0ff;
    let coreColor = 0xffffff;
    
    if (this.weaponMode === 'repulsor') {
      outerColor = 0xff5500;
      coreColor = 0xffd700;
    } else if (this.weaponMode === 'disintegrator') {
      outerColor = 0xd946ef;
      coreColor = 0xa855f7;
    } else if (this.weaponMode === 'vortex') {
      outerColor = 0x10b981;
      coreColor = 0x34d399;
    } else if (this.weaponMode === 'orbital_laser') {
      outerColor = 0xff0055;
      coreColor = 0xffd700;
    }

    (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).color.setHex(outerColor);
    (this.beamEnergyCore.material as THREE.MeshBasicMaterial).color.setHex(coreColor);
    (this.beamGroundRing.material as THREE.MeshBasicMaterial).color.setHex(outerColor);
    if (this.beamSurfaceLight) this.beamSurfaceLight.color.setHex(outerColor);
  }

  public setPlayerMode(mode: PlayerMode) {
    this.playerMode = mode;
    const questSet = mode === 'Alien' ? ALIEN_QUESTS : UFO_QUESTS;
    this.quests = JSON.parse(JSON.stringify(questSet));
    this.currentQuestIndex = 0;

    if (mode === 'UFO' && this.posY < 60) {
      this.posY = 85;
    } else if (mode === 'Alien') {
      this.posY = CONFIG.FLOOR_Y + 1.2;
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
      const vScale = this.playerMode === 'Alien' ? 0.333 : 1.0;
      dummy.position.set((v.x - cx) * vScale, ((v.y - cy) * vScale) + (this.playerMode === 'Alien' ? 2.5 : 0), (v.z - cz) * vScale);
      dummy.scale.set(vScale, vScale, vScale);
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
      if (e.key) this.keys[e.key] = true;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      
      // Prevent browser scrolling for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyR') {
        this.triggerBarrelRoll();
      }
      if (e.code === 'F1') { e.preventDefault(); this.setWeaponMode('tractor'); }
      if (e.code === 'F2') { e.preventDefault(); this.setWeaponMode('repulsor'); }
      if (e.code === 'F3') { e.preventDefault(); this.setWeaponMode('disintegrator'); }
      if (e.code === 'F4') { e.preventDefault(); this.setWeaponMode('vortex'); }
      if (e.code === 'F5') { e.preventDefault(); this.setWeaponMode('orbital_laser'); }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      this.keys[e.code] = false;
      if (e.key) this.keys[e.key] = false;
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
    if (this.playerMode === 'UFO') {
      if (this.flightMode === 'jet') {
        this.fireHomingTorpedoes();
      } else {
        if (this.weaponMode === 'tractor') {
          this.audio.playLaserSound();
          this.screenShake = 0.8;
          if (this.tractorBeamMesh) {
            (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
          }
          this.attemptAbduction();
          this.spawnEMPWave();
        } else if (this.weaponMode === 'repulsor') {
          this.fireRepulsorPulse();
        } else if (this.weaponMode === 'disintegrator') {
          this.fireDisintegratorRay();
        } else if (this.weaponMode === 'vortex') {
          this.triggerGravitationalVortex();
        } else if (this.weaponMode === 'orbital_laser') {
          this.fireOrbitalLaser();
        }
        if (this.interceptorJets.length > 0 || this.policeChasers.length > 0) {
          this.fireHomingTorpedoes();
        }
      }
    } else {
      this.interactAsAlien();
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

  private fireRepulsorPulse() {
    this.audio.playExplosionSound();
    this.screenShake = 1.8;
    
    // Blast outwards all physics bodies within shockwave radius
    const radius = 25 * (1 + this.upgrades.repulsorRadius * 0.2);
    const forceMag = 1800 * (1 + this.upgrades.repulsorRadius * 0.25);
    const ufoPos = new CANNON.Vec3(this.posX, this.posY, this.posZ);

    for (const body of this.physicsWorld.bodies) {
      if (body === this.ufoBody) continue;
      const dist = body.position.distanceTo(ufoPos);
      if (dist <= radius && dist > 0.1) {
        const dir = body.position.vsub(ufoPos);
        dir.normalize();
        const factor = (1 - dist / radius) * forceMag;
        body.applyImpulse(dir.scale(factor), body.position);
      }
    }

    // Spawn expanding orange energy ring mesh
    const ringGeo = new THREE.RingGeometry(1, 2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5500, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(this.posX, CONFIG.FLOOR_Y + 0.5, this.posZ);
    this.scene.add(ring);

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.6) {
        const scale = 1 + elapsed * radius * 0.8;
        ring.scale.set(scale, scale, scale);
        ringMat.opacity = 0.9 * (1 - elapsed / 0.6);
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    anim();
  }

  private fireDisintegratorRay() {
    this.audio.playLaserSound();
    this.screenShake = 1.2;
    this.credits += 150;

    // Disintegrate nearest physics debris or building voxels underneath UFO
    const rayRadius = 4 * (1 + this.upgrades.disintegratorPower * 0.3);
    const ufoX = this.posX;
    const ufoZ = this.posZ;

    // Destroy debris bodies near ray
    for (let i = this.debrisBodies.length - 1; i >= 0; i--) {
      const d = this.debrisBodies[i];
      const dx = d.body.position.x - ufoX;
      const dz = d.body.position.z - ufoZ;
      if (Math.hypot(dx, dz) <= rayRadius) {
        // Disintegrate debris!
        this.spawnAshParticles(d.body.position);
        this.physicsWorld.removeBody(d.body);
        this.scene.remove(d.mesh);
        this.debrisBodies.splice(i, 1);
      }
    }

    // Disintegrate building colliders
    if (this.cityWorld) {
      for (let i = this.cityWorld.colliders.length - 1; i >= 0; i--) {
        const col = this.cityWorld.colliders[i];
        const dx = col.x - ufoX;
        const dz = col.z - ufoZ;
        if (Math.hypot(dx, dz) <= rayRadius + col.width / 2) {
          this.spawnAshParticles(new CANNON.Vec3(col.x, CONFIG.FLOOR_Y + col.height / 2, col.z));
          // Shrink or remove building collider
          col.height = Math.max(0, col.height - 8);
          if (col.height <= 0) {
            this.cityWorld.colliders.splice(i, 1);
          }
        }
      }
    }
  }

  private triggerGravitationalVortex() {
    this.audio.playAbductionSound();
    this.screenShake = 1.0;

    const vortexRadius = 22 * (1 + this.upgrades.vortexRange * 0.2);
    const ufoPos = new CANNON.Vec3(this.posX, this.posY, this.posZ);

    for (const body of this.physicsWorld.bodies) {
      if (body === this.ufoBody) continue;
      const dist = body.position.distanceTo(ufoPos);
      if (dist <= vortexRadius && dist > 0.2) {
        // Spiral pull
        const toUfo = ufoPos.vsub(body.position);
        toUfo.y = 0;
        toUfo.normalize();

        // Tangential vector for spinning
        const tangent = new CANNON.Vec3(-toUfo.z, 0, toUfo.x);
        
        const pull = toUfo.scale(120);
        const spin = tangent.scale(160);
        const lift = new CANNON.Vec3(0, 200, 0);

        body.applyForce(pull.vadd(spin).vadd(lift), body.position);
      }
    }
  }

  // --- BIO-SPECIMENS & CYBER-MUTANTS ---
  public bioSpecimens: number = 5;
  public mutantsDeployed: number = 0;

  public deployMutant(): boolean {
    if (this.bioSpecimens < 3) return false;
    this.bioSpecimens -= 3;
    this.mutantsDeployed++;
    this.audio.playExplosionSound();
    this.screenShake = 2.0;

    // Spawn 6-meter tall Cyber-Mutant monster on ground
    const mutantGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(3, 5, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.2, metalness: 0.8 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 2.5;

    const headGeo = new THREE.BoxGeometry(2, 2, 2);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 5.5;

    mutantGroup.add(bodyMesh, headMesh);
    mutantGroup.position.set(this.posX, CONFIG.FLOOR_Y, this.posZ);
    this.scene.add(mutantGroup);

    // Mutant walks around smashing buildings
    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 12.0) {
        mutantGroup.position.x += Math.sin(elapsed * 2) * 0.3;
        mutantGroup.position.z += Math.cos(elapsed * 2) * 0.3;
        mutantGroup.rotation.y = elapsed * 1.5;

        if (this.cityWorld) {
          for (let i = this.cityWorld.colliders.length - 1; i >= 0; i--) {
            const col = this.cityWorld.colliders[i];
            const dx = col.x - mutantGroup.position.x;
            const dz = col.z - mutantGroup.position.z;
            if (Math.hypot(dx, dz) <= 8) {
              this.spawnAshParticles(new CANNON.Vec3(col.x, CONFIG.FLOOR_Y + col.height / 2, col.z));
              this.cityWorld.colliders.splice(i, 1);
              this.credits += 200;
              this.score += 800;
            }
          }
        }
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(mutantGroup);
        bodyGeo.dispose();
        bodyMat.dispose();
        headGeo.dispose();
        headMat.dispose();
      }
    };
    anim();
    return true;
  }

  // --- ATMOSPHERIC ORBITAL LASER SUPERWEAPON ---
  private fireOrbitalLaser() {
    this.audio.playExplosionSound();
    this.screenShake = 3.5;
    this.credits += 600;
    this.score += 2500;

    const beamGeo = new THREE.CylinderGeometry(8, 12, 200, 32);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.95 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(this.posX, CONFIG.FLOOR_Y + 100, this.posZ);
    this.scene.add(beam);

    const coreGeo = new THREE.CylinderGeometry(3, 5, 200, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 1.0 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(this.posX, CONFIG.FLOOR_Y + 100, this.posZ);
    this.scene.add(core);

    const radius = 30;
    const ufoX = this.posX;
    const ufoZ = this.posZ;

    for (let i = this.debrisBodies.length - 1; i >= 0; i--) {
      const d = this.debrisBodies[i];
      const dx = d.body.position.x - ufoX;
      const dz = d.body.position.z - ufoZ;
      if (Math.hypot(dx, dz) <= radius) {
        this.spawnAshParticles(d.body.position);
        this.physicsWorld.removeBody(d.body);
        this.scene.remove(d.mesh);
        this.debrisBodies.splice(i, 1);
      }
    }

    if (this.cityWorld) {
      for (let i = this.cityWorld.colliders.length - 1; i >= 0; i--) {
        const col = this.cityWorld.colliders[i];
        const dx = col.x - ufoX;
        const dz = col.z - ufoZ;
        if (Math.hypot(dx, dz) <= radius + col.width / 2) {
          this.spawnAshParticles(new CANNON.Vec3(col.x, CONFIG.FLOOR_Y + col.height / 2, col.z));
          this.cityWorld.colliders.splice(i, 1);
        }
      }
    }

    const ufoPos = new CANNON.Vec3(this.posX, this.posY, this.posZ);
    for (const body of this.physicsWorld.bodies) {
      if (body === this.ufoBody) continue;
      const dist = body.position.distanceTo(ufoPos);
      if (dist <= radius && dist > 0.1) {
        body.applyImpulse(new CANNON.Vec3((Math.random()-0.5)*1000, 2500, (Math.random()-0.5)*1000), body.position);
      }
    }

    const startTime = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 1.0) {
        beamMat.opacity = 0.95 * (1 - elapsed / 1.0);
        coreMat.opacity = 1.0 * (1 - elapsed / 1.0);
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(beam);
        this.scene.remove(core);
        beamGeo.dispose();
        beamMat.dispose();
        coreGeo.dispose();
        coreMat.dispose();
      }
    };
    anim();
  }

  // --- AIR FORCE INTERCEPTOR JETS ---
  private interceptorJets: Array<{ 
    mesh: THREE.Group; 
    posX: number; posY: number; posZ: number; 
    velX: number; velY: number; velZ: number;
    pitch: number; yaw: number; roll: number;
    shootTimer: number; 
  }> = [];

  private updateInterceptorJets(deltaTime: number) {
    if (this.wantedLevel >= 2 && this.interceptorJets.length < Math.min(5, this.wantedLevel)) {
      const jetGroup = new THREE.Group();
      const bodyGeo = new THREE.ConeGeometry(1.5, 5, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.rotation.x = Math.PI / 2;

      const wingGeo = new THREE.BoxGeometry(6, 0.2, 2);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const wingMesh = new THREE.Mesh(wingGeo, wingMat);

      jetGroup.add(bodyMesh, wingMesh);
      const angle = Math.random() * Math.PI * 2;
      const posX = this.posX + Math.cos(angle) * 200;
      const posZ = this.posZ + Math.sin(angle) * 200;
      const posY = CONFIG.FLOOR_Y + 50 + Math.random() * 50;

      jetGroup.position.set(posX, posY, posZ);
      this.scene.add(jetGroup);

      this.interceptorJets.push({
        mesh: jetGroup,
        posX,
        posY,
        posZ,
        velX: 0, velY: 0, velZ: 0,
        pitch: 0, yaw: angle + Math.PI, roll: 0,
        shootTimer: 0
      });
    }

    for (let i = this.interceptorJets.length - 1; i >= 0; i--) {
      const jet = this.interceptorJets[i];
      
      // Calculate vector to player
      const dx = this.posX - jet.posX;
      const dy = this.posY - jet.posY;
      const dz = this.posZ - jet.posZ;
      const distToPlayer = Math.hypot(dx, dy, dz);

      // Jet AI dogfighting logic
      const targetSpeed = 80;
      
      if (this.flightMode === 'jet') {
          // Advanced Dogfighting AI
          // Calculate heading to player
          const targetYaw = Math.atan2(dx, dz);
          // Calculate pitch to player
          const horizDist = Math.hypot(dx, dz);
          const targetPitch = -Math.atan2(dy, horizDist);

          // Turn towards player smoothly
          let yawDiff = targetYaw - jet.yaw;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          jet.yaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 2.0 * deltaTime);
          
          let pitchDiff = targetPitch - jet.pitch;
          jet.pitch += Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), 2.0 * deltaTime);

          // Bank (roll) into turns
          const targetRoll = -yawDiff * 2.0;
          jet.roll = THREE.MathUtils.lerp(jet.roll, targetRoll, 4.0 * deltaTime);

          // Move forward based on orientation
          const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(jet.pitch, jet.yaw, jet.roll, 'YXZ'));
          jet.velX = forward.x * targetSpeed;
          jet.velY = forward.y * targetSpeed;
          jet.velZ = forward.z * targetSpeed;
          
          // Evasive maneuvers if too close
          if (distToPlayer < 50) {
              jet.velX += Math.cos(performance.now() * 0.001) * 30;
              jet.velY += Math.sin(performance.now() * 0.002) * 30;
          }
      } else {
          // Simple Orbit AI for when player is hovering
          jet.yaw += deltaTime * 0.8;
          const radius = 60 + Math.sin(performance.now() * 0.001 + i) * 20;
          const targetPosX = this.posX + Math.cos(jet.yaw) * radius;
          const targetPosZ = this.posZ + Math.sin(jet.yaw) * radius;
          const targetPosY = this.posY + 15 + Math.sin(performance.now() * 0.002 + i) * 10;
          
          jet.velX = (targetPosX - jet.posX) * 2.0;
          jet.velY = (targetPosY - jet.posY) * 2.0;
          jet.velZ = (targetPosZ - jet.posZ) * 2.0;
          
          // Look tangentially
          jet.yaw = Math.atan2(jet.velX, jet.velZ);
          jet.pitch = 0;
          jet.roll = -0.5; // Bank into the turn
      }

      jet.posX += jet.velX * deltaTime;
      jet.posY += jet.velY * deltaTime;
      jet.posZ += jet.velZ * deltaTime;
      
      // Enforce floor
      if (jet.posY < CONFIG.FLOOR_Y + 10) jet.posY = CONFIG.FLOOR_Y + 10;

      jet.mesh.position.set(jet.posX, jet.posY, jet.posZ);
      jet.mesh.rotation.set(jet.pitch, jet.yaw, jet.roll, 'YXZ');

      jet.shootTimer += deltaTime;
      
      // Only shoot if roughly pointed at player and within range
      const toPlayer = new THREE.Vector3(dx, dy, dz).normalize();
      const jetForward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(jet.pitch, jet.yaw, jet.roll, 'YXZ'));
      const dot = jetForward.dot(toPlayer);

      if (jet.shootTimer >= (this.flightMode === 'jet' ? 1.0 : 1.5) && distToPlayer < 300 && dot > 0.8) {
        jet.shootTimer = 0;
        this.audio.playLaserSound();
        const tracerGeo = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
        const tracerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        tracer.position.set(jet.posX, jet.posY, jet.posZ);
        
        // Shoot slightly ahead of player (leading target)
        tracer.lookAt(this.posX + this.velX * 0.5, this.posY + this.velY * 0.5, this.posZ + this.velZ * 0.5);
        tracer.rotation.x += Math.PI / 2;
        this.scene.add(tracer);

        setTimeout(() => {
          this.scene.remove(tracer);
          tracerGeo.dispose();
          tracerMat.dispose();
        }, 300);
      }
    }
  }

  private spawnAshParticles(pos: CANNON.Vec3) {
    const geo = new THREE.OctahedronGeometry(0.2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(pos.x + (Math.random()-0.5)*2, pos.y + (Math.random()-0.5)*2, pos.z + (Math.random()-0.5)*2);
      this.scene.add(p);

      const velY = Math.random() * 0.2 + 0.1;
      const startTime = performance.now();
      const anim = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 0.5) {
          p.position.y += velY;
          mat.opacity = 0.9 * (1 - elapsed / 0.5);
          requestAnimationFrame(anim);
        } else {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      anim();
    }
  }

  private interactAsAlien() {
    if (!this.cityWorld) return;

    const alienX = this.posX;
    const alienZ = this.posZ;
    const interactRadius = 14;

    // Find closest pedestrian
    let closestIndex = -1;
    let closestDist = Infinity;

    this.cityWorld.pedestrians.forEach((ped, idx) => {
      const dx = ped.mesh.position.x - alienX;
      const dz = ped.mesh.position.z - alienZ;
      const dist = Math.hypot(dx, dz);
      if (dist < interactRadius && dist < closestDist) {
        closestDist = dist;
        closestIndex = idx;
      }
    });

    if (closestIndex !== -1) {
      const ped = this.cityWorld.pedestrians[closestIndex];
      const isScare = Math.random() > 0.4; // 60% scare, 40% talk

      if (isScare) {
        this.audio.playAlienScareSound();
        this.screenShake = 1.0;
        this.spawnImpactSparks(ped.mesh.position);

        const scareQuotes = [
          "😱 CIV: AAAAAGHH!! A REAL GRAY ALIEN! DON'T PROBE ME!",
          "😱 CIV: HELP! IT'S AN EXTRATERRESTRIAL INVASION!",
          "😱 CIV: ZORP ZORP! MY BRAIN IS BEING TELEPATHICALLY ZAPPED!",
          "😱 CIV: DROPPED MY COFFEE AND RAN FOR MY LIFE!",
          "😱 CIV: TAKE MY WALLET JUST DON'T ABDUCT ME!"
        ];
        this.alienTestLog = scareQuotes[Math.floor(Math.random() * scareQuotes.length)];
        
        // Pedestrian runs away at high speed!
        ped.speed = 0.32;
        ped.sign *= -1;

        // Quest check
        const currentQ = this.quests[this.currentQuestIndex];
        if (currentQ && (currentQ.id === 'al1' || currentQ.id === 'al4') && !currentQ.completed) {
          currentQ.progress += 1;
          if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
        }
      } else {
        this.audio.playAlienTelepathySound();
        this.spawnHeartParticles();

        const talkQuotes = [
          "💬 ALIEN: Greetings human! Take me to your leader!",
          "💬 ALIEN: Your species spends 8 hours a day staring at glowing rectangles?",
          "💬 ALIEN: I come in peace... or do I? Just kidding, stay cool!",
          "💬 ALIEN: Is this 'coffee' liquid your primary planetary fuel source?",
          "💬 ALIEN: Do you have Wi-Fi in this quadrant of Earth?"
        ];
        this.alienTestLog = talkQuotes[Math.floor(Math.random() * talkQuotes.length)];

        // Quest check
        const currentQ = this.quests[this.currentQuestIndex];
        if (currentQ && currentQ.id === 'al1' && !currentQ.completed) {
          currentQ.progress += 1;
          if (currentQ.progress >= currentQ.target) this.completeQuest(currentQ);
        }
      }

      this.score += 400 * this.comboMultiplier;
      this.comboMultiplier = Math.min(5, this.comboMultiplier + 1);
      this.comboTimer = 4.0;
    } else {
      // No pedestrian nearby: alien fires a harmless green energy ray into air!
      this.audio.playLaserSound();
      this.spawnEMPWave();
      this.alienTestLog = "🛸 ALIEN RAY: Scanned empty sidewalk - No humans in telepathic range!";
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
      this.bioSpecimens++;
      this.credits += 250;
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

    // Cyber Police Interceptor Hull
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.0, 1.0, 16), bodyMat);
    policeGroup.add(disc);

    // Light Ring
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.18, 8, 16), ringMat);
    ring.rotation.x = Math.PI / 2;
    policeGroup.add(ring);

    // Flashing Siren PointLight
    const sirenLight = new THREE.PointLight(0xff0000, 4, 35);
    sirenLight.position.set(0, 1.2, 0);
    policeGroup.add(sirenLight);

    // Spotlight searchlight projecting onto ground
    const spotlight = new THREE.SpotLight(0x00f0ff, 6, 70, Math.PI / 4, 0.4, 1);
    spotlight.position.set(0, -0.5, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -50, 0);
    policeGroup.add(spotlight);
    policeGroup.add(spotTarget);
    spotlight.target = spotTarget;

    // Spawn far out on city perimeter
    const spawnAngle = Math.random() * Math.PI * 2;
    policeGroup.position.set(
      this.posX + Math.cos(spawnAngle) * 120,
      this.posY + 12 + Math.random() * 8,
      this.posZ + Math.sin(spawnAngle) * 120
    );

    this.scene.add(policeGroup);
    this.policeChasers.push({ mesh: policeGroup, vel: new THREE.Vector3(), sirenLight });
    this.policeSpawnCooldown = 20.0;
    this.audio.playSirenSound();
  }

  private handleUfoImpact(position: CANNON.Vec3, velocity: number) {
    this.screenShake = Math.max(this.screenShake, Math.min(1.5, Math.abs(velocity) * 0.05));
    this.audio.playExplosionSound();
    
    // Create debris from building impact
    const debrisCount = Math.floor(Math.abs(velocity) * 0.5);
    for(let i = 0; i < debrisCount; i++) {
      const size = 0.5 + Math.random() * 1.5;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8, metalness: 0.1 })
      );
      
      const dx = (Math.random() - 0.5) * 10;
      const dy = Math.random() * 5;
      const dz = (Math.random() - 0.5) * 10;
      
      mesh.position.set(position.x + dx, position.y + dy, position.z + dz);
      this.scene.add(mesh);
      
      const body = new CANNON.Body({
        mass: size * 10,
        shape: new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2)),
        position: new CANNON.Vec3(position.x + dx, position.y + dy, position.z + dz)
      });
      
      // Explode outwards
      body.velocity.set(dx * 2, dy * 2 + 10, dz * 2);
      body.angularVelocity.set(Math.random()*5, Math.random()*5, Math.random()*5);
      
      this.physicsWorld.addBody(body);
      this.debrisBodies.push({ mesh, body });
    }
  }

  public triggerPedestrianPanic(epicenterX: number, epicenterZ: number, radius: number = 30) {
    if (!this.cityWorld) return;
    const nearby = this.pedSpatialHash.queryRadius(epicenterX, epicenterZ, radius);
    for (const entry of nearby) {
      const ped = entry.item;
      const dx = entry.x - epicenterX;
      const dz = entry.z - epicenterZ;
      const len = Math.hypot(dx, dz) || 1;
      ped.isPanicked = true;
      ped.panicTimer = 5.0;
      ped.panicDirX = dx / len;
      ped.panicDirZ = dz / len;
    }
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
          this.triggerPedestrianPanic(this.posX, this.posZ, 40);
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

    this.updateInterceptorJets(deltaTime);

    let isGamepadInput = false;
    let isKeyboardInput = false;

    // Detect gamepad
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    
    // Check keyboard activity
    if (Object.values(this.keys).some(v => v)) {
      isKeyboardInput = true;
    }

    let gpInputFwd = 0;
    let gpInputStrafe = 0;
    let gpWantBoost = false;

    if (gp) {
      // Deadzones
      const lx = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : 0;
      const rx = Math.abs(gp.axes[2]) > 0.15 ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3]) > 0.15 ? gp.axes[3] : 0;

      if (lx !== 0 || ly !== 0) {
        gpInputStrafe += lx;
        gpInputFwd -= ly; // y axis is inverted usually
        isGamepadInput = true;
      }
      
      if (rx !== 0 || ry !== 0) {
        this.rotateCamera(-rx * 0.04, ry * 0.04);
        isGamepadInput = true;
      }
      
      // Boost mapped to Left Trigger (6) or Right Trigger (7)
      if (gp.buttons[6]?.pressed || gp.buttons[7]?.pressed) {
        gpWantBoost = true;
        isGamepadInput = true;
      }

      // X/Square or A/Cross for Action
      if (gp.buttons[2]?.pressed || gp.buttons[0]?.pressed) {
        if (!this.keys['GamepadAction']) {
          if (this.playerMode === 'Alien') this.triggerJump();
          else this.triggerAction();
          this.keys['GamepadAction'] = true;
        }
        isGamepadInput = true;
      } else {
        this.keys['GamepadAction'] = false;
      }

      // B/Circle for Barrel Roll
      if (gp.buttons[1]?.pressed) {
        if (!this.keys['GamepadRoll']) {
          this.triggerBarrelRoll();
          this.keys['GamepadRoll'] = true;
        }
        isGamepadInput = true;
      } else {
        this.keys['GamepadRoll'] = false;
      }
    }

    if (isKeyboardInput) {
      this.lastInputDevice = 'keyboard';
    } else if (isGamepadInput) {
      this.lastInputDevice = 'gamepad';
    }

    // --- Nitro Energy Consumption & Regeneration ---
    const isWantBoost = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.virtualInput.boost || gpWantBoost);
    let isBoost = false;

    if (isWantBoost && this.energy > 5) {
      isBoost = true;
      this.energy = Math.max(0, this.energy - 0.35);
      this.screenShake = Math.max(this.screenShake, 0.2);
    } else {
      this.energy = Math.min(100, this.energy + 0.2);
    }

    const moveSpeed = (isBoost ? 45.0 : 18.0) * (this.playerMode === 'UFO' ? 1.2 : 0.8);

    // Movement Vector relative to Camera Yaw
    let inputFwd = this.virtualInput.fwd + gpInputFwd;
    let inputStrafe = this.virtualInput.strafe + gpInputStrafe;

    if (this.keys['KeyW'] || this.keys['w'] || this.keys['ArrowUp']) inputFwd += 1;
    if (this.keys['KeyS'] || this.keys['s'] || this.keys['ArrowDown']) inputFwd -= 1;
    if (this.keys['KeyA'] || this.keys['a'] || this.keys['ArrowLeft']) inputStrafe -= 1;
    if (this.keys['KeyD'] || this.keys['d'] || this.keys['ArrowRight']) inputStrafe += 1;

    // Clamp Inputs
    inputFwd = Math.max(-1, Math.min(1, inputFwd));
    inputStrafe = Math.max(-1, Math.min(1, inputStrafe));

    const maxSpeed = (isBoost ? 32.0 : 18.0) * (this.playerMode === 'UFO' ? 1.2 : 0.8);

    // Compute Direction relative to Camera View
    if (inputFwd !== 0 || inputStrafe !== 0) {
      const inputLen = Math.hypot(inputFwd, inputStrafe);
      const normFwd = inputFwd / inputLen;
      const normStrafe = inputStrafe / inputLen;

      // Camera orientation vectors in world space
      const forwardX = -Math.sin(this.camYaw);
      const forwardZ = -Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      // Target velocity in world m/s
      const targetVelX = (forwardX * normFwd + rightX * normStrafe) * maxSpeed;
      const targetVelZ = (forwardZ * normFwd + rightZ * normStrafe) * maxSpeed;

      this.velX += (targetVelX - this.velX) * 0.18;
      this.velZ += (targetVelZ - this.velZ) * 0.18;

      const targetRot = Math.atan2(this.velX, this.velZ);
      let rotDiff = targetRot - this.rotY;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      this.rotY += rotDiff * 0.22;
    } else {
      this.velX *= 0.82;
      this.velZ *= 0.82;
    }

    // --- Physics by Player Mode ---
    if (this.playerMode === 'UFO' && this.ufoBody) {
      let ascendInput = this.virtualInput.ascend;
      if (
        this.keys['Space'] ||
        this.keys[' '] ||
        this.keys['KeyE'] ||
        this.keys['e'] ||
        this.keys['E'] ||
        this.keys['ShiftLeft'] ||
        this.keys['ShiftRight'] ||
        this.keys['Shift'] ||
        this.keys['PageUp']
      ) {
        ascendInput += 1;
      }
      if (
        this.keys['KeyQ'] ||
        this.keys['q'] ||
        this.keys['Q'] ||
        this.keys['ControlLeft'] ||
        this.keys['ControlRight'] ||
        this.keys['Control'] ||
        this.keys['KeyC'] ||
        this.keys['c'] ||
        this.keys['PageDown']
      ) {
        ascendInput -= 1;
      }

      // Check Flight Mode Toggle
      if (this.keys['KeyF'] || this.keys['f']) {
        if (!this.keys['F_PRESSED']) {
          this.flightMode = this.flightMode === 'hover' ? 'jet' : 'hover';
          if (this.flightMode === 'jet') {
             this.audio.playWindBoostSound(); // "Engage" sound
             this.jetPitch = 0;
             this.jetRoll = 0;
             this.jetThrottle = Math.max(0.2, Math.hypot(this.velX, this.velY, this.velZ) / maxSpeed); // Convert current speed to throttle
          } else {
             // Returning to hover mode, zero out jet forces and re-level
             this.currentRollAngle = 0;
             this.currentPitchAngle = 0;
          }
          this.keys['F_PRESSED'] = true;
        }
      } else {
        this.keys['F_PRESSED'] = false;
      }

      if (this.flightMode === 'hover') {
        // --- HOVER MODE (2.5x Supercharged Altitude Movement) ---
        const climbSpeedMult = 2.5 * (1 + this.upgrades.engineSpeed * 0.25);
        const forceY = ascendInput * 30000 * climbSpeedMult; 

        // Directly sync CANNON body velocity with our kinematic movement vector
        this.ufoBody.velocity.x = this.velX;
        this.ufoBody.velocity.z = this.velZ;

        if (ascendInput !== 0) {
          this.ufoBody.velocity.y += ascendInput * 45.0 * climbSpeedMult * deltaTime;
        } else {
          this.ufoBody.velocity.y *= 0.82;
        }

        // Counteract gravity completely for hover stability
        const antiGravity = 9.81 * this.ufoBody.mass;
        this.ufoBody.applyForce(new CANNON.Vec3(0, forceY + antiGravity, 0), this.ufoBody.position);

        // Read state back from physics
        this.posX = this.ufoBody.position.x;
        this.posY = Math.max(3.0, Math.min(350.0, this.ufoBody.position.y));
        this.ufoBody.position.y = this.posY;
        this.posZ = this.ufoBody.position.z;

        this.velY = this.ufoBody.velocity.y;

        const hoverBob = Math.sin(performance.now() * 0.003) * 0.05;
        this.posY += hoverBob;

        if (this.barrelRollCooldown > 0) {
          this.barrelRollCooldown -= deltaTime;
        }

        // Smooth Flight Aerodynamic Banking & Barrel Roll
        if (this.barrelRollTimer > 0) {
          this.barrelRollTimer -= deltaTime;
          const progress = 1 - Math.max(0, this.barrelRollTimer / 0.5);
          this.currentRollAngle = progress * Math.PI * 2;
          this.currentPitchAngle = Math.sin(progress * Math.PI) * 0.3;
        } else {
          const targetBank = -inputStrafe * 0.35 - (this.velX * 0.01);
          const targetPitch = inputFwd * 0.20 + (this.velZ * 0.01);
          this.currentRollAngle = THREE.MathUtils.lerp(this.currentRollAngle, targetBank, 0.15);
          this.currentPitchAngle = THREE.MathUtils.lerp(this.currentPitchAngle, targetPitch, 0.15);
        }

        this.playerGroup.rotation.set(this.currentPitchAngle, this.rotY, this.currentRollAngle);
      } else {
        // --- JET FLIGHT SIM MODE ---
        // Decouple from basic velocity vector, use true forces & aerodynamics

        if (this.barrelRollCooldown > 0) {
          this.barrelRollCooldown -= deltaTime;
        }

        let rollOffset = 0;
        let pitchOffset = 0;
        if (this.barrelRollTimer > 0) {
          this.barrelRollTimer -= deltaTime;
          const progress = 1 - Math.max(0, this.barrelRollTimer / 0.5);
          rollOffset = progress * Math.PI * 2;
          pitchOffset = Math.sin(progress * Math.PI) * 0.3;
        }

        // Throttle Control (W/S or Up/Down)
        this.jetThrottle += inputFwd * deltaTime * 0.5; 
        if (isBoost) this.jetThrottle = 1.2;
        this.jetThrottle = Math.max(0.05, Math.min(1.5, this.jetThrottle)); // Allow up to 1.5 for barrel roll boost

        // Pitch Control (Ascend/Descend mapped to pitch - 2.5x quicker)
        const pitchInput = -ascendInput; // Invert so ascend pulls nose UP
        this.jetPitch = THREE.MathUtils.lerp(this.jetPitch, pitchInput * 1.2, 7.5 * deltaTime);
        
        // Roll Control (A/D or Left/Right)
        const rollInput = -inputStrafe;
        this.jetRoll = THREE.MathUtils.lerp(this.jetRoll, rollInput * 1.5, 4.0 * deltaTime);
        
        // Yaw tied to roll (banking to turn)
        this.rotY += Math.sin(this.jetRoll) * deltaTime * 0.8;

        // --- Flight Physics Forces ---
        const thrustForce = this.jetThrottle * (isBoost ? 35000 : 25000);
        
        // Forward vector based on current rotation (including barrel roll offsets for visuals, but we use base for physics so it doesn't spiral out)
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
        
        // Lift vector (points "up" relative to the jet)
        const up = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
        
        // Calculate current forward speed
        const currentVelocity = new THREE.Vector3(this.ufoBody.velocity.x, this.ufoBody.velocity.y, this.ufoBody.velocity.z);
        const speed = currentVelocity.length();
        
        // Lift calculation (proportional to square of speed, pointing "up" relative to wings)
        // Adjust lift coefficient so that normal cruising speed roughly counteracts gravity
        const liftCoef = 1.8;
        const liftMag = liftCoef * speed * speed;
        const liftForce = up.clone().multiplyScalar(liftMag);

        // Drag calculation (proportional to square of speed, pointing opposite to velocity)
        const dragCoef = 0.4;
        const dragForce = currentVelocity.clone().normalize().multiplyScalar(-dragCoef * speed * speed);

        // Apply Forces
        const totalForce = new CANNON.Vec3(
            (forward.x * thrustForce) + liftForce.x + dragForce.x,
            (forward.y * thrustForce) + liftForce.y + dragForce.y,
            (forward.z * thrustForce) + liftForce.z + dragForce.z
        );

        // We do NOT counteract gravity here; gravity applies naturally.
        this.ufoBody.applyForce(totalForce, this.ufoBody.position);

        // Artificial stabilization to prevent tumbling and enforce flight envelope
        this.ufoBody.angularVelocity.set(0, 0, 0); // Lock angular physics, kinematic rotation
        
        // Dampen velocity sideways to simulate aerodynamic fins (we want velocity to align with forward vector over time)
        const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
        const sidewaysSpeed = currentVelocity.dot(right);
        this.ufoBody.velocity.x -= right.x * sidewaysSpeed * 0.05;
        this.ufoBody.velocity.z -= right.z * sidewaysSpeed * 0.05;
        // Minor pitch dampening for angle of attack correction
        const verticalSpeed = currentVelocity.dot(up);
        this.ufoBody.velocity.y -= up.y * verticalSpeed * 0.02;

        // Read state back
        this.posX = this.ufoBody.position.x;
        this.posY = Math.max(3.0, Math.min(1000.0, this.ufoBody.position.y)); // Higher ceiling
        this.ufoBody.position.y = this.posY;
        this.posZ = this.ufoBody.position.z;
        this.velX = this.ufoBody.velocity.x;
        this.velY = this.ufoBody.velocity.y;
        this.velZ = this.ufoBody.velocity.z;

        // Update visual model rotation
        this.playerGroup.rotation.set(this.jetPitch + pitchOffset, this.rotY, this.jetRoll + rollOffset);
        
        // Update variables so camera tracking and other logic holds up
        this.currentPitchAngle = this.jetPitch + pitchOffset;
        this.currentRollAngle = this.jetRoll + rollOffset;
      }

      if (this.tractorBeamMesh) {
        const mat = this.tractorBeamMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - 0.03);
      }

      const currSpeedNorm = Math.min(1.0, Math.hypot(this.velX, this.velY, this.velZ) / maxSpeed);
      this.audio.updateEngineHum(currSpeedNorm);

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

    if (this.physicsActive) {
      this.physicsWorld.step(deltaTime);
      
      // Update Debris Meshes
      for (const d of this.debrisBodies) {
        d.mesh.position.copy(d.body.position as any);
        d.mesh.quaternion.copy(d.body.quaternion as any);
      }
    }

    // Apply Position & Building Collision Resolution (Manual for Aliens, skipped if UFO using physics)
    let nextX = this.posX + (this.playerMode === 'UFO' ? 0 : this.velX * deltaTime);
    let nextZ = this.posZ + (this.playerMode === 'UFO' ? 0 : this.velZ * deltaTime);

    if (this.cityWorld && this.playerMode !== 'UFO') {
      const playerRadius = 1.2;
      
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

    if (this.playerMode !== 'UFO') {
      this.posX = nextX;
      this.posZ = nextZ;
    }

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

      // 3. Sidewalk Pedestrians & Spatial Hash Grid Population
      this.pedSpatialHash.clear();
      for (let i = 0; i < this.cityWorld.pedestrians.length; i++) {
        const ped = this.cityWorld.pedestrians[i];
        if (ped.isPanicked && ped.panicTimer && ped.panicTimer > 0) {
          ped.panicTimer -= deltaTime;
          ped.mesh.position.x += (ped.panicDirX || 1) * ped.speed * 2.8;
          ped.mesh.position.z += (ped.panicDirZ || 0) * ped.speed * 2.8;
          ped.mesh.rotation.y = Math.atan2(ped.panicDirX || 1, ped.panicDirZ || 0);
          ped.legL.rotation.x = Math.sin(now * 0.03) * 0.8;
          ped.legR.rotation.x = -Math.sin(now * 0.03) * 0.8;
          if (ped.panicTimer <= 0) {
            ped.isPanicked = false;
          }
        } else {
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

        // Insert into spatial grid
        this.pedSpatialHash.insert(i, ped.mesh.position.x, ped.mesh.position.z, ped);
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

    // --- Wanted Level Decay Logic ---
    if (this.wantedLevel > 0) {
      this.wantedDecayTimer -= deltaTime;
      if (this.wantedDecayTimer <= 0) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.wantedDecayTimer = 22.0;
        if (this.wantedLevel === 0 && this.policeChasers.length > 0) {
          for (const p of this.policeChasers) {
            this.scene.remove(p.mesh);
          }
          this.policeChasers = [];
        }
      }
    }

    // --- Update Police Interceptors AI (Wide Tactical Patrol) ---
    if (this.policeSpawnCooldown > 0) {
      this.policeSpawnCooldown -= deltaTime;
    }

    // Max 1 police ship at Wanted level 2-3, max 2 at Wanted level 4+
    const targetPoliceCount = this.wantedLevel <= 1 ? 0 : (this.wantedLevel <= 3 ? 1 : 2);
    if (this.policeChasers.length < targetPoliceCount && this.policeSpawnCooldown <= 0) {
      this.spawnPoliceChaser();
    }

    const now = performance.now();
    for (let i = this.policeChasers.length - 1; i >= 0; i--) {
      const police = this.policeChasers[i];
      const offsetAngle = (now * 0.0004) + (i * Math.PI);
      const patrolRadius = 55 + i * 18;
      const targetPos = new THREE.Vector3(
        this.posX + Math.cos(offsetAngle) * patrolRadius,
        this.posY + 12 + Math.sin(now * 0.0015 + i) * 3,
        this.posZ + Math.sin(offsetAngle) * patrolRadius
      );
      police.mesh.position.lerp(targetPos, 0.02);
      police.mesh.rotation.y += 0.02;

      const distToPlayer = police.mesh.position.distanceTo(this.playerGroup.position);
      const isSearchlightLock = distToPlayer < 40;

      const flash = Math.floor(now / (isSearchlightLock ? 100 : 300)) % 2 === 0;
      police.sirenLight.color.setHex(flash ? 0xef4444 : 0x3b82f6);

      if (isSearchlightLock && (now - this.lastSirenSoundTime > 14000)) {
        this.lastSirenSoundTime = now;
        this.audio.playSirenSound();
      }
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
          const nearbyPeds = this.pedSpatialHash.queryRadius(this.posX, this.posZ, 14);
          pedUnderScanner = nearbyPeds.length > 0;
        }

        const ringMesh = this.groundScannerMesh.children[0] as THREE.Mesh;
        if (ringMesh && ringMesh.material instanceof THREE.MeshBasicMaterial) {
          ringMesh.material.color.setHex(pedUnderScanner ? 0xfacc15 : 0x00f0ff);
        }
      } else {
        this.groundScannerMesh.visible = false;
      }
    }

    // --- Tractor Beam & Target Alignment Engine ---
    let alignmentWarning: string | null = null;
    let closestPedTarget: Pedestrian | null = null;
    
    if (this.playerMode === 'UFO' && this.cityWorld) {
      // Find closest pedestrian target using O(1) Spatial Hash query
      let closestIdx = -1;
      let closestDist = Infinity;

      const nearestEntry = this.pedSpatialHash.queryNearest(this.posX, this.posZ, 25);
      if (nearestEntry) {
        closestPedTarget = nearestEntry.item;
        closestIdx = nearestEntry.id;
        closestDist = Math.hypot(nearestEntry.x - this.posX, nearestEntry.z - this.posZ);
      }

      if (closestPedTarget && closestDist < 22) {
        this.targetName = `CIVILIAN #${closestIdx + 101}`;
        const horizDist = closestDist;
        this.alignmentProgress = Math.max(0, Math.min(100, Math.round(100 * (1 - horizDist / 18))));

        if (horizDist <= 12) {
          this.alignmentHoldTimer += deltaTime;
          if (this.alignmentHoldTimer > 0.2) {
            if (this.targetAlignmentState !== 'ABDUCTING') {
              this.targetAlignmentState = 'LOCK_STABLE';
            }
          } else {
            this.targetAlignmentState = 'ALIGNING';
          }
        } else {
          this.alignmentHoldTimer = 0;
          if (this.targetAlignmentState === 'ABDUCTING') {
            // Broken alignment!
            this.targetAlignmentState = 'ALIGNMENT_LOST';
            alignmentWarning = "⚠️ ALIGNMENT LOST - RE-CENTER UFO";
            if (this.activeAbductee) {
              if ((this.activeAbductee as any).body) {
                // Let gravity take over, turn off tractor beam forces, but keep body to let it fall
                // Wait, if it's a pedestrian, it might be better to just remove it and spawn a ragdoll, or just let it fall
                this.physicsWorld.removeBody((this.activeAbductee as any).body);
                (this.activeAbductee as any).body = null;
              }
              this.activeAbductee.mesh.position.y = CONFIG.FLOOR_Y + 0.4;
              this.activeAbductee.mesh.rotation.x = Math.PI / 2; // Fall over
              this.activeAbductee = null;
            }
            this.abductionTimer = 0;
          } else {
            this.targetAlignmentState = 'SEARCHING';
          }
        }

        // Active Abduction 4.5s Sequence Execution
        if (this.targetAlignmentState === 'LOCK_STABLE' && !this.activeAbductee) {
          this.targetAlignmentState = 'ABDUCTING';
          this.activeAbductee = closestPedTarget;
          this.activeAbducteeIdx = closestIdx;
          this.abductionTimer = 0;
          this.audio.playAbductionSound();
          
          // Create a physics body for the abductee
          if ((this.activeAbductee as any).body) {
             this.physicsWorld.removeBody((this.activeAbductee as any).body);
          }
          const pedBody = new CANNON.Body({
            mass: 75,
            shape: new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)),
            position: new CANNON.Vec3(this.activeAbductee.mesh.position.x, this.activeAbductee.mesh.position.y, this.activeAbductee.mesh.position.z),
            linearDamping: 0.1,
            angularDamping: 0.8
          });
          this.physicsWorld.addBody(pedBody);
          (this.activeAbductee as any).body = pedBody;
        }

        if (this.targetAlignmentState === 'ABDUCTING' && this.activeAbductee) {
          this.abductionTimer += deltaTime;
          this.abductionProgress = Math.min(100, Math.round((this.abductionTimer / 4.5) * 100));

          const pedBody = (this.activeAbductee as any).body as CANNON.Body;
          if (pedBody) {
            // Apply Tractor Beam Physics
            const beamCenter = new CANNON.Vec3(this.posX, this.posY - 1.5, this.posZ);
            const pedPos = pedBody.position;
            
            const dx = beamCenter.x - pedPos.x;
            const dy = beamCenter.y - pedPos.y;
            const dz = beamCenter.z - pedPos.z;
            
            // Force towards center line (X/Z) - acts like a pendulum/spring
            const centerForceMag = 120;
            const liftForceMag = 350 + (this.abductionTimer * 50); // lift gets stronger
            
            // Add some wobble/swing
            const wobbleX = Math.sin(now * 0.005) * 50;
            const wobbleZ = Math.cos(now * 0.007) * 50;
            
            pedBody.applyForce(new CANNON.Vec3(dx * centerForceMag + wobbleX, liftForceMag, dz * centerForceMag + wobbleZ), pedPos);
            
            // Sync mesh
            this.activeAbductee.mesh.position.set(pedPos.x, pedPos.y - 1, pedPos.z);
            this.activeAbductee.mesh.quaternion.set(pedBody.quaternion.x, pedBody.quaternion.y, pedBody.quaternion.z, pedBody.quaternion.w);
          }

          // Beam Visual Intensification
          if (this.tractorBeamMesh) {
            (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(now * 0.015) * 0.2;
          }
          if (this.beamEnergyCore) {
            (this.beamEnergyCore.material as THREE.MeshBasicMaterial).opacity = 0.85;
          }
          if (this.beamGroundRing) {
            this.beamGroundRing.position.set(this.posX, CONFIG.FLOOR_Y + 0.1, this.posZ);
            (this.beamGroundRing.material as THREE.MeshBasicMaterial).opacity = 0.75;
          }
          if (this.beamSurfaceLight) {
            this.beamSurfaceLight.position.set(this.posX, CONFIG.FLOOR_Y + 2, this.posZ);
            this.beamSurfaceLight.intensity = 4.0;
          }

          // Animate spiral particles floating up beam
          this.beamSpiralParticles.forEach((p, pIdx) => {
            const angle = now * 0.003 + (pIdx * Math.PI / 6);
            const radius = 1.2 + Math.sin(now * 0.005 + pIdx) * 0.5;
            const pProgress = ((now * 0.002 + pIdx * 0.1) % 1);
            p.position.set(Math.cos(angle) * radius, -30 * (1 - pProgress), Math.sin(angle) * radius);
            (p.material as THREE.MeshBasicMaterial).opacity = Math.sin(pProgress * Math.PI) * 0.8;
          });

          // 100% Abduction Completion
          if (this.abductionTimer >= 4.5) {
            this.targetAlignmentState = 'SUCCESS';
            this.audio.playAbductionSound();
            this.screenShake = 1.2;
            this.abductedCount++;
            this.abductionCount++;
            if (this.abductionCount <= 2) this.wantedLevel = 1;
            else if (this.abductionCount <= 5) this.wantedLevel = 2;
            else if (this.abductionCount <= 9) this.wantedLevel = 3;
            else this.wantedLevel = 4;
            this.wantedDecayTimer = 25.0;
            this.triggerPedestrianPanic(this.posX, this.posZ, 35);
            this.abductionTriggerTime = Date.now();
            this.score += 1500 * this.comboMultiplier;
            this.comboMultiplier = Math.min(5, this.comboMultiplier + 1);
            this.comboTimer = 4.0;

            const testQuotes = [
              `🧪 PROBED: Subject #${this.activeAbducteeIdx + 101} - IQ: ${Math.floor(Math.random()*60+60)} - Memory Cleared!`,
              `🧪 ANALYZED: Subject #${this.activeAbducteeIdx + 101} - DNA = 98% Banana!`,
              `🧪 LAB TEST: Subject #${this.activeAbducteeIdx + 101} - Caloric value: 2400 kcal!`,
              `🧪 SCAN COMPLETE: Subject #${this.activeAbducteeIdx + 101} - Teleported donut directly into stomach!`
            ];
            this.alienTestLog = testQuotes[Math.floor(Math.random() * testQuotes.length)];

            // Remove ped
            if (this.cityWorld && this.activeAbducteeIdx !== -1) {
              if ((this.activeAbductee as any).body) {
                this.physicsWorld.removeBody((this.activeAbductee as any).body);
              }
              this.scene.remove(this.activeAbductee.mesh);
              this.cityWorld.pedestrians.splice(this.activeAbducteeIdx, 1);
            }

            this.spawnRagdoll(new THREE.Vector3(this.posX, this.posY - 1.5, this.posZ));
            this.activeAbductee = null;
            this.abductionTimer = 0;
            this.abductionProgress = 100;
          }
        }
      } else {
        this.targetAlignmentState = 'SEARCHING';
        this.alignmentProgress = 0;
        this.abductionProgress = 0;
        if (this.tractorBeamMesh) (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity, 0, 0.1);
        if (this.beamEnergyCore) (this.beamEnergyCore.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((this.beamEnergyCore.material as THREE.MeshBasicMaterial).opacity, 0, 0.1);
        if (this.beamGroundRing) (this.beamGroundRing.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((this.beamGroundRing.material as THREE.MeshBasicMaterial).opacity, 0, 0.1);
        if (this.beamSurfaceLight) this.beamSurfaceLight.intensity = THREE.MathUtils.lerp(this.beamSurfaceLight.intensity, 0, 0.1);
      }
    }

    // --- Calculate Curated Strategic Radar Blips (relative to player, max radius 80) ---
    const radarBlips: RadarBlip[] = [];
    const maxRadarDist = 80;
    let nearestPedDist: number | null = null;

    if (this.cityWorld) {
      // 1. Collectibles (Top 4 closest)
      const collectiblesSorted: { dx: number; dz: number; dist: number; type: RadarBlip['type'] }[] = [];
      for (const item of this.cityWorld.collectibleVoxels) {
        const dx = item.mesh.position.x - this.posX;
        const dz = item.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= maxRadarDist) {
          const blipType = item.type === 'fish' ? 'fish' : item.type === 'feather' ? 'feather' : 'crystal';
          collectiblesSorted.push({ dx, dz, dist, type: blipType as RadarBlip['type'] });
        }
      }
      collectiblesSorted.sort((a, b) => a.dist - b.dist);
      for (let i = 0; i < Math.min(4, collectiblesSorted.length); i++) {
        const c = collectiblesSorted[i];
        radarBlips.push({ x: c.dx / maxRadarDist, z: c.dz / maxRadarDist, type: c.type });
      }

      // 2. Pedestrians (Top 6 closest, plus active/closest target pedestrian tagged)
      const pedsSorted: { dx: number; dz: number; dist: number; isTarget: boolean }[] = [];
      for (let i = 0; i < this.cityWorld.pedestrians.length; i++) {
        const ped = this.cityWorld.pedestrians[i];
        const dx = ped.mesh.position.x - this.posX;
        const dz = ped.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (nearestPedDist === null || dist < nearestPedDist) {
          nearestPedDist = dist;
        }
        if (dist <= maxRadarDist) {
          const isTarget = (this.activeAbductee === ped) || (closestPedTarget === ped && dist < 22);
          pedsSorted.push({ dx, dz, dist, isTarget });
        }
      }
      pedsSorted.sort((a, b) => (b.isTarget ? 1 : 0) - (a.isTarget ? 1 : 0) || a.dist - b.dist);
      for (let i = 0; i < Math.min(6, pedsSorted.length); i++) {
        const p = pedsSorted[i];
        radarBlips.push({ x: p.dx / maxRadarDist, z: p.dz / maxRadarDist, type: 'person', isTarget: p.isTarget });
      }

      // 3. Traffic Cars (Top 2 closest)
      const carsSorted: { dx: number; dz: number; dist: number }[] = [];
      for (const car of this.cityWorld.trafficCars) {
        const dx = car.mesh.position.x - this.posX;
        const dz = car.mesh.position.z - this.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= maxRadarDist) {
          carsSorted.push({ dx, dz, dist });
        }
      }
      carsSorted.sort((a, b) => a.dist - b.dist);
      for (let i = 0; i < Math.min(2, carsSorted.length); i++) {
        const c = carsSorted[i];
        radarBlips.push({ x: c.dx / maxRadarDist, z: c.dz / maxRadarDist, type: 'car' });
      }
    }

    // 4. Police Chasers (ALL included - high threat priority!)
    for (const police of this.policeChasers) {
      const dx = police.mesh.position.x - this.posX;
      const dz = police.mesh.position.z - this.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= maxRadarDist) {
        radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: 'police' });
      }
    }

    // 5. Interceptor Jets (ALL included - high threat priority!)
    for (const jet of this.interceptorJets) {
      const dx = jet.posX - this.posX;
      const dz = jet.posZ - this.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= maxRadarDist * 2) {
        radarBlips.push({ x: dx / (maxRadarDist * 2), z: dz / (maxRadarDist * 2), type: 'jet' });
      }
    }

    // --- Cinematic Camera Auto-Pan & Smooth Motion Tracking ---
    if (this.userCamOverrideTimer > 0) {
      this.userCamOverrideTimer -= deltaTime;
    } else if (this.flightMode === 'jet') {
      // Jet Mode Camera - Locked behind tail like a flight simulator
      const spd = Math.hypot(this.velX, this.velZ);
      
      // Look direction from rotation
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
      const up = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
      
      this.camYaw = this.rotY + Math.PI; // Look from behind
      this.camPitch = this.jetPitch + 0.1; // Slightly angled down to see plane
    } else if (this.isCinematicCamera) {
      const spd = Math.hypot(this.velX, this.velZ);
      if (spd > 0.04) {
        // Automatically align camera yaw with movement heading so camera follows behind player
        const targetYaw = Math.atan2(this.velX, this.velZ) + Math.PI;
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

    // --- Camera Follow Controller (Clean, Zero-Warp, Pro-Grade Smooth Follow) ---
    const camDist = this.playerMode === 'UFO' ? 26 : 16;
    const camHeight = this.playerMode === 'UFO' ? 9 : 4;

    // Enforce fixed, stable FOV = 55 to eliminate perspective warping
    if (this.camera.fov !== 55) {
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
    }

    // Always reset up vector to standard Y-up
    this.camera.up.set(0, 1, 0);

    const cx = this.posX + Math.sin(this.camYaw) * Math.cos(this.camPitch) * camDist;
    const cz = this.posZ + Math.cos(this.camYaw) * Math.cos(this.camPitch) * camDist;
    const cy = this.posY + Math.sin(this.camPitch) * camDist + camHeight;

    // Smooth camera position tracking
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), this.flightMode === 'jet' ? 0.35 : 0.14);

    // Look cleanly at player position
    let targetX = this.posX;
    let targetY = this.posY + (this.playerMode === 'UFO' ? 1.0 : 1.5);
    let targetZ = this.posZ;

    if (this.flightMode === 'jet') {
       // Look slightly ahead of the jet
       const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.jetPitch, this.rotY, this.jetRoll, 'YXZ'));
       targetX += forward.x * 20;
       targetY += forward.y * 20;
       targetZ += forward.z * 20;
    }

    this.camera.lookAt(targetX, targetY, targetZ);

    // --- Send Telemetry ---
    const currentSpeed = Math.hypot(this.velX, this.velY, this.velZ);
    const telemetrySpeed = Math.round(currentSpeed * 2.237); // Convert m/s to MPH
    const cityColliders = this.cityWorld ? this.cityWorld.colliders.map(col => ({
      x: col.x - this.posX,
      z: col.z - this.posZ,
      width: col.width,
      depth: col.depth,
      height: col.height
    })) : [];

    let targetJetName: string | undefined = undefined;
    let targetJetDist: number | undefined = undefined;

    if (this.interceptorJets.length > 0) {
      let minDist = Infinity;
      let closestJetIdx = -1;
      for (let i = 0; i < this.interceptorJets.length; i++) {
        const jet = this.interceptorJets[i];
        const d = Math.hypot(jet.posX - this.posX, jet.posY - this.posY, jet.posZ - this.posZ);
        if (d < minDist) {
          minDist = d;
          closestJetIdx = i;
        }
      }
      if (closestJetIdx !== -1) {
        targetJetName = `F-22 INTERCEPTOR #${closestJetIdx + 1}`;
        targetJetDist = Math.round(minDist);
      }
    }

      // Enemy Jet tracking for HUD
      const enemyJetsState = this.interceptorJets.map((jet, idx) => {
        // Project position to screen roughly for HUD
        const dx = jet.posX - this.posX;
        const dz = jet.posZ - this.posZ;
        const dy = jet.posY - this.posY;
        const dist = Math.hypot(dx, dy, dz);
        
        const pos = new THREE.Vector3(jet.posX, jet.posY, jet.posZ);
        pos.project(this.camera);
        
        let screenX = (pos.x * 0.5 + 0.5) * 100;
        let screenY = (-(pos.y) * 0.5 + 0.5) * 100;
        
        const inView = pos.z < 1 && dist < 400;

        return {
          id: idx,
          screenX,
          screenY,
          dist: dist,
          isLocked: dist < 120 && targetJetName !== undefined && (this.interceptorJets.length > 0 && targetJetDist !== undefined && Math.abs(targetJetDist - dist) < 5), // simplified lock
          lockProgress: dist < 150 ? 100 - (dist / 150) * 100 : 0,
          inView
        };
      });

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        speed: telemetrySpeed,
        altitude: Math.round(this.posY - CONFIG.FLOOR_Y),
        posX: Math.round(this.posX),
        posY: Math.round(this.posY),
        posZ: Math.round(this.posZ),
        heading: this.rotY,
        camYaw: this.camYaw,
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
        nearestPedestrianDist: nearestPedDist !== null ? Math.round(nearestPedDist) : null,
        targetAlignmentState: this.targetAlignmentState,
        alignmentProgress: this.alignmentProgress,
        abductionProgress: this.abductionProgress,
        targetName: this.targetName,
        alignmentWarning: alignmentWarning,
        physicsActive: this.physicsActive,
        debrisCount: this.debrisBodies.length,
        weaponMode: this.weaponMode,
        upgrades: this.upgrades,
        credits: this.credits,
        bioSpecimens: this.bioSpecimens,
        mutantsDeployed: this.mutantsDeployed,
        interceptorJetsCount: this.interceptorJets.length,
        targetJetName,
        targetJetDist,
        rollAngle: Math.round((this.currentRollAngle * 180) / Math.PI),
        pitchAngle: Math.round((this.currentPitchAngle * 180) / Math.PI),
        gForce: Number((1.0 + currentSpeed * 0.15 + (this.barrelRollTimer > 0 ? 3.5 : 0)).toFixed(1)),
        isBarrelRolling: this.barrelRollTimer > 0,
        subagentProposal: "Atmospheric Weather Manipulator & Plasma Forcefield Shield",
        cityColliders: cityColliders,
        lastInputDevice: this.lastInputDevice,
        flightMode: this.flightMode,
        jetSpeed: Math.round(currentSpeed * 2.237),
        jetAltitude: Math.round(this.posY - CONFIG.FLOOR_Y),
        jetThrottle: this.jetThrottle,
        jetPitch: this.jetPitch,
        jetRoll: this.jetRoll,
        jetHeading: this.rotY,
        enemyJetsState
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
