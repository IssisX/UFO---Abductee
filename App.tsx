
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { GameHUD } from './components/GameHUD';
import { UfoSplashScreen } from './components/UfoSplashScreen';
import { Generators } from './utils/voxelGenerators';
import { PlayerMode, GameModeTelemetry } from './types';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  
  const [showUfoSplash, setShowUfoSplash] = useState(true);
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
    radarBlips: [],
    flightMode: 'hover'
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Engine
    const engine = new VoxelEngine(
      containerRef.current,
      () => {},
      () => {}
    );
    engine.setOnGameTelemetryUpdate((t) => setGameTelemetry(t));
    engineRef.current = engine;

    // Resize Listener
    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, []);

  const handleStartUfoFromSplash = () => {
    setShowUfoSplash(false);
    handleEnterGameMode('UFO');
  };

  const handleEnterGameMode = (mode: PlayerMode) => {
    setPlayerMode(mode);
    setIsGameMode(true);
    let voxels = Generators.UFO();
    if (mode === 'Alien') voxels = Generators.Alien();
    engineRef.current?.startGameMode(mode, voxels);
  };

  const handleSelectPlayerMode = useCallback((mode: PlayerMode) => {
    setPlayerMode(mode);
    let voxels = Generators.UFO();
    if (mode === 'Alien') voxels = Generators.Alien();
    engineRef.current?.setPlayerMode(mode);
    engineRef.current?.setPlayerVoxels(voxels);
  }, []);

  const handleTriggerGameAction = useCallback(() => {
    engineRef.current?.triggerGameAction();
  }, []);

  const handleVirtualInput = useCallback((fwd: number, strafe: number, ascend: number = 0, boost: boolean = false) => {
    engineRef.current?.setGameVirtualInput(fwd, strafe, ascend, boost);
  }, []);

  const handleRotateCamera = useCallback((deltaYaw: number, deltaPitch: number = 0) => {
    engineRef.current?.rotateGameCamera(deltaYaw, deltaPitch);
  }, []);

  const handleToggleCinematicCamera = useCallback(() => {
    engineRef.current?.toggleCinematicCamera();
  }, []);

  const handleJump = useCallback(() => {
    engineRef.current?.triggerGameJump();
  }, []);

  const handleSelectWeaponMode = useCallback((mode: any) => {
    engineRef.current?.setGameWeaponMode(mode);
  }, []);

  const handlePurchaseUpgrade = useCallback((key: any) => {
    return engineRef.current?.purchaseGameUpgrade(key) ?? false;
  }, []);

  const handleDeployMutant = useCallback(() => {
    return engineRef.current?.deployGameMutant() ?? false;
  }, []);

  const handleBarrelRoll = useCallback(() => {
    return engineRef.current?.triggerGameBarrelRoll() ?? false;
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#f0f2f5] overflow-hidden">
      {/* 3D Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      {/* Game HUD when in Game Mode */}
      {isGameMode && (
        <GameHUD
          playerMode={playerMode}
          telemetry={gameTelemetry}
          onSelectPlayerMode={handleSelectPlayerMode}
          onTriggerAction={handleTriggerGameAction}
          onExitGameMode={() => {}} 
          onToggleCinematicCamera={handleToggleCinematicCamera}
          onVirtualInput={handleVirtualInput}
          onRotateCamera={handleRotateCamera}
          onJump={handleJump}
          onSelectWeaponMode={handleSelectWeaponMode}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onDeployMutant={handleDeployMutant}
          onBarrelRoll={handleBarrelRoll}
        />
      )}

      {showUfoSplash && (
        <UfoSplashScreen onStartGame={handleStartUfoFromSplash} />
      )}
    </div>
  );
};

export default App;
