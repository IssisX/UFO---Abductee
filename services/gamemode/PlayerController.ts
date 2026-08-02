/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PlayerMode } from '../../types';
import { GameAudioEngine } from '../GameAudioEngine';

export class PlayerController {
  public keys: { [key: string]: boolean } = {};
  public isMouseDragging = false;
  public previousMousePosition = { x: 0, y: 0 };
  public camYaw = 0;
  public camPitch = 0.3;

  public posX = 0;
  public posY = 15;
  public posZ = 0;
  public rotY = 0;
  public velX = 0;
  public velY = 0;
  public velZ = 0;
  public isGrounded = false;

  public flightMode: 'hover' | 'jet' = 'hover';
  public jetPitch: number = 0;
  public jetRoll: number = 0;
  public jetThrottle: number = 0;
  public screenShake = 0;

  public isCinematicCamera: boolean = true;
  public userCamOverrideTimer: number = 0;
  public synthesisFocusTarget: { x: number; y: number; z: number } | null = null;

  constructor() {}

    public updateCamera(
    camera: THREE.PerspectiveCamera,
    playerGroup: THREE.Group,
    playerMode: PlayerMode,
    deltaTime: number
  ) {
    if (this.synthesisFocusTarget) {
      const now = performance.now() * 0.0006;
      const camRadius = 15;
      const camHeight = 6;
      const targetCamX = this.synthesisFocusTarget.x + Math.sin(now) * camRadius;
      const targetCamZ = this.synthesisFocusTarget.z + Math.cos(now) * camRadius;
      const targetCamY = this.synthesisFocusTarget.y + camHeight + Math.sin(now * 1.5) * 1.2;

      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
      camera.lookAt(this.synthesisFocusTarget.x, this.synthesisFocusTarget.y + 1.2, this.synthesisFocusTarget.z);

      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - deltaTime * 3);
        const shakeAmt = this.screenShake * 0.6;
        camera.position.x += (Math.random() - 0.5) * shakeAmt;
        camera.position.y += (Math.random() - 0.5) * shakeAmt;
        camera.position.z += (Math.random() - 0.5) * shakeAmt;
      }
      return;
    }

    if (this.isMouseDragging || Object.values(this.keys).some(Boolean)) {
      this.userCamOverrideTimer = 5.0;
    } else if (this.userCamOverrideTimer > 0) {
      this.userCamOverrideTimer -= deltaTime;
    }

    if (!this.isMouseDragging && this.userCamOverrideTimer <= 0) {
       // Auto-align camera slowly behind player movement if moving
       const speed = Math.hypot(this.velX, this.velZ);
       if (speed > 0.1) {
         const moveYaw = Math.atan2(this.velX, this.velZ);
         // Smoothly lerp camYaw towards moveYaw
         let diff = moveYaw - this.camYaw;
         while (diff < -Math.PI) diff += Math.PI * 2;
         while (diff > Math.PI) diff -= Math.PI * 2;
         this.camYaw += diff * 0.02;
       }
    }

    if (this.isCinematicCamera && this.userCamOverrideTimer <= 0) {
      const now = performance.now() * 0.0003;
      const camRadius = playerMode === 'UFO' ? 22 : 12;
      const camHeight = playerMode === 'UFO' ? 14 : 7;
          
      const targetCamX = this.posX + Math.sin(now) * camRadius;
      const targetCamZ = this.posZ + Math.cos(now) * camRadius;
      const targetCamY = this.posY + camHeight + Math.sin(now * 2) * 1.5;

      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.03);
      camera.lookAt(this.posX, this.posY + 2, this.posZ);
    } else {
      const distance = playerMode === 'UFO' ? 20 : 8;
      const height = playerMode === 'UFO' ? 8 : 4;
      
      // Prevent going completely top-down to avoid "right on top of the UFO" feeling
      const effectivePitch = Math.min(this.camPitch, Math.PI / 3);

      const targetX = this.posX - Math.sin(this.camYaw) * distance * Math.cos(effectivePitch);
      const targetZ = this.posZ - Math.cos(this.camYaw) * distance * Math.cos(effectivePitch);
      const targetY = this.posY + height + Math.sin(effectivePitch) * distance;

      // Add velocity-based dynamic sway/lag to camera position for liveliness
      const lagX = this.velX * 3.0;
      const lagZ = this.velZ * 3.0;
      const lagY = this.velY * 3.0;

      camera.position.lerp(new THREE.Vector3(targetX - lagX, targetY - lagY, targetZ - lagZ), 0.08);

      // Look slightly ahead based on velocity
      const lookAtTarget = new THREE.Vector3(
        this.posX + this.velX * 10,
        this.posY + 2 + this.velY * 5,
        this.posZ + this.velZ * 10
      );
      
      const currentLookAt = new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
      const tempCam = camera.clone();
      tempCam.lookAt(lookAtTarget);
      camera.quaternion.slerp(tempCam.quaternion, 0.1);
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - deltaTime * 3);
      const shakeAmt = this.screenShake * 0.6;
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }
  }

  public updateMovement(
    deltaTime: number,
    playerMode: PlayerMode,
    ufoBody: CANNON.Body | null,
    audio: GameAudioEngine
  ) {
    const isBoost = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

    if (playerMode === 'UFO') {
      const maxSpeed = isBoost ? 1.6 : 0.8;
      const accel = isBoost ? 0.08 : 0.04;
      const damping = 0.92;

      let moveX = 0;
      let moveZ = 0;

      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX += 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX -= 1;

      if (moveX !== 0 || moveZ !== 0) {
        const moveAngle = Math.atan2(moveX, moveZ);
        this.rotY = this.camYaw + moveAngle;

        this.velX += Math.sin(this.rotY) * accel;
        this.velZ += Math.cos(this.rotY) * accel;
      }

      this.velX *= damping;
      this.velZ *= damping;

      this.posX += this.velX;
      this.posZ += this.velZ;

      if (this.keys['Space']) this.posY += 0.35;
      if (this.keys['KeyC'] || this.keys['ControlLeft']) this.posY = Math.max(8, this.posY - 0.35);

      if (ufoBody) {
        ufoBody.position.set(this.posX, this.posY, this.posZ);
        ufoBody.velocity.set(this.velX * 10, 0, this.velZ * 10);
      }

      const currSpeedNorm = Math.min(1.0, Math.hypot(this.velX, this.velY, this.velZ) / maxSpeed);
      audio.updateEngineHum(currSpeedNorm);
    } else {
      // Ground / Alien Walk Physics
      const maxSpeed = isBoost ? 0.7 : 0.35;
      const accel = isBoost ? 0.06 : 0.03;
      const damping = 0.82;

      let moveX = 0;
      let moveZ = 0;

      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX += 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX -= 1;

      if (moveX !== 0 || moveZ !== 0) {
        const moveAngle = Math.atan2(moveX, moveZ);
        this.rotY = this.camYaw + moveAngle;

        this.velX += Math.sin(this.rotY) * accel;
        this.velZ += Math.cos(this.rotY) * accel;
      }

      this.velX *= damping;
      this.velZ *= damping;
    }
  }
}
