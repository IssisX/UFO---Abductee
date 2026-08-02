/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Tv, Play, Minimize2, Maximize2, Radio } from 'lucide-react';

interface SimpsonsTVCartoonProps {
  abductionTriggerTime?: number;
  onTriggerAbductionInGame?: () => void;
}

export const SimpsonsTVCartoon: React.FC<SimpsonsTVCartoonProps> = ({ abductionTriggerTime, onTriggerAbductionInGame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(true); // Default to compact badge to keep 3D screen clean!
  const [channel, setChannel] = useState<number>(51);
  const [isLiveAbduction, setIsLiveAbduction] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  // Listen to live abduction trigger from Game Engine
  useEffect(() => {
    if (abductionTriggerTime) {
      startTimeRef.current = performance.now();
      setIsPlaying(true);
      setIsMinimized(false); // Pop-out TV screen to show abduction cartoon!
      setIsLiveAbduction(true);

      // Auto-collapse TV after 6.5s to restore clean 3D view
      const timer = setTimeout(() => {
        setIsLiveAbduction(false);
        setIsMinimized(true);
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [abductionTriggerTime]);

  useEffect(() => {
    startTimeRef.current = performance.now();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (now: number) => {
      const elapsed = ((now - startTimeRef.current) / 1000) % 5.5; // 5.5s loop

      // Canvas dimensions
      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // --- 1. Background Environment (Springfield Suburban Backyard) ---
      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(1, '#a5f3fc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.7);

      // Sun
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.2, 18, 0, Math.PI * 2);
      ctx.fill();

      // Fluffy Cartoon Clouds
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.25, h * 0.2, 12, 0, Math.PI * 2);
      ctx.arc(w * 0.32, h * 0.18, 16, 0, Math.PI * 2);
      ctx.arc(w * 0.38, h * 0.22, 12, 0, Math.PI * 2);
      ctx.fill();

      // Green Grass Hill
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.85, w * 0.6, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fence
      ctx.fillStyle = '#fef3c7';
      for (let x = 10; x < w; x += 18) {
        ctx.fillRect(x, h * 0.58, 12, h * 0.22);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.58);
        ctx.lineTo(x + 6, h * 0.52);
        ctx.lineTo(x + 12, h * 0.58);
        ctx.fill();
      }

      // --- 2. Simpson-Style Yellow Characters ---
      // Character 1 (The Abductee - Homer style)
      // Character 2 (The Witness - Marge/Neighbor style)
      const char1X = w * 0.38;
      const char1GroundY = h * 0.72;
      const char2X = w * 0.68;
      const char2GroundY = h * 0.72;

      // Timeline Logic
      // Phase 1 (0.0s - 2.0s): Casual Conversation
      // Phase 2 (2.0s - 3.8s): UFO Abduction Beam!
      // Phase 3 (3.8s - 5.5s): Confused Reaction!

      let ufoOpacity = 0;
      let beamActive = false;
      let char1OffsetY = 0;
      let char1Spin = 0;
      let speechBubble1 = '';
      let speechBubble2 = '';

      if (elapsed < 2.0) {
        speechBubble1 = 'Mmm... donut...';
        if (elapsed > 1.0) speechBubble2 = 'Nice weather!';
      } else if (elapsed >= 2.0 && elapsed < 3.8) {
        ufoOpacity = Math.min(1, (elapsed - 2.0) * 4);
        beamActive = elapsed >= 2.3;
        if (beamActive) {
          const liftProgress = Math.min(1, (elapsed - 2.3) / 1.2);
          char1OffsetY = -liftProgress * (h * 0.55);
          char1Spin = (elapsed - 2.3) * 12;
          speechBubble1 = 'AHHH! UFO!!';
          speechBubble2 = 'WHAT THE?!';
        }
      } else {
        // Post abduction
        ufoOpacity = Math.max(0, 1 - (elapsed - 3.8) * 3);
        speechBubble2 = 'Where\'d he go?!';
      }

      // --- Draw UFO (if visible) ---
      if (ufoOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = ufoOpacity;
        const ufoX = char1X;
        const ufoY = h * 0.18;

        // Tractor Beam
        if (beamActive && ufoOpacity > 0.5) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.beginPath();
          ctx.moveTo(ufoX - 12, ufoY + 10);
          ctx.lineTo(ufoX + 12, ufoY + 10);
          ctx.lineTo(ufoX + 35, h * 0.85);
          ctx.lineTo(ufoX - 35, h * 0.85);
          ctx.closePath();
          ctx.fill();

          // Beam Rings
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 2;
          const ringY = ufoY + 15 + ((now * 0.1) % (h * 0.6));
          ctx.beginPath();
          ctx.ellipse(ufoX, ringY, 18, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // UFO Metallic Saucer
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(ufoX, ufoY, 28, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // UFO Glass Dome
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(ufoX, ufoY - 2, 12, Math.PI, 0);
        ctx.fill();

        // Flashing Lights
        const lightColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
        for (let i = 0; i < 4; i++) {
          const lx = ufoX - 18 + i * 12;
          ctx.fillStyle = lightColors[(i + Math.floor(now * 0.008)) % 4];
          ctx.beginPath();
          ctx.arc(lx, ufoY + 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // --- Draw Character 1 (Abductee) ---
      if (elapsed < 3.8 || char1OffsetY > -h * 0.5) {
        ctx.save();
        ctx.translate(char1X, char1GroundY + char1OffsetY);
        if (char1Spin > 0) ctx.rotate(char1Spin);

        // Yellow Skin
        ctx.fillStyle = '#facc15';

        // Head
        ctx.beginPath();
        ctx.arc(0, -28, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (Big Simpson Eyes)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-3, -30, 4, 0, Math.PI * 2);
        ctx.arc(3, -30, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-3, -30, 1.5, 0, Math.PI * 2);
        ctx.arc(3, -30, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (beamActive) {
          // Surprised scream O mouth
          ctx.arc(0, -23, 3, 0, Math.PI * 2);
        } else {
          ctx.arc(0, -24, 4, 0.1, Math.PI - 0.1);
        }
        ctx.stroke();

        // White Shirt Body
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -18, 16, 14);

        // Blue Pants
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(-7, -4, 14, 12);

        // Arms
        ctx.fillStyle = '#facc15';
        if (beamActive) {
          // Flailing arms UP
          ctx.fillRect(-12, -22, 4, 12);
          ctx.fillRect(8, -22, 4, 12);
        } else {
          ctx.fillRect(-11, -16, 4, 10);
          ctx.fillRect(7, -16, 4, 10);
        }

        ctx.restore();
      }

      // --- Draw Character 2 (Witness) ---
      ctx.save();
      ctx.translate(char2X, char2GroundY);

      // Yellow Skin
      ctx.fillStyle = '#facc15';

      // Tall Blue Hair (Marge style)
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-6, -55, 12, 26);
      ctx.beginPath();
      ctx.arc(0, -55, 7, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -26, 9, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-3, -28, 4, 0, Math.PI * 2);
      ctx.arc(3, -28, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      if (elapsed >= 3.8) {
        // Confused spinning/crossed pupil offset
        const pupilX = Math.sin(now * 0.01) * 1.5;
        ctx.arc(-3 + pupilX, -28, 1.5, 0, Math.PI * 2);
        ctx.arc(3 - pupilX, -28, 1.5, 0, Math.PI * 2);
      } else {
        ctx.arc(-3, -28, 1.5, 0, Math.PI * 2);
        ctx.arc(3, -28, 1.5, 0, Math.PI * 2);
      }
      ctx.fill();

      // Green Dress
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(-7, -17);
      ctx.lineTo(7, -17);
      ctx.lineTo(10, 8);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // --- Speech Bubbles ---
      const drawBubble = (text: string, bx: number, by: number) => {
        if (!text) return;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.font = 'bold 10px sans-serif';

        const metrics = ctx.measureText(text);
        const bw = metrics.width + 12;
        const bh = 18;

        ctx.beginPath();
        ctx.roundRect(bx - bw / 2, by - bh, bw, bh, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(text, bx, by - 5);
      };

      if (speechBubble1 && char1OffsetY > -h * 0.4) {
        drawBubble(speechBubble1, char1X, char1GroundY + char1OffsetY - 42);
      }
      if (speechBubble2) {
        drawBubble(speechBubble2, char2X, char2GroundY - 60);
      }

      // --- CRT Scanlines & Screen Reflections ---
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }

      // Glass Arc Vignette
      const glassGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      glassGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(0, 0, w, h);

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, channel, isMinimized]);

  const handleReplay = () => {
    startTimeRef.current = performance.now();
    setIsPlaying(true);
  };

  return (
    <div className="font-sans pointer-events-auto transition-all">
      {/* RETRO CRT TELEVISION CONTAINER */}
      <div className={`bg-gradient-to-b from-amber-600 via-yellow-600 to-amber-700 p-2.5 sm:p-3 rounded-3xl shadow-2xl border-4 border-amber-900 flex flex-col items-center transition-all ${isMinimized ? 'w-44' : 'w-64 sm:w-72'}`}>
        
        {/* Antenna */}
        <div className="relative w-full h-3 flex justify-center -mt-5 mb-1">
          <div className="w-1 h-5 bg-slate-400 rotate-[-25deg] origin-bottom rounded-full border border-slate-600"></div>
          <div className="w-1 h-5 bg-slate-400 rotate-[25deg] origin-bottom rounded-full border border-slate-600"></div>
        </div>

        {/* TV Header Bar */}
        <div className="w-full flex items-center justify-between px-1.5 mb-1 text-amber-100">
          <div className="flex items-center gap-1.5 font-black text-[10px] tracking-wider uppercase drop-shadow">
            <Radio size={12} className="text-amber-300 animate-pulse" />
            <span>Ch. {channel} Springfield TV</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-amber-200 transition-colors"
              title={isMinimized ? "Expand TV" : "Minimize TV"}
            >
              {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          </div>
        </div>

        {/* Live Abduction Alert Badge */}
        {isLiveAbduction && !isMinimized && (
          <div className="w-full mb-1 py-0.5 px-2 bg-rose-600 text-white text-[9px] font-black uppercase text-center rounded-lg shadow animate-pulse border border-rose-300 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping"></span>
            <span>LIVE ABDUCTION FEED!</span>
          </div>
        )}

        {/* CRT Screen Display */}
        {!isMinimized && (
          <div className="relative w-full bg-slate-950 rounded-2xl border-4 border-amber-950 p-1 shadow-inner overflow-hidden flex flex-col items-center">
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={280}
              height={180}
              className="w-full h-36 sm:h-40 object-cover rounded-xl bg-slate-900 border border-slate-800"
            />

            {/* Retro TV Knobs & Controls Bar */}
            <div className="w-full mt-2 pt-1.5 border-t border-amber-900/60 flex items-center justify-between px-2 text-amber-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplay}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg shadow flex items-center gap-1 active:scale-90 transition-all border border-amber-300"
                >
                  <Play size={10} fill="currentColor" /> REPLAY CARTOON
                </button>
                <button
                  onClick={() => setChannel(prev => (prev === 51 ? 12 : 51))}
                  className="px-2 py-1 bg-amber-900 hover:bg-amber-800 text-amber-300 font-bold text-[9px] rounded-lg"
                >
                  CH {channel}
                </button>
              </div>

              {/* Speaker Grille Slits */}
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-amber-950 rounded-full"></div>
                <div className="w-1 h-3 bg-amber-950 rounded-full"></div>
                <div className="w-1 h-3 bg-amber-950 rounded-full"></div>
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500 animate-pulse mt-0.5"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
