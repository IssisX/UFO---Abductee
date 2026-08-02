const fs = require('fs');
const content = fs.readFileSync('services/gamemode/PlayerController.ts', 'utf8');
const lines = content.split('\n');
const start = 43; // 44 is 0 indexed 43
const end = 73; // 73 is 72

const replacement = `    if (this.isMouseDragging || Object.values(this.keys).some(Boolean)) {
      this.userCamOverrideTimer = 5.0;
    } else if (this.userCamOverrideTimer > 0) {
      this.userCamOverrideTimer -= deltaTime;
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
      const distance = playerMode === 'UFO' ? 18 : 8;
      const height = playerMode === 'UFO' ? 10 : 4;

      const targetX = this.posX - Math.sin(this.camYaw) * distance * Math.cos(this.camPitch);
      const targetZ = this.posZ - Math.cos(this.camYaw) * distance * Math.cos(this.camPitch);
      const targetY = this.posY + height + Math.sin(this.camPitch) * distance;

      camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
      camera.lookAt(this.posX, this.posY + 2, this.posZ);
    }`;

lines.splice(start, end - start, replacement);
fs.writeFileSync('services/gamemode/PlayerController.ts', lines.join('\n'));
