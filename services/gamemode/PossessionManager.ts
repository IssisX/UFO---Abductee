/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SynthesizedVoxel } from '../../types';
import { SummonedAIObject, PossessedObject, DebrisObject } from './GameModeTypes';
import { GameAudioEngine } from '../GameAudioEngine';
import { CONFIG } from '../../utils/voxelConstants';

export class PossessionManager {
  private scene: THREE.Scene;
  private physicsWorld: CANNON.World;
  private audio: GameAudioEngine;
  private playerGroup: THREE.Group;

  public summonedAIObjects: SummonedAIObject[] = [];
  public possessedObject: PossessedObject | null = null;

  constructor(scene: THREE.Scene, physicsWorld: CANNON.World, audio: GameAudioEngine, playerGroup: THREE.Group) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.playerGroup = playerGroup;
  }

  public async summonAIObject(
    prompt: string,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerRotY: number,
    params?: { styleScheme?: string; energyCore?: string; complexity?: string },
    onHeightUpdate?: (height: number) => void
  ): Promise<{ success: boolean; name?: string; description?: string; id?: string; error?: string }> {
    try {
      const forwardX = Math.sin(playerRotY);
      const forwardZ = Math.cos(playerRotY);
      const spawnX = playerX + forwardX * 12;
      const spawnZ = playerZ + forwardZ * 12;
      let spawnY = CONFIG.FLOOR_Y + 1.2;

      const group = new THREE.Group();
      group.position.set(spawnX, spawnY, spawnZ);
      
      const ringGeo = new THREE.RingGeometry(1.2, 2.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.0;
      group.add(ring);

      const pointLight = new THREE.PointLight(0x00f0ff, 3.0, 20);
      pointLight.position.set(0, 0, 0);
      group.add(pointLight);

      this.scene.add(group);

      const maxVoxels = 500;
      const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
      
      const emissiveMat = new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.1, emissiveIntensity: 2.5 });
      const metallicMat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.85 });
      const glassMat = new THREE.MeshPhysicalMaterial({ transmission: 0.8, opacity: 0.7, transparent: true, roughness: 0.1 });
      const standardMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });

      const instEmissive = new THREE.InstancedMesh(geo, emissiveMat, maxVoxels);
      const instMetallic = new THREE.InstancedMesh(geo, metallicMat, maxVoxels);
      const instGlass = new THREE.InstancedMesh(geo, glassMat, maxVoxels);
      const instStandard = new THREE.InstancedMesh(geo, standardMat, maxVoxels);
      
      instEmissive.count = 0; instMetallic.count = 0; instGlass.count = 0; instStandard.count = 0;
      instEmissive.castShadow = true; instMetallic.castShadow = true; instGlass.castShadow = true; instStandard.castShadow = true;
      group.add(instEmissive); group.add(instMetallic); group.add(instGlass); group.add(instStandard);

      const dummy = new THREE.Object3D();

      const res = await fetch('/api/gemini/synthesize-object-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          styleScheme: params?.styleScheme,
          energyCore: params?.energyCore,
          complexity: params?.complexity,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let processedVoxels = 0;
      const allVoxels: any[] = [];
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        
        const lines = sseBuffer.split('\n\n');
        sseBuffer = lines.pop() || ''; // Keep the incomplete part in the buffer
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const data = line.replace(/^\s*data:\s*/, '').trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulatedText += parsed.text;
                
                // Try to find {"x": ...} objects using regex
                const voxelRegex = /\{\s*"x"\s*:\s*(-?\d+)\s*,\s*"y"\s*:\s*(-?\d+)\s*,\s*"z"\s*:\s*(-?\d+)\s*,\s*"color"\s*:\s*"([^"]+)"(?:,\s*"mat"\s*:\s*"([^"]+)")?(?:,\s*"part"\s*:\s*"([^"]+)")?\s*\}/g;
                let match;
                let currentIndex = 0;
                while ((match = voxelRegex.exec(accumulatedText)) !== null) {
                  if (currentIndex >= processedVoxels) {
                    const v = { x: parseInt(match[1]), y: parseInt(match[2]), z: parseInt(match[3]), color: match[4], mat: match[5] || 'standard', part: match[6] || 'core' };
                    allVoxels.push(v);
                    
                    dummy.position.set(v.x * 0.45, v.y * 0.45, v.z * 0.45);
                    dummy.scale.set(0.45, 0.45, 0.45);
                    dummy.updateMatrix();
                    
                    const colStr = String(v.color || '').toLowerCase();
                    const color = new THREE.Color(v.color);

                    if (v.mat === 'emissive' || ['#00f0ff', '#ff0055', '#a855f7', '#00ffcc', '#ffff00'].includes(colStr)) {
                      instEmissive.setMatrixAt(instEmissive.count, dummy.matrix);
                      instEmissive.setColorAt(instEmissive.count, color);
                      instEmissive.count++;
                      instEmissive.instanceMatrix.needsUpdate = true;
                      if (instEmissive.instanceColor) instEmissive.instanceColor.needsUpdate = true;
                    } else if (v.mat === 'metallic') {
                      instMetallic.setMatrixAt(instMetallic.count, dummy.matrix);
                      instMetallic.setColorAt(instMetallic.count, color);
                      instMetallic.count++;
                      instMetallic.instanceMatrix.needsUpdate = true;
                      if (instMetallic.instanceColor) instMetallic.instanceColor.needsUpdate = true;
                    } else if (v.mat === 'glass') {
                      instGlass.setMatrixAt(instGlass.count, dummy.matrix);
                      instGlass.setColorAt(instGlass.count, color);
                      instGlass.count++;
                      instGlass.instanceMatrix.needsUpdate = true;
                      if (instGlass.instanceColor) instGlass.instanceColor.needsUpdate = true;
                    } else {
                      instStandard.setMatrixAt(instStandard.count, dummy.matrix);
                      instStandard.setColorAt(instStandard.count, color);
                      instStandard.count++;
                      instStandard.instanceMatrix.needsUpdate = true;
                      if (instStandard.instanceColor) instStandard.instanceColor.needsUpdate = true;
                    }

                    processedVoxels++;
                    this.audio.playLaserSound(); // small sound for building
                  }
                  currentIndex++;
                }
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }

      let cleanText = accumulatedText.replace(/```json/gi, "").replace(/```/g, "").trim();
      // Try to parse the rest of the metadata. If it fails, fallback to defaults
      let metadata: any = {};
      try {
         // Attempt to fix incomplete JSON by adding closing brackets
         let bracketDepth = 0;
         for(let i=0; i<cleanText.length; i++) {
            if(cleanText[i]==='{') bracketDepth++;
            else if(cleanText[i]==='}') bracketDepth--;
         }
         let tempText = cleanText;
         while(bracketDepth > 0) { tempText += '}'; bracketDepth--; }
         // Sometimes it misses array closing
         if (tempText.lastIndexOf('}') < tempText.lastIndexOf(']')) {
             tempText += '}';
         }
         // Remove trailing commas
         tempText = tempText.replace(/,\s*([}\]])/g, '$1');
         metadata = JSON.parse(tempText);
      } catch (e) {
         console.warn("Could not parse complete JSON, using defaults for metadata.");
      }

      const { name, description, animationType, physicsType, placementDomain: domainRaw, locomotionType: locoRaw, baseSpeed, abilities: abilsRaw, styleScheme: schemeRaw, energyOutput, massKg, threatLevel, composition, recommendedSpawnHeightMeters } = metadata;
      
      let placementDomain: 'ground' | 'air' | 'high_sky' = (domainRaw as any) || 'ground';
      let locomotionType: 'walk' | 'flight' | 'hover_drift' | 'stationary' = (locoRaw as any) || 'walk';
      let abilities: string[] = Array.isArray(abilsRaw) && abilsRaw.length > 0 ? abilsRaw : ["Energy Surge", "Kinetic Shockwave"];

      if (placementDomain === 'air' || locomotionType === 'flight') {
        spawnY = CONFIG.FLOOR_Y + Math.max(20, recommendedSpawnHeightMeters || 25);
      } else if (placementDomain === 'high_sky' || locomotionType === 'hover_drift') {
        spawnY = CONFIG.FLOOR_Y + Math.max(35, recommendedSpawnHeightMeters || 45);
      } else {
        spawnY = CONFIG.FLOOR_Y + Math.max(1.2, recommendedSpawnHeightMeters || 1.2);
      }
      group.position.y = spawnY;
      onHeightUpdate?.(spawnY);

      const shape = new CANNON.Sphere(2.2);
      const body = new CANNON.Body({
        mass: (locomotionType === 'flight' || locomotionType === 'hover_drift') ? 0 : (massKg || 30),
        position: new CANNON.Vec3(spawnX, spawnY, spawnZ),
      });
      body.addShape(shape);
      this.physicsWorld.addBody(body);

      const objId = 'ai_obj_' + Date.now();
      const obj: SummonedAIObject = {
        id: objId,
        name: name || prompt,
        description: description || 'Synthesized Voxel Construct',
        group,
        body,
        animationType: animationType || 'float',
        physicsType: physicsType || 'rigid',
        placementDomain,
        locomotionType,
        baseSpeed: baseSpeed || 20,
        abilities,
        canBePossessed: true,
        styleScheme: schemeRaw || params?.styleScheme || "Neon Cyber",
        energyOutput: energyOutput || '2.5 GW',
        massKg: massKg || 120,
        threatLevel: threatLevel || 'Benign',
        composition: composition || [{ element: 'Hyper-Titanium', percentage: 100 }],
        voxels: allVoxels,
        creationTime: performance.now(),
        pointLight,
      };
      this.summonedAIObjects.push(obj);

      this.audio.playExplosionSound();
      
      return { success: true, name: obj.name, description: obj.description, id: obj.id };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message };
    }
  }

  public getSummonedObjectsTelemetry(playerX: number, playerY: number, playerZ: number) {
    return this.summonedAIObjects.map((obj) => {
      const pos = obj.group.position;
      const dx = pos.x - playerX;
      const dy = pos.y - playerY;
      const dz = pos.z - playerZ;
      const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
      return {
        id: obj.id,
        name: obj.name,
        description: obj.description,
        animationType: obj.animationType,
        physicsType: obj.physicsType,
        placementDomain: obj.placementDomain,
        locomotionType: obj.locomotionType,
        baseSpeed: obj.baseSpeed,
        abilities: obj.abilities,
        canBePossessed: obj.canBePossessed,
        styleScheme: obj.styleScheme,
        energyOutput: obj.energyOutput,
        massKg: obj.massKg,
        threatLevel: obj.threatLevel,
        composition: obj.composition,
        voxelCount: obj.voxels.length,
        position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
        distance,
      };
    });
  }

  public possessAIObject(
    id: string,
    onMorph: (targetX: number, targetY: number, targetZ: number, loco: 'walk' | 'flight' | 'hover_drift' | 'stationary') => void
  ): boolean {
    const obj = this.summonedAIObjects.find((o) => o.id === id);
    if (!obj) return false;

    obj.group.visible = false;

    this.possessedObject = {
      id: obj.id,
      name: obj.name,
      description: obj.description,
      placementDomain: (obj.placementDomain as any) || 'ground',
      locomotionType: (obj.locomotionType as any) || 'walk',
      baseSpeed: obj.baseSpeed || 25,
      abilities: obj.abilities || ['Sonic Stomp', 'Earthquake Charge'],
      voxels: obj.voxels,
      energyOutput: obj.energyOutput,
      massKg: obj.massKg,
    };

    this.rebuildPlayerPossessedMesh(obj.voxels);
    onMorph(obj.group.position.x, obj.group.position.y, obj.group.position.z, obj.locomotionType || 'walk');

    this.audio.playExplosionSound();
    this.audio.playWindBoostSound();
    return true;
  }

  public ejectFromPossession(posX: number, posY: number, posZ: number, onRestoreMesh: () => void): boolean {
    if (!this.possessedObject) return false;

    const objId = this.possessedObject.id;
    const obj = this.summonedAIObjects.find((o) => o.id === objId);
    if (obj) {
      obj.group.position.set(posX, posY, posZ);
      obj.body.position.set(posX, posY, posZ);
      obj.group.visible = true;
    }

    this.possessedObject = null;
    onRestoreMesh();

    this.audio.playTractorSound();
    return true;
  }

  public triggerPossessedPrimaryAbility(
    posX: number,
    posY: number,
    posZ: number,
    rotY: number,
    explodeObject: (pos: THREE.Vector3, color: number) => void,
    debrisBodies: DebrisObject[],
    applyBoost: (fx: number, fz: number) => void
  ) {
    if (!this.possessedObject) return;
    const locomotion = this.possessedObject.locomotionType;

    if (locomotion === 'walk') {
      this.audio.playExplosionSound();
      explodeObject(new THREE.Vector3(posX, CONFIG.FLOOR_Y + 0.5, posZ), 0x00f0ff);

      for (const d of debrisBodies) {
        const dx = d.body.position.x - posX;
        const dz = d.body.position.z - posZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 25) {
          const force = (25 - dist) * 18;
          d.body.applyImpulse(new CANNON.Vec3(dx * force, 160, dz * force), d.body.position);
        }
      }
    } else if (locomotion === 'flight') {
      this.audio.playWindBoostSound();
      this.audio.playWeaponSound();
      const forwardX = Math.sin(rotY);
      const forwardZ = Math.cos(rotY);
      applyBoost(forwardX * 2.2, forwardZ * 2.2);
    } else {
      this.audio.playWeaponSound();
      explodeObject(new THREE.Vector3(posX, posY - 2, posZ), 0xa855f7);
    }
  }

  public rebuildPlayerPossessedMesh(voxels: SynthesizedVoxel[]) {
    while (this.playerGroup.children.length > 0) {
      const child = this.playerGroup.children[0];
      this.playerGroup.remove(child);
    }

    const emissiveV: SynthesizedVoxel[] = [];
    const metallicV: SynthesizedVoxel[] = [];
    const glassV: SynthesizedVoxel[] = [];
    const standardV: SynthesizedVoxel[] = [];

    voxels.forEach((v) => {
      const colStr = String(v.color || '').toLowerCase();
      if (v.mat === 'emissive' || ['#00f0ff', '#ff0055', '#a855f7', '#00ffcc', '#ffff00'].includes(colStr)) {
        emissiveV.push(v);
      } else if (v.mat === 'metallic') {
        metallicV.push(v);
      } else if (v.mat === 'glass') {
        glassV.push(v);
      } else {
        standardV.push(v);
      }
    });

    const buildSubMesh = (vList: SynthesizedVoxel[], material: THREE.Material) => {
      if (vList.length === 0) return;
      const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
      const instMesh = new THREE.InstancedMesh(geo, material, vList.length);
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      vList.forEach((v, i) => {
        dummy.position.set(v.x * 0.45, v.y * 0.45, v.z * 0.45);
        dummy.scale.set(0.45, 0.45, 0.45);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
        instMesh.setColorAt(i, new THREE.Color(v.color));
      });
      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
      this.playerGroup.add(instMesh);
    };

    buildSubMesh(emissiveV, new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.1, emissiveIntensity: 2.5 }));
    buildSubMesh(metallicV, new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.85 }));
    buildSubMesh(glassV, new THREE.MeshPhysicalMaterial({ transmission: 0.8, opacity: 0.7, transparent: true, roughness: 0.1 }));
    buildSubMesh(standardV, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }));

    const ringGeo = new THREE.RingGeometry(1.5, 2.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2;
    this.playerGroup.add(ring);
  }

  public recallAIObject(id: string, posX: number, posY: number, posZ: number, rotY: number): boolean {
    const obj = this.summonedAIObjects.find((o) => o.id === id);
    if (!obj) return false;
    const forwardX = Math.sin(rotY);
    const forwardZ = Math.cos(rotY);
    const rx = posX + forwardX * 8;
    const rz = posZ + forwardZ * 8;
    const ry = Math.max(CONFIG.FLOOR_Y + 3, posY);

    obj.group.position.set(rx, ry, rz);
    obj.body.position.set(rx, ry, rz);
    obj.body.velocity.set(0, 0, 0);
    obj.body.angularVelocity.set(0, 0, 0);
    this.audio.playWeaponSound();
    return true;
  }

  public overchargeAIObject(id: string): boolean {
    const obj = this.summonedAIObjects.find((o) => o.id === id);
    if (!obj) return false;
    if (obj.pointLight) {
      obj.pointLight.intensity = 15;
      setTimeout(() => {
        if (obj.pointLight) obj.pointLight.intensity = 3;
      }, 1500);
    }
    obj.body.applyImpulse(new CANNON.Vec3(0, 250, 0), obj.body.position);
    this.audio.playExplosionSound();
    return true;
  }

  public deconstructAIObject(id: string, debrisBodies: DebrisObject[]): boolean {
    const idx = this.summonedAIObjects.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    const obj = this.summonedAIObjects[idx];

    const center = obj.group.position;
    obj.voxels.slice(0, 80).forEach((v) => {
      const vx = center.x + v.x * 0.45;
      const vy = center.y + v.y * 0.45;
      const vz = center.z + v.z * 0.45;

      const dGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const dMat = new THREE.MeshStandardMaterial({ color: v.color || '#00f0ff', roughness: 0.3 });
      const dMesh = new THREE.Mesh(dGeo, dMat);
      dMesh.position.set(vx, vy, vz);
      this.scene.add(dMesh);

      const dShape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25));
      const dBody = new CANNON.Body({ mass: 1, position: new CANNON.Vec3(vx, vy, vz) });
      dBody.addShape(dShape);
      dBody.velocity.set(
        (Math.random() - 0.5) * 15,
        Math.random() * 12 + 5,
        (Math.random() - 0.5) * 15
      );
      this.physicsWorld.addBody(dBody);

      debrisBodies.push({ mesh: dMesh, body: dBody });
    });

    this.scene.remove(obj.group);
    this.physicsWorld.removeBody(obj.body);
    this.summonedAIObjects.splice(idx, 1);
    this.audio.playExplosionSound();
    return true;
  }

  public teleportToAIObject(id: string, onTeleport: (tx: number, ty: number, tz: number) => void): boolean {
    const obj = this.summonedAIObjects.find((o) => o.id === id);
    if (!obj) return false;
    onTeleport(obj.group.position.x - 3, obj.group.position.y + 2, obj.group.position.z - 3);
    this.audio.playTractorSound();
    return true;
  }

  public updateSummonedObjects(physicsActive: boolean) {
    if (!physicsActive) return;
    const now = performance.now();
    for (const obj of this.summonedAIObjects) {
      if (obj.physicsType !== 'floating') {
        obj.group.position.copy(obj.body.position as any);
        obj.group.quaternion.copy(obj.body.quaternion as any);
      }

      const elapsed = (now - obj.creationTime) * 0.001;
      if (obj.animationType === 'spin') {
        obj.group.rotation.y += 0.02;
      } else if (obj.animationType === 'float' || obj.physicsType === 'floating') {
        obj.group.position.y += Math.sin(elapsed * 2.5) * 0.015;
        obj.group.rotation.y += 0.01;
      } else if (obj.animationType === 'pulse') {
        const s = 1.0 + Math.sin(elapsed * 4) * 0.08;
        obj.group.scale.set(s, s, s);
      } else if (obj.animationType === 'bounce') {
        if (obj.group.position.y <= CONFIG.FLOOR_Y + 1.2 && Math.abs(obj.body.velocity.y) < 0.5) {
          obj.body.velocity.y = 7;
        }
      }
    }
  }

  public dispose() {
    for (const obj of this.summonedAIObjects) {
      this.scene.remove(obj.group);
      this.physicsWorld.removeBody(obj.body);
    }
    this.summonedAIObjects = [];
    this.possessedObject = null;
  }
}
