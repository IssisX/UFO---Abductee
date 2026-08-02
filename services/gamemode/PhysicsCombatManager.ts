/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ActiveRagdoll, PoliceChaser, DebrisObject } from './GameModeTypes';
import { GameAudioEngine } from '../GameAudioEngine';
import { CONFIG } from '../../utils/voxelConstants';

export class PhysicsCombatManager {
  private scene: THREE.Scene;
  public physicsWorld: CANNON.World;
  private audio: GameAudioEngine;

  public activeRagdolls: ActiveRagdoll[] = [];
  public policeChasers: PoliceChaser[] = [];
  public debrisBodies: DebrisObject[] = [];
  public policeSpawnCooldown = 0;
  public lastSirenSoundTime = 0;

  constructor(scene: THREE.Scene, audio: GameAudioEngine) {
    this.scene = scene;
    this.audio = audio;

    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
    });
    this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
    (this.physicsWorld.solver as CANNON.GSSolver).iterations = 10;

    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material({ friction: 0.1, restitution: 0.1 }) });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, CONFIG.FLOOR_Y, 0);
    this.physicsWorld.addBody(groundBody);
  }

  public spawnRagdoll(pos: THREE.Vector3) {
    const ragGroup = new THREE.Group();
    ragGroup.position.copy(pos);

    const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });
    const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const torsoGeo = new THREE.BoxGeometry(0.6, 0.9, 0.4);
    const limbGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);

    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.8, 0);

    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.set(0, 0.2, 0);

    const legL = new THREE.Mesh(limbGeo, mat);
    legL.position.set(-0.2, -0.5, 0);

    const legR = new THREE.Mesh(limbGeo, mat);
    legR.position.set(0.2, -0.5, 0);

    const armL = new THREE.Mesh(limbGeo, mat);
    armL.position.set(-0.45, 0.3, 0);

    const armR = new THREE.Mesh(limbGeo, mat);
    armR.position.set(0.45, 0.3, 0);

    ragGroup.add(head, torso, legL, legR, armL, armR);
    this.scene.add(ragGroup);

    const initialVel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      -8,
      (Math.random() - 0.5) * 8
    );
    const initialRotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );

    this.activeRagdolls.push({
      mesh: ragGroup,
      bodyParts: { head, torso, legL, legR, armL, armR },
      pos: pos.clone(),
      vel: initialVel,
      rot: new THREE.Vector3(0, 0, 0),
      rotVel: initialRotVel,
      bouncesLeft: 3,
      timeAlive: 0,
      recovered: false
    });
  }

  public updateRagdolls(deltaTime: number) {
    for (let i = this.activeRagdolls.length - 1; i >= 0; i--) {
      const rag = this.activeRagdolls[i];
      rag.timeAlive += deltaTime;

      if (!rag.recovered) {
        rag.vel.y -= 18 * deltaTime; // gravity
        rag.pos.addScaledVector(rag.vel, deltaTime);

        rag.rot.addScaledVector(rag.rotVel, deltaTime);
        rag.mesh.rotation.set(rag.rot.x, rag.rot.y, rag.rot.z);

        const groundLevel = CONFIG.FLOOR_Y + 0.5;
        if (rag.pos.y <= groundLevel) {
          rag.pos.y = groundLevel;
          if (rag.bouncesLeft > 0) {
            rag.bouncesLeft--;
            rag.vel.y = -rag.vel.y * 0.4; // Bounce damping
            rag.vel.x *= 0.6;
            rag.vel.z *= 0.6;
            rag.rotVel.multiplyScalar(0.5);
            this.audio.playBounceSound();
          } else {
            rag.vel.set(0, 0, 0);
            rag.rotVel.set(0, 0, 0);
            rag.recovered = true;
          }
        }
        rag.mesh.position.copy(rag.pos);
      } else {
        if (rag.timeAlive > 10.0) {
          this.scene.remove(rag.mesh);
          this.activeRagdolls.splice(i, 1);
        }
      }
    }
  }

  public spawnPoliceChaser(playerX: number, playerY: number, playerZ: number) {
    const policeGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, emissive: 0x0284c7, emissiveIntensity: 0.5 });
    
    const bodyGeo = new THREE.BoxGeometry(3.5, 1.0, 5.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);

    const cabinGeo = new THREE.BoxGeometry(2.2, 0.8, 2.5);
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.7, -0.2);

    const sirenLight = new THREE.PointLight(0xef4444, 4.0, 30);
    sirenLight.position.set(0, 1.5, 0);

    policeGroup.add(bodyMesh, cabinMesh, sirenLight);

    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 70 + Math.random() * 20;
    policeGroup.position.set(
      playerX + Math.cos(angle) * spawnDist,
      playerY + 5 + Math.random() * 10,
      playerZ + Math.sin(angle) * spawnDist
    );

    this.scene.add(policeGroup);
    this.policeChasers.push({
      mesh: policeGroup,
      vel: new THREE.Vector3(),
      sirenLight
    });
    this.policeSpawnCooldown = 8.0;
  }

  public updatePoliceChasers(
    deltaTime: number,
    wantedLevel: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerGroup: THREE.Group
  ) {
    if (this.policeSpawnCooldown > 0) {
      this.policeSpawnCooldown -= deltaTime;
    }

    const targetPoliceCount = wantedLevel <= 1 ? 0 : (wantedLevel <= 3 ? 1 : 2);
    if (this.policeChasers.length < targetPoliceCount && this.policeSpawnCooldown <= 0) {
      this.spawnPoliceChaser(playerX, playerY, playerZ);
    }

    const now = performance.now();
    for (let i = this.policeChasers.length - 1; i >= 0; i--) {
      const police = this.policeChasers[i];
      const offsetAngle = (now * 0.0004) + (i * Math.PI);
      const patrolRadius = 55 + i * 18;
      const targetPos = new THREE.Vector3(
        playerX + Math.cos(offsetAngle) * patrolRadius,
        playerY + 12 + Math.sin(now * 0.0015 + i) * 3,
        playerZ + Math.sin(offsetAngle) * patrolRadius
      );
      police.mesh.position.lerp(targetPos, 0.02);
      police.mesh.rotation.y += 0.02;

      const distToPlayer = police.mesh.position.distanceTo(playerGroup.position);
      const isSearchlightLock = distToPlayer < 40;

      const flash = Math.floor(now / (isSearchlightLock ? 100 : 300)) % 2 === 0;
      police.sirenLight.color.setHex(flash ? 0xef4444 : 0x3b82f6);

      if (isSearchlightLock && (now - this.lastSirenSoundTime > 14000)) {
        this.lastSirenSoundTime = now;
        this.audio.playSirenSound();
      }
    }
  }

  public explodeObject(pos: THREE.Vector3, color: number) {
    const pCount = 20;
    const pGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });

    for (let i = 0; i < pCount; i++) {
      const p = new THREE.Mesh(pGeo, pMat.clone());
      p.position.copy(pos);
      this.scene.add(p);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(Math.random() * 12 + 4);

      const startTime = performance.now();
      const anim = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 0.8) {
          p.position.addScaledVector(dir, 0.016);
          p.scale.multiplyScalar(0.95);
          (p.material as THREE.MeshBasicMaterial).opacity = 1 - elapsed / 0.8;
          requestAnimationFrame(anim);
        } else {
          this.scene.remove(p);
          pGeo.dispose();
          (p.material as THREE.Material).dispose();
        }
      };
      anim();
    }
  }

  public updateDebris() {
    for (const d of this.debrisBodies) {
      d.mesh.position.copy(d.body.position as any);
      d.mesh.quaternion.copy(d.body.quaternion as any);
    }
  }

  public dispose() {
    for (const rag of this.activeRagdolls) {
      this.scene.remove(rag.mesh);
    }
    this.activeRagdolls = [];

    for (const police of this.policeChasers) {
      this.scene.remove(police.mesh);
    }
    this.policeChasers = [];

    for (const d of this.debrisBodies) {
      this.scene.remove(d.mesh);
      this.physicsWorld.removeBody(d.body);
    }
    this.debrisBodies = [];
  }
}
