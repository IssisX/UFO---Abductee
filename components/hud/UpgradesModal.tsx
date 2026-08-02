/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameModeTelemetry, MothershipUpgrades } from '../../types';
import { Wrench, Coins, X } from 'lucide-react';
import { motion } from 'motion/react';

interface UpgradesModalProps {
  telemetry: GameModeTelemetry;
  onClose: () => void;
  onPurchaseUpgrade?: (key: keyof MothershipUpgrades) => boolean;
}

export const UpgradesModal: React.FC<UpgradesModalProps> = ({
  telemetry,
  onClose,
  onPurchaseUpgrade,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/70 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8 cursor-pointer"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col gap-6 overflow-hidden cursor-default"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-950/50 border border-cyan-400/30 rounded-2xl shadow-inner text-cyan-300">
              <Wrench size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-display font-black text-white tracking-widest uppercase">MOTHERSHIP BAY</h3>
              <p className="text-xs font-bold tracking-widest text-cyan-500/80 uppercase">Cybernetic Beam Physics & Thrusters</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 font-mono font-black text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Coins size={16} className="text-emerald-300" /> 
              <span>{(telemetry.credits ?? 2500).toLocaleString()} <span className="text-emerald-500/50">CR</span></span>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-slate-900 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Upgrade Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2 relative z-10 custom-scrollbar">
          {[
            { key: 'beamForce', name: 'Mega Tractor Lift', desc: 'Magnifies magnetic pull speed & multi-target radius.', icon: '🧲', color: 'cyan' },
            { key: 'engineSpeed', name: 'Hyper-Thrusters 2.5X', desc: 'Unlocks 2.5x vertical climb speed & 350m ceiling.', icon: '🚀', color: 'indigo' },
            { key: 'repulsorRadius', name: 'Kinetic Shockwave', desc: 'Flings police chasers & street vehicles into orbit.', icon: '💥', color: 'orange' },
            { key: 'disintegratorPower', name: 'Plasma Disintegrator', desc: 'High-intensity beam that dissolves building voxels.', icon: '⚡', color: 'fuchsia' },
            { key: 'vortexRange', name: 'Quantum Grav-Cyclotron', desc: 'Creates a dense black hole pulling dozens of targets.', icon: '🌀', color: 'emerald' },
            { key: 'energyCore', name: 'Golden Zero-Point Shield', desc: 'Projects a glowing forcefield ring & auto-regens nitro.', icon: '🛡️', color: 'amber' },
            { key: 'singularityMass', name: 'Void Singularity', desc: 'Deploys a collapse-state gravity well ripping apart matter.', icon: '🌌', color: 'violet' },
            { key: 'tetherStrength', name: 'Quantum Tether', desc: 'Binds multiple objects with subatomic strings, wrecking ball style.', icon: '🔗', color: 'sky' },
          ].map((up) => {
            const currentLvl = telemetry.upgrades?.[up.key as keyof MothershipUpgrades] ?? 1;
            const cost = currentLvl * 1000;
            const canAfford = (telemetry.credits ?? 2500) >= cost;
            const isMax = currentLvl >= 5;

            return (
              <div key={up.key} className="group relative bg-slate-950/60 hover:bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 hover:border-cyan-500/30 transition-all flex flex-col justify-between gap-3 overflow-hidden">
                {/* Subtle highlight gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-display font-black text-white flex items-center gap-2 uppercase tracking-wider">
                      <span className="text-lg">{up.icon}</span> {up.name}
                    </span>
                    <span className="text-[10px] font-mono font-black text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/20">
                      LVL {currentLvl}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">{up.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/50 mt-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={`up-lvl-${up.key}-${lvl}`}
                        className={`w-4 h-1.5 rounded-full transition-all ${
                          lvl <= currentLvl ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    disabled={isMax || !canAfford}
                    onClick={() => onPurchaseUpgrade?.(up.key as keyof MothershipUpgrades)}
                    className={`px-4 py-2 rounded-xl font-black text-xs font-mono transition-all ${
                      isMax
                        ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : canAfford
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95'
                        : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'MAXED' : `UPGRADE (${cost})`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};
