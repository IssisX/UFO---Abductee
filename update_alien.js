const fs = require('fs');
let code = fs.readFileSync('utils/voxelGenerators.ts', 'utf8');

const newAlien = `    Alien: (): VoxelData[] => {
        const map = new Map<string, VoxelData>();
        const AY = CONFIG.FLOOR_Y + 1; const AX = 0, AZ = 0;
        const ALIEN_GREY = 0x94a3b8;
        const ALIEN_GREY_DARK = 0x64748b;
        const EYE_BLACK = 0x020617;
        const EYE_GLOW = 0x38bdf8;
        const SUIT_DARK = 0x1e293b;
        const RAY_GREEN = 0xa3e635;

        // HIGH FIDELITY ALIEN (Scaled 3x larger in coords, will be rendered 3x smaller)
        
        // Feet & Boots
        generateSphere(map, AX - 4.5, AY + 1.5, AZ, 3.6, SUIT_DARK);
        generateSphere(map, AX + 4.5, AY + 1.5, AZ, 3.6, SUIT_DARK);

        // Slender Legs
        for (let y = 3; y <= 15; y++) {
            generateSphere(map, AX - 4.0, AY + y, AZ, 1.8, ALIEN_GREY);
            generateSphere(map, AX + 4.0, AY + y, AZ, 1.8, ALIEN_GREY);
        }

        // Torso / Body (Space Suit with glowing green chest reactor)
        for (let y = 16; y <= 36; y++) {
            const r = 6.6 - (y - 16) * 0.15;
            generateSphere(map, AX, AY + y, AZ, r, ALIEN_GREY);
        }
        
        // Chest Reactor
        generateSphere(map, AX, AY + 25, AZ + 4.5, 2.5, RAY_GREEN);

        // Arms & Ray Blaster
        for (let y = 20; y <= 33; y++) {
            generateSphere(map, AX - 6.6, AY + y, AZ, 1.8, ALIEN_GREY);
            generateSphere(map, AX + 6.6, AY + y, AZ, 1.8, ALIEN_GREY);
        }

        // Blaster in right hand
        generateSphere(map, AX + 7.5, AY + 24, AZ + 3, 3, SUIT_DARK);
        generateSphere(map, AX + 7.5, AY + 24, AZ + 6, 2, RAY_GREEN);
        setBlock(map, AX + 7.5, AY + 24, AZ + 8, RAY_GREEN);

        // Neck
        generateSphere(map, AX, AY + 37, AZ, 2, ALIEN_GREY_DARK);
        generateSphere(map, AX, AY + 39, AZ, 2, ALIEN_GREY);

        // Proportional Gray Alien Oval Head (Smaller relative to body than before)
        const HEAD_Y = AY + 45;
        generateSphere(map, AX, HEAD_Y, AZ, 7.5, ALIEN_GREY, 1.2);
        generateSphere(map, AX, HEAD_Y + 4, AZ, 8.5, ALIEN_GREY, 0.9);
        generateSphere(map, AX, HEAD_Y + 8, AZ - 1, 7.5, ALIEN_GREY, 0.8);

        // Large Black Almond Eyes
        // Left Eye (Detailed)
        generateSphere(map, AX - 3.5, HEAD_Y + 1, AZ + 6.5, 2.5, EYE_BLACK, 1.5);
        setBlock(map, AX - 3.0, HEAD_Y + 2.5, AZ + 8.5, EYE_GLOW);

        // Right Eye (Detailed)
        generateSphere(map, AX + 3.5, HEAD_Y + 1, AZ + 6.5, 2.5, EYE_BLACK, 1.5);
        setBlock(map, AX + 3.0, HEAD_Y + 2.5, AZ + 8.5, EYE_GLOW);

        // Small Slit Nostrils
        setBlock(map, AX - 0.5, HEAD_Y - 3, AZ + 7, ALIEN_GREY_DARK);
        setBlock(map, AX + 0.5, HEAD_Y - 3, AZ + 7, ALIEN_GREY_DARK);
        
        // Small Mouth
        setBlock(map, AX, HEAD_Y - 5.5, AZ + 6.5, EYE_BLACK);
        setBlock(map, AX - 0.5, HEAD_Y - 5.5, AZ + 6.5, EYE_BLACK);
        setBlock(map, AX + 0.5, HEAD_Y - 5.5, AZ + 6.5, EYE_BLACK);

        return Array.from(map.values());
    },`;

code = code.replace(/    Alien: \(\): VoxelData\[\] => \{[\s\S]*?return Array.from\(map.values\(\)\);\n    \},/, newAlien);
fs.writeFileSync('utils/voxelGenerators.ts', code);
