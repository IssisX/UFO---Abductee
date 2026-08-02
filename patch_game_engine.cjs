const fs = require('fs');
const content = fs.readFileSync('services/GameModeEngine.ts', 'utf8');

const updated = content.replace(
  /public async summonAIObject\([\s\S]*?\)\s*\{\s*return this\.possessionManager\.summonAIObject\([\s\S]*?\);\s*\}/,
  `public async summonAIObject(prompt: string, params?: any) {
    const res = await this.possessionManager.summonAIObject(
      prompt,
      this.controller.posX,
      this.controller.posY,
      this.controller.posZ,
      this.controller.rotY,
      params
    );
    if (res.success && res.id) {
      this.possessAIObject(res.id);
    }
    return res;
  }`
);

fs.writeFileSync('services/GameModeEngine.ts', updated);
