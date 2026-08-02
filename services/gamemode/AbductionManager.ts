/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Pedestrian, CityWorld } from '../CityGenerator';
import { CONFIG } from '../../utils/voxelConstants';
import { SpatialHashGrid } from '../SpatialHashGrid';
import { GameAudioEngine } from '../GameAudioEngine';

export class AbductionManager {
  private scene: THREE.Scene;
  private playerGroup: THREE.Group;
  private audio: GameAudioEngine;
  private physicsWorld: CANNON.World;

  public groundScannerMesh: THREE.Group | null = null;
  public tractorBeamGroup: THREE.Group | null = null;
  public tractorBeamMesh: THREE.Mesh | null = null;
  public beamEnergyCore: THREE.Mesh | null = null;
  public beamGroundRing: THREE.Mesh | null = null;
  public beamSurfaceLight: THREE.PointLight | null = null;
  public beamSpiralParticles: THREE.Mesh[] = [];

  public targetAlignmentState: 'SEARCHING' | 'ALIGNING' | 'LOCK_STABLE' | 'ABDUCTING' | 'SUCCESS' | 'ALIGNMENT_LOST' = 'SEARCHING';
  public alignmentProgress: number = 0;
  public abductionProgress: number = 0;
  public activeAbductee: Pedestrian | null = null;
  public activeAbducteeIdx: number = -1;
  public abductionTimer: number = 0;
  public alignmentHoldTimer: number = 0;
  public targetName: string = "CIVILIAN";
  public abductedCount: number = 0;
  public alienTestLog: string | null = null;
  public alignmentWarning: string | null = null;

