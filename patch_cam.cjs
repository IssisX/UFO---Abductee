const fs = require('fs');
const content = fs.readFileSync('services/gamemode/PlayerController.ts', 'utf8');

const replacement = `  public updateCamera(
    camera: THREE.PerspectiveCamera,
    playerGroup: THREE.Group,
    playerMode: PlayerMode,
    deltaTime: number
  ) {
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
  }`;

const regex = /public updateCamera\([\s\S]*?if\s*\(this\.screenShake > 0\)\s*\{[\s\S]*?\}\s*\}/;
const newContent = content.replace(regex, replacement);

fs.writeFileSync('services/gamemode/PlayerController.ts', newContent);
