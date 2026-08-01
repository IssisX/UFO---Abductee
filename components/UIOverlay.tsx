/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect, useRef } from 'react';
import { AppState, SavedModel, VoxelData, AIModelId, AI_MODELS, AnimationState, PlayerMode } from '../types';
import { Box, Bird, Cat, Rabbit, Users, Code2, Wand2, Hammer, FolderOpen, ChevronUp, FileJson, History, Play, Pause, Info, Wrench, Loader2, Cpu, Zap, Check, Trash2, SkipBack, SkipForward, Flame, Heart, Sparkles, Repeat, Layers, PlayCircle, FastForward, Gamepad2, Rocket } from 'lucide-react';

interface UIOverlayProps {
  voxelCount: number;
  appState: AppState;
  currentBaseModel: string;
  customBuilds: SavedModel[];
  customRebuilds: SavedModel[];
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  selectedModel: AIModelId;
  onSelectModel: (modelId: AIModelId) => void;
  onDismantle: () => void;
  onSupernova: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onRebuildCurrent: () => void;
  onNewScene: (type: 'Eagle') => void;
  onSelectCustomBuild: (model: SavedModel) => void;
  onSelectCustomRebuild: (model: SavedModel) => void;
  onDeleteCustomBuild?: (index: number) => void;
  onDeleteCustomRebuild?: (index: number) => void;
  onPromptCreate: () => void;
  onPromptMorph: () => void;
  onShowJson: () => void;
  onImportJson: () => void;
  onToggleRotation: () => void;
  onToggleInfo: () => void;

  // Animation Engine Props
  animState: AnimationState;
  onPlayPauseAnim: () => void;
  onSetAnimFrame: (frame: number) => void;
  onSetAnimFps: (fps: number) => void;
  onToggleAnimInterpolation: () => void;
  onToggleAnimLoop: () => void;
  onAnimateCurrentModel: (type: 'fly' | 'walk' | 'pulse' | 'float' | 'spin') => void;
  onSelectAnimatedPreset: (preset: 'AnimatedEagle' | 'AnimatedCat' | 'AnimatedHeart' | 'AnimatedUFO' | 'AnimatedFire') => void;

  // Game Mode Props
  onEnterGameMode: (playerMode: PlayerMode) => void;
}

const LOADING_MESSAGES = [
    "Crafting voxels...",
    "Designing structure...",
    "Calculating physics...",
    "Mixing colors...",
    "Assembling geometry...",
    "Applying polish..."
];