  constructor(scene: THREE.Scene, playerGroup: THREE.Group, audio: GameAudioEngine, physicsWorld: CANNON.World) {
    this.scene = scene;
    this.playerGroup = playerGroup;
    this.audio = audio;
    this.physicsWorld = physicsWorld;

    this.setupGroundScanner();
    this.setupTractorBeam();
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

    this.beamSurfaceLight = new THREE.PointLight(0x00f0ff, 0, 35);
    this.beamSurfaceLight.position.set(0, CONFIG.FLOOR_Y + 2, 0);

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

  public updateScanner(playerMode: string, posX: number, posZ: number, pedSpatialHash: SpatialHashGrid<Pedestrian>) {
    if (!this.groundScannerMesh) return;
    if (playerMode === 'UFO') {
      this.groundScannerMesh.visible = true;
      this.groundScannerMesh.position.set(posX, CONFIG.FLOOR_Y + 0.15, posZ);
      this.groundScannerMesh.rotation.y += 0.02;

      const nearbyPeds = pedSpatialHash.queryRadius(posX, posZ, 14);
      const ringMesh = this.groundScannerMesh.children[0] as THREE.Mesh;
      if (ringMesh && ringMesh.material instanceof THREE.MeshBasicMaterial) {
        ringMesh.material.color.setHex(nearbyPeds.length > 0 ? 0xfacc15 : 0x00f0ff);
      }
    } else {
      this.groundScannerMesh.visible = false;
    }
  }

  public updateTractorBeamAndAlignment(
    deltaTime: number,
    playerMode: string,
    posX: number,
    posY: number,
    posZ: number,
    cityWorld: CityWorld | null,
    pedSpatialHash: SpatialHashGrid<Pedestrian>,
    onAbductionSuccess: (posX: number, posY: number, posZ: number, pedIdx: number) => void
  ) {
    this.alignmentWarning = null;
    let closestPedTarget: Pedestrian | null = null;

    if (playerMode === 'UFO' && cityWorld) {
      let closestIdx = -1;
      let closestDist = Infinity;

      const nearestEntry = pedSpatialHash.queryNearest(posX, posZ, 25);
      if (nearestEntry) {
        closestPedTarget = nearestEntry.item;
        closestIdx = nearestEntry.id;
        closestDist = Math.hypot(nearestEntry.x - posX, nearestEntry.z - posZ);
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
            this.targetAlignmentState = 'ALIGNMENT_LOST';
            this.alignmentWarning = "⚠️ ALIGNMENT LOST - RE-CENTER UFO";
            if (this.activeAbductee) {
              if ((this.activeAbductee as any).body) {
                this.physicsWorld.removeBody((this.activeAbductee as any).body);
                (this.activeAbductee as any).body = null;
              }
              this.activeAbductee.mesh.position.y = CONFIG.FLOOR_Y + 0.4;
              this.activeAbductee.mesh.rotation.x = Math.PI / 2;
              this.activeAbductee = null;
            }
            this.abductionTimer = 0;
          } else {
            this.targetAlignmentState = 'SEARCHING';
          }
        }

        if (this.targetAlignmentState === 'LOCK_STABLE' && !this.activeAbductee) {
          this.targetAlignmentState = 'ABDUCTING';
          this.activeAbductee = closestPedTarget;
          this.activeAbducteeIdx = closestIdx;
          this.abductionTimer = 0;
          this.audio.playAbductionSound();

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
          const now = performance.now();
          if (pedBody) {
            const beamCenter = new CANNON.Vec3(posX, posY - 1.5, posZ);
            const pedPos = pedBody.position;
            const dx = beamCenter.x - pedPos.x;
            const dz = beamCenter.z - pedPos.z;

            const centerForceMag = 120;
            const liftForceMag = 350 + (this.abductionTimer * 50);
            const wobbleX = Math.sin(now * 0.005) * 50;
            const wobbleZ = Math.cos(now * 0.007) * 50;

            pedBody.applyForce(new CANNON.Vec3(dx * centerForceMag + wobbleX, liftForceMag, dz * centerForceMag + wobbleZ), pedPos);

            this.activeAbductee.mesh.position.set(pedPos.x, pedPos.y - 1, pedPos.z);
            this.activeAbductee.mesh.quaternion.set(pedBody.quaternion.x, pedBody.quaternion.y, pedBody.quaternion.z, pedBody.quaternion.w);
          }

          if (this.tractorBeamMesh) {
            (this.tractorBeamMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(now * 0.015) * 0.2;
          }
          if (this.beamEnergyCore) {
            (this.beamEnergyCore.material as THREE.MeshBasicMaterial).opacity = 0.85;
          }
          if (this.beamGroundRing) {
            this.beamGroundRing.position.set(posX, CONFIG.FLOOR_Y + 0.1, posZ);
            (this.beamGroundRing.material as THREE.MeshBasicMaterial).opacity = 0.75;
          }
          if (this.beamSurfaceLight) {
            this.beamSurfaceLight.position.set(posX, CONFIG.FLOOR_Y + 2, posZ);
            this.beamSurfaceLight.intensity = 4.0;
          }

          this.beamSpiralParticles.forEach((p, pIdx) => {
            const angle = now * 0.003 + (pIdx * Math.PI / 6);
            const radius = 1.2 + Math.sin(now * 0.005 + pIdx) * 0.5;
            const pProgress = ((now * 0.002 + pIdx * 0.1) % 1);
            p.position.set(Math.cos(angle) * radius, -30 * (1 - pProgress), Math.sin(angle) * radius);
            (p.material as THREE.MeshBasicMaterial).opacity = Math.sin(pProgress * Math.PI) * 0.8;
          });

          if (this.abductionTimer >= 4.5) {
            this.targetAlignmentState = 'SUCCESS';
            this.audio.playAbductionSound();
            this.abductedCount++;

            const testQuotes = [
              `🧪 PROBED: Subject #${this.activeAbducteeIdx + 101} - IQ: ${Math.floor(Math.random()*60+60)} - Memory Cleared!`,
              `🧪 ANALYZED: Subject #${this.activeAbducteeIdx + 101} - DNA = 98% Banana!`,
              `🧪 LAB TEST: Subject #${this.activeAbducteeIdx + 101} - Caloric value: 2400 kcal!`,
              `🧪 SCAN COMPLETE: Subject #${this.activeAbducteeIdx + 101} - Teleported donut directly into stomach!`
            ];
            this.alienTestLog = testQuotes[Math.floor(Math.random() * testQuotes.length)];

            if (cityWorld && this.activeAbducteeIdx !== -1) {
              if ((this.activeAbductee as any).body) {
                this.physicsWorld.removeBody((this.activeAbductee as any).body);
              }
              this.scene.remove(this.activeAbductee.mesh);
              cityWorld.pedestrians.splice(this.activeAbducteeIdx, 1);
            }

            onAbductionSuccess(posX, posY, posZ, this.activeAbducteeIdx);

            this.activeAbductee = null;
            this.abductionTimer = 0;
            this.abductionProgress = 100;
          }
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

    return { closestPedTarget };
  }

  public dispose() {
    if (this.groundScannerMesh) this.scene.remove(this.groundScannerMesh);
    if (this.beamGroundRing) this.scene.remove(this.beamGroundRing);
    if (this.beamSurfaceLight) this.scene.remove(this.beamSurfaceLight);
  }
}
