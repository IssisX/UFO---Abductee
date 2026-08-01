/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { PlayerMode, GameModeTelemetry } from '../types';
import { Rocket, Cat, Bird, Zap, Sparkles, X, Gauge, ArrowUp, RotateCcw, RotateCw, Crown, Trophy, Target, Flame, Compass, ChevronUp, Video, Users, FlaskConical } from 'lucide-react';
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
}) => {
  const isUFO = playerMode === 'UFO';
  const isCat = playerMode === 'Cat';
  const isFlying = playerMode === 'UFO' || playerMode === 'Eagle';

  // --- LEFT ANALOG STICK STATE (MOVEMENT) ---
  const leftStickRef = useRef<HTMLDivElement>(null);
  const [leftActive, setLeftActive] = useState(false);
  const [leftKnobPos, setLeftKnobPos] = useState({ x: 0, y: 0 });

  // --- RIGHT ANALOG STICK STATE (CAMERA LOOK) ---
  const rightStickRef = useRef<HTMLDivElement>(null);
  const [rightActive, setRightActive] = useState(false);
  const [rightKnobPos, setRightKnobPos] = useState({ x: 0, y: 0 });

  // --- HUD DISPLAY MODES & COLLAPSIBLE PANELS ---
  const [hudMode, setHudMode] = useState<'full' | 'compact' | 'minimal'>('compact'); // Default to compact for pristine 3D view
  const [showJoysticks, setShowJoysticks] = useState<boolean>(false);
  const [isMissionCollapsed, setIsMissionCollapsed] = useState<boolean>(false);

  // Keyboard shortcut [H] to toggle HUD mode & [V] for camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setHudMode(prev => (prev === 'full' ? 'compact' : prev === 'compact' ? 'minimal' : 'full'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- LEFT JOYSTICK DRAG HANDLERS ---
  const handleLeftStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setLeftActive(true);
  };

  useEffect(() => {
    if (!leftActive) {
      setLeftKnobPos({ x: 0, y: 0 });
      if (onVirtualInput) onVirtualInput(0, 0, ascendInput, isNitro);
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

      // Calculate normalized fwd (-1 to +1) and strafe (-1 to +1)
      const normStrafe = dx / maxRadius;
      const normFwd = -dy / maxRadius; // invert Y for screen space

      if (onVirtualInput) {
        onVirtualInput(normFwd, normStrafe, ascendInput, isNitro);
      }
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
      if (onVirtualInput) onVirtualInput(0, 0, ascendInput, isNitro);
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
  }, [leftActive, ascendInput, isNitro, onVirtualInput]);

  // --- RIGHT JOYSTICK DRAG HANDLERS (CAMERA) ---
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

        if (onRotateCamera) {
          onRotateCamera(-deltaX * 0.008, deltaY * 0.008);
        }
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
  }, [rightActive, onRotateCamera]);

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-2 sm:p-4 select-none font-sans overflow-hidden touch-none"
    >
      
      {/* --- FLASHING POLICE SIREN OVERLAY WHEN WANTED --- */}
      {telemetry.wantedLevel > 0 && (
        <div className="absolute inset-0 pointer-events-none z-0 animate-pulse border-8 border-rose-600/40 bg-gradient-to-t from-rose-950/20 via-transparent to-rose-950/20" />
      )}

      {/* --- MINIMAL HUD MODE FLOATING PILL --- */}
      {hudMode === 'minimal' ? (
        <div className="relative z-10 w-full flex justify-between items-center max-w-5xl mx-auto pt-1">
          <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-cyan-500/40 text-white flex items-center gap-3 shadow-xl text-xs">
            <span className="font-black text-cyan-300 font-mono">{(telemetry.score ?? 0).toLocaleString()} PTS</span>
            <span className="w-px h-3 bg-slate-700" />
            <span className="text-[10px] font-bold text-slate-300 uppercase">UFO Sandbox</span>
          </div>

          <button
            onClick={() => setHudMode('compact')}
            className="pointer-events-auto bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg border border-indigo-400/40 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Gauge size={14} /> Show HUD [H]
          </button>
        </div>
      ) : (
        <>
          {/* --- TOP HUD BAR --- */}
          <div className="relative z-10 flex items-start justify-between w-full max-w-7xl mx-auto gap-2">
            
            {/* Left: Player Mode & Vehicle Switcher */}
            <div className="flex flex-col gap-1.5">
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white border border-indigo-500/40 px-3 py-1.5 rounded-2xl shadow-xl flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow">
                  {isUFO ? <Rocket className="text-cyan-300 animate-pulse" size={16} /> : isCat ? <Cat className="text-amber-300" size={16} /> : <Bird className="text-emerald-300" size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                      {isFlying ? '3D Aerial Sandbox' : 'GTA Ground Explorer'}
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black text-white">
                    {isUFO ? '🛸 Cyber UFO' : isCat ? '🐱 Meow City' : '🦅 Eagle View'}
                  </h2>
                </div>
              </div>

              {/* Quick Vehicle Switcher */}
              <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-lg self-start">
                <button
                  onClick={() => onSelectPlayerMode('UFO')}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] transition-all ${
                    playerMode === 'UFO' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Rocket size={12} /> UFO
                </button>
                <button
                  onClick={() => onSelectPlayerMode('Cat')}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] transition-all ${
                    playerMode === 'Cat' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Cat size={12} /> Cat
                </button>
                <button
                  onClick={() => onSelectPlayerMode('Eagle')}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] transition-all ${
                    playerMode === 'Eagle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Bird size={12} /> Eagle
                </button>
              </div>
            </div>

            {/* Center: Score, Wanted Stars, Energy, & Camera Badge */}
            <div className="flex flex-col items-center gap-1 pointer-events-none">
              {/* Cinematic Camera Active Badge */}
              {telemetry.isCinematicCamera && (
                <div className="bg-purple-950/80 border border-purple-500/50 text-cyan-300 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shadow flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  🎥 CINEMATIC CAM
                </div>
              )}

              {/* GTA Wanted Stars Bar */}
              {(telemetry.wantedLevel ?? 0) > 0 && (
                <div className="bg-slate-950/90 border border-rose-500/80 px-3 py-0.5 rounded-full shadow flex items-center gap-1 animate-pulse">
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest mr-1">WANTED</span>
                  {[1, 2, 3, 4, 5].map((starIndex) => (
                    <span key={starIndex} className={`text-xs font-black ${starIndex <= (telemetry.wantedLevel ?? 0) ? 'text-amber-400' : 'text-slate-700'}`}>
                      ★
                    </span>
                  ))}
                </div>
              )}

              <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/50 px-4 py-1.5 rounded-2xl shadow-xl flex items-center gap-3 text-white">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                  <span className="text-sm sm:text-lg font-black text-cyan-300 font-mono">{(telemetry.score ?? 0).toLocaleString()}</span>
                </div>

                {(telemetry.comboMultiplier ?? 1) > 1 && (
                  <div className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-black text-[10px] text-white shadow animate-bounce flex items-center gap-1">
                    <Flame size={12} /> {telemetry.comboMultiplier}x
                  </div>
                )}

                <div className="h-6 w-px bg-slate-700/80" />

                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                    <Crown size={9} /> Best
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">{(telemetry.highScore ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Nitro Energy Bar */}
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

            {/* Right: Controls, HUD Mode, Simpsons TV & Minimap */}
            <div className="flex flex-col items-end gap-1.5">
              {/* Top Control Bar */}
              <div className="flex items-center gap-1.5">
                {/* HUD Mode Switcher Toggle */}
                <button
                  onClick={() => setHudMode(prev => (prev === 'full' ? 'compact' : prev === 'compact' ? 'minimal' : 'full'))}
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-auto bg-slate-800/90 hover:bg-slate-700 text-cyan-300 font-black text-[10px] px-2.5 py-1.5 rounded-xl border border-cyan-500/30 flex items-center gap-1 shadow active:scale-95 transition-all"
                  title="Toggle HUD Mode [H]"
                >
                  <Gauge size={12} /> HUD: {hudMode.toUpperCase()}
                </button>

                {/* Touch Joysticks Toggle */}
                <button
                  onClick={() => setShowJoysticks(!showJoysticks)}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`pointer-events-auto font-black text-[10px] px-2.5 py-1.5 rounded-xl border flex items-center gap-1 shadow active:scale-95 transition-all ${
                    showJoysticks
                      ? 'bg-cyan-600 text-white border-cyan-300'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="Toggle Touch Joysticks"
                >
                  🕹️ STICKS
                </button>

                {/* Cinematic Camera Toggle Button */}
                {onToggleCinematicCamera && (
                  <button
                    onClick={onToggleCinematicCamera}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`pointer-events-auto font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border active:scale-95 transition-all ${
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
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-auto bg-rose-600/90 hover:bg-rose-500 text-white font-black text-[10px] px-2.5 py-1.5 rounded-xl shadow flex items-center gap-1 border border-rose-400/30 active:scale-95 transition-all"
                >
                  <X size={12} /> Exit
                </button>
              </div>

              {/* Simpsons CRT TV Cartoon Window & Abduction Stats */}
              {isUFO && (
                <div className="flex flex-col items-end gap-1">
                  {/* Simpsons TV Frame */}
                  <div className="pointer-events-auto shadow-2xl transition-all duration-300">
                    <SimpsonsTVCartoon abductionTriggerTime={telemetry.abductionTriggerTime} />
                  </div>

                  {/* Abduction Stats & Scanner Badge */}
                  <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 px-2 py-1 rounded-xl shadow flex items-center gap-2 text-white">
                    <div className="flex items-center gap-1 text-[9px] font-black uppercase text-cyan-200">
                      <Users size={12} className="text-cyan-300 animate-pulse" />
                      <span>ABDUCTED: <strong className="text-amber-300 font-mono">{telemetry.abductedCount ?? 0}</strong></span>
                    </div>

                    {telemetry.nearestPedestrianDist !== null && telemetry.nearestPedestrianDist !== undefined && (
                      <div className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Target size={10} className="animate-spin text-amber-400" />
                        <span>{telemetry.nearestPedestrianDist}m</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cyberpunk Circular Radar Minimap */}
              <div className="pointer-events-auto relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-950/90 backdrop-blur-md border border-cyan-500/60 shadow-xl overflow-hidden flex items-center justify-center">
                {/* Grid concentric rings */}
                <div className="absolute inset-1.5 rounded-full border border-cyan-500/20" />
                <div className="absolute inset-5 rounded-full border border-cyan-500/20" />
                <div className="absolute w-full h-0.5 bg-cyan-500/20" />
                <div className="absolute h-full w-0.5 bg-cyan-500/20" />

                {/* Sweep radar line animation */}
                <div className="absolute w-1/2 h-0.5 bg-gradient-to-r from-transparent to-cyan-400 origin-left animate-spin" style={{ animationDuration: '3s' }} />

                {/* Center Player Icon */}
                <div className="relative z-10 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-emerald-100 shadow-[0_0_6px_rgba(52,211,153,1)]" />

                {/* Radar Blips */}
                {telemetry.radarBlips && telemetry.radarBlips.map((blip, idx) => {
                  const px = blip.x * 40;
                  const py = blip.z * 40;
                  const colorClass = 
                    blip.type === 'police'
                      ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,1)] animate-ping'
                      : blip.type === 'person'
                      ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,1)] animate-pulse'
                      : blip.type === 'crystal'
                      ? 'bg-cyan-300 shadow-[0_0_4px_rgba(103,232,249,1)]'
                      : blip.type === 'fish'
                      ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,1)]'
                      : blip.type === 'feather'
                      ? 'bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,1)]'
                      : 'bg-slate-400 shadow-[0_0_4px_rgba(148,163,184,0.8)]';

                  return (
                    <div
                      key={idx}
                      className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
                      style={{ transform: `translate(${px}px, ${py}px)` }}
                    />
                  );
                })}
              </div>

              {/* Active Mission/Quest Card (Collapsible) */}
              {telemetry.activeQuest && (
                <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-indigo-500/30 p-2 rounded-2xl shadow-xl max-w-xs text-white">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase text-indigo-400 flex items-center gap-1">
                      <Target size={10} /> Mission
                    </span>
                    <button
                      onClick={() => setIsMissionCollapsed(!isMissionCollapsed)}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <ChevronUp size={12} className={`transition-transform ${isMissionCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {!isMissionCollapsed && (
                    <>
                      <h4 className="text-xs font-black text-white">{telemetry.activeQuest.title}</h4>
                      <p className="text-[10px] text-slate-300 mb-1">{telemetry.activeQuest.description}</p>

                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (telemetry.activeQuest.progress / telemetry.activeQuest.target) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[8px] font-mono font-bold text-right text-indigo-300 mt-0.5">
                        {telemetry.activeQuest.progress} / {telemetry.activeQuest.target}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- HUMOROUS ALIEN TEST LOG BANNER --- */}
      {telemetry.alienTestLog && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 text-cyan-300 font-mono text-xs px-5 py-2.5 rounded-2xl shadow-2xl border border-cyan-400 flex items-center gap-2 animate-bounce">
          <FlaskConical size={16} className="text-amber-400 animate-spin" />
          <span className="font-bold">{telemetry.alienTestLog}</span>
        </div>
      )}

      {/* --- QUEST COMPLETED FLASH BANNER --- */}
      {telemetry.questCompletedFlash && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-2xl border border-emerald-300 animate-bounce flex items-center gap-2">
          <Trophy size={16} className="text-amber-300 animate-spin" />
          <span>{telemetry.questCompletedFlash}</span>
        </div>
      )}

      {/* --- BOTTOM CONTROLS BAR (CLEAN, COMPACT, OPTIONAL JOYSTICKS) --- */}
      {hudMode !== 'minimal' && (
        <div className="w-full max-w-7xl mx-auto flex items-end justify-between gap-2 mt-auto">
          
          {/* LEFT DUAL JOYSTICK (SHOWN ONLY IF showJoysticks OR hudMode === 'full') */}
          {(showJoysticks || hudMode === 'full') ? (
            <div className="pointer-events-auto flex flex-col items-center gap-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-indigo-500/30">
                🕹️ Move Stick
              </div>

              <div
                ref={leftStickRef}
                onMouseDown={handleLeftStart}
                onTouchStart={handleLeftStart}
                className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-indigo-500/50 shadow-xl flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              >
                <div className="absolute w-full h-0.5 bg-indigo-500/20" />
                <div className="absolute h-full w-0.5 bg-indigo-500/20" />
                <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-dashed border-indigo-400/30" />

                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 border border-indigo-300 shadow-lg flex items-center justify-center text-white transition-transform duration-75 ${
                    leftActive ? 'scale-110 border-cyan-300' : ''
                  }`}
                  style={{
                    transform: `translate(${leftKnobPos.x * 0.8}px, ${leftKnobPos.y * 0.8}px)`
                  }}
                >
                  <Compass size={18} className={leftActive ? "animate-spin text-cyan-200" : "text-indigo-200"} />
                </div>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 font-bold flex items-center gap-2">
              <span className="text-cyan-400 font-mono">WASD</span> Fly / Walk
            </div>
          )}

          {/* CENTER QUICK ACTION CONTROLS */}
          <div className="pointer-events-auto flex flex-wrap justify-center items-center gap-1.5">
            {/* Turbo Nitro Toggle Button */}
            <button
              onClick={() => setIsNitro(!isNitro)}
              onContextMenu={(e) => e.preventDefault()}
              className={`px-3.5 py-2 rounded-xl font-black text-xs text-white shadow-xl flex items-center gap-1.5 border active:scale-95 transition-all ${
                isNitro
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-300 shadow-amber-500/50 animate-pulse'
                  : 'bg-slate-900/90 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Flame size={14} className={isNitro ? "text-amber-200 animate-bounce" : "text-slate-400"} />
              <span>NITRO [Shift]</span>
            </button>

            {/* Flight Ascend / Jump Controls */}
            {isFlying ? (
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 shadow">
                <button
                  onMouseDown={() => setAscendInput(1)}
                  onMouseUp={() => setAscendInput(0)}
                  onTouchStart={() => setAscendInput(1)}
                  onTouchEnd={() => setAscendInput(0)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] rounded-lg shadow flex items-center gap-1 active:scale-90 transition-all"
                >
                  <ChevronUp size={14} /> Fly Up
                </button>
                <button
                  onMouseDown={() => setAscendInput(-1)}
                  onMouseUp={() => setAscendInput(0)}
                  onTouchStart={() => setAscendInput(-1)}
                  onTouchEnd={() => setAscendInput(0)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-black text-[11px] rounded-lg shadow flex items-center gap-1 active:scale-90 transition-all"
                >
                  <ChevronUp size={14} className="rotate-180" /> Fly Down
                </button>
              </div>
            ) : (
              <button
                onClick={() => onJump && onJump()}
                onContextMenu={(e) => e.preventDefault()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow flex items-center gap-1 active:scale-90 transition-all border border-emerald-400/30"
              >
                <ArrowUp size={14} /> JUMP [Space]
              </button>
            )}

            {/* Ability / EMP Action Button */}
            <button
              onClick={onTriggerAction}
              onContextMenu={(e) => e.preventDefault()}
              className={`px-4 py-2 rounded-xl font-black text-xs text-white shadow-xl flex items-center gap-1.5 border active:scale-90 transition-all ${
                isUFO
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-300 shadow-cyan-500/40'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-300 shadow-amber-500/40'
              }`}
            >
              {isUFO ? <Zap size={14} className="animate-bounce" /> : <Sparkles size={14} />}
              <span>{isUFO ? 'ABDUCT / EMP [F]' : 'MEOW [F]'}</span>
            </button>
          </div>

          {/* RIGHT DUAL JOYSTICK (SHOWN ONLY IF showJoysticks OR hudMode === 'full') */}
          {(showJoysticks || hudMode === 'full') ? (
            <div className="pointer-events-auto flex flex-col items-center gap-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                🎥 Cam Stick
              </div>

              <div
                ref={rightStickRef}
                onMouseDown={handleRightStart}
                onTouchStart={handleRightStart}
                className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-950/80 backdrop-blur-lg border border-cyan-500/50 shadow-xl flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              >
                <div className="absolute w-full h-0.5 bg-cyan-500/20" />
                <div className="absolute h-full w-0.5 bg-cyan-500/20" />
                <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-dashed border-cyan-400/30" />

                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 border border-cyan-300 shadow-lg flex items-center justify-center text-white transition-transform duration-75 ${
                    rightActive ? 'scale-110 border-indigo-300' : ''
                  }`}
                  style={{
                    transform: `translate(${rightKnobPos.x * 0.8}px, ${rightKnobPos.y * 0.8}px)`
                  }}
                >
                  <RotateCw size={16} className={rightActive ? "animate-spin text-cyan-100" : "text-cyan-200"} />
                </div>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 font-bold flex items-center gap-2">
              <span className="text-cyan-400 font-mono">Mouse / Touch Drag</span> Orbit Camera
            </div>
          )}

        </div>
      )}
    </div>
  );
};
