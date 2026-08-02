const fs = require('fs');
const content = fs.readFileSync('components/GameHUD.tsx', 'utf8');

const updated = content.replace(
  /{showUpgradesModal && \(/,
  `{isSummoning && !showSummonerModal && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-cyan-500/50 rounded-full px-6 py-3 shadow-[0_0_30px_rgba(6,182,212,0.3)] flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-cyan-300 font-mono text-sm font-bold tracking-wider uppercase">
              {summonStatus}
            </span>
          </motion.div>
        )}
        {showUpgradesModal && (`
);

fs.writeFileSync('components/GameHUD.tsx', updated);
