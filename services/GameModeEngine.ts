/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PlayerMode, GameModeTelemetry, VoxelData, Quest, WeaponMode, MothershipUpgrades, RadarBlip, SynthesizedVoxel } from '../types';
import { CityGenerator, CityWorld, Pedestrian } from './CityGenerator';
import { CONFIG } from '../utils/voxelConstants';
import { SpatialHashGrid } from './SpatialHashGrid';
import { GameAudioEngine } from './GameAudioEngine';
import { UFO_QUESTS, ALIEN_QUESTS } from './GameQuests';

import { ActiveRagdoll, SummonedAIObject, PossessedObject, PoliceChaser, DebrisObject } from './gamemode/GameModeTypes';
import { AbductionManager } from './gamemode/AbductionManager';
import { PossessionManager } from './gamemode/PossessionManager';
import { PhysicsCombatManager } from './gamemode/PhysicsCombatManager';
import { PlayerController } from './gamemode/PlayerController';

export class GameModeEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private audio: GameAudioEngine;

  private cityWorld: CityWorld | null = null;
  private playerGroup: THREE.Group;
  private playerMesh: THREE.InstancedMesh | null = null;
  private particleGroup: THREE.Group;

  // Sub-System Managers
  private physicsCombat: PhysicsCombatManager;
  private abductionManager: AbductionManager;
  private possessionManager: PossessionManager;
  public controller: PlayerController;

  // Spatial Hash Grid Optimization for O(1) Pedestrian Lookup
  private pedSpatialHash = new SpatialHashGrid<Pedestrian>(25);

  private isActive = false;
  private playerMode: PlayerMode = 'UFO';

  // Gamification State
  public score = 0;
  public highScore = 0;
  public energy = 100;
  public comboMultiplier = 1;
  public comboTimer = 0;
  public wantedLevel = 0; // 0 to 5 Stars
  public abductionCount = 0;
  public wantedDecayTimer = 0;
  public currentQuestIndex = 0;
  public quests: Quest[] = JSON.parse(JSON.stringify(UFO_QUESTS));
  public questCompletedFlash: string | null = null;

  // Interceptor Jets & Defense Entities
  public interceptorJets: { mesh: THREE.Group; posX: number; posY: number; posZ: number; velX: number; velZ: number }[] = [];

  // Transform & Physics
  private ufoBody: CANNON.Body | null = null;
  private terrainBodies: CANNON.Body[] = [];
  private gameModeLights: THREE.Object3D[] = [];
  private physicsActive = false;

  // Callbacks
  private onTelemetryUpdate?: (telemetry: GameModeTelemetry) => void;

  // Articulated Alien Model
  private alienContainerGroup: THREE.Group | null = null;
  private alienTorsoGroup: THREE.Group | null = null;
  private alienHeadGroup: THREE.Group | null = null;
  private alienLeftArmGroup: THREE.Group | null = null;
  private alienRightArmGroup: THREE.Group | null = null;
  private alienLeftLegGroup: THREE.Group | null = null;
  private alienRightLegGroup: THREE.Group | null = null;
  private alienWalkPhase: number = 0;

  // Upgrades & Weaponry
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

  // Flight & Aerodynamic state
  public barrelRollTimer: number = 0;
  public barrelRollCooldown: number = 0;
  public currentRollAngle: number = 0;

  public bioSpecimens: number = 5;
  public mutantsDeployed: number = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.audio = new GameAudioEngine();

    this.playerGroup = new THREE.Group();
    this.playerGroup.name = "PlayerEntityGroup";
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = "GameParticlesGroup";

    // Initialize Sub-Managers
    this.physicsCombat = new PhysicsCombatManager(this.scene, this.audio);
    this.abductionManager = new AbductionManager(this.scene, this.playerGroup, this.audio, this.physicsCombat.physicsWorld);
    this.possessionManager = new PossessionManager(this.scene, this.physicsCombat.physicsWorld, this.audio, this.playerGroup);
    this.controller = new PlayerController();

    try {
      const saved = localStorage.getItem('voxel_high_score');
      if (saved) this.highScore = parseInt(saved, 10) || 0;
    } catch {}

    this.bindInputs();
  }

  // --- Getters for Sub-System Exports ---
  public get isCinematicCamera(): boolean {
    return this.controller.isCinematicCamera;
  }
  public set isCinematicCamera(val: boolean) {
    this.controller.isCinematicCamera = val;
  }

  public get summonedAIObjects() {
    return this.possessionManager.summonedAIObjects;
  }

  public get possessedObject() {
    return this.possessionManager.possessedObject;
  }

  public setOnTelemetryUpdate(cb: (t: GameModeTelemetry) => void) {
    this.onTelemetryUpdate = cb;
  }

  public start(mode: PlayerMode, playerVoxels: VoxelData[]) {
    if (this.isActive) this.stop();

    this.isActive = true;
    this.playerMode = mode;
    this.score = 0;

    // 1. Generate City World
    this.cityWorld = CityGenerator.generateVoxelCity();
    this.scene.add(this.cityWorld.cityGroup);

    // --- PHYSICS INIT ---
    this.physicsActive = true;
    if (this.ufoBody) {
      this.physicsCombat.physicsWorld.removeBody(this.ufoBody);
    }
    this.terrainBodies.forEach(b => this.physicsCombat.physicsWorld.removeBody(b));
    this.terrainBodies = [];

    // Clear old lights
    this.gameModeLights.forEach(light => this.scene.remove(light));
    this.gameModeLights = [];

    // Sunset Magic Hour Lighting
    const sunsetSunLight = new THREE.DirectionalLight(0xffa044, 3.2);
    sunsetSunLight.position.set(-180, 55, -220);
    sunsetSunLight.castShadow = true;
    this.scene.add(sunsetSunLight);

    const sunsetHemiLight = new THREE.HemisphereLight(0xff8866, 0x2a1038, 1.6);
    this.scene.add(sunsetHemiLight);

    const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });
    const sunDiscMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 16), sunDiscMat);
    sunDiscMesh.position.set(-320, 45, -380);
    this.scene.add(sunDiscMesh);

    this.gameModeLights.push(sunsetSunLight, sunsetHemiLight, sunDiscMesh);

    const mass = mode === 'UFO' ? 500 : 80;
    const startY = mode === 'UFO' ? 85 : CONFIG.FLOOR_Y + 2;
    this.ufoBody = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(0, startY, mode === 'UFO' ? 0 : 12),
      shape: new CANNON.Sphere(mode === 'UFO' ? 3.5 : 1.2),
      linearDamping: 0.8,
      angularDamping: 0.9,
    });

    if (mode === 'UFO') {
      this.ufoBody.addEventListener('collide', (e: any) => {
        const impactVelocity = e.contact.getImpactVelocityAlongNormal();
        if (Math.abs(impactVelocity) > 15) {
          this.handleUfoImpact(e.body.position, impactVelocity);
        }
      });
    }

    this.physicsCombat.physicsWorld.addBody(this.ufoBody);

    // Add building colliders to physics world
    this.cityWorld.colliders.forEach(col => {
      const shape = new CANNON.Box(new CANNON.Vec3(col.width / 2, col.height / 2, col.depth / 2));
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(col.x, CONFIG.FLOOR_Y + col.height / 2, col.z);
      this.physicsCombat.physicsWorld.addBody(body);
      this.terrainBodies.push(body);
    });

    // Build Player Entity Mesh
    this.buildPlayerMesh(playerVoxels);
    this.scene.add(this.playerGroup);
    this.scene.add(this.particleGroup);

    // Initial Position
    if (mode === 'UFO') {
      this.controller.posX = 0;
      this.controller.posY = 85;
      this.controller.posZ = 0;
    } else {
      this.controller.posX = 0;
      this.controller.posY = CONFIG.FLOOR_Y + 2;
      this.controller.posZ = 12;
    }
    this.controller.rotY = 0;
    this.controller.velX = 0;
    this.controller.velY = 0;
    this.controller.velZ = 0;

    this.controller.camYaw = 0;
    this.controller.camPitch = 0.35;
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

    this.gameModeLights.forEach(light => this.scene.remove(light));
    this.gameModeLights = [];

    this.physicsCombat.dispose();
    this.abductionManager.dispose();
    this.possessionManager.dispose();

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
    this.controller.isCinematicCamera = !this.controller.isCinematicCamera;
    this.controller.userCamOverrideTimer = 0;
    return this.controller.isCinematicCamera;
  }

  public setWeaponMode(mode: WeaponMode) {
    this.weaponMode = mode;
    this.audio.playLaserSound();
  }

  public purchaseUpgrade(upgradeKey: keyof MothershipUpgrades): boolean {
    const cost = (this.upgrades[upgradeKey] || 1) * 800;
    if (this.credits >= cost) {
      this.credits -= cost;
      this.upgrades[upgradeKey] = (this.upgrades[upgradeKey] || 1) + 1;
      this.audio.playPickupSound();
      return true;
    }
    return false;
  }

  private handleUfoImpact(pos: CANNON.Vec3, impactSpeed: number) {
    this.audio.playExplosionSound();
    this.controller.screenShake = Math.min(2.5, impactSpeed * 0.08);
    this.physicsCombat.explodeObject(new THREE.Vector3(pos.x, pos.y, pos.z), 0xffa044);
  }

  private bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('.z-50'))) {
        return;
      }
      this.controller.keys[e.code] = true;
      if (e.key) this.controller.keys[e.key] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyE') {
        if (this.possessionManager.possessedObject) {
          this.ejectFromPossession();
        }
      }
      if (e.code === 'Space') {
        if (this.possessionManager.possessedObject) {
          this.triggerPossessedPrimaryAbility();
        }
      }
      if (e.code === 'KeyR') {
        this.triggerBarrelRoll();
      }
      if (e.code === 'Digit1') { this.setWeaponMode('tractor'); }
      if (e.code === 'Digit6') { this.setWeaponMode('singularity'); }
      if (e.code === 'Digit7') { this.setWeaponMode('quantum_tether'); }
      if (e.code === 'Digit2') { this.setWeaponMode('repulsor'); }
      if (e.code === 'Digit3') { this.setWeaponMode('disintegrator'); }
      if (e.code === 'Digit4') { this.setWeaponMode('vortex'); }
      if (e.code === 'Digit5') { this.setWeaponMode('orbital_laser'); }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('.z-50'))) {
        return;
      }
      this.controller.keys[e.code] = false;
      if (e.key) this.controller.keys[e.key] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('button') || target.closest('.z-50'))) {
        return;
      }
      this.controller.isMouseDragging = true;
      this.controller.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.controller.isMouseDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive || !this.controller.isMouseDragging) return;
      const deltaX = e.clientX - this.controller.previousMousePosition.x;
      const deltaY = e.clientY - this.controller.previousMousePosition.y;

      this.controller.camYaw -= deltaX * 0.008;
      this.controller.camPitch = Math.max(0.05, Math.min(Math.PI / 2.2, this.controller.camPitch + deltaY * 0.008));

      this.controller.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
  }

  // --- BUILD PLAYER ENTITY VISUALS ---
  private buildPlayerMesh(voxels: VoxelData[]) {
    while (this.playerGroup.children.length > 0) {
      const child = this.playerGroup.children[0];
      this.playerGroup.remove(child);
    }

    if (this.playerMode === 'Alien') {
      this.alienContainerGroup = new THREE.Group();
      this.alienTorsoGroup = new THREE.Group();
      this.alienHeadGroup = new THREE.Group();
      this.alienLeftArmGroup = new THREE.Group();
      this.alienRightArmGroup = new THREE.Group();
      this.alienLeftLegGroup = new THREE.Group();
      this.alienRightLegGroup = new THREE.Group();

      const headV: VoxelData[] = [];
      const torsoV: VoxelData[] = [];
      const lArmV: VoxelData[] = [];
      const rArmV: VoxelData[] = [];
      const lLegV: VoxelData[] = [];
      const rLegV: VoxelData[] = [];

      voxels.forEach(v => {
        if (v.y >= 10) headV.push(v);
        else if (v.y >= 5) {
          if (v.x < -2.2) lArmV.push(v);
          else if (v.x > 2.2) rArmV.push(v);
          else torsoV.push(v);
        } else {
          if (v.x < 0) lLegV.push(v);
          else rLegV.push(v);
        }
      });

      const buildPartMesh = (vList: VoxelData[], pivotX: number, pivotY: number, pivotZ: number) => {
        if (vList.length === 0) return null;
        const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
        const inst = new THREE.InstancedMesh(geo, mat, vList.length);
        inst.castShadow = true; inst.receiveShadow = true;

        const dummy = new THREE.Object3D();
        vList.forEach((v, i) => {
          dummy.position.set((v.x * 0.45) - pivotX * 0.45, (v.y * 0.45) - pivotY * 0.45, (v.z * 0.45) - pivotZ * 0.45);
          dummy.scale.set(0.45, 0.45, 0.45);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
          inst.setColorAt(i, new THREE.Color(v.color));
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        return inst;
      };

      const torsoMesh = buildPartMesh(torsoV, 0, 7.5, 0);
      if (torsoMesh) this.alienTorsoGroup.add(torsoMesh);
      this.alienTorsoGroup.position.set(0, 7.5 * 0.45, 0);

      const headMesh = buildPartMesh(headV, 0, 11.5, 0);
      if (headMesh) this.alienHeadGroup.add(headMesh);
      this.alienHeadGroup.position.set(0, 11.5 * 0.45, 0);

      const lArmMesh = buildPartMesh(lArmV, -1.8, 8.5, 0);
      if (lArmMesh) this.alienLeftArmGroup.add(lArmMesh);
      this.alienLeftArmGroup.position.set(-1.8 * 0.45, 8.5 * 0.45, 0);

      const rArmMesh = buildPartMesh(rArmV, 1.8, 8.5, 0);
      if (rArmMesh) this.alienRightArmGroup.add(rArmMesh);
      this.alienRightArmGroup.position.set(1.8 * 0.45, 8.5 * 0.45, 0);

      const lLegMesh = buildPartMesh(lLegV, -0.9, 4.3, 0);
      if (lLegMesh) this.alienLeftLegGroup.add(lLegMesh);
      this.alienLeftLegGroup.position.set(-0.9 * 0.45, 4.3 * 0.45, 0);

      const rLegMesh = buildPartMesh(rLegV, 0.9, 4.3, 0);
      if (rLegMesh) this.alienRightLegGroup.add(rLegMesh);
      this.alienRightLegGroup.position.set(0.9 * 0.45, 4.3 * 0.45, 0);

      this.alienContainerGroup.add(this.alienTorsoGroup, this.alienHeadGroup, this.alienLeftArmGroup, this.alienRightArmGroup, this.alienLeftLegGroup, this.alienRightLegGroup);
      this.playerGroup.add(this.alienContainerGroup);
    } else {
      let cx = 0, cy = 0, cz = 0;
      voxels.forEach(v => { cx += v.x; cy += v.y; cz += v.z; });
      if (voxels.length > 0) {
        cx /= voxels.length; cy /= voxels.length; cz /= voxels.length;
      }

      const isUFO = this.playerMode === 'UFO';
      const scale = isUFO ? 0.5 : 1.0;
      
      // Use slightly simpler material if voxels are very high count, to keep performance smooth
      const geo = new THREE.BoxGeometry(0.95 * scale, 0.95 * scale, 0.95 * scale);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      this.playerMesh = new THREE.InstancedMesh(geo, mat, voxels.length);
      this.playerMesh.castShadow = true;
      this.playerMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      voxels.forEach((v, i) => {
        dummy.position.set((v.x - cx) * scale, (v.y - cy) * scale, (v.z - cz) * scale);
        dummy.scale.set(1.0, 1.0, 1.0);
        dummy.updateMatrix();
        this.playerMesh!.setMatrixAt(i, dummy.matrix);
        this.playerMesh!.setColorAt(i, new THREE.Color(v.color));
      });

      this.playerMesh.instanceMatrix.needsUpdate = true;
      if (this.playerMesh.instanceColor) this.playerMesh.instanceColor.needsUpdate = true;

      this.playerGroup.add(this.playerMesh);
    }
  }

  public setPlayerMode(mode: PlayerMode) {
    this.playerMode = mode;
    if (this.isActive) {
      this.buildPlayerMesh([]);
    }
  }

  public setVirtualInput(fwd: number, strafe: number, ascend: number = 0, boost: boolean = false) {
    this.controller.keys['KeyW'] = fwd > 0;
    this.controller.keys['KeyS'] = fwd < 0;
    this.controller.keys['KeyD'] = strafe > 0;
    this.controller.keys['KeyA'] = strafe < 0;
    this.controller.keys['Space'] = ascend > 0;
    this.controller.keys['ControlLeft'] = ascend < 0;
    this.controller.keys['ShiftLeft'] = boost;
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number = 0) {
    this.controller.camYaw += deltaYaw;
    this.controller.camPitch = Math.max(0.05, Math.min(Math.PI / 2.2, this.controller.camPitch + deltaPitch));
  }

  public triggerJump() {
    if (this.controller.isGrounded) {
      this.controller.velY = 0.8;
      this.controller.isGrounded = false;
      this.audio.playWindBoostSound();
    }
  }

  public triggerAction() {
    if (!this.isActive) return;
    if (this.playerMode === 'UFO') {
      if (this.weaponMode === 'tractor') {
        this.audio.playLaserSound();
        this.controller.screenShake = 0.8;
      } else if (this.weaponMode === 'repulsor') {
        this.physicsCombat.explodeObject(new THREE.Vector3(this.controller.posX, CONFIG.FLOOR_Y + 0.5, this.controller.posZ), 0xff5500);
      } else if (this.weaponMode === 'disintegrator') {
        this.audio.playLaserSound();
        this.controller.screenShake = 1.2;
      }
    }
  }

  public triggerBarrelRoll(): boolean {
    if (this.barrelRollCooldown <= 0 && this.playerMode === 'UFO') {
      this.barrelRollTimer = 0.6;
      this.barrelRollCooldown = 2.5;
      this.audio.playWindBoostSound();
      this.controller.screenShake = 1.0;
      return true;
    }
    return false;
  }

  // --- MAIN ENGINE TICK / UPDATE LOOP ---
  public update(deltaTime: number) {
    if (!this.isActive) return;

    if (this.barrelRollTimer > 0) {
      this.barrelRollTimer -= deltaTime;
      this.currentRollAngle += (Math.PI * 2 / 0.6) * deltaTime;
    } else {
      this.currentRollAngle = 0;
    }
    if (this.barrelRollCooldown > 0) {
      this.barrelRollCooldown -= deltaTime;
    }

    // 1. Controller Movement Updates
    this.controller.updateMovement(deltaTime, this.playerMode, this.ufoBody, this.audio);
    this.playerGroup.position.set(this.controller.posX, this.controller.posY, this.controller.posZ);
    this.playerGroup.rotation.set(0, this.controller.rotY, this.currentRollAngle);

    // 2. Physics & AI Updates
    if (this.physicsActive) {
      this.physicsCombat.physicsWorld.step(deltaTime);
      this.physicsCombat.updateDebris();
      this.possessionManager.updateSummonedObjects(this.physicsActive);
    }

    // 3. Police Chasers
    this.physicsCombat.updatePoliceChasers(
      deltaTime,
      this.wantedLevel,
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      this.playerGroup
    );

    // 4. Ground Scanner & Abduction Beam Logic
    this.abductionManager.updateScanner(
      this.playerMode,
      this.controller.posX,
      this.controller.posZ,
      this.pedSpatialHash
    );

    const { closestPedTarget } = this.abductionManager.updateTractorBeamAndAlignment(
      deltaTime,
      this.playerMode,
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      this.cityWorld,
      this.pedSpatialHash,
      (px, py, pz) => {
        this.physicsCombat.spawnRagdoll(new THREE.Vector3(px, py - 1.5, pz));
      }
    );

    // 5. Radar Blips Computation
    const radarBlips: RadarBlip[] = [];
    const maxRadarDist = 80;

    if (this.cityWorld) {
      for (const item of this.cityWorld.collectibleVoxels) {
        const dx = item.mesh.position.x - this.controller.posX;
        const dz = item.mesh.position.z - this.controller.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= maxRadarDist) {
          const blipType = item.type === 'fish' ? 'fish' : item.type === 'feather' ? 'feather' : 'crystal';
          radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: blipType as any });
        }
      }
    }

    for (const police of this.physicsCombat.policeChasers) {
      const dx = police.mesh.position.x - this.controller.posX;
      const dz = police.mesh.position.z - this.controller.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= maxRadarDist) {
        radarBlips.push({ x: dx / maxRadarDist, z: dz / maxRadarDist, type: 'police' });
      }
    }

    // 6. Camera Update
    this.controller.updateCamera(this.camera, this.playerGroup, this.playerMode, deltaTime);

    // 7. Telemetry Notification
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        posX: Math.round(this.controller.posX),
        posY: Math.round(this.controller.posY),
        posZ: Math.round(this.controller.posZ),
        speed: Math.round(Math.hypot(this.controller.velX, this.controller.velY, this.controller.velZ) * 60),
        score: this.score,
        highScore: this.highScore,
        energy: this.energy,
        abductedCount: this.abductionManager.abductedCount,
        wantedLevel: this.wantedLevel,
        activeQuest: this.quests[this.currentQuestIndex],
        altitude: Math.round(this.controller.posY - CONFIG.FLOOR_Y),
        boostActive: !!(this.controller.keys['ShiftLeft'] || this.controller.keys['ShiftRight']),
        actionActive: !!this.controller.keys['Space'],
        weaponMode: this.weaponMode,
        credits: this.credits,
        radarBlips,
        targetAlignmentState: this.abductionManager.targetAlignmentState,
        alignmentProgress: this.abductionManager.alignmentProgress,
        abductionProgress: this.abductionManager.abductionProgress,
        targetName: this.abductionManager.targetName,
        alienTestLog: this.abductionManager.alienTestLog,
        alignmentWarning: this.abductionManager.alignmentWarning,
        summonedAIObjects: this.possessionManager.getSummonedObjectsTelemetry(this.controller.posX, this.controller.posY, this.controller.posZ),
        possessedObject: this.possessionManager.possessedObject,
        flightMode: this.controller.flightMode,
        bioSpecimens: this.bioSpecimens,
        mutantsDeployed: this.mutantsDeployed,
      });
    }
  }

  // --- PUBLIC DELEGATE API METHODS ---
  public async summonAIObject(prompt: string, params?: any) {
    const forwardX = Math.sin(this.controller.rotY);
    const forwardZ = Math.cos(this.controller.rotY);
    const spawnX = this.controller.posX + forwardX * 12;
    const spawnZ = this.controller.posZ + forwardZ * 12;
    const spawnY = this.controller.posY;

    // Direct camera to focus on the materialization matrix
    this.controller.synthesisFocusTarget = { x: spawnX, y: spawnY, z: spawnZ };

    const res = await this.possessionManager.summonAIObject(
      prompt,
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      this.controller.rotY,
      params,
      (targetY) => {
        if (this.controller.synthesisFocusTarget) {
          this.controller.synthesisFocusTarget.y = targetY;
        }
      }
    );

    if (res.success && res.id) {
      this.possessAIObject(res.id);
    } else {
      this.controller.synthesisFocusTarget = null;
    }
    return res;
  }

  public getSummonedObjectsTelemetry() {
    return this.possessionManager.getSummonedObjectsTelemetry(this.controller.posX, this.controller.posY, this.controller.posZ);
  }

  public possessAIObject(id: string): boolean {
    return this.possessionManager.possessAIObject(id, (tx, ty, tz, loco) => {
      this.controller.posX = tx;
      this.controller.posY = ty;
      this.controller.posZ = tz;
      this.controller.synthesisFocusTarget = null; // Clear focus target so camera smoothly transitions to behind possessed object!
      if (this.ufoBody) {
        this.ufoBody.position.set(tx, ty, tz);
        this.ufoBody.velocity.set(0, 0, 0);
      }
      if (loco === 'flight') {
        this.controller.flightMode = 'jet';
        this.controller.jetThrottle = 0.6;
      } else if (loco === 'walk') {
        this.playerMode = 'Alien';
        this.controller.posY = Math.max(CONFIG.FLOOR_Y + 1.2, ty);
      } else if (loco === 'hover_drift') {
        this.controller.flightMode = 'hover';
      }
    });
  }

  public ejectFromPossession(): boolean {
    return this.possessionManager.ejectFromPossession(
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      () => this.buildPlayerMesh([])
    );
  }

  public triggerPossessedPrimaryAbility() {
    this.possessionManager.triggerPossessedPrimaryAbility(
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      this.controller.rotY,
      (pos, col) => this.physicsCombat.explodeObject(pos, col),
      this.physicsCombat.debrisBodies,
      (fx, fz) => {
        this.controller.velX += fx;
        this.controller.velZ += fz;
      }
    );
  }

  public recallAIObject(id: string): boolean {
    return this.possessionManager.recallAIObject(id, this.controller.posX, this.controller.posY, this.controller.posZ, this.controller.rotY);
  }

  public overchargeAIObject(id: string): boolean {
    return this.possessionManager.overchargeAIObject(id);
  }

  public deconstructAIObject(id: string): boolean {
    return this.possessionManager.deconstructAIObject(id, this.physicsCombat.debrisBodies);
  }

  public teleportToAIObject(id: string): boolean {
    return this.possessionManager.teleportToAIObject(id, (tx, ty, tz) => {
      this.controller.posX = tx;
      this.controller.posY = ty;
      this.controller.posZ = tz;
      if (this.ufoBody) {
        this.ufoBody.position.set(tx, ty, tz);
        this.ufoBody.velocity.set(0, 0, 0);
      }
    });
  }

  public deployMutant(): boolean {
    if (this.bioSpecimens < 3) return false;
    this.bioSpecimens -= 3;
    this.mutantsDeployed++;
    this.audio.playExplosionSound();
    this.controller.screenShake = 2.0;
    return true;
  }
}
