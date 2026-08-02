/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { PlayerMode, GameModeTelemetry, WeaponMode, MothershipUpgrades } from '../types';
import { Rocket, User, Zap, Sparkles, X, Gauge, ArrowUp, RotateCw, Crown, Trophy, Target, Flame, Compass, ChevronUp, Video, Users, FlaskConical, Shield, Plus, Minus, Maximize2, Crosshair, Wrench, Coins, Cpu, RefreshCw, Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SimpsonsTVCartoon } from './SimpsonsTVCartoon';
import { UpgradesModal } from './hud/UpgradesModal';

interface GameHUDProps {
  playerMode: PlayerMode;
  telemetry: GameModeTelemetry;
  onSelectPlayerMode: (mode: PlayerMode) => void;
  onTriggerAction: () => void;
  onExitGameMode: () => void;
  onToggleCinematicCamera?: () => void;
  onVirtualInput?: (fwd: number, strafe: number, ascend: number, boost: boolean) => void;
  onRotateCamera?: (deltaYaw: number, deltaPitch?: number) => void;
  onJump?: () => void;
  onSelectWeaponMode?: (mode: WeaponMode) => void;
  onPurchaseUpgrade?: (key: keyof MothershipUpgrades) => boolean;
  onDeployMutant?: () => boolean;
  onBarrelRoll?: () => boolean;
  onSummonAIObject?: (prompt: string, params?: any) => Promise<{ success: boolean; name?: string; description?: string; error?: string }>;
  onGetSummonedObjects?: () => any[];
  onRecallAIObject?: (id: string) => boolean;
  onOverchargeAIObject?: (id: string) => boolean;
  onDeconstructAIObject?: (id: string) => boolean;
  onTeleportToAIObject?: (id: string) => boolean;
  onPossessAIObject?: (id: string) => boolean;
  onEjectPossession?: () => boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  playerMode,
  telemetry,
  onSelectPlayerMode,
  onTriggerAction,
  onExitGameMode,
  onToggleCinematicCamera,
  onVirtualInput,
  onRotateCamera,
  onJump,
  onSelectWeaponMode,
  onPurchaseUpgrade,
  onDeployMutant,
  onBarrelRoll,
  onSummonAIObject,
  onGetSummonedObjects,
  onRecallAIObject,
  onOverchargeAIObject,
  onDeconstructAIObject,
  onTeleportToAIObject,
  onPossessAIObject,
  onEjectPossession,
}) => {
  const isUFO = playerMode === 'UFO';
  const isFlying = playerMode === 'UFO';

  // --- JOYSTICKS STATE ---
  const leftStickRef = useRef<HTMLDivElement>(null);
  const [leftActive, setLeftActive] = useState(false);
  const [leftKnobPos, setLeftKnobPos] = useState({ x: 0, y: 0 });

  const rightStickRef = useRef<HTMLDivElement>(null);
  const [rightActive, setRightActive] = useState(false);
  const [rightKnobPos, setRightKnobPos] = useState({ x: 0, y: 0 });

  const [ascendInput, setAscendInput] = useState(0);
  const [isNitro, setIsNitro] = useState(false);

  // --- HUD STATE ---
  const [showControlOverlay, setShowControlOverlay] = useState<boolean>(false);
  const [inputPref, setInputPref] = useState<'auto' | 'keyboard' | 'gamepad' | 'touch'>('auto');
  const [showUpgradesModal, setShowUpgradesModal] = useState<boolean>(false);
  const [showSummonerModal, setShowSummonerModal] = useState<boolean>(false);
  const [summonPrompt, setSummonPrompt] = useState<string>('');
  const [isSummoning, setIsSummoning] = useState<boolean>(false);
  const [summonStatus, setSummonStatus] = useState<string | null>(null);
  const [summonerTab, setSummonerTab] = useState<'forge' | 'manifest' | 'analysis'>('forge');
  const [styleScheme, setStyleScheme] = useState<string>('Neon Cyber');
  const [energyCore, setEnergyCore] = useState<string>('Zero-Point Crystal');
  const [complexity, setComplexity] = useState<string>('Standard');
  const [activeObjectsList, setActiveObjectsList] = useState<any[]>([]);

  useEffect(() => {
    if (showSummonerModal && onGetSummonedObjects) {
      const updateList = () => {
        setActiveObjectsList(onGetSummonedObjects());
      };
      updateList();
      const interval = setInterval(updateList, 800);
      return () => clearInterval(interval);
    }
  }, [showSummonerModal, onGetSummonedObjects, summonerTab]);
  const [minimapZoom, setMinimapZoom] = useState<number>(1.0); // Zoom level 0.5x to 2.0x
  const [minimapExpanded, setMinimapExpanded] = useState<boolean>(false);
  const [isTabPressed, setIsTabPressed] = useState(false);

  const [deviceType, setDeviceType] = useState<'mouseKeyboard' | 'gamepad' | 'touch'>(
    (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) ? 'touch' : 'mouseKeyboard'
  );

  useEffect(() => {
    if (inputPref !== 'auto') {
      setDeviceType(inputPref === 'keyboard' ? 'mouseKeyboard' : inputPref);
      return;
    }

    if (telemetry.lastInputDevice === 'gamepad') setDeviceType('gamepad');
    else if (telemetry.lastInputDevice === 'keyboard') setDeviceType('mouseKeyboard');
    
    const onTouch = () => setDeviceType('touch');
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, [telemetry.lastInputDevice, inputPref]);

  // Entrance animation
  const [isAnimateIn, setIsAnimateIn] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimateIn(true), 40);
    return () => clearTimeout(timer);
  }, []);

  // Refs for virtual input callbacks
  const onVirtualInputRef = useRef(onVirtualInput);
  useEffect(() => {
    onVirtualInputRef.current = onVirtualInput;
  }, [onVirtualInput]);

  const onRotateCameraRef = useRef(onRotateCamera);
  useEffect(() => {
    onRotateCameraRef.current = onRotateCamera;
  }, [onRotateCamera]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));

      // Global ESCAPE key to close active modal or overlay
      if (e.key === 'Escape') {
        if (showSummonerModal) {
          setShowSummonerModal(false);
          return;
        }
        if (showUpgradesModal) {
          setShowUpgradesModal(false);
          return;
        }
        if (showControlOverlay) {
          setShowControlOverlay(false);
          return;
        }
      }

      // 'x' or 'X' key to exit open modal/overlay when not typing text
      if ((e.key === 'x' || e.key === 'X') && !isInput) {
        if (showSummonerModal) {
          setShowSummonerModal(false);
          return;
        }
        if (showUpgradesModal) {
          setShowUpgradesModal(false);
          return;
        }
        if (showControlOverlay) {
          setShowControlOverlay(false);
          return;
        }
      }

      if (isInput) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setIsTabPressed(true);
      }
      if (e.key === 'u' || e.key === 'U') {
        setShowUpgradesModal(prev => !prev);
      }
      if (e.key === 'm' || e.key === 'M') {
        setShowSummonerModal(prev => !prev);
      }
      if (e.key === 'r' || e.key === 'R') {
        onBarrelRoll?.();
      }
      if (e.key === 'F1') onSelectWeaponMode?.('tractor');
      if (e.key === 'F2') onSelectWeaponMode?.('repulsor');
      if (e.key === 'F3') onSelectWeaponMode?.('disintegrator');
      if (e.key === 'F4') onSelectWeaponMode?.('vortex');
      if (e.key === 'F5') onSelectWeaponMode?.('orbital_laser');
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsTabPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onSelectWeaponMode, showSummonerModal, showUpgradesModal, showControlOverlay, onBarrelRoll]);

  useEffect(() => {
    if (!leftActive) {
      onVirtualInputRef.current?.(0, 0, ascendInput, isNitro);
    }
  }, [ascendInput, isNitro, leftActive]);

  // Refs for tracking active pointer IDs for multi-touch
  const leftTouchIdRef = useRef<number | null>(null);
  const rightTouchIdRef = useRef<number | null>(null);

  // Joystick drag logic
  const handleLeftPointerDown = (e: React.PointerEvent) => {
    if (leftTouchIdRef.current !== null) return; // Already tracking
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    leftTouchIdRef.current = e.pointerId;
    setLeftActive(true);
  };

  useEffect(() => {
    if (!leftActive) {
      setLeftKnobPos({ x: 0, y: 0 });
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== leftTouchIdRef.current) return;
      if (!leftStickRef.current) return;
      const rect = leftStickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const maxRadius = rect.width / 2 - 10;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      setLeftKnobPos({ x: dx, y: dy });
      const normStrafe = dx / maxRadius;
      const normFwd = -dy / maxRadius;

      onVirtualInputRef.current?.(normFwd, normStrafe, ascendInput, isNitro);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== leftTouchIdRef.current) return;
      leftTouchIdRef.current = null;
      setLeftActive(false);
      setLeftKnobPos({ x: 0, y: 0 });
      onVirtualInputRef.current?.(0, 0, ascendInput, isNitro);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [leftActive, ascendInput, isNitro]);

  const handleRightPointerDown = (e: React.PointerEvent) => {
    if (rightTouchIdRef.current !== null) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    rightTouchIdRef.current = e.pointerId;
    setRightActive(true);
  };

  useEffect(() => {
    if (!rightActive) {
      setRightKnobPos({ x: 0, y: 0 });
      return;
    }

    let prevX: number | null = null;
    let prevY: number | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== rightTouchIdRef.current) return;
      if (!rightStickRef.current) return;
      const rect = rightStickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const maxRadius = rect.width / 2 - 10;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      setRightKnobPos({ x: dx, y: dy });

      if (prevX !== null && prevY !== null) {
        const deltaX = e.clientX - prevX;
        const deltaY = e.clientY - prevY;
        onRotateCameraRef.current?.(-deltaX * 0.008, deltaY * 0.008);
      }

      prevX = e.clientX;
      prevY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== rightTouchIdRef.current) return;
      rightTouchIdRef.current = null;
      setRightActive(false);
      setRightKnobPos({ x: 0, y: 0 });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [rightActive]);

  const activeWeapon: WeaponMode = telemetry.weaponMode || 'tractor';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-2 sm:p-4 select-none font-sans overflow-hidden touch-none"
    >
      {/* Alien Diegetic Cockpit Overlay */}
      {isUFO && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg className="w-full h-full opacity-[0.15]" preserveAspectRatio="none" viewBox="0 0 1920 1080">
            <path d="M 0 0 L 200 0 C 400 100, 1520 100, 1720 0 L 1920 0 L 1920 1080 L 1720 1080 C 1520 980, 400 980, 200 1080 L 0 1080 Z" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="3" />
            <path d="M 200 0 C 400 100, 1520 100, 1720 0" fill="none" stroke="currentColor" className="text-cyan-300" strokeWidth="6" opacity="0.5" />
            <path d="M 1720 1080 C 1520 980, 400 980, 200 1080" fill="none" stroke="currentColor" className="text-cyan-300" strokeWidth="6" opacity="0.5" />
            {/* Alien glyphs scattered on the edges */}
            <text x="50" y="50" fill="currentColor" className="text-cyan-400 font-display font-black text-2xl tracking-[0.5em]" opacity="0.7">⍙☊⍜</text>
            <text x="1800" y="50" fill="currentColor" className="text-cyan-400 font-display font-black text-2xl tracking-[0.5em]" opacity="0.7">⍙☊⍜</text>
            <text x="50" y="1030" fill="currentColor" className="text-cyan-400 font-display font-black text-2xl tracking-[0.5em]" opacity="0.7">⏁⊑⟒</text>
            <text x="1800" y="1030" fill="currentColor" className="text-cyan-400 font-display font-black text-2xl tracking-[0.5em]" opacity="0.7">⏁⊑⟒</text>
            {/* Corner curved accents */}
            <path d="M 0 50 L 50 50 A 50 50 0 0 0 100 0" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="4" opacity="0.6"/>
            <path d="M 1920 50 L 1870 50 A 50 50 0 0 1 1820 0" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="4" opacity="0.6"/>
            <path d="M 0 1030 L 50 1030 A 50 50 0 0 1 100 1080" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="4" opacity="0.6"/>
            <path d="M 1920 1030 L 1870 1030 A 50 50 0 0 0 1820 1080" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="4" opacity="0.6"/>
          </svg>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-16 bg-gradient-to-b from-cyan-900/40 to-transparent blur-xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-32 bg-gradient-to-t from-cyan-900/30 to-transparent blur-2xl" />
        </div>
      )}

      {/* Wanted siren flash overlay */}
      {telemetry.wantedLevel > 0 && (
        <div className="absolute inset-0 pointer-events-none z-0 animate-pulse border-8 border-rose-600/40 bg-gradient-to-t from-rose-950/20 via-transparent to-rose-950/20" />
      )}

      {/* --- TOP HUD BAR --- */}
      <div className="relative z-10 flex items-start justify-between w-full max-w-7xl mx-auto gap-2">
        
        {/* Left: Mode & Vehicle Switcher & Controls Badge */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white border border-indigo-500/40 px-3 py-1.5 rounded-2xl shadow-xl flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow">
              {isUFO ? <Rocket className="text-cyan-300 animate-pulse" size={16} /> : <User className="text-lime-300 animate-bounce" size={16} />}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                  {isFlying ? '3D Aerial Abduction' : 'Ground Extraterrestrial'}
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white">
                {isUFO ? '🛸 Cyber UFO' : '👽 Walking Gray Alien'}
              </h2>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-lg self-start">
            <button
              onClick={() => onSelectPlayerMode('UFO')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-black text-[11px] transition-all ${
                playerMode === 'UFO' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Rocket size={12} /> UFO
            </button>
            <button
              onClick={() => onSelectPlayerMode('Alien')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-black text-[11px] transition-all ${
                playerMode === 'Alien' ? 'bg-lime-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              👽 Gray Alien
            </button>

            <button
              onClick={() => setShowControlOverlay(!showControlOverlay)}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 rounded-lg text-cyan-300 font-bold text-[10px] shadow"
              title="Toggle Controls Pop-up [TAB]"
            >
              <Target size={11} /> <span>[TAB] Controls</span>
            </button>
          </div>

          {/* Subagent Next-Upgrade Guidance Banner */}
          <div className="pointer-events-auto bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 px-2.5 py-1 rounded-xl text-[10px] text-cyan-300 shadow flex items-center gap-1.5 max-w-xs animate-pulse">
            <Cpu size={12} className="text-cyan-400 animate-spin" />
            <span className="font-bold">Subagent Proposal:</span>
            <span className="text-slate-200">{telemetry.subagentProposal || "Atmospheric Weather Manipulator & Plasma Forcefield Shield"}</span>
          </div>
        </motion.div>

        {/* Center: Score, Credits, Energy & Wanted Level */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          className="flex flex-col items-center gap-1 pointer-events-none"
        >
          {/* Active Construct Possession Banner */}
          {telemetry.possessedConstruct && (
            <div className="pointer-events-auto bg-gradient-to-r from-purple-950/90 via-slate-900/95 to-indigo-950/90 border-2 border-amber-400/80 px-4 py-2 rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center gap-3 animate-pulse">
              <div className="p-2 bg-amber-500/20 border border-amber-400 rounded-xl text-amber-300">
                <Sparkles size={20} className="animate-spin" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                    ✨ POSSESSED OBJECT
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300 uppercase">
                    Mode: {telemetry.possessedConstruct.locomotionType} ({telemetry.possessedConstruct.placementDomain})
                  </span>
                </div>
                <h3 className="text-sm font-black text-white tracking-wide">
                  {telemetry.possessedConstruct.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => onTriggerAction?.()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-md transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>⚡ Ability [Space]</span>
                </button>
                <button
                  onClick={() => onEjectPossession?.()}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>🚪 Eject [E]</span>
                </button>
              </div>
            </div>
          )}

          {/* Cinematic Cam Badge */}
          {telemetry.isCinematicCamera && (
            <div className="bg-purple-950/80 border border-purple-500/50 text-cyan-300 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shadow flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              🎥 CINEMATIC CAM
            </div>
          )}

          {/* GTA Wanted Stars Bar */}
          {(telemetry.wantedLevel ?? 0) > 0 && (
            <div className="bg-slate-950/90 border border-rose-500/80 px-3 py-0.5 rounded-full shadow flex items-center gap-1 animate-pulse pointer-events-auto">
              <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest mr-1">WANTED</span>
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <span key={`wanted-star-${starIndex}`} className={`text-xs font-black ${starIndex <= (telemetry.wantedLevel ?? 0) ? 'text-amber-400' : 'text-slate-700'}`}>
                  ★
                </span>
              ))}
            </div>
          )}

          <div className="pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/50 px-4 py-1.5 rounded-2xl shadow-xl flex items-center gap-3 text-white mt-1">
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                <span className="text-sm sm:text-lg font-black text-cyan-300 font-mono">{(telemetry.score ?? 0).toLocaleString()}</span>
              </div>

              <div className="h-6 w-px bg-slate-700/80" />

              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-0.5">
                  <Coins size={9} /> Credits
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-300 font-mono">{(telemetry.credits ?? 2500).toLocaleString()} CR</span>
              </div>

              {(telemetry.comboMultiplier ?? 1) > 1 && (
                <div className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-black text-[10px] text-white shadow animate-bounce flex items-center gap-1">
                  <Flame size={12} /> {telemetry.comboMultiplier}x
                </div>
              )}
            </div>
          </div>

          {/* Nitro Energy Bar */}
          <div className="pointer-events-auto mt-1">
            <div className="w-36 sm:w-44 bg-slate-900/90 p-1 rounded-full border border-slate-700/80 flex items-center gap-1.5 shadow">
              <Flame size={10} className={(telemetry.energy ?? 100) < 20 ? "text-rose-500 animate-pulse" : "text-amber-400"} />
              <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    (telemetry.energy ?? 100) > 50
                      ? "bg-gradient-to-r from-cyan-400 to-indigo-500"
                      : (telemetry.energy ?? 100) > 20
                      ? "bg-gradient-to-r from-amber-400 to-orange-500"
                      : "bg-rose-500 animate-pulse"
                  }`}
                  style={{ width: `${telemetry.energy ?? 100}%` }}
                />
              </div>
              <span className="text-[9px] font-black font-mono text-slate-300">{telemetry.energy ?? 100}%</span>
            </div>
          </div>
        </motion.div>

        {/* Right: Upgrades Tab, Camera, Exit & Interactive Strategic Mini-map */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
          className="flex flex-col items-end gap-1.5"
        >
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setInputPref(p => p === 'auto' ? 'keyboard' : p === 'keyboard' ? 'gamepad' : p === 'gamepad' ? 'touch' : 'auto')}
              className="bg-slate-800/90 text-slate-300 hover:bg-slate-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
              title="Lock Input Device Preference"
            >
              {inputPref === 'auto' ? 'Auto Input' : inputPref === 'keyboard' ? 'Key/Mouse' : inputPref === 'gamepad' ? 'Gamepad' : 'Touch'}
            </button>

            {/* AI 3D Object Summoner HUD Button */}
            <button
              onClick={() => setShowSummonerModal(true)}
              className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-[10px] px-3 py-1.5 rounded-xl border border-cyan-300/40 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              <Sparkles size={13} className="text-cyan-200 animate-spin" />
              <span>AI 3D SUMMONER [M]</span>
            </button>

            {/* Mothership Upgrades HUD Button */}
            <button
              onClick={() => setShowUpgradesModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[10px] px-3 py-1.5 rounded-xl border border-emerald-300/40 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all animate-pulse"
            >
              <Wrench size={13} />
              <span>UPGRADES [U]</span>
            </button>

            {/* Cinematic Cam Toggle */}
            {onToggleCinematicCamera && (
              <button
                onClick={onToggleCinematicCamera}
                className={`font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border active:scale-95 transition-all ${
                  telemetry.isCinematicCamera
                    ? 'bg-purple-600 text-cyan-200 border-cyan-400/50'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Video size={12} /> CAM
              </button>
            )}

          </div>

          {/* Simpsons CRT TV Frame */}
          {isUFO && (
            <div className="pointer-events-auto shadow-2xl">
              <SimpsonsTVCartoon abductionTriggerTime={telemetry.abductionTriggerTime} />
            </div>
          )}

          {/* --- INTERACTIVE STRATEGIC MINI-MAP --- */}
          <div className="pointer-events-auto relative transition-all duration-300 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-cyan-500/60 shadow-2xl overflow-hidden flex flex-col items-center">
            <div className={`relative transition-all duration-300 ${
              minimapExpanded ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-28 h-28 sm:w-36 sm:h-36'
            }`}>
              {/* Map Header Overlay */}
              <div className="absolute top-1 left-2 right-2 z-20 flex items-center justify-between pointer-events-auto">
              <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                <Crosshair size={10} /> RADAR
              </span>
              <div className="flex items-center gap-1 bg-slate-900/80 px-1 py-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setMinimapZoom(z => Math.min(2.0, z + 0.25))}
                  className="text-slate-300 hover:text-white p-0.5"
                  title="Zoom In"
                >
                  <Plus size={10} />
                </button>
                <button
                  onClick={() => setMinimapZoom(z => Math.max(0.5, z - 0.25))}
                  className="text-slate-300 hover:text-white p-0.5"
                  title="Zoom Out"
                >
                  <Minus size={10} />
                </button>
                <button
                  onClick={() => setMinimapExpanded(!minimapExpanded)}
                  className="text-slate-300 hover:text-white p-0.5"
                  title="Expand Map"
                >
                  <Maximize2 size={10} />
                </button>
              </div>
            </div>

            {/* Mini-map Canvas Area */}
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Cardinal Compass Markers */}
              <span className="absolute top-1 text-[8px] font-black font-mono text-cyan-400/80">N</span>
              <span className="absolute bottom-1 text-[8px] font-black font-mono text-slate-500">S</span>
              <span className="absolute left-1.5 text-[8px] font-black font-mono text-slate-500">W</span>
              <span className="absolute right-1.5 text-[8px] font-black font-mono text-slate-500">E</span>

              {/* Concentric distance rings */}
              <div className="absolute inset-2 rounded-full border border-cyan-500/25" />
              <div className="absolute inset-8 rounded-full border border-cyan-500/20" />
              <div className="absolute w-full h-0.5 bg-cyan-500/15" />
              <div className="absolute h-full w-0.5 bg-cyan-500/15" />

              {/* Sweep Radar Beam */}
              <div className="absolute w-1/2 h-0.5 bg-gradient-to-r from-transparent to-cyan-400 origin-left animate-spin" style={{ animationDuration: '3s' }} />

              {/* Render City Colliders / Building Footprints */}
              {telemetry.cityColliders && telemetry.cityColliders.map((col, idx) => {
                const mapScale = (minimapExpanded ? 2.5 : 1.2) * minimapZoom;
                const bx = col.x * mapScale;
                const bz = col.z * mapScale;
                const bw = Math.max(3, col.width * mapScale);
                const bd = Math.max(3, col.depth * mapScale);

                // Skip if way off radar boundary
                if (Math.abs(bx) > 120 || Math.abs(bz) > 120) return null;

                return (
                  <div
                    key={`city-collider-${idx}`}
                    className="absolute bg-slate-800/80 border border-slate-700/60 rounded-sm pointer-events-none"
                    style={{
                      left: `calc(50% + ${bx}px - ${bw / 2}px)`,
                      top: `calc(50% + ${bz}px - ${bd / 2}px)`,
                      width: `${bw}px`,
                      height: `${bd}px`,
                    }}
                  />
                );
              })}

              {/* Center UFO Icon with Heading Vector Pointer */}
              <div className="relative z-10 flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full border border-white shadow-[0_0_10px_rgba(34,211,238,1)] flex items-center justify-center">
                  <div 
                    className="w-0.5 h-3.5 bg-cyan-200 origin-bottom" 
                    style={{ transform: `rotate(${((telemetry.heading ?? 0) * 180) / Math.PI}deg)` }} 
                  />
                </div>
              </div>

              {/* Radar Blips */}
              {telemetry.radarBlips && telemetry.radarBlips.map((blip, idx) => {
                const mapScale = (minimapExpanded ? 110 : 50) * minimapZoom;
                const px = blip.x * mapScale;
                const py = blip.z * mapScale;

                if (blip.isTarget) {
                  return (
                    <div
                      key={`blip-target-${idx}`}
                      className="absolute z-20 flex items-center justify-center pointer-events-none"
                      style={{ transform: `translate(${px}px, ${py}px)` }}
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)] animate-ping absolute" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,1)] border border-white flex items-center justify-center text-[7px] font-black text-slate-950">
                        🎯
                      </div>
                    </div>
                  );
                }

                if (blip.type === 'police') {
                  return (
                    <div
                      key={`blip-police-${idx}`}
                      className="absolute z-20 flex items-center justify-center pointer-events-none"
                      style={{ transform: `translate(${px}px, ${py}px)` }}
                    >
                      <div className="w-3 h-3 rounded-full border border-rose-500 bg-rose-600/50 animate-ping absolute" />
                      <div className="w-2 h-2 rounded-full bg-rose-500 border border-white shadow-[0_0_6px_rgba(244,63,94,1)]" />
                    </div>
                  );
                }

                if (blip.type === 'jet') {
                  return (
                    <div
                      key={`blip-jet-${idx}`}
                      className="absolute z-20 flex items-center justify-center pointer-events-none"
                      style={{ transform: `translate(${px}px, ${py}px)` }}
                    >
                      <div className="w-3 h-3 text-[9px] text-amber-300 font-black animate-bounce">
                        ✈️
                      </div>
                    </div>
                  );
                }

                const colorClass = 
                  blip.type === 'person'
                    ? 'bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.8)]'
                    : blip.type === 'crystal' || blip.type === 'fish' || blip.type === 'feather'
                    ? 'bg-cyan-300 shadow-[0_0_5px_rgba(103,232,249,0.8)]'
                    : blip.type === 'debris'
                    ? 'bg-purple-400 shadow-[0_0_4px_rgba(192,132,252,0.8)]'
                    : 'bg-slate-400';

                return (
                  <div
                    key={`blip-${blip.type || 'item'}-${idx}`}
                    className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
                    style={{ transform: `translate(${px}px, ${py}px)` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* --- CENTRAL RETICLE TARGET LOCK OVERLAY --- */}
      {isUFO && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-2"
          >
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full border-2 transition-all duration-300 ${
                telemetry.targetAlignmentState === 'ABDUCTING'
                  ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-pulse'
                  : telemetry.targetAlignmentState === 'LOCK_STABLE'
                  ? 'border-emerald-400 bg-emerald-950/30 shadow-[0_0_18px_rgba(52,211,153,0.6)]'
                  : telemetry.targetAlignmentState === 'ALIGNING'
                  ? 'border-amber-400/80 border-dashed animate-spin'
                  : 'border-cyan-500/30'
              }`}
              style={{ animationDuration: '6s' }}
            />
            <div
              className="absolute inset-2 rounded-full border-4 border-cyan-400 border-t-transparent transition-transform duration-100"
              style={{ transform: `rotate(${(telemetry.alignmentProgress ?? 0) * 3.6}deg)` }}
            />
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]" />
            <div className="absolute w-8 h-0.5 bg-cyan-400/60" />
            <div className="absolute h-8 w-0.5 bg-cyan-400/60" />
          </div>

          <div className="bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 px-3.5 py-1.5 rounded-xl shadow-2xl flex flex-col items-center gap-1 text-center font-mono">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-cyan-300">
              <Target size={12} className={telemetry.targetAlignmentState === 'ABDUCTING' ? 'text-amber-400 animate-spin' : 'text-cyan-400'} />
              <span>{telemetry.targetName ?? 'SCANNING CIVILIANS'}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold">
              <span className="text-slate-300">ALIGN: <strong className="text-cyan-300 font-mono">{telemetry.alignmentProgress ?? 0}%</strong></span>
              {telemetry.targetAlignmentState === 'ABDUCTING' && (
                <span className="text-amber-400 font-mono animate-pulse">LIFT: {telemetry.abductionProgress ?? 0}%</span>
              )}
            </div>
          </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* --- BOTTOM WEAPONS HOTBAR & MOVEMENT JOYSTICKS --- */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, delay: 0.4 }}
        className="w-full max-w-7xl mx-auto flex items-end justify-between gap-2 mt-auto pointer-events-none z-30 pb-2 sm:pb-0 relative"
      >
        {/* Left Joystick or Keyboard Hint */}
        {deviceType === 'touch' ? (
          <div className="flex flex-col items-center gap-1 transition-all duration-500 ease-out transform pointer-events-auto shrink-0 pl-2">
            <div
              ref={leftStickRef}
              onPointerDown={handleLeftPointerDown}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-indigo-500/50 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="absolute w-full h-0.5 bg-indigo-500/20" />
              <div className="absolute h-full w-0.5 bg-indigo-500/20" />
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 border border-indigo-300 shadow-lg flex items-center justify-center text-white"
                style={{ transform: `translate(${leftKnobPos.x * 0.8}px, ${leftKnobPos.y * 0.8}px)` }}
              >
                <Compass size={18} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] text-slate-200 font-bold shadow-lg">
            {deviceType === 'gamepad' ? 'Left Stick: Move | Right Stick: Orbit' : 'WASD/Arrows: Move | Mouse: Camera'}
          </div>
        )}

        {/* DYNAMIC WEAPON MODES HOTBAR & ACTION TRIGGER */}
        <div className={`flex flex-col items-center gap-2 pointer-events-auto shrink ${deviceType === 'touch' ? 'absolute bottom-36 left-1/2 -translate-x-1/2 w-[98vw]' : ''}`}>
          {/* FLIGHT SIMULATOR ARTIFICIAL HORIZON & JET LOCK OVERLAY */}
          {isUFO && (
            <div className="pointer-events-none mb-1 flex flex-col items-center justify-center gap-1 w-full max-w-2xl relative">
              
              {telemetry.flightMode === 'jet' && (
                <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center justify-center">
                  
                  {/* Advanced Flight Sim HUD overlay */}
                  <div className="absolute inset-0 flex justify-between items-center px-12 pb-24 text-cyan-400 font-mono text-xs opacity-70">
                    
                    {/* Left Speed/Throttle Ladder */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-cyan-200 font-bold bg-slate-900/40 px-2 py-0.5 rounded border border-cyan-500/50">
                        SPD {telemetry.jetSpeed?.toString().padStart(3, '0')}
                      </div>
                      <div className="h-40 w-8 border-r-2 border-cyan-500/50 relative">
                        {/* Ladder ticks */}
                        {[...Array(5)].map((_, i) => (
                           <div key={`spd-tick-${i}`} className="absolute right-0 w-3 h-px bg-cyan-500/50" style={{ bottom: `${i * 25}%` }} />
                        ))}
                        {/* Speed pointer */}
                        <div 
                           className="absolute right-0 w-4 h-2 border-y-4 border-l-4 border-r-0 border-transparent border-l-cyan-300 transition-all duration-100" 
                           style={{ bottom: `${Math.min(100, Math.max(0, (telemetry.jetThrottle || 0) * 100))}%`, transform: 'translateY(50%)' }}
                        />
                      </div>
                      <div className="text-[9px] text-cyan-500">THR {Math.round((telemetry.jetThrottle || 0) * 100)}%</div>
                    </div>

                    {/* Right Altitude Ladder */}
                    <div className="flex flex-col items-start gap-1">
                      <div className="text-cyan-200 font-bold bg-slate-900/40 px-2 py-0.5 rounded border border-cyan-500/50">
                        ALT {telemetry.jetAltitude?.toString().padStart(4, '0')}
                      </div>
                      <div className="h-40 w-8 border-l-2 border-cyan-500/50 relative">
                        {[...Array(5)].map((_, i) => (
                           <div key={`alt-tick-${i}`} className="absolute left-0 w-3 h-px bg-cyan-500/50" style={{ bottom: `${i * 25}%` }} />
                        ))}
                        <div 
                           className="absolute left-0 w-4 h-2 border-y-4 border-r-4 border-l-0 border-transparent border-r-cyan-300 transition-all duration-100" 
                           style={{ bottom: `${((telemetry.jetAltitude || 0) % 1000) / 10}%`, transform: 'translateY(50%)' }}
                        />
                      </div>
                      <div className="text-[9px] text-cyan-500">MSL (M)</div>
                    </div>
                  </div>

                  {/* Enemy Jet Tracking Reticles */}
                  {telemetry.enemyJetsState?.filter(enemy => enemy.inView).map((enemy, idx) => (
                    <div 
                      key={`enemy-jet-${enemy.id || 'jet'}-${idx}`} 
                      className={`fixed w-12 h-12 border ${enemy.isLocked ? 'border-rose-500' : 'border-amber-400'} rounded-full flex items-center justify-center transition-all duration-75`}
                      style={{
                        left: `${enemy.screenX}%`, 
                        top: `${enemy.screenY}%`,
                        transform: `translate(-50%, -50%) scale(${Math.max(0.3, Math.min(1.0, 100 / enemy.dist))})`,
                        opacity: enemy.isLocked ? 1 : 0.6
                      }}
                    >
                      {enemy.isLocked && <div className="absolute w-2 h-2 bg-rose-500 rounded-full animate-ping" />}
                      <div className="absolute -bottom-4 text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: enemy.isLocked ? '#f43f5e' : '#fbbf24' }}>
                        {enemy.isLocked ? 'LOCKED' : 'TRACKING'} {Math.round(enemy.dist)}M
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Air Force Jet Target Lock Banner */}
              {telemetry.targetJetName && (
                <div className="bg-slate-950/90 border-2 border-rose-500 text-rose-400 px-3 py-1 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto">
                  <Crosshair size={16} className="text-rose-500 animate-spin" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">
                      AIR FORCE JET LOCK: {telemetry.targetJetName} ({telemetry.targetJetDist}M)
                    </span>
                    <span className="text-[9px] text-amber-300 font-mono">
                      PRESS [L-CLICK] TO LAUNCH HOMING PLASMA TORPEDO
                    </span>
                  </div>
                </div>
              )}

              {/* Flight Horizon Pitch & Roll Gauge */}
              <div className="relative w-44 h-10 flex items-center justify-center opacity-85">
                {/* Horizon Line tilted by roll angle */}
                <div 
                  className="absolute w-32 h-0.5 bg-cyan-400/80 shadow-[0_0_8px_#38bdf8] transition-transform duration-75"
                  style={{ transform: `rotate(${-telemetry.rollAngle || 0}deg) translateY(${(telemetry.pitchAngle || 0) * 0.6}px)` }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-2 border-l-2 border-cyan-400" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-2 border-r-2 border-cyan-400" />
                </div>

                {/* Crosshair reticle center */}
                <div className="w-4 h-4 border-2 border-cyan-400 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-cyan-300 rounded-full" />
                </div>

                {/* Flight Telemetry stats */}
                <div className="absolute -bottom-3 flex items-center gap-2 text-[8px] font-mono font-bold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  <span>G-LOAD: {telemetry.gForce || '1.0'}G</span>
                  <span>PITCH: {telemetry.pitchAngle || 0}°</span>
                  <span>BANK: {telemetry.rollAngle || 0}°</span>
                </div>
              </div>
            </div>
          )}

          {/* 5 Weapon Switcher Bar */}
          <div className="bg-slate-950/40 backdrop-blur-xl p-1.5 rounded-2xl border border-cyan-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-wrap justify-center items-center gap-1.5 transition-all">
            {[
              { id: 'tractor', name: 'Tractor', key: '1', color: 'from-cyan-500 to-blue-600', icon: '🧲' },
              { id: 'repulsor', name: 'Repulsor', key: '2', color: 'from-orange-500 to-red-600', icon: '💥' },
              { id: 'disintegrator', name: 'Disintegrat', key: '3', color: 'from-fuchsia-500 to-purple-600', icon: '⚡' },
              { id: 'vortex', name: 'Vortex', key: '4', color: 'from-emerald-500 to-teal-600', icon: '🌀' },
              { id: 'orbital_laser', name: 'Orbital', key: '5', color: 'from-rose-600 to-amber-600', icon: '☄️' },
              { id: 'singularity', name: 'Singularity', key: '6', color: 'from-violet-600 to-fuchsia-800', icon: '🌌' },
              { id: 'quantum_tether', name: 'Q-Tether', key: '7', color: 'from-sky-500 to-indigo-500', icon: '🔗' },
            ].map((wp) => {
              const isActive = activeWeapon === wp.id;
              return (
                <button
                  key={wp.id}
                  onPointerDown={(e) => { e.preventDefault(); onSelectWeaponMode?.(wp.id as WeaponMode); }}
                  className={`relative px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border ${
                    isActive
                      ? `bg-gradient-to-br ${wp.color} text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105`
                      : 'bg-slate-900/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-sm sm:text-base">{wp.icon}</span>
                  <span className="hidden md:inline">{wp.name}</span>
                  {telemetry.lastInputDevice !== 'gamepad' && (
                    <span className="hidden sm:inline-block text-[9px] bg-slate-950/80 px-1 py-0.5 rounded text-cyan-300 border border-cyan-500/30 font-mono opacity-60">
                      [{wp.key}]
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side Controls (Camera Joystick + Action Buttons) */}
        <div className="flex items-end gap-3 z-30 pointer-events-auto shrink-0 pr-2 pb-2 sm:pb-0">
          
          {/* Action Buttons Container (Vertical on Mobile, Horizontal on Desktop) */}
          <div className={`flex ${deviceType === 'touch' ? 'flex-col-reverse items-end mb-20' : 'flex-row items-center'} gap-2`}>
            
            {/* Fire Button (Primary Action) */}
            <button
              onPointerDown={(e) => { e.preventDefault(); onTriggerAction?.(); }}
              className={`px-5 py-4 sm:px-6 sm:py-3.5 bg-gradient-to-br from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center justify-center gap-2 border border-cyan-300/50 active:scale-90 transition-all ${deviceType === 'touch' ? 'w-16 h-16 rounded-full p-0 touch-none' : ''}`}
            >
              <Zap size={deviceType === 'touch' ? 24 : 18} className={deviceType === 'touch' ? '' : 'animate-bounce'} />
              {deviceType !== 'touch' && <span>FIRE {deviceType === 'mouseKeyboard' ? '[L-CLICK]' : '[X]'}</span>}
            </button>

            {/* Flight Altitude Controls (Touch only) */}
            {isFlying && deviceType === 'touch' && (
              <div className="flex flex-col gap-2">
                <button
                  onPointerDown={(e) => { e.preventDefault(); setAscendInput(1); }}
                  onPointerUp={() => setAscendInput(0)}
                  onPointerCancel={() => setAscendInput(0)}
                  onPointerLeave={() => setAscendInput(0)}
                  className="w-12 h-12 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 text-white rounded-full flex items-center justify-center shadow-lg active:bg-cyan-600 transition-colors touch-none"
                >
                  <ChevronUp size={20} />
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); setAscendInput(-1); }}
                  onPointerUp={() => setAscendInput(0)}
                  onPointerCancel={() => setAscendInput(0)}
                  onPointerLeave={() => setAscendInput(0)}
                  className="w-12 h-12 bg-slate-900/80 backdrop-blur-md border border-indigo-500/30 text-white rounded-full flex items-center justify-center shadow-lg active:bg-indigo-600 transition-colors touch-none"
                >
                  <ChevronUp size={20} className="rotate-180" />
                </button>
              </div>
            )}
            
            {/* Jump Button (Non-flying mode) */}
            {!isFlying && (
              <button
                onPointerDown={(e) => { e.preventDefault(); onJump && onJump(); }}
                className={`px-4 py-3 bg-emerald-600/90 backdrop-blur-md text-white font-black text-xs rounded-xl flex items-center gap-1 border border-emerald-400/50 active:scale-95 transition-all ${deviceType === 'touch' ? 'w-14 h-14 rounded-full justify-center p-0 touch-none' : ''}`}
              >
                <ArrowUp size={deviceType === 'touch' ? 20 : 16} /> 
                {deviceType !== 'touch' && <span>JUMP [SPC]</span>}
              </button>
            )}

            {/* Secondary Actions Row/Col */}
            <div className={`flex ${deviceType === 'touch' ? 'flex-col' : 'flex-row'} gap-2`}>
              <button
                onPointerDown={(e) => { e.preventDefault(); setIsNitro(!isNitro); }}
                className={`px-3 py-2.5 rounded-xl font-bold text-[10px] sm:text-xs text-white shadow-lg flex items-center gap-1.5 border transition-all active:scale-95 ${
                  isNitro
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-300/50'
                    : 'bg-slate-900/60 backdrop-blur-md border-slate-700/50'
                } ${deviceType === 'touch' ? 'w-12 h-12 rounded-full justify-center p-0 touch-none' : ''}`}
              >
                <Flame size={16} className={isNitro ? 'animate-pulse' : ''} /> 
                {deviceType !== 'touch' && <span>NITRO</span>}
              </button>

              {isUFO && (
                <button
                  onPointerDown={(e) => { e.preventDefault(); onBarrelRoll?.(); }}
                  className={`px-3 py-2.5 rounded-xl font-bold text-[10px] sm:text-xs text-white shadow-lg flex items-center gap-1.5 border transition-all active:scale-95 ${
                    telemetry.isBarrelRolling
                      ? 'bg-sky-500 border-white/50 animate-spin'
                      : 'bg-slate-900/60 backdrop-blur-md border-slate-700/50'
                  } ${deviceType === 'touch' ? 'w-12 h-12 rounded-full justify-center p-0 touch-none' : ''}`}
                >
                  <RefreshCw size={16} />
                  {deviceType !== 'touch' && <span>ROLL</span>}
                </button>
              )}

              <button
                disabled={(telemetry.bioSpecimens ?? 0) < 3}
                onPointerDown={(e) => { 
                  if ((telemetry.bioSpecimens ?? 0) < 3) return;
                  e.preventDefault(); 
                  onDeployMutant?.(); 
                }}
                className={`px-3 py-2.5 rounded-xl font-bold text-[10px] sm:text-xs shadow-lg flex items-center gap-1.5 border transition-all active:scale-95 ${
                  (telemetry.bioSpecimens ?? 0) >= 3
                    ? 'bg-emerald-600 border-emerald-400/50 text-white'
                    : 'bg-slate-900/60 backdrop-blur-md border-slate-800/50 text-slate-500 opacity-50'
                } ${deviceType === 'touch' ? 'w-12 h-12 rounded-full justify-center p-0 touch-none' : ''}`}
              >
                <FlaskConical size={16} />
                {deviceType !== 'touch' && <span>MUTANT ({(telemetry.bioSpecimens ?? 0)}/3)</span>}
              </button>
            </div>

          </div>

          {/* Right Camera Stick (Touch Only) */}
          {deviceType === 'touch' && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                ref={rightStickRef}
                onPointerDown={handleRightPointerDown}
                className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-cyan-500/50 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
              >
                <div className="absolute w-full h-0.5 bg-cyan-500/20" />
                <div className="absolute h-full w-0.5 bg-cyan-500/20" />
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 border border-cyan-300 shadow-lg flex items-center justify-center text-white"
                  style={{ transform: `translate(${rightKnobPos.x * 0.8}px, ${rightKnobPos.y * 0.8}px)` }}
                >
                  <RotateCw size={16} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* --- CONTROL SCHEME REFERENCE OVERLAY (TAB or Button Toggle) --- */}
      {(isTabPressed || showControlOverlay) && (
        <div className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/60 rounded-3xl p-6 text-white shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-600 rounded-xl text-white">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">CONTROL SCHEME & TACTICAL GUIDE</h3>
                  <p className="text-xs text-cyan-300">Quick Reference for Flight, Extraterrestrial Combat & Abduction</p>
                </div>
              </div>
              <button
                onClick={() => setShowControlOverlay(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <h4 className="font-black text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  🛸 UFO Flight & Movement
                </h4>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Move Forward / Strafe</span>
                    <strong className="text-white font-mono">W / A / S / D or Arrows</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Ascend (Fly Up)</span>
                    <strong className="text-white font-mono">Space / E / Shift</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Descend (Fly Down)</span>
                    <strong className="text-white font-mono">Q / Ctrl / C</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Evasive Barrel Roll</span>
                    <strong className="text-white font-mono">R Key</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Boost / Nitro</span>
                    <strong className="text-white font-mono">Left Shift</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <h4 className="font-black text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  ⚡ Weapon Systems & Abduction
                </h4>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Tractor Beam (Abduct)</span>
                    <strong className="text-white font-mono">F1 Key</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Repulsor Pulse (Blast)</span>
                    <strong className="text-white font-mono">F2 Key</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Disintegrator Ray</span>
                    <strong className="text-white font-mono">F3 Key</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Grav Vortex Cyclotron</span>
                    <strong className="text-white font-mono">F4 Key</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Orbital Laser Strike</span>
                    <strong className="text-white font-mono">F5 Key</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-cyan-950/40 border border-cyan-500/40 p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-300">
                Press <strong className="text-white font-mono">[U]</strong> anytime to open Mothership Upgrades Bay & buy stats.
              </span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
                Release TAB to close
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modals and Overlays */}
      <AnimatePresence>
        {isSummoning && !showSummonerModal && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-cyan-500/50 rounded-full px-6 py-3 shadow-[0_0_30px_rgba(6,182,212,0.3)] flex items-center gap-3 backdrop-blur-md"
          >
            {summonStatus.includes('✅') ? null : <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />}
            <span className="text-cyan-300 font-mono text-sm font-bold tracking-wider uppercase">
              {summonStatus}
            </span>
          </motion.div>
        )}
        {showUpgradesModal && (
          <UpgradesModal
            telemetry={telemetry}
            onClose={() => setShowUpgradesModal(false)}
            onPurchaseUpgrade={onPurchaseUpgrade}
          />
        )}

        {showSummonerModal && (
          <div 
            onClick={() => setShowSummonerModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[85vh] bg-slate-950/95 border-2 border-cyan-500/60 rounded-3xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.35)] text-slate-100 flex flex-col gap-5 overflow-hidden cursor-default"
            >
              {/* Diegetic Alien UI Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-2xl" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                    <Sparkles className="animate-spin" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2">
                      🛸 Alien AI Matter Synthesizer Engine
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Gemini 3.6 Flash Voxel Engine • Deep Multi-Material Materialization Matrix
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSummonerModal(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/80 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer z-20 flex items-center gap-1.5 text-xs font-bold font-mono shadow-md"
                  title="Close Engine (Shortcut: X or ESC)"
                >
                  <X size={18} />
                  <span className="hidden sm:inline text-[10px] text-cyan-300">CLOSE [ESC / X]</span>
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setSummonerTab('forge')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                    summonerTab === 'forge'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Cpu size={15} />
                  <span>1. Synthesis Studio</span>
                </button>
                <button
                  onClick={() => setSummonerTab('manifest')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                    summonerTab === 'manifest'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Sparkles size={15} />
                  <span>2. Materialization Manifest ({activeObjectsList.length})</span>
                </button>
                <button
                  onClick={() => setSummonerTab('analysis')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                    summonerTab === 'analysis'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Wrench size={15} />
                  <span>3. Molecular Analysis</span>
                </button>
              </div>

              {/* TAB 1: FORGE STUDIO */}
              {summonerTab === 'forge' && (
                <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                  {/* Quick Presets */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Cpu size={14} /> Quick Synthesis Matrices:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "🤖 Cyber Battle Mech",
                        "🐉 Alien Neon Dragon",
                        "🏎️ Cyberpunk Hoverbike",
                        "🛸 Saucer Recon Companion",
                        "🍌 Giant Plasma Banana",
                        "🌌 Cosmic Monolith Portal"
                      ].map((preset, pIdx) => (
                        <button
                          key={`preset-${pIdx}-${preset}`}
                          onClick={() => setSummonPrompt(preset.replace(/^[^\w\s]+/, '').trim())}
                          className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Synthesis Parameter Customizer */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        🎨 Color & Style Theme
                      </label>
                      <select
                        value={styleScheme}
                        onChange={(e) => setStyleScheme(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs text-cyan-200 outline-none"
                      >
                        <option value="Neon Cyber">Neon Cyber</option>
                        <option value="Alien Bio-Luminescence">Alien Bio-Luminescence</option>
                        <option value="Stealth Obsidian">Stealth Obsidian</option>
                        <option value="Imperial Gold">Imperial Gold</option>
                        <option value="Exotic Plasma">Exotic Plasma</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        ⚡ Energy Core Engine
                      </label>
                      <select
                        value={energyCore}
                        onChange={(e) => setEnergyCore(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs text-cyan-200 outline-none"
                      >
                        <option value="Zero-Point Crystal">Zero-Point Crystal</option>
                        <option value="Dark Matter Reactor">Dark Matter Reactor</option>
                        <option value="Tachyon Singularity">Tachyon Singularity</option>
                        <option value="Quantum Fusion">Quantum Fusion</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        📐 Complexity Target
                      </label>
                      <select
                        value={complexity}
                        onChange={(e) => setComplexity(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs text-cyan-200 outline-none"
                      >
                        <option value="Compact (60 V)">Compact (60 Voxels)</option>
                        <option value="Standard (150 V)">Standard (150 Voxels)</option>
                        <option value="Colossal (250+ V)">Colossal Structure (250+ Voxels)</option>
                      </select>
                    </div>
                  </div>

                  {/* Prompt Input Form */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
                      <span>Describe Any Physical 3D Object To Summon:</span>
                      <span className="text-[10px] text-cyan-400 font-mono">100% Fully Editable</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        autoFocus
                        value={summonPrompt}
                        onChange={(e) => setSummonPrompt(e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={async (e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter' && !isSummoning && summonPrompt.trim()) {
                            if (!onSummonAIObject) return;
                            setIsSummoning(true);
                            setSummonStatus("⚡ Contacting Gemini AI Voxel Engine...");
                            setShowSummonerModal(false);
                            const res = await onSummonAIObject(summonPrompt, { styleScheme, energyCore, complexity });
                            if (res.success) {
                              setSummonStatus(`✅ Successfully materialized "${res.name}" into local physics world!`);
                              setTimeout(() => { setIsSummoning(false); setSummonStatus(""); }, 5000);
                            } else {
                              setSummonStatus(`❌ Synthesis error: ${res.error}`);
                              setShowSummonerModal(true);
                              setIsSummoning(false);
                            }
                          }
                        }}
                        onKeyUp={(e) => e.stopPropagation()}
                        placeholder="e.g. 'A futuristic plasma hover tank', 'A cute pet alien kitten', 'A giant laser turret'..."
                        className="w-full bg-slate-900/90 border-2 border-cyan-500/60 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/40 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <button
                      disabled={isSummoning || !summonPrompt.trim()}
                      onClick={async () => {
                        if (!onSummonAIObject || !summonPrompt.trim()) return;
                        setIsSummoning(true);
                        setSummonStatus("⚡ Contacting Gemini AI Voxel Engine...");
                        setShowSummonerModal(false);
                        const res = await onSummonAIObject(summonPrompt, { styleScheme, energyCore, complexity });
                        if (res.success) {
                          setSummonStatus(`✅ Successfully materialized "${res.name}" into local physics world!`);
                          setTimeout(() => { setIsSummoning(false); setSummonStatus(""); }, 5000);
                        } else {
                          setSummonStatus(`❌ Synthesis error: ${res.error}`);
                          setShowSummonerModal(true);
                          setIsSummoning(false);
                        }
                      }}
                      className={`w-full py-3.5 rounded-2xl font-black text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                        isSummoning || !summonPrompt.trim()
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 border border-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-98'
                      }`}
                    >
                      {isSummoning ? (
                        <>
                          <RefreshCw className="animate-spin" size={18} />
                          <span>Synthesizing Multi-Material Voxel Matrix...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>Materialize 3D Object Into World</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status Feed */}
                  {summonStatus && (
                    <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 font-mono flex items-start gap-2">
                      <span className="text-cyan-400">📡</span>
                      <span>{summonStatus}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ACTIVE MATERIALIZATIONS MANIFEST */}
              {summonerTab === 'manifest' && (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[50vh] pr-1">
                  {activeObjectsList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Sparkles size={30} className="text-slate-600" />
                      <span>No active materialized objects in the city simulation yet.</span>
                      <button
                        onClick={() => setSummonerTab('forge')}
                        className="mt-2 text-cyan-400 hover:underline font-bold"
                      >
                        Go to Synthesis Studio to create one!
                      </button>
                    </div>
                  ) : (
                    activeObjectsList.map((obj, idx) => (
                      <div
                        key={`manifest-obj-${obj.id || 'obj'}-${idx}`}
                        className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-md hover:border-cyan-400 transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wide flex items-center gap-2">
                              <span>🛸 {obj.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-mono">
                                {obj.distance}m away
                              </span>
                            </h3>
                            <p className="text-xs text-slate-400">{obj.description}</p>
                            
                            {/* Semantic Tags */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {obj.placementDomain && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-500/40 font-mono">
                                  🌐 {obj.placementDomain}
                                </span>
                              )}
                              {obj.locomotionType && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 font-mono">
                                  🏃 {obj.locomotionType}
                                </span>
                              )}
                              {obj.abilities && obj.abilities.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono">
                                  ⚡ {obj.abilities[0]}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded-lg">
                            {obj.energyOutput || '3.2 GW'}
                          </span>
                        </div>

                        {/* WOW-FACTOR FEATURE: POSSESS / BECOME OBJECT BUTTON */}
                        <button
                          onClick={() => {
                            if (onPossessAIObject?.(obj.id)) {
                              setSummonStatus(`✨ POSSESSED "${obj.name}"! You are now controlling this 3D construct.`);
                              setShowSummonerModal(false);
                            }
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 border border-amber-300"
                        >
                          <Sparkles size={16} className="animate-spin" />
                          <span>✨ POSSESS & BECOME THIS OBJECT!</span>
                        </button>

                        {/* Remote Action Controls */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            onClick={() => onRecallAIObject?.(obj.id)}
                            className="py-1.5 px-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <span>🧲 Recall</span>
                          </button>

                          <button
                            onClick={() => onOverchargeAIObject?.(obj.id)}
                            className="py-1.5 px-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <span>⚡ Overcharge</span>
                          </button>

                          <button
                            onClick={() => onTeleportToAIObject?.(obj.id)}
                            className="py-1.5 px-2 rounded-xl bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-teal-300 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <span>📍 Teleport</span>
                          </button>

                          <button
                            onClick={() => onDeconstructAIObject?.(obj.id)}
                            className="py-1.5 px-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <span>💥 Shatter</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: MOLECULAR ANALYSIS */}
              {summonerTab === 'analysis' && (
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[50vh] pr-1">
                  <div className="p-4 bg-slate-900/80 border border-cyan-500/30 rounded-2xl flex flex-col gap-3">
                    <h3 className="text-xs font-black text-cyan-300 uppercase tracking-widest flex items-center gap-2">
                      <Wrench size={16} /> Molecular Scan & Elemental Composition Matrix
                    </h3>
                    {activeObjectsList.length === 0 ? (
                      <p className="text-xs text-slate-400">Summon an object first to perform alien elemental analysis.</p>
                    ) : (
                      activeObjectsList.map((obj, oIdx) => (
                        <div key={`analysis-obj-${obj.id || 'item'}-${oIdx}`} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                            <span>{obj.name}</span>
                            <span className="text-cyan-400 font-mono">{obj.massKg || 180} kg • {obj.voxelCount || 120} Voxels</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {(obj.composition || [{ element: 'Hyper-Titanium', percentage: 100 }]).map((comp: any, idx: number) => (
                              <div key={`comp-${comp.element || 'elem'}-${idx}`} className="flex flex-col gap-1 text-[11px]">
                                <div className="flex justify-between text-slate-300 font-mono">
                                  <span>{comp.element}</span>
                                  <span className="text-cyan-300">{comp.percentage}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                                    style={{ width: `${comp.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
