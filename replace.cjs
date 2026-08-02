const fs = require('fs');
const content = fs.readFileSync('services/gamemode/PossessionManager.ts', 'utf8');

const updated = content.replace(
  /public async summonAIObject\([\s\S]*?public getSummonedObjectsTelemetry/m,
  "public async summonAIObject(\n" +
  "    prompt: string,\n" +
  "    playerX: number,\n" +
  "    playerY: number,\n" +
  "    playerZ: number,\n" +
  "    playerRotY: number,\n" +
  "    params?: { styleScheme?: string; energyCore?: string; complexity?: string }\n" +
  "  ): Promise<{ success: boolean; name?: string; description?: string; id?: string; error?: string }> {\n" +
  "    try {\n" +
  "      const forwardX = Math.sin(playerRotY);\n" +
  "      const forwardZ = Math.cos(playerRotY);\n" +
  "      const spawnX = playerX + forwardX * 12;\n" +
  "      const spawnZ = playerZ + forwardZ * 12;\n" +
  "      let spawnY = CONFIG.FLOOR_Y + 1.2;\n" +
  "\n" +
  "      const group = new THREE.Group();\n" +
  "      group.position.set(spawnX, spawnY, spawnZ);\n" +
  "      \n" +
  "      const ringGeo = new THREE.RingGeometry(1.2, 2.2, 32);\n" +
  "      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });\n" +
  "      const ring = new THREE.Mesh(ringGeo, ringMat);\n" +
  "      ring.rotation.x = Math.PI / 2;\n" +
  "      ring.position.y = -1.0;\n" +
  "      group.add(ring);\n" +
  "\n" +
  "      const pointLight = new THREE.PointLight(0x00f0ff, 3.0, 20);\n" +
  "      pointLight.position.set(0, 0, 0);\n" +
  "      group.add(pointLight);\n" +
  "\n" +
  "      this.scene.add(group);\n" +
  "\n" +
  "      const maxVoxels = 500;\n" +
  "      const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);\n" +
  "      \n" +
  "      const emissiveMat = new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.1, emissiveIntensity: 2.5 });\n" +
  "      const metallicMat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.85 });\n" +
  "      const glassMat = new THREE.MeshPhysicalMaterial({ transmission: 0.8, opacity: 0.7, transparent: true, roughness: 0.1 });\n" +
  "      const standardMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });\n" +
  "\n" +
  "      const instEmissive = new THREE.InstancedMesh(geo, emissiveMat, maxVoxels);\n" +
  "      const instMetallic = new THREE.InstancedMesh(geo, metallicMat, maxVoxels);\n" +
  "      const instGlass = new THREE.InstancedMesh(geo, glassMat, maxVoxels);\n" +
  "      const instStandard = new THREE.InstancedMesh(geo, standardMat, maxVoxels);\n" +
  "      \n" +
  "      instEmissive.count = 0; instMetallic.count = 0; instGlass.count = 0; instStandard.count = 0;\n" +
  "      instEmissive.castShadow = true; instMetallic.castShadow = true; instGlass.castShadow = true; instStandard.castShadow = true;\n" +
  "      group.add(instEmissive); group.add(instMetallic); group.add(instGlass); group.add(instStandard);\n" +
  "\n" +
  "      const dummy = new THREE.Object3D();\n" +
  "\n" +
  "      const res = await fetch('/api/gemini/synthesize-object-stream', {\n" +
  "        method: 'POST',\n" +
  "        headers: { 'Content-Type': 'application/json' },\n" +
  "        body: JSON.stringify({\n" +
  "          prompt,\n" +
  "          styleScheme: params?.styleScheme,\n" +
  "          energyCore: params?.energyCore,\n" +
  "          complexity: params?.complexity,\n" +
  "        }),\n" +
  "      });\n" +
  "\n" +
  "      if (!res.ok || !res.body) {\n" +
  "        throw new Error(`Server returned ${res.status}`);\n" +
  "      }\n" +
  "\n" +
  "      const reader = res.body.getReader();\n" +
  "      const decoder = new TextDecoder();\n" +
  "      let accumulatedText = '';\n" +
  "      let processedVoxels = 0;\n" +
  "      const allVoxels: any[] = [];\n" +
  "\n" +
  "      while (true) {\n" +
  "        const { value, done } = await reader.read();\n" +
  "        if (done) break;\n" +
  "        const chunk = decoder.decode(value, { stream: true });\n" +
  "        const lines = chunk.split('\\n\\n');\n" +
  "        for (const line of lines) {\n" +
  "          if (line.startsWith('data: ')) {\n" +
  "            const data = line.replace('data: ', '').trim();\n" +
  "            if (data === '[DONE]') break;\n" +
  "            try {\n" +
  "              const parsed = JSON.parse(data);\n" +
  "              if (parsed.error) throw new Error(parsed.error);\n" +
  "              if (parsed.text) {\n" +
  "                accumulatedText += parsed.text;\n" +
  "                \n" +
  "                // Try to find {\"x\": ...} objects using regex\n" +
  "                const voxelRegex = /\\{\\s*\"x\"\\s*:\\s*(-?\\d+)\\s*,\\s*\"y\"\\s*:\\s*(-?\\d+)\\s*,\\s*\"z\"\\s*:\\s*(-?\\d+)\\s*,\\s*\"color\"\\s*:\\s*\"([^\"]+)\"(?:,\\s*\"mat\"\\s*:\\s*\"([^\"]+)\")?(?:,\\s*\"part\"\\s*:\\s*\"([^\"]+)\")?\\s*\\}/g;\n" +
  "                let match;\n" +
  "                let currentIndex = 0;\n" +
  "                while ((match = voxelRegex.exec(accumulatedText)) !== null) {\n" +
  "                  if (currentIndex >= processedVoxels) {\n" +
  "                    const v = { x: parseInt(match[1]), y: parseInt(match[2]), z: parseInt(match[3]), color: match[4], mat: match[5] || 'standard', part: match[6] || 'core' };\n" +
  "                    allVoxels.push(v);\n" +
  "                    \n" +
  "                    dummy.position.set(v.x * 0.45, v.y * 0.45, v.z * 0.45);\n" +
  "                    dummy.scale.set(0.45, 0.45, 0.45);\n" +
  "                    dummy.updateMatrix();\n" +
  "                    \n" +
  "                    const colStr = String(v.color || '').toLowerCase();\n" +
  "                    const color = new THREE.Color(v.color);\n" +
  "\n" +
  "                    if (v.mat === 'emissive' || ['#00f0ff', '#ff0055', '#a855f7', '#00ffcc', '#ffff00'].includes(colStr)) {\n" +
  "                      instEmissive.setMatrixAt(instEmissive.count, dummy.matrix);\n" +
  "                      instEmissive.setColorAt(instEmissive.count, color);\n" +
  "                      instEmissive.count++;\n" +
  "                      instEmissive.instanceMatrix.needsUpdate = true;\n" +
  "                      if (instEmissive.instanceColor) instEmissive.instanceColor.needsUpdate = true;\n" +
  "                    } else if (v.mat === 'metallic') {\n" +
  "                      instMetallic.setMatrixAt(instMetallic.count, dummy.matrix);\n" +
  "                      instMetallic.setColorAt(instMetallic.count, color);\n" +
  "                      instMetallic.count++;\n" +
  "                      instMetallic.instanceMatrix.needsUpdate = true;\n" +
  "                      if (instMetallic.instanceColor) instMetallic.instanceColor.needsUpdate = true;\n" +
  "                    } else if (v.mat === 'glass') {\n" +
  "                      instGlass.setMatrixAt(instGlass.count, dummy.matrix);\n" +
  "                      instGlass.setColorAt(instGlass.count, color);\n" +
  "                      instGlass.count++;\n" +
  "                      instGlass.instanceMatrix.needsUpdate = true;\n" +
  "                      if (instGlass.instanceColor) instGlass.instanceColor.needsUpdate = true;\n" +
  "                    } else {\n" +
  "                      instStandard.setMatrixAt(instStandard.count, dummy.matrix);\n" +
  "                      instStandard.setColorAt(instStandard.count, color);\n" +
  "                      instStandard.count++;\n" +
  "                      instStandard.instanceMatrix.needsUpdate = true;\n" +
  "                      if (instStandard.instanceColor) instStandard.instanceColor.needsUpdate = true;\n" +
  "                    }\n" +
  "\n" +
  "                    processedVoxels++;\n" +
  "                    this.audio.playLaserSound(); // small sound for building\n" +
  "                  }\n" +
  "                  currentIndex++;\n" +
  "                }\n" +
  "              }\n" +
  "            } catch (e) {\n" +
  "              // ignore parse errors for incomplete chunks\n" +
  "            }\n" +
  "          }\n" +
  "        }\n" +
  "      }\n" +
  "\n" +
  "      let cleanText = accumulatedText.replace(/```json/gi, \"\").replace(/```/g, \"\").trim();\n" +
  "      // Try to parse the rest of the metadata. If it fails, fallback to defaults\n" +
  "      let metadata: any = {};\n" +
  "      try {\n" +
  "         // Attempt to fix incomplete JSON by adding closing brackets\n" +
  "         let bracketDepth = 0;\n" +
  "         for(let i=0; i<cleanText.length; i++) {\n" +
  "            if(cleanText[i]==='{') bracketDepth++;\n" +
  "            else if(cleanText[i]==='}') bracketDepth--;\n" +
  "         }\n" +
  "         let tempText = cleanText;\n" +
  "         while(bracketDepth > 0) { tempText += '}'; bracketDepth--; }\n" +
  "         // Sometimes it misses array closing\n" +
  "         if (tempText.lastIndexOf('}') < tempText.lastIndexOf(']')) {\n" +
  "             tempText += '}';\n" +
  "         }\n" +
  "         // Remove trailing commas\n" +
  "         tempText = tempText.replace(/,\\s*([}\\]])/g, '$1');\n" +
  "         metadata = JSON.parse(tempText);\n" +
  "      } catch (e) {\n" +
  "         console.warn(\"Could not parse complete JSON, using defaults for metadata.\");\n" +
  "      }\n" +
  "\n" +
  "      const { name, description, animationType, physicsType, placementDomain: domainRaw, locomotionType: locoRaw, baseSpeed, abilities: abilsRaw, styleScheme: schemeRaw, energyOutput, massKg, threatLevel, composition } = metadata;\n" +
  "      \n" +
  "      const combined = (prompt + ' ' + (name || '') + ' ' + (description || '')).toLowerCase();\n" +
  "      let placementDomain: 'ground' | 'air' | 'high_sky' = domainRaw || 'ground';\n" +
  "      let locomotionType: 'walk' | 'flight' | 'hover_drift' | 'stationary' = locoRaw || 'walk';\n" +
  "      let abilities: string[] = abilsRaw || [\"Primary Energy Discharge\", \"Kinetic Shockwave\"];\n" +
  "\n" +
  "      if (!domainRaw) {\n" +
  "        if (['elephant', 'dog', 'cat', 'tiger', 'lion', 'dinosaur', 'mech', 'tank', 'car', 'truck', 'spider', 'human', 'robot', 'statue', 'tree', 'building', 'monster'].some(k => combined.includes(k))) {\n" +
  "          placementDomain = 'ground';\n" +
  "          locomotionType = locomotionType || 'walk';\n" +
  "          if (combined.includes('elephant')) abilities = [\"Sonic Trunk Stomp\", \"Earthquake Charge\", \"Heavy Slam\"];\n" +
  "        } else if (['f22', 'f-22', 'jet', 'fighter', 'plane', 'aircraft', 'helicopter', 'ufo', 'saucer', 'dragon', 'bird', 'eagle', 'rocket', 'drone'].some(k => combined.includes(k))) {\n" +
  "          placementDomain = 'air';\n" +
  "          locomotionType = locomotionType || 'flight';\n" +
  "          if (combined.includes('f22') || combined.includes('jet')) abilities = [\"Afterburner Boost\", \"Supersonic Shockwave\", \"Thermal Flares\"];\n" +
  "        } else if (['cloud', 'balloon', 'cumulus', 'stratus', 'nebula', 'satellite', 'star', 'sun', 'moon'].some(k => combined.includes(k))) {\n" +
  "          placementDomain = 'high_sky';\n" +
  "          locomotionType = locomotionType || 'hover_drift';\n" +
  "          if (combined.includes('cloud')) abilities = [\"Lightning Electro-Burst\", \"Rainfall Mist\", \"Atmospheric Drift\"];\n" +
  "        } else {\n" +
  "          placementDomain = 'ground';\n" +
  "          locomotionType = locomotionType || 'walk';\n" +
  "        }\n" +
  "      }\n" +
  "\n" +
  "      if (placementDomain === 'air' || locomotionType === 'flight') {\n" +
  "        spawnY = CONFIG.FLOOR_Y + Math.max(25, metadata.recommendedSpawnHeightMeters || 30);\n" +
  "      } else if (placementDomain === 'high_sky' || locomotionType === 'hover_drift') {\n" +
  "        spawnY = CONFIG.FLOOR_Y + Math.max(40, metadata.recommendedSpawnHeightMeters || 45);\n" +
  "      }\n" +
  "      group.position.y = spawnY; // Update height if needed\n" +
  "\n" +
  "      const shape = new CANNON.Sphere(2.2);\n" +
  "      const body = new CANNON.Body({\n" +
  "        mass: (locomotionType === 'flight' || locomotionType === 'hover_drift') ? 0 : (massKg || 30),\n" +
  "        position: new CANNON.Vec3(spawnX, spawnY, spawnZ),\n" +
  "      });\n" +
  "      body.addShape(shape);\n" +
  "      this.physicsWorld.addBody(body);\n" +
  "\n" +
  "      const objId = 'ai_obj_' + Date.now();\n" +
  "      const obj: SummonedAIObject = {\n" +
  "        id: objId,\n" +
  "        name: name || prompt,\n" +
  "        description: description || 'Synthesized Voxel Construct',\n" +
  "        group,\n" +
  "        body,\n" +
  "        animationType: animationType || 'float',\n" +
  "        physicsType: physicsType || 'rigid',\n" +
  "        placementDomain,\n" +
  "        locomotionType,\n" +
  "        baseSpeed: baseSpeed || 20,\n" +
  "        abilities,\n" +
  "        canBePossessed: true,\n" +
  "        styleScheme: schemeRaw || params?.styleScheme || \"Neon Cyber\",\n" +
  "        energyOutput: energyOutput || '2.5 GW',\n" +
  "        massKg: massKg || 120,\n" +
  "        threatLevel: threatLevel || 'Benign',\n" +
  "        composition: composition || [{ element: 'Hyper-Titanium', percentage: 100 }],\n" +
  "        voxels: allVoxels,\n" +
  "        creationTime: performance.now(),\n" +
  "        pointLight,\n" +
  "      };\n" +
  "      this.summonedAIObjects.push(obj);\n" +
  "\n" +
  "      this.audio.playExplosionSound();\n" +
  "      \n" +
  "      return { success: true, name: obj.name, description: obj.description, id: obj.id };\n" +
  "    } catch (err: any) {\n" +
  "      console.error(err);\n" +
  "      return { success: false, error: err.message };\n" +
  "    }\n" +
  "  }\n\n  public getSummonedObjectsTelemetry"
);

fs.writeFileSync('services/gamemode/PossessionManager.ts', updated);
