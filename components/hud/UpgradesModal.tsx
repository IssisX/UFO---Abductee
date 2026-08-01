/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameModeTelemetry, MothershipUpgrades } from '../../types';
import { Wrench, Coins, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 text-white shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Wrench className="text-cyan-300" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">MOTHERSHIP UPGRADES BAY</h3>
              <p className="text-xs text-slate-400">Enhance cybernetic beam physics, thrusters & weapons</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-300 font-mono font-black text-sm flex items-center gap-1">
              <Coins size={14} /> {(telemetry.credits ?? 2500).toLocaleString()} CR
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Upgrade Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {[
            { key: 'beamForce', name: 'Mega Tractor Lift', desc: 'Magnifies magnetic pull speed & multi-target abduction radius.', icon: '🧲' },
            { key: 'engineSpeed', name: 'Hyper-Thrusters 2.5X', desc: 'Unlocks 2.5x vertical altitude climb/dive speed & 350m ceiling.', icon: '🚀' },
            { key: 'repulsorRadius', name: 'Kinetic Shockwave', desc: 'Flings police chasers & street vehicles into orbit with explosive force.', icon: '💥' },
            { key: 'disintegratorPower', name: 'Plasma Disintegrator', desc: 'Fires high-intensity beam that dissolves building voxels & melts obstacles.', icon: '⚡' },
            { key: 'vortexRange', name: 'Quantum Grav-Cyclotron', desc: 'Creates a hyper-dense black hole vortex pulling dozens of targets at once.', icon: '🌀' },
            { key: 'energyCore', name: 'Golden Zero-Point Shield', desc: 'Projects a glowing sunset forcefield ring & auto-regenerates nitro energy.', icon: '🛡️' },
          ].map((up) => {
            const currentLvl = telemetry.upgrades?.[up.key as keyof MothershipUpgrades] ?? 1;
            const cost = currentLvl * 1000;
            const canAfford = (telemetry.credits ?? 2500) >= cost;
            const isMax = currentLvl >= 5;

            return (
              <div key={up.key} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>{up.icon}</span> {up.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-slate-900 px-2 py-0.5 rounded-md border border-cyan-500/30">
                      LVL {currentLvl}/5
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">{up.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`w-3 h-2 rounded-sm ${
                          lvl <= currentLvl ? 'bg-cyan-400 shadow-sm shadow-cyan-500/50' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    disabled={isMax || !canAfford}
                    onClick={() => onPurchaseUpgrade?.(up.key as keyof MothershipUpgrades)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono transition-all ${
                      isMax
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : canAfford
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95'
                        : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'MAXED' : `UPGRADE (${cost} CR)`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
