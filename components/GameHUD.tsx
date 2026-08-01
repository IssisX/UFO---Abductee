/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { PlayerMode, GameModeTelemetry, WeaponMode, MothershipUpgrades } from '../types';
import { Rocket, User, Zap, Sparkles, X, Gauge, ArrowUp, RotateCw, Crown, Trophy, Target, Flame, Compass, ChevronUp, Video, Users, FlaskConical, Shield, Plus, Minus, Maximize2, Crosshair, Wrench, Coins, Cpu, RefreshCw } from 'lucide-react';
import { SimpsonsTVCartoon } from './SimpsonsTVCartoon';

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
      if (e.key === 'Tab') {
        e.preventDefault();
        setIsTabPressed(true);
      }
      if (e.key === 'u' || e.key === 'U') {
        setShowUpgradesModal(prev => !prev);
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
  }, [onSelectWeaponMode]);

  useEffect(() => {
    if (!leftActive) {
      onVirtualInputRef.current?.(0, 0, ascendInput, isNitro);
    }
  }, [ascendInput, isNitro, leftActive]);

  // Joystick drag logic
  const handleLeftStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setLeftActive(true);
  };

  useEffect(() => {
    if (!leftActive) {
      setLeftKnobPos({ x: 0, y: 0 });
      return;
    }

    const handleMove = (clientPt: { x: number; y: number }) => {
      if (!leftStickRef.current) return;
      const rect = leftStickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientPt.x - centerX;
      let dy = clientPt.y - centerY;
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

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      handleMove({ x: e.clientX, y: e.clientY });
    };
    const handleEnd = () => {
      setLeftActive(false);
      setLeftKnobPos({ x: 0, y: 0 });
      onVirtualInputRef.current?.(0, 0, ascendInput, isNitro);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [leftActive, ascendInput, isNitro]);

  const handleRightStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setRightActive(true);
  };

  useEffect(() => {
    if (!rightActive) {
      setRightKnobPos({ x: 0, y: 0 });
      return;
    }

    let prevX: number | null = null;
    let prevY: number | null = null;

    const handleMove = (clientPt: { x: number; y: number }) => {
      if (!rightStickRef.current) return;
      const rect = rightStickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientPt.x - centerX;
      let dy = clientPt.y - centerY;
      const maxRadius = rect.width / 2 - 10;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      setRightKnobPos({ x: dx, y: dy });

      if (prevX !== null && prevY !== null) {
        const deltaX = clientPt.x - prevX;
        const deltaY = clientPt.y - prevY;
        onRotateCameraRef.current?.(-deltaX * 0.008, deltaY * 0.008);
      }

      prevX = clientPt.x;
      prevY = clientPt.y;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      handleMove({ x: e.clientX, y: e.clientY });
    };
    const handleEnd = () => {
      setRightActive(false);
      setRightKnobPos({ x: 0, y: 0 });
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [rightActive]);

  const activeWeapon: WeaponMode = telemetry.weaponMode || 'tractor';

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-2 sm:p-4 select-none font-sans overflow-hidden touch-none"
    >
      {/* Wanted siren flash overlay */}
      {telemetry.wantedLevel > 0 && (
        <div className="absolute inset-0 pointer-events-none z-0 animate-pulse border-8 border-rose-600/40 bg-gradient-to-t from-rose-950/20 via-transparent to-rose-950/20" />
      )}

      {/* --- TOP HUD BAR --- */}
      <div className="relative z-10 flex items-start justify-between w-full max-w-7xl mx-auto gap-2">
        
        {/* Left: Mode & Vehicle Switcher & Controls Badge */}
        <div className={`flex flex-col gap-1.5 transition-all duration-500 ease-out delay-75 transform ${isAnimateIn ? 'translate-y-0 opacity-100' : '-translate-y-12 -translate-x-12 opacity-0'}`}>
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
        </div>

        {/* Center: Score, Credits, Energy & Wanted Level */}
        <div className={`flex flex-col items-center gap-1 pointer-events-none transition-all duration-500 ease-out delay-0 transform ${isAnimateIn ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-16 opacity-0 scale-95'}`}>
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
                <span key={starIndex} className={`text-xs font-black ${starIndex <= (telemetry.wantedLevel ?? 0) ? 'text-amber-400' : 'text-slate-700'}`}>
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
        </div>

        {/* Right: Upgrades Tab, Camera, Exit & Interactive Strategic Mini-map */}
        <div className={`flex flex-col items-end gap-1.5 transition-all duration-500 ease-out delay-150 transform ${isAnimateIn ? 'translate-y-0 translate-x-0 opacity-100' : '-translate-y-12 translate-x-12 opacity-0'}`}>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setInputPref(p => p === 'auto' ? 'keyboard' : p === 'keyboard' ? 'gamepad' : p === 'gamepad' ? 'touch' : 'auto')}
              className="bg-slate-800/90 text-slate-300 hover:bg-slate-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
              title="Lock Input Device Preference"
            >
              {inputPref === 'auto' ? 'Auto Input' : inputPref === 'keyboard' ? 'Key/Mouse' : inputPref === 'gamepad' ? 'Gamepad' : 'Touch'}
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

            {/* Exit Button */}
            <button
              onClick={onExitGameMode}
              className="bg-rose-600/90 hover:bg-rose-500 text-white font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border border-rose-400/30 active:scale-95 transition-all"
            >
              <X size={12} /> Exit
            </button>
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
                    key={idx}
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
                      key={idx}
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
                      key={idx}
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
                      key={idx}
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
                    key={idx}
                    className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
                    style={{ transform: `translate(${px}px, ${py}px)` }}
                  />
                );
              })}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* --- CENTRAL RETICLE TARGET LOCK OVERLAY --- */}
      {isUFO && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-2 transition-all duration-500 ease-out transform ${isAnimateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
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
        </div>
      )}

      {/* --- BOTTOM WEAPONS HOTBAR & MOVEMENT JOYSTICKS --- */}
      <div className="w-full max-w-7xl mx-auto flex items-end justify-between gap-2 mt-auto pointer-events-auto">
        {/* Left Joystick or Keyboard Hint */}
        {deviceType === 'touch' ? (
          <div className="flex flex-col items-center gap-1 transition-all duration-500 ease-out transform pointer-events-auto">
            <div
              ref={leftStickRef}
              onMouseDown={handleLeftStart}
              onTouchStart={handleLeftStart}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-indigo-500/50 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing"
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
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          {/* FLIGHT SIMULATOR ARTIFICIAL HORIZON & JET LOCK OVERLAY */}
          {isUFO && (
            <div className="pointer-events-none mb-1 flex flex-col items-center justify-center gap-1">
              {/* Air Force Jet Target Lock Banner */}
              {telemetry.targetJetName && (
                <div className="bg-slate-950/90 border-2 border-rose-500 text-rose-400 px-3 py-1 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto">
                  <Crosshair size={16} className="text-rose-500 animate-spin" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">
                      AIR FORCE JET LOCK: {telemetry.targetJetName} ({telemetry.targetJetDist}M)
                    </span>
                    <span className="text-[9px] text-amber-300 font-mono">
                      PRESS [F] TO LAUNCH HOMING PLASMA TORPEDO
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
          <div className="bg-slate-950/90 backdrop-blur-xl p-1.5 rounded-2xl border border-cyan-500/50 shadow-2xl flex items-center gap-1.5">
            {[
              { id: 'tractor', name: 'Tractor Beam', key: 'F1', color: 'from-cyan-500 to-blue-600', icon: '🧲' },
              { id: 'repulsor', name: 'Repulsor Pulse', key: 'F2', color: 'from-orange-500 to-red-600', icon: '💥' },
              { id: 'disintegrator', name: 'Disintegrator Ray', key: 'F3', color: 'from-fuchsia-500 to-purple-600', icon: '⚡' },
              { id: 'vortex', name: 'Grav Tornado', key: 'F4', color: 'from-emerald-500 to-teal-600', icon: '🌀' },
              { id: 'orbital_laser', name: 'Orbital Laser', key: 'F5', color: 'from-rose-600 to-amber-600', icon: '☄️' },
            ].map((wp) => {
              const isActive = activeWeapon === wp.id;
              return (
                <button
                  key={wp.id}
                  onClick={() => onSelectWeaponMode?.(wp.id as WeaponMode)}
                  className={`relative px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 border ${
                    isActive
                      ? `bg-gradient-to-r ${wp.color} text-white border-white shadow-lg scale-105`
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{wp.icon}</span>
                  <span className="hidden sm:inline">{wp.name}</span>
                  {telemetry.lastInputDevice !== 'gamepad' && (
                    <span className="text-[9px] bg-slate-950/80 px-1 py-0.5 rounded text-cyan-300 border border-cyan-500/30 font-mono">
                      [{wp.key}]
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Fire Action, Nitro, Barrel Roll, Mutant & Jump Bar */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setIsNitro(!isNitro)}
              className={`px-2.5 py-1.5 rounded-xl font-black text-xs text-white shadow-xl flex items-center gap-1 border ${
                isNitro
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-300 animate-pulse'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300'
              }`}
            >
              <Flame size={14} /> Nitro {deviceType === 'mouseKeyboard' ? '[Shift]' : deviceType === 'gamepad' ? '[LT]' : ''}
            </button>

            {/* Evasive Barrel Roll Button */}
            {isUFO && (
              <button
                onClick={() => onBarrelRoll?.()}
                className={`px-2.5 py-1.5 rounded-xl font-black text-xs shadow-xl flex items-center gap-1 border transition-all ${
                  telemetry.isBarrelRolling
                    ? 'bg-sky-500 text-white border-white animate-spin scale-110'
                    : 'bg-gradient-to-r from-sky-600 to-blue-700 border-sky-400 text-white hover:scale-105 active:scale-95'
                }`}
                title="Perform 360° Evasive Corkscrew Roll"
              >
                <RefreshCw size={14} className={telemetry.isBarrelRolling ? 'animate-spin' : ''} />
                <span>ROLL {deviceType === 'mouseKeyboard' ? '[R]' : deviceType === 'gamepad' ? '[B]' : ''}</span>
              </button>
            )}

            {/* Bio-Specimens Mutant Deployment Button */}
            <button
              disabled={(telemetry.bioSpecimens ?? 0) < 3}
              onClick={() => onDeployMutant?.()}
              className={`px-2.5 py-1.5 rounded-xl font-black text-xs shadow-xl flex items-center gap-1 border transition-all ${
                (telemetry.bioSpecimens ?? 0) >= 3
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-300 text-white animate-bounce active:scale-95'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Requires 3 Bio-Specimens"
            >
              <FlaskConical size={14} className={(telemetry.bioSpecimens ?? 0) >= 3 ? 'text-emerald-300 animate-spin' : ''} />
              <span>MUTANT ({(telemetry.bioSpecimens ?? 0)}/3)</span>
            </button>

            {isFlying ? (
              <div className={`flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 ${deviceType !== 'touch' ? 'hidden' : ''}`}>
                <button
                  onMouseDown={() => setAscendInput(1)}
                  onMouseUp={() => setAscendInput(0)}
                  onTouchStart={() => setAscendInput(1)}
                  onTouchEnd={() => setAscendInput(0)}
                  className="px-2.5 py-1.5 bg-cyan-600 text-white font-black text-[11px] rounded-lg flex items-center gap-1"
                >
                  <ChevronUp size={14} /> Fly Up
                </button>
                <button
                  onMouseDown={() => setAscendInput(-1)}
                  onMouseUp={() => setAscendInput(0)}
                  onTouchStart={() => setAscendInput(-1)}
                  onTouchEnd={() => setAscendInput(0)}
                  className="px-2.5 py-1.5 bg-indigo-700 text-white font-black text-[11px] rounded-lg flex items-center gap-1"
                >
                  <ChevronUp size={14} className="rotate-180" /> Fly Down
                </button>
              </div>
            ) : (
              <button
                onClick={() => onJump && onJump()}
                className="px-3.5 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl flex items-center gap-1"
              >
                <ArrowUp size={14} /> JUMP [Space]
              </button>
            )}

            <button
              onClick={onTriggerAction}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-xl flex items-center gap-1.5 border border-cyan-300 active:scale-95 transition-all"
            >
              <Zap size={15} className="animate-bounce" />
              <span>FIRE {deviceType === 'mouseKeyboard' ? '[F]' : deviceType === 'gamepad' ? '[X]' : ''}</span>
            </button>
          </div>
        </div>

        {/* Right Camera Stick or Mouse Hint */}
        {deviceType === 'touch' ? (
          <div className="flex flex-col items-center gap-1 transition-all duration-500 ease-out transform pointer-events-auto">
            <div
              ref={rightStickRef}
              onMouseDown={handleRightStart}
              onTouchStart={handleRightStart}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-cyan-500/50 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing"
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
          </div>
        ) : (
          <div className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] text-slate-200 font-bold shadow-lg">
            Hold [TAB] for Full Control Scheme
          </div>
        )}
      </div>

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

      {/* --- MOTHERSHIP UPGRADES HUD DRAWER MODAL --- */}
      {showUpgradesModal && (
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
                  onClick={() => setShowUpgradesModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Upgrade Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { key: 'beamForce', name: 'Tractor Beam Lift', desc: 'Increases abduction lifting force and pull speed.', icon: '🧲' },
                { key: 'engineSpeed', name: 'Hyper-Thrusters', desc: 'Increases top speed and maneuverability.', icon: '🚀' },
                { key: 'repulsorRadius', name: 'Repulsor Shockwave', desc: 'Expands kinetic blast radius & explosion force.', icon: '💥' },
                { key: 'disintegratorPower', name: 'Disintegrator Ray', desc: 'Increases voxel dissolution & building melt rate.', icon: '⚡' },
                { key: 'vortexRange', name: 'Grav-Vortex Cyclotron', desc: 'Expands orbital cyclone pull radius & spin torque.', icon: '🌀' },
                { key: 'energyCore', name: 'Zero-Point Energy', desc: 'Increases max energy capacity & regen rate.', icon: '🔋' },
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
                              lvl <= currentLvl ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-slate-800'
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
      )}
    </div>
  );
};
