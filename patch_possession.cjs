const fs = require('fs');
const content = fs.readFileSync('services/gamemode/PossessionManager.ts', 'utf8');

const updated = content.replace(
  /public async summonAIObject\([\s\S]*?\/\/ --- AI TELEMETRY ---/,
  `
  public async summonAIObject(
    prompt: string,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerRotY: number,
    params?: { styleScheme?: string; energyCore?: string; complexity?: string }
  ): Promise<{ success: boolean; name?: string; description?: string; error?: string }> {
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
        throw new Error(\`Server returned \${res.status}\`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let processedVoxels = 0;
      const allVoxels: any[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.replace('data: ', '').trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulatedText += parsed.text;
                
                // Try to find {"x": ...} objects using regex
                const voxelRegex = /\\{\\s*"x"\\s*:\\s*(-?\\d+)\\s*,\\s*"y"\\s*:\\s*(-?\\d+)\\s*,\\s*"z"\\s*:\\s*(-?\\d+)\\s*,\\s*"color"\\s*:\\s*"([^"]+)"(?:,\\s*"mat"\\s*:\\s*"([^"]+)")?(?:,\\s*"part"\\s*:\\s*"([^"]+)")?\\s*\\}/g;
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

      let cleanText = accumulatedText.replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim();
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
         tempText = tempText.replace(/,\\s*([}\\]])/g, '$1');
         metadata = JSON.parse(tempText);
      } catch (e) {
         console.warn("Could not parse complete JSON, using defaults for metadata.");
      }

      const { name, description, animationType, physicsType, placementDomain: domainRaw, locomotionType: locoRaw, baseSpeed, abilities: abilsRaw, styleScheme: schemeRaw, energyOutput, massKg, threatLevel, composition } = metadata;
      
      const combined = (prompt + ' ' + (name || '') + ' ' + (description || '')).toLowerCase();
      let placementDomain: 'ground' | 'air' | 'high_sky' = domainRaw || 'ground';
      let locomotionType: 'walk' | 'flight' | 'hover_drift' | 'stationary' = locoRaw || 'walk';
      let abilities: string[] = abilsRaw || ["Primary Energy Discharge", "Kinetic Shockwave"];

      if (!domainRaw) {
        if (['elephant', 'dog', 'cat', 'tiger', 'lion', 'dinosaur', 'mech', 'tank', 'car', 'truck', 'spider', 'human', 'robot', 'statue', 'tree', 'building', 'monster'].some(k => combined.includes(k))) {
          placementDomain = 'ground';
          locomotionType = locomotionType || 'walk';
          if (combined.includes('elephant')) abilities = ["Sonic Trunk Stomp", "Earthquake Charge", "Heavy Slam"];
        } else if (['f22', 'f-22', 'jet', 'fighter', 'plane', 'aircraft', 'helicopter', 'ufo', 'saucer', 'dragon', 'bird', 'eagle', 'rocket', 'drone'].some(k => combined.includes(k))) {
          placementDomain = 'air';
          locomotionType = locomotionType || 'flight';
          if (combined.includes('f22') || combined.includes('jet')) abilities = ["Afterburner Boost", "Supersonic Shockwave", "Thermal Flares"];
        } else if (['cloud', 'balloon', 'cumulus', 'stratus', 'nebula', 'satellite', 'star', 'sun', 'moon'].some(k => combined.includes(k))) {
          placementDomain = 'high_sky';
          locomotionType = locomotionType || 'hover_drift';
          if (combined.includes('cloud')) abilities = ["Lightning Electro-Burst", "Rainfall Mist", "Atmospheric Drift"];
        } else {
          placementDomain = 'ground';
          locomotionType = locomotionType || 'walk';
        }
      }

      if (placementDomain === 'air' || locomotionType === 'flight') {
        spawnY = CONFIG.FLOOR_Y + Math.max(25, metadata.recommendedSpawnHeightMeters || 30);
      } else if (placementDomain === 'high_sky' || locomotionType === 'hover_drift') {
        spawnY = CONFIG.FLOOR_Y + Math.max(40, metadata.recommendedSpawnHeightMeters || 45);
      }
      group.position.y = spawnY; // Update height if needed

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
      
      // Auto-possess newly created object if possible
      this.possess(objId);
      
      return { success: true, name: obj.name, description: obj.description };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message };
    }
  }

  // --- AI TELEMETRY ---`
);

fs.writeFileSync('services/gamemode/PossessionManager.ts', updated);
