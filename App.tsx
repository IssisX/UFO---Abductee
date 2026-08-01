/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useEffect, useRef, useState } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { UIOverlay } from './components/UIOverlay';
import { GameHUD } from './components/GameHUD';
import { JsonModal } from './components/JsonModal';
import { PromptModal } from './components/PromptModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { UfoSplashScreen } from './components/UfoSplashScreen';
import { Generators, proceduralAnimate } from './utils/voxelGenerators';
import { AppState, VoxelData, SavedModel, AIModelId, AI_MODELS, AnimationState, PlayerMode, GameModeTelemetry } from './types';
import { storageService } from './services/storageService';
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  
  const [appState, setAppState] = useState<AppState>(AppState.STABLE);
  const [voxelCount, setVoxelCount] = useState<number>(0);
  
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalMode, setJsonModalMode] = useState<'view' | 'import'>('view');
  
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<'create' | 'morph'>('create');
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUfoSplash, setShowUfoSplash] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [jsonData, setJsonData] = useState('');
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  // --- Game Mode State ---
  const [isGameMode, setIsGameMode] = useState<boolean>(false);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('UFO');
  const [gameTelemetry, setGameTelemetry] = useState<GameModeTelemetry>({
    speed: 0,
    altitude: 15,
    posX: 0,
    posY: 15,
    posZ: 0,
    boostActive: false,
    actionActive: false,
    score: 0,
    highScore: 0,
    energy: 100,
    comboMultiplier: 1,
    wantedLevel: 0,
    isCinematicCamera: true,
    activeQuest: null,
    questCompletedFlash: null,
    radarBlips: []
  });

  // --- State for Custom Models, Active AI Model & Animation ---
  const [selectedModel, setSelectedModel] = useState<AIModelId>(() => storageService.getSelectedModel());
  const [currentBaseModel, setCurrentBaseModel] = useState<string>('Eagle');
  const [customBuilds, setCustomBuilds] = useState<SavedModel[]>([]);
  const [customRebuilds, setCustomRebuilds] = useState<SavedModel[]>([]);
  const [animState, setAnimState] = useState<AnimationState>({
    isAnimated: false,
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 0,
    fps: 6,
    isInterpolated: true,
    isLooping: true
  });

  const handleSelectModel = (modelId: AIModelId) => {
    setSelectedModel(modelId);
    storageService.saveSelectedModel(modelId);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Load persisted models from storage
    storageService.getCustomBuilds().then(setCustomBuilds);
    storageService.getCustomRebuilds().then(setCustomRebuilds);

    // Initialize Engine
    const engine = new VoxelEngine(
      containerRef.current,
      (newState) => setAppState(newState),
      (count) => setVoxelCount(count)
    );

    engine.setOnAnimationStateChange((s) => setAnimState(s));
    engine.setOnGameTelemetryUpdate((t) => setGameTelemetry(t));
    engineRef.current = engine;

    // Initial Model Load
    engine.loadInitialModel(Generators.Eagle());

    // Resize Listener
    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        engineRef.current?.stopGameMode();
        setIsGameMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => setShowWelcome(false), 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      engine.cleanup();
    };
  }, []);

  const handleDismantle = () => {
    engineRef.current?.dismantle();
  };

  const handleNewScene = (type: 'Eagle') => {
    const generator = Generators[type];
    if (generator && engineRef.current) {
      engineRef.current.clearAnimation();
      engineRef.current.loadInitialModel(generator());
      setCurrentBaseModel('Eagle');
    }
  };

  const handleSelectCustomBuild = (model: SavedModel) => {
      if (engineRef.current) {
          if (model.isAnimated && model.frames) {
            engineRef.current.loadAnimatedModel(model);
          } else {
            engineRef.current.clearAnimation();
            engineRef.current.loadInitialModel(model.data);
          }
          setCurrentBaseModel(model.name);
      }
  };

  const handlePlayPauseAnim = () => engineRef.current?.togglePlayAnimation();
  const handleSetAnimFrame = (frame: number) => engineRef.current?.setFrame(frame);
  const handleSetAnimFps = (fps: number) => engineRef.current?.setFps(fps);
  const handleToggleAnimInterpolation = () => engineRef.current?.toggleInterpolation();
  const handleToggleAnimLoop = () => engineRef.current?.toggleLoop();

  const handleAnimateCurrentModel = (type: 'fly' | 'walk' | 'pulse' | 'float' | 'spin' = 'float') => {
    if (engineRef.current) {
      const currentVoxels = engineRef.current.getCurrentVoxels();
      if (currentVoxels.length > 0) {
        const frames = proceduralAnimate(currentVoxels, type, 6);
        engineRef.current.setAnimationFrames(frames, 6);
      }
    }
  };

  const handleSelectAnimatedPreset = (presetName: 'AnimatedEagle' | 'AnimatedCat' | 'AnimatedHeart' | 'AnimatedUFO' | 'AnimatedFire') => {
    if (Generators[presetName] && engineRef.current) {
      const savedModel = (Generators[presetName] as () => SavedModel)();
      engineRef.current.loadAnimatedModel(savedModel);
      setCurrentBaseModel(savedModel.name);
    }
  };

  const handleRebuild = (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => {
    const generator = Generators[type];
    if (generator && engineRef.current) {
      engineRef.current.rebuild(generator());
    }
  };

  const handleRebuildCurrent = () => {
    engineRef.current?.rebuildCurrent();
  };

  const handleSupernova = () => {
    engineRef.current?.triggerSupernova();
  };

  const handleSelectCustomRebuild = (model: SavedModel) => {
      if (engineRef.current) {
          engineRef.current.rebuild(model.data);
      }
  };

  const handleShowJson = () => {
    if (engineRef.current) {
      setJsonData(engineRef.current.getJsonData());
      setJsonModalMode('view');
      setIsJsonModalOpen(true);
    }
  };

  const handleImportClick = () => {
      setJsonModalMode('import');
      setIsJsonModalOpen(true);
  };

  const handleJsonImport = async (jsonStr: string) => {
      try {
          const rawData = JSON.parse(jsonStr);
          if (!Array.isArray(rawData)) throw new Error("JSON must be an array");

          const voxelData: VoxelData[] = rawData.map((v: any) => {
              let colorVal = v.c || v.color;
              let colorInt = 0xCCCCCC;

              if (typeof colorVal === 'string') {
                  if (colorVal.startsWith('#')) colorVal = colorVal.substring(1);
                  colorInt = parseInt(colorVal, 16);
              } else if (typeof colorVal === 'number') {
                  colorInt = colorVal;
              }

              return {
                  x: Number(v.x) || 0,
                  y: Number(v.y) || 0,
                  z: Number(v.z) || 0,
                  color: isNaN(colorInt) ? 0xCCCCCC : colorInt
              };
          });
          
          if (engineRef.current) {
              engineRef.current.loadInitialModel(voxelData);
              const importedName = `Imported Build (${customBuilds.length + 1})`;
              setCurrentBaseModel(importedName);
              const newModel: SavedModel = { name: importedName, data: voxelData };
              const updated = await storageService.saveCustomBuild(newModel);
              setCustomBuilds(updated);
          }
      } catch (e) {
          console.error("Failed to import JSON", e);
          alert("Failed to import JSON. Please ensure the format is correct.");
      }
  };

  const openPrompt = (mode: 'create' | 'morph') => {
      setPromptMode(mode);
      setIsPromptModalOpen(true);
  }
  
  const handleToggleRotation = () => {
      const newState = !isAutoRotate;
      setIsAutoRotate(newState);
      if (engineRef.current) {
          engineRef.current.setAutoRotate(newState);
      }
  }

  const handlePromptSubmit = async (prompt: string, isAnimatedRequested?: boolean) => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found");
    }

    setIsGenerating(true);
    // Close modal immediately so we can show the main loading indicator
    setIsPromptModalOpen(false);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = selectedModel;
        
        let systemContext = "";
        if (promptMode === 'morph' && engineRef.current) {
            const availableColors = engineRef.current.getUniqueColors().join(', ');
            systemContext = `
                CONTEXT: You are re-assembling an existing pile of lego-like voxels.
                The current pile consists of these colors: [${availableColors}].
                TRY TO USE THESE COLORS if they fit the requested shape.
                If the requested shape absolutely requires different colors, you may use them, but prefer the existing palette to create a "rebuilding" effect.
                The model should be roughly the same volume as the previous one.
            `;
        } else {
            systemContext = `
                CONTEXT: You are creating a brand new voxel art scene from scratch.
                Be creative with colors.
            `;
        }

        if (promptMode === 'create' && engineRef.current) {
            engineRef.current.clearForStreaming();
        } else if (promptMode === 'morph' && engineRef.current) {
            engineRef.current.clearGhostsForStreaming();
        }

        const stream = await ai.models.generateContentStream({
            model,
            contents: `
                    ${systemContext}
                    
                    Task: Generate a 3D voxel art model of: "${prompt}".
                    
                    Strict Rules:
                    1. Use approximately 150 to 600 voxels.
                    2. The model must be centered at x=0, z=0.
                    3. The bottom of the model must be at y=0 or slightly higher.
                    4. Ensure the structure is physically plausible (connected).
                    5. Coordinates should be integers.
                    
                    Return ONLY a JSON array of objects.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.INTEGER },
                            y: { type: Type.INTEGER },
                            z: { type: Type.INTEGER },
                            color: { type: Type.STRING, description: "Hex color code e.g. #FF5500" }
                        },
                        required: ["x", "y", "z", "color"]
                    }
                }
            }
        });

        let accumulatedText = "";
        let processedIndex = 0;
        let finalVoxelData: VoxelData[] = [];

        for await (const chunk of stream) {
            accumulatedText += chunk.text;
            
            let startIndex = processedIndex;
            while (startIndex < accumulatedText.length) {
                const start = accumulatedText.indexOf('{', startIndex);
                if (start === -1) break;
                const end = accumulatedText.indexOf('}', start);
                if (end === -1) break;
                
                const objStr = accumulatedText.substring(start, end + 1);
                try {
                    const v = JSON.parse(objStr);
                    if (v.x !== undefined && v.y !== undefined && v.z !== undefined && v.color !== undefined) {
                        let colorStr = v.color;
                        if (colorStr.startsWith('#')) colorStr = colorStr.substring(1);
                        const colorInt = parseInt(colorStr, 16);
                        
                        const voxel = {
                            x: v.x,
                            y: v.y,
                            z: v.z,
                            color: isNaN(colorInt) ? 0xCCCCCC : colorInt
                        };
                        
                        finalVoxelData.push(voxel);
                        
                        if (engineRef.current) {
                            if (promptMode === 'create') {
                                engineRef.current.addStreamedVoxel(voxel);
                            } else {
                                engineRef.current.addStreamedGhostVoxel(voxel);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore parse errors for partial/malformed objects
                }
                
                startIndex = end + 1;
                processedIndex = startIndex;
            }
        }

        if (engineRef.current) {
            if (promptMode === 'create') {
                engineRef.current.setCurrentModelData(finalVoxelData);
                let frames: VoxelData[][] | undefined;
                if (isAnimatedRequested) {
                    const pLower = prompt.toLowerCase();
                    let motionType: 'fly' | 'walk' | 'pulse' | 'float' | 'spin' = 'float';
                    if (pLower.includes('fly') || pLower.includes('bird') || pLower.includes('wing') || pLower.includes('dragon') || pLower.includes('plane')) motionType = 'fly';
                    else if (pLower.includes('walk') || pLower.includes('cat') || pLower.includes('dog') || pLower.includes('robot') || pLower.includes('animal')) motionType = 'walk';
                    else if (pLower.includes('heart') || pLower.includes('beat') || pLower.includes('pulse')) motionType = 'pulse';
                    else if (pLower.includes('spin') || pLower.includes('ufo') || pLower.includes('rotate')) motionType = 'spin';
                    
                    frames = proceduralAnimate(finalVoxelData, motionType, 6);
                    engineRef.current.setAnimationFrames(frames, 6);
                }
                const newModel: SavedModel = { name: prompt, data: finalVoxelData, frames, fps: 6, isAnimated: !!frames };
                const updated = await storageService.saveCustomBuild(newModel);
                setCustomBuilds(updated);
                setCurrentBaseModel(prompt);
            } else {
                engineRef.current.clearGhosts();
                engineRef.current.rebuild(finalVoxelData);
                let frames: VoxelData[][] | undefined;
                if (isAnimatedRequested) {
                    frames = proceduralAnimate(finalVoxelData, 'float', 6);
                    setTimeout(() => {
                        engineRef.current?.setAnimationFrames(frames!, 6);
                    }, 3000);
                }
                const newRebuild: SavedModel = { 
                    name: prompt, 
                    data: finalVoxelData,
                    baseModel: currentBaseModel,
                    frames,
                    fps: 6,
                    isAnimated: !!frames
                };
                const updated = await storageService.saveCustomRebuild(newRebuild);
                setCustomRebuilds(updated);
            }
        }
    } catch (err) {
        console.error("Generation failed", err);
        alert("Oops! Something went wrong generating the model.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteCustomBuild = async (index: number) => {
    const updated = await storageService.deleteCustomBuild(index);
    setCustomBuilds(updated);
  };

  const handleDeleteCustomRebuild = async (index: number) => {
    const updated = await storageService.deleteCustomRebuild(index);
    setCustomRebuilds(updated);
  };

  // --- Game Mode Handlers ---
  const handleStartUfoFromSplash = () => {
    setShowUfoSplash(false);
    handleEnterGameMode('UFO');
  };

  const handleEnterGameMode = (mode: PlayerMode) => {
    setPlayerMode(mode);
    setIsGameMode(true);
    let voxels: VoxelData[] | undefined;
    if (mode === 'UFO') voxels = Generators.UFO();
    else if (mode === 'Cat') voxels = Generators.Cat();
    else if (mode === 'Eagle') voxels = Generators.Eagle();

    engineRef.current?.startGameMode(mode, voxels);
  };

  const handleExitGameMode = () => {
    setIsGameMode(false);
    engineRef.current?.stopGameMode();
  };

  const handleSelectPlayerMode = (mode: PlayerMode) => {
    setPlayerMode(mode);
    let voxels: VoxelData[] | undefined;
    if (mode === 'UFO') voxels = Generators.UFO();
    else if (mode === 'Cat') voxels = Generators.Cat();
    else if (mode === 'Eagle') voxels = Generators.Eagle();

    engineRef.current?.setPlayerMode(mode);
    if (voxels) {
      engineRef.current?.setPlayerVoxels(voxels);
    }
  };

  const handleTriggerGameAction = () => {
    engineRef.current?.triggerGameAction();
  };

  const handleVirtualInput = (fwd: number, strafe: number, ascend: number = 0, boost: boolean = false) => {
    engineRef.current?.setGameVirtualInput(fwd, strafe, ascend, boost);
  };

  const handleRotateCamera = (deltaYaw: number, deltaPitch: number = 0) => {
    engineRef.current?.rotateGameCamera(deltaYaw, deltaPitch);
  };

  const handleToggleCinematicCamera = () => {
    engineRef.current?.toggleCinematicCamera();
  };

  const handleJump = () => {
    engineRef.current?.triggerGameJump();
  };

  // Filter rebuilds to only show those relevant to the current base model
  const relevantRebuilds = customRebuilds.filter(
      r => r.baseModel === currentBaseModel
  );

  return (
    <div className="relative w-full h-screen bg-[#f0f2f5] overflow-hidden">
      {/* 3D Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      {/* Game HUD when in Game Mode */}
      {isGameMode ? (
        <GameHUD
          playerMode={playerMode}
          telemetry={gameTelemetry}
          onSelectPlayerMode={handleSelectPlayerMode}
          onTriggerAction={handleTriggerGameAction}
          onExitGameMode={handleExitGameMode}
          onToggleCinematicCamera={handleToggleCinematicCamera}
          onVirtualInput={handleVirtualInput}
          onRotateCamera={handleRotateCamera}
          onJump={handleJump}
        />
      ) : (
        /* UI Overlay */
        <UIOverlay 
          voxelCount={voxelCount}
          appState={appState}
          currentBaseModel={currentBaseModel}
          customBuilds={customBuilds}
          customRebuilds={relevantRebuilds} 
          isAutoRotate={isAutoRotate}
          isInfoVisible={showWelcome}
          isGenerating={isGenerating}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          onDismantle={handleDismantle}
          onSupernova={handleSupernova}
          onRebuild={handleRebuild}
          onRebuildCurrent={handleRebuildCurrent}
          onNewScene={handleNewScene}
          onSelectCustomBuild={handleSelectCustomBuild}
          onSelectCustomRebuild={handleSelectCustomRebuild}
          onDeleteCustomBuild={handleDeleteCustomBuild}
          onDeleteCustomRebuild={handleDeleteCustomRebuild}
          onPromptCreate={() => openPrompt('create')}
          onPromptMorph={() => openPrompt('morph')}
          onShowJson={handleShowJson}
          onImportJson={handleImportClick}
          onToggleRotation={handleToggleRotation}
          onToggleInfo={() => setShowWelcome(!showWelcome)}

          animState={animState}
          onPlayPauseAnim={handlePlayPauseAnim}
          onSetAnimFrame={handleSetAnimFrame}
          onSetAnimFps={handleSetAnimFps}
          onToggleAnimInterpolation={handleToggleAnimInterpolation}
          onToggleAnimLoop={handleToggleAnimLoop}
          onAnimateCurrentModel={handleAnimateCurrentModel}
          onSelectAnimatedPreset={handleSelectAnimatedPreset}

          onEnterGameMode={handleEnterGameMode}
        />
      )}

      {/* Modals & Screens */}
      
      {showUfoSplash && (
        <UfoSplashScreen onStartGame={handleStartUfoFromSplash} />
      )}

      <WelcomeScreen visible={showWelcome} />

      <JsonModal 
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        data={jsonData}
        isImport={jsonModalMode === 'import'}
        onImport={handleJsonImport}
      />

      <PromptModal
        isOpen={isPromptModalOpen}
        mode={promptMode}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onClose={() => setIsPromptModalOpen(false)}
        onSubmit={handlePromptSubmit}
      />
    </div>
  );
};

export default App;