export const UIOverlay: React.FC<UIOverlayProps> = ({
  voxelCount,
  appState,
  currentBaseModel,
  customBuilds,
  customRebuilds,
  isAutoRotate,
  isInfoVisible,
  isGenerating,
  selectedModel,
  onSelectModel,
  onDismantle,
  onSupernova,
  onRebuild,
  onRebuildCurrent,
  onNewScene,
  onSelectCustomBuild,
  onSelectCustomRebuild,
  onDeleteCustomBuild,
  onDeleteCustomRebuild,
  onPromptCreate,
  onPromptMorph,
  onShowJson,
  onImportJson,
  onToggleRotation,
  onToggleInfo,

  animState,
  onPlayPauseAnim,
  onSetAnimFrame,
  onSetAnimFps,
  onToggleAnimInterpolation,
  onToggleAnimLoop,
  onAnimateCurrentModel,
  onSelectAnimatedPreset,

  onEnterGameMode
}) => {
  const isStable = appState === AppState.STABLE;
  const isDismantling = appState === AppState.DISMANTLING;
  const isRebuilding = appState === AppState.REBUILDING;
  
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAnimateMenuOpen, setIsAnimateMenuOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const animateMenuRef = useRef<HTMLDivElement>(null);
  const gameMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGenerating) {
        const interval = setInterval(() => {
            setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2000);
        return () => clearInterval(interval);
    } else {
        setLoadingMsgIndex(0);
    }
  }, [isGenerating]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
            setIsModelMenuOpen(false);
        }
        if (animateMenuRef.current && !animateMenuRef.current.contains(event.target as Node)) {
            setIsAnimateMenuOpen(false);
        }
        if (gameMenuRef.current && !gameMenuRef.current.contains(event.target as Node)) {
            setIsGameMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Only show default presets if the current model is the original Eagle
  const isEagle = currentBaseModel === 'Eagle';
  const currentModelOption = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none">
      
      {/* --- Top Bar (Stats & Tools) --- */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-3">
        
        {/* Global Scene Controls */}
        <div className="pointer-events-auto flex flex-col gap-2">
            <DropdownMenu 
                icon={<FolderOpen size={20} />}
                label="Builds"
                color="indigo"
            >
                <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">STATIC BUILDS</div>
                <DropdownItem onClick={() => onNewScene('Eagle')} icon={<Bird size={16}/>} label="Eagle" />
                <DropdownItem onClick={onPromptCreate} icon={<Wand2 size={16}/>} label="New build" highlight />
                <div className="h-px bg-slate-100 my-1" />

                <div className="px-2 py-1 text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={12} /> 3D ANIMATED MODELS
                </div>
                <DropdownItem onClick={() => onSelectAnimatedPreset('AnimatedEagle')} icon={<Bird size={16}/>} label="Flapping Eagle" highlight />
                <DropdownItem onClick={() => onSelectAnimatedPreset('AnimatedCat')} icon={<Cat size={16}/>} label="Walking Cat" highlight />
                <DropdownItem onClick={() => onSelectAnimatedPreset('AnimatedHeart')} icon={<Heart size={16}/>} label="Pulsing Heart" highlight />
                <DropdownItem onClick={() => onSelectAnimatedPreset('AnimatedUFO')} icon={<Sparkles size={16}/>} label="Hovering UFO" highlight />
                <DropdownItem onClick={() => onSelectAnimatedPreset('AnimatedFire')} icon={<Flame size={16}/>} label="Dancing Campfire" highlight />
                <div className="h-px bg-slate-100 my-1" />
                
                {customBuilds.length > 0 && (
                    <>
                        <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">YOUR CREATIONS</div>
                        {customBuilds.map((model, idx) => (
                            <DropdownItem 
                                key={`build-${idx}`} 
                                onClick={() => onSelectCustomBuild(model)} 
                                onDelete={onDeleteCustomBuild ? (e) => { e.stopPropagation(); onDeleteCustomBuild(idx); } : undefined}
                                icon={model.isAnimated ? <Sparkles size={16} className="text-purple-500" /> : <History size={16}/>} 
                                label={model.name} 
                                truncate
                            />
                        ))}
                        <div className="h-px bg-slate-100 my-1" />
                    </>
                )}

                <DropdownItem onClick={onImportJson} icon={<FileJson size={16}/>} label="Import JSON" />
            </DropdownMenu>

            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm shadow-sm rounded-xl border border-slate-200 text-slate-500 font-bold w-fit mt-2">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                    <Box size={16} strokeWidth={3} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Voxels</span>
                    <span className="text-lg text-slate-800 font-extrabold font-mono">{voxelCount}</span>
                </div>
            </div>
        </div>

        {/* Utilities & AI Model Dropdown */}
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
            
            {/* AI Model Cohesive Selector Dropdown */}
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-md border-b-[3px] border-indigo-900 active:border-b-0 active:translate-y-[3px] font-bold text-xs sm:text-sm transition-all"
              >
                <span className="p-1 rounded-md bg-white/20">
                  {currentModelOption.id === 'gemini-3.6-flash' ? <Zap size={14} fill="currentColor" /> : <Cpu size={14} />}
                </span>
                <span className="font-extrabold">{currentModelOption.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 font-mono hidden md:inline-block">
                  {currentModelOption.badge}
                </span>
                <ChevronUp size={14} className={`transition-transform duration-200 ${isModelMenuOpen ? '' : 'rotate-180'}`} />
              </button>

              {isModelMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Select Active AI Model
                  </div>
                  {AI_MODELS.map((model) => {
                    const isSelected = model.id === selectedModel;
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          onSelectModel(model.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`
                          w-full flex items-start justify-between p-2.5 rounded-xl text-left transition-all
                          ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}
                        `}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-lg mt-0.5 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {model.id === 'gemini-3.6-flash' ? <Zap size={14} /> : <Cpu size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-extrabold text-xs ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                                {model.name}
                              </span>
                            </div>
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 mt-0.5">
                              {model.speed}
                            </span>
                            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-1">
                              {model.description}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="text-indigo-600 p-1 shrink-0">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Game Mode City Explorer Launcher */}
            <div className="relative" ref={gameMenuRef}>
              <button
                onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg font-black text-xs transition-all active:scale-95 border border-emerald-400/30"
                title="Explore 3D Voxel City World"
              >
                <Gamepad2 size={16} className="text-amber-300" />
                <span className="hidden sm:inline">Play Game Mode</span>
              </button>

              {isGameMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Explore 3D Voxel World
                  </div>
                  <DropdownItem onClick={() => { onEnterGameMode('UFO'); setIsGameMenuOpen(false); }} icon={<Rocket size={16} className="text-cyan-500"/>} label="🛸 UFO City Flight" highlight />
                  <DropdownItem onClick={() => { onEnterGameMode('Cat'); setIsGameMenuOpen(false); }} icon={<Cat size={16} className="text-amber-500"/>} label="🐱 Cat GTA World" highlight />
                  <DropdownItem onClick={() => { onEnterGameMode('Eagle'); setIsGameMenuOpen(false); }} icon={<Bird size={16} className="text-emerald-500"/>} label="🦅 Eagle Aerial View" />
                  <DropdownItem onClick={() => { onEnterGameMode('Custom'); setIsGameMenuOpen(false); }} icon={<Box size={16} className="text-indigo-500"/>} label="📦 Fly Active Model" />
                </div>
              )}
            </div>

            {/* Quick Motion Converter Menu */}
            <div className="relative" ref={animateMenuRef}>
              <button
                onClick={() => setIsAnimateMenuOpen(!isAnimateMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-md font-bold text-xs transition-all active:scale-95"
                title="Animate current 3D model"
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">Animate</span>
              </button>

              {isAnimateMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Add 3D Motion
                  </div>
                  <DropdownItem onClick={() => { onAnimateCurrentModel('fly'); setIsAnimateMenuOpen(false); }} icon={<Bird size={14}/>} label="Flapping Wing" />
                  <DropdownItem onClick={() => { onAnimateCurrentModel('walk'); setIsAnimateMenuOpen(false); }} icon={<Cat size={14}/>} label="Walking Gait" />
                  <DropdownItem onClick={() => { onAnimateCurrentModel('pulse'); setIsAnimateMenuOpen(false); }} icon={<Heart size={14}/>} label="Heartbeat Pulse" />
                  <DropdownItem onClick={() => { onAnimateCurrentModel('float'); setIsAnimateMenuOpen(false); }} icon={<Sparkles size={14}/>} label="Floating Wave" />
                  <DropdownItem onClick={() => { onAnimateCurrentModel('spin'); setIsAnimateMenuOpen(false); }} icon={<Repeat size={14}/>} label="Spin 360" />
                </div>
              )}
            </div>

            <TactileButton
                onClick={onToggleInfo}
                color={isInfoVisible ? 'indigo' : 'slate'}
                icon={<Info size={18} strokeWidth={2.5} />}
                label="Info"
                compact
            />
            <TactileButton
                onClick={onToggleRotation}
                color={isAutoRotate ? 'sky' : 'slate'}
                icon={isAutoRotate ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                label={isAutoRotate ? "Pause Cam" : "Play Cam"}
                compact
            />
            <TactileButton
                onClick={onShowJson}
                color="slate"
                icon={<Code2 size={18} strokeWidth={2.5} />}
                label="Share"
            />
        </div>
      </div>

      {/* --- Floating 3D Animation Control Bar --- */}
      {animState.isAnimated && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/90 backdrop-blur-md text-white border-2 border-indigo-500/40 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 font-sans">
            {/* Play/Pause */}
            <button
              onClick={onPlayPauseAnim}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95 transition-all"
              title={animState.isPlaying ? "Pause 3D Animation" : "Play 3D Animation"}
            >
              {animState.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            {/* Frame Scrubber */}
            <div className="flex items-center gap-2 border-x border-slate-700/60 px-3">
              <button
                onClick={() => onSetAnimFrame((animState.currentFrame - 1 + animState.totalFrames) % animState.totalFrames)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Previous Frame"
              >
                <SkipBack size={16} />
              </button>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-indigo-300 font-extrabold uppercase tracking-wider">
                  Frame {animState.currentFrame + 1} / {animState.totalFrames}
                </span>
                <input
                  type="range"
                  min={0}
                  max={animState.totalFrames - 1}
                  value={animState.currentFrame}
                  onChange={(e) => onSetAnimFrame(Number(e.target.value))}
                  className="w-24 h-1.5 bg-slate-700 accent-indigo-500 rounded-lg cursor-pointer"
                />
              </div>

              <button
                onClick={() => onSetAnimFrame((animState.currentFrame + 1) % animState.totalFrames)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Next Frame"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* FPS Selector */}
            <div className="flex items-center gap-1">
              {[4, 6, 12].map((f) => (
                <button
                  key={f}
                  onClick={() => onSetAnimFps(f)}
                  className={`px-2 py-1 text-[10px] font-extrabold rounded-lg transition-colors ${animState.fps === f ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  {f} FPS
                </button>
              ))}
            </div>

            {/* Smooth Motion Lerp Toggle */}
            <button
              onClick={onToggleAnimInterpolation}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${animState.isInterpolated ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              title="Toggle Smooth Motion Lerp"
            >
              {animState.isInterpolated ? 'Smooth' : 'Step'}
            </button>
          </div>
        </div>
      )}

      {/* --- Loading Indicator --- */}
      {isGenerating && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none">
              <div className="bg-slate-900/85 backdrop-blur-md text-white border border-slate-700/50 px-4 py-2 rounded-full shadow-xl flex items-center gap-2.5">
                  <Loader2 size={16} className="text-sky-400 animate-spin shrink-0" />
                  <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="text-slate-100">{currentModelOption.displayName} Building...</span>
                      <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">• {LOADING_MESSAGES[loadingMsgIndex]}</span>
                  </div>
              </div>
          </div>
      )}

      {/* --- Bottom Control Center --- */}
      <div className="absolute bottom-8 left-0 w-full flex justify-center items-end pointer-events-none">
        
        <div className="pointer-events-auto transition-all duration-500 ease-in-out transform">
            
            {/* STATE 1: STABLE -> DISMANTLE */}
            {isStable && (
                 <div className="flex gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
                     <BigActionButton 
                        onClick={onDismantle} 
                        icon={<Hammer size={32} strokeWidth={2.5} />} 
                        label="BREAK" 
                        color="rose" 
                     />
                     <BigActionButton 
                        onClick={onSupernova} 
                        icon={<Zap size={32} strokeWidth={2.5} />} 
                        label="SUPERNOVA" 
                        color="purple" 
                     />
                 </div>
            )}

            {/* STATE 2: DISMANTLED -> REBUILD */}
            {/* Hide this menu if we are actively rebuilding (animating) or if we are generating new content */}
            {isDismantling && !isGenerating && (
                <div className="animate-in slide-in-from-bottom-10 fade-in duration-300">
                     <BigActionButton 
                        onClick={onRebuildCurrent} 
                        icon={<Wrench size={32} strokeWidth={2.5} />} 
                        label="REBUILD" 
                        color="emerald" 
                     />
                </div>
            )}
        </div>
      </div>

    </div>
  );
};

// --- Components ---

interface TactileButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  color: 'slate' | 'rose' | 'sky' | 'emerald' | 'amber' | 'indigo';
  compact?: boolean;
}

const TactileButton: React.FC<TactileButtonProps> = ({ onClick, disabled, icon, label, color, compact }) => {
  const colorStyles = {
    slate:   'bg-slate-200 text-slate-600 shadow-slate-300 hover:bg-slate-300',
    rose:    'bg-rose-500 text-white shadow-rose-700 hover:bg-rose-600',
    sky:     'bg-sky-500 text-white shadow-sky-700 hover:bg-sky-600',
    emerald: 'bg-emerald-500 text-white shadow-emerald-700 hover:bg-emerald-600',
    amber:   'bg-amber-400 text-amber-900 shadow-amber-600 hover:bg-amber-500',
    indigo:  'bg-indigo-500 text-white shadow-indigo-700 hover:bg-indigo-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all duration-100
        border-b-[4px] active:border-b-0 active:translate-y-[4px]
        ${compact ? 'p-2.5' : 'px-4 py-3'}
        ${disabled 
          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed shadow-none' 
          : `${colorStyles[color]} border-black/20 shadow-lg`}
      `}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </button>
  );
};

const BigActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: 'rose' | 'emerald' | 'purple'}> = ({ onClick, icon, label, color }) => {
    let colorClasses = '';
    if (color === 'rose') colorClasses = 'bg-rose-500 hover:bg-rose-600 shadow-rose-900/30 border-rose-800';
    if (color === 'emerald') colorClasses = 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-900/30 border-emerald-800';
    if (color === 'purple') colorClasses = 'bg-purple-500 hover:bg-purple-600 shadow-purple-900/30 border-purple-800';
    return (
        <button 
            onClick={onClick}
            className={`group relative flex flex-col items-center justify-center w-32 h-32 rounded-3xl text-white shadow-xl border-b-[8px] active:border-b-0 active:translate-y-[8px] transition-all duration-150 ${colorClasses}`}
        >
            <div className="mb-2">{icon}</div>
            <div className="text-sm font-black tracking-wider">{label}</div>
        </button>
    )
}

// --- Dropdown Components ---

interface DropdownProps {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    color: 'indigo' | 'emerald';
    direction?: 'up' | 'down';
    big?: boolean;
}

const DropdownMenu: React.FC<DropdownProps> = ({ icon, label, children, color, direction = 'down', big }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const bgClass = color === 'indigo' ? 'bg-indigo-500 hover:bg-indigo-600 border-indigo-800' : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-800';

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 font-bold text-white shadow-lg rounded-2xl transition-all active:scale-95
                    ${bgClass}
                    ${big ? 'px-8 py-4 text-lg border-b-[6px] active:border-b-0 active:translate-y-[6px]' : 'px-4 py-3 text-sm border-b-[4px] active:border-b-0 active:translate-y-[4px]'}
                `}
            >
                {icon}
                {label}
                <ChevronUp size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${direction === 'down' ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={`
                    absolute left-0 ${direction === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'} 
                    w-56 max-h-[60vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-200 z-50
                `}>
                    {children}
                </div>
            )}
        </div>
    )
}

const DropdownItem: React.FC<{ 
    onClick: () => void, 
    onDelete?: (e: React.MouseEvent) => void,
    icon: React.ReactNode, 
    label: string, 
    highlight?: boolean, 
    truncate?: boolean 
}> = ({ onClick, onDelete, icon, label, highlight, truncate }) => {
    return (
        <div className="group/item flex items-center justify-between w-full rounded-xl hover:bg-slate-100 transition-colors">
            <button 
                onClick={onClick}
                className={`
                    flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-left
                    ${highlight 
                        ? 'bg-gradient-to-r from-sky-50 to-blue-50 text-sky-600 hover:from-sky-100 hover:to-blue-100' 
                        : 'text-slate-600 group-hover/item:text-slate-900'}
                `}
            >
                <div className="shrink-0">{icon}</div>
                <span className={truncate ? "truncate max-w-[120px]" : ""}>{label}</span>
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    title="Delete saved build"
                    className="p-1.5 mr-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    )
}
