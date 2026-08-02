const fs = require('fs');
const content = fs.readFileSync('components/GameHUD.tsx', 'utf8');

let updated = content.replace(
  /if \(e.key === 'Enter' && !isSummoning && summonPrompt.trim\(\)\) {[\s\S]*?setIsSummoning\(false\);\s*\}/,
  `if (e.key === 'Enter' && !isSummoning && summonPrompt.trim()) {
                            if (!onSummonAIObject) return;
                            setIsSummoning(true);
                            setSummonStatus("⚡ Contacting Gemini AI Voxel Engine...");
                            setShowSummonerModal(false);
                            const res = await onSummonAIObject(summonPrompt, { styleScheme, energyCore, complexity });
                            if (res.success) {
                              setSummonStatus(\`✅ Successfully materialized "\${res.name}" into local physics world!\`);
                              setTimeout(() => { setIsSummoning(false); setSummonStatus(""); }, 5000);
                            } else {
                              setSummonStatus(\`❌ Synthesis error: \${res.error}\`);
                              setShowSummonerModal(true);
                              setIsSummoning(false);
                            }
                          }`
);

updated = updated.replace(
  /onClick=\{async \(\) => {[\s\S]*?if \(!onSummonAIObject \|\| !summonPrompt.trim\(\)\) return;[\s\S]*?setIsSummoning\(true\);[\s\S]*?setSummonStatus\("⚡ Contacting Gemini AI Voxel Engine..."\);[\s\S]*?const res = await onSummonAIObject\(summonPrompt, \{ styleScheme, energyCore, complexity \}\);[\s\S]*?if \(res.success\) {[\s\S]*?setSummonStatus\(\`✅ Successfully materialized "\$\{res.name\}" into local physics world!\`\);[\s\S]*?\} else \{[\s\S]*?setSummonStatus\(\`❌ Synthesis error: \$\{res.error\}\`\);[\s\S]*?\}[\s\S]*?setIsSummoning\(false\);[\s\S]*?\}\}/,
  `onClick={async () => {
                        if (!onSummonAIObject || !summonPrompt.trim()) return;
                        setIsSummoning(true);
                        setSummonStatus("⚡ Contacting Gemini AI Voxel Engine...");
                        setShowSummonerModal(false);
                        const res = await onSummonAIObject(summonPrompt, { styleScheme, energyCore, complexity });
                        if (res.success) {
                          setSummonStatus(\`✅ Successfully materialized "\${res.name}" into local physics world!\`);
                          setTimeout(() => { setIsSummoning(false); setSummonStatus(""); }, 5000);
                        } else {
                          setSummonStatus(\`❌ Synthesis error: \${res.error}\`);
                          setShowSummonerModal(true);
                          setIsSummoning(false);
                        }
                      }}`
);

fs.writeFileSync('components/GameHUD.tsx', updated);
