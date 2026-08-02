const fs = require('fs');
const content = fs.readFileSync('components/GameHUD.tsx', 'utf8');

const updated = content.replace(
  /<div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" \/>/,
  `{summonStatus.includes('✅') ? null : <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />}`
);

fs.writeFileSync('components/GameHUD.tsx', updated);
