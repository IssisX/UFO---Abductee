const fs = require('fs');
let code = fs.readFileSync('services/GameModeEngine.ts', 'utf8');

const target = `      if (e.code === 'F1') this.setWeaponMode('tractor');
      if (e.code === 'F2') this.setWeaponMode('repulsor');
      if (e.code === 'F3') this.setWeaponMode('disintegrator');
      if (e.code === 'F4') this.setWeaponMode('vortex');
      if (e.code === 'F5') this.setWeaponMode('orbital_laser');`;

const replacement = `      if (e.code === 'F1') { e.preventDefault(); this.setWeaponMode('tractor'); }
      if (e.code === 'F2') { e.preventDefault(); this.setWeaponMode('repulsor'); }
      if (e.code === 'F3') { e.preventDefault(); this.setWeaponMode('disintegrator'); }
      if (e.code === 'F4') { e.preventDefault(); this.setWeaponMode('vortex'); }
      if (e.code === 'F5') { e.preventDefault(); this.setWeaponMode('orbital_laser'); }`;

code = code.replace(target, replacement);
fs.writeFileSync('services/GameModeEngine.ts', code);
