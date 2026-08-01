const fs = require('fs');
let code = fs.readFileSync('components/GameHUD.tsx', 'utf8');

const target1 = `  const [hudActiveTimer, setHudActiveTimer] = useState(3000); // 3 seconds visible initially`;
const replacement1 = `  const [hudActiveTimer, setHudActiveTimer] = useState(0); // completely hidden by default`;

const target2 = `  const isHudContextVisible = isTabPressed || hudActiveTimer > 0 || hudMode === 'full';`;
const replacement2 = `  const isHudContextVisible = isTabPressed || hudMode === 'full';`;

const target3 = `  const [hudMode, setHudMode] = useState<'full' | 'compact' | 'minimal'>('compact');`;
const replacement3 = `  const [hudMode, setHudMode] = useState<'full' | 'compact' | 'minimal'>('minimal');`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
code = code.replace(target3, replacement3);

fs.writeFileSync('components/GameHUD.tsx', code);
