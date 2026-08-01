/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Play, Zap, Compass, Flame, Sparkles } from 'lucide-react';

interface UfoSplashScreenProps {
  onStartGame: () => void;
}

export const UfoSplashScreen: React.FC<UfoSplashScreenProps> = ({ onStartGame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Render loop for badass UFO Abduction Graphic
    const render = () => {
      time += 0.03;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // --- 1. Dark Night Sky Gradient ---
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // --- 2. Twinkling Stars & Sci-fi Grid Lines ---
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 60; i++) {
        const sx = (Math.sin(i * 99 + time * 0.1) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 33 + time * 0.1) * 0.5 + 0.5) * (h * 0.6);
        const alpha = Math.sin(time * 2 + i) * 0.4 + 0.6;
        ctx.globalAlpha = alpha;
        ctx.fillRect(sx, sy, Math.sin(i) * 2 + 1, Math.sin(i) * 2 + 1);
      }
      ctx.globalAlpha = 1.0;

      // --- 3. Neon City Skyline Backdrop ---
      const skylineY = h * 0.72;
      ctx.fillStyle = '#0f172a';
      
      // Building silhouettes
      const buildings = [
        { x: 0.05, w: 0.08, h: 0.35 },
        { x: 0.12, w: 0.06, h: 0.45 },
        { x: 0.17, w: 0.10, h: 0.28 },
        { x: 0.26, w: 0.07, h: 0.52 },
        { x: 0.32, w: 0.09, h: 0.38 },
        { x: 0.60, w: 0.08, h: 0.48 },
        { x: 0.67, w: 0.07, h: 0.32 },
        { x: 0.73, w: 0.11, h: 0.55 },
        { x: 0.83, w: 0.08, h: 0.40 },
        { x: 0.90, w: 0.07, h: 0.30 },
      ];

      buildings.forEach((b, idx) => {
        const bx = b.x * w;
        const bw = b.w * w;
        const bh = b.h * h;
        const by = skylineY - bh;

        ctx.fillStyle = idx % 2 === 0 ? '#090d16' : '#030712';
        ctx.fillRect(bx, by, bw, bh);

        // Building Neon Windows
        ctx.fillStyle = idx % 3 === 0 ? '#06b6d4' : idx % 3 === 1 ? '#eab308' : '#f43f5e';
        ctx.globalAlpha = 0.6;
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
          for (let wy = by + 10; wy < skylineY - 10; wy += 16) {
            if (Math.sin(wx * 11 + wy * 7) > -0.2) {
              ctx.fillRect(wx, wy, 5, 8);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      });

      // --- 4. Police Siren Flash Lights on Ground ---
      const policeFlash = Math.sin(time * 10) > 0;
      ctx.fillStyle = policeFlash ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)';
      ctx.fillRect(0, skylineY, w, h - skylineY);

      // Searchlight beams sweeping
      const searchAngle = Math.sin(time * 0.8) * 0.4;
      ctx.save();
      ctx.translate(w * 0.2, skylineY);
      ctx.rotate(searchAngle - 0.5);
      const searchGrad = ctx.createLinearGradient(0, 0, 0, -h * 0.8);
      searchGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      searchGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = searchGrad;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-80, -h * 0.8);
      ctx.lineTo(80, -h * 0.8);
      ctx.lineTo(15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- 5. CENTERPIECE: TRACTOR BEAM & ABDUCTEE ---
      const ufoX = w * 0.5 + Math.sin(time * 1.5) * 20;
      const ufoY = h * 0.26 + Math.cos(time * 1.2) * 10;

      // Glowing Cone Tractor Beam
      const beamGrad = ctx.createLinearGradient(0, ufoY, 0, skylineY);
      beamGrad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
      beamGrad.addColorStop(0.4, 'rgba(163, 230, 53, 0.6)');
      beamGrad.addColorStop(1, 'rgba(6, 182, 212, 0.05)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(ufoX - 30, ufoY + 15);
      ctx.lineTo(ufoX - 160, skylineY);
      ctx.lineTo(ufoX + 160, skylineY);
      ctx.lineTo(ufoX + 30, ufoY + 15);
      ctx.closePath();
      ctx.fill();

      // Tractor Beam Energy Waves
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 3;
      for (let yRing = ufoY + 40; yRing < skylineY; yRing += 35) {
        const ringProgress = (yRing - ufoY) / (skylineY - ufoY);
        const ringWidth = 30 + ringProgress * 130;
        const waveOffset = Math.sin(time * 8 - ringProgress * 10) * 8;

        ctx.globalAlpha = (1 - ringProgress) * 0.7;
        ctx.beginPath();
        ctx.ellipse(ufoX, yRing + waveOffset, ringWidth, ringWidth * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Floating Abductee Particles
      for (let p = 0; p < 20; p++) {
        const pY = ufoY + ((time * 100 + p * 40) % (skylineY - ufoY));
        const pProgress = (pY - ufoY) / (skylineY - ufoY);
        const pX = ufoX + Math.sin(pY * 0.05 + time * 3) * (pProgress * 100);
        
        ctx.fillStyle = p % 2 === 0 ? '#a3e635' : '#06b6d4';
        ctx.shadowColor = '#a3e635';
        ctx.shadowBlur = 10;
        ctx.fillRect(pX, pY, 4, 4);
        ctx.shadowBlur = 0;
      }

      // --- 6. FLOATING TERRIFIED ABDUCTEE (SCARED HUMAN RAGDOLL) ---
      const humanY = ufoY + (skylineY - ufoY) * (0.45 + Math.sin(time * 2) * 0.08);
      const humanX = ufoX + Math.sin(time * 3) * 15;
      const armTilt = Math.sin(time * 12) * 0.4;
      const legTilt = Math.cos(time * 10) * 0.5;

      ctx.save();
      ctx.translate(humanX, humanY);
      ctx.rotate(Math.sin(time * 2.5) * 0.2);

      // Scared Aura Glow
      ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.fill();

      // Body / Torso (Yellow Shirt)
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-12, -15, 24, 30);

      // Head (Terrified expression)
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -26, 12, 0, Math.PI * 2);
      ctx.fill();

      // Scared Eyes (Wide white circles with tiny black pupils)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4, -28, 4, 0, Math.PI * 2);
      ctx.arc(4, -28, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-4 + Math.sin(time * 15) * 1, -28, 1.5, 0, Math.PI * 2);
      ctx.arc(4 + Math.sin(time * 15) * 1, -28, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Screaming Mouth (Wide O)
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.ellipse(0, -22, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms Flailing Upwards
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      // Left Arm
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-24 + Math.sin(armTilt) * 10, -32 + Math.cos(armTilt) * 10);
      ctx.stroke();

      // Right Arm
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.lineTo(24 - Math.sin(armTilt) * 10, -32 - Math.cos(armTilt) * 10);
      ctx.stroke();

      // Legs Kicking (Blue Jeans)
      ctx.strokeStyle = '#2563eb';
      // Left Leg
      ctx.beginPath();
      ctx.moveTo(-6, 15);
      ctx.lineTo(-16 + Math.sin(legTilt) * 12, 35);
      ctx.stroke();

      // Right Leg
      ctx.beginPath();
      ctx.moveTo(6, 15);
      ctx.lineTo(16 - Math.sin(legTilt) * 12, 35);
      ctx.stroke();

      // Screaming Speech Bubble
      ctx.restore();

      ctx.save();
      ctx.translate(humanX + 45, humanY - 40);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(0, 0, 110, 36, 12);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = '900 13px sans-serif';
      ctx.fillText('AAAHHH! 😱', 12, 22);
      ctx.restore();

      // --- 7. BADASS 3D METALLIC UFO SAUCER ---
      ctx.save();
      ctx.translate(ufoX, ufoY);

      // UFO Shadow Glow underneath
      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.ellipse(0, 10, 100, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Metallic Saucer Body (Gradient)
      const ufoGrad = ctx.createLinearGradient(0, -30, 0, 20);
      ufoGrad.addColorStop(0, '#e2e8f0');
      ufoGrad.addColorStop(0.3, '#64748b');
      ufoGrad.addColorStop(0.7, '#1e293b');
      ufoGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = ufoGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 110, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring Lights (Rotating colors)
      for (let l = 0; l < 8; l++) {
        const angle = (l / 8) * Math.PI * 2 + time * 3;
        const lx = Math.cos(angle) * 90;
        const ly = Math.sin(angle) * 20;

        ctx.fillStyle = (l + Math.floor(time * 5)) % 2 === 0 ? '#a3e635' : '#06b6d4';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Glass Cockpit Dome
      const domeGrad = ctx.createLinearGradient(0, -45, 0, -5);
      domeGrad.addColorStop(0, 'rgba(163, 230, 53, 0.9)');
      domeGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.7)');
      domeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.8)');

      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.ellipse(0, -12, 50, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Alien Pilot Silhouette inside Dome
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(0, -18, 10, 0, Math.PI * 2); // Alien big head
      ctx.fill();
      // Glowing Alien Eyes
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.ellipse(-4, -20, 3, 5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(4, -20, 3, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 font-sans overflow-hidden select-none">
      {/* Background Animated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

      {/* Glassmorphism Subtle Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60 pointer-events-none" />

      {/* TOP HEADER TITLE */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center pt-4 sm:pt-8 animate-fadeIn">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20 mb-3 animate-pulse">
          <Sparkles size={14} className="text-lime-400" />
          <span>EARTH INVASION 3D SIMULATOR</span>
        </div>

        <h1 className="text-4xl sm:text-7xl font-black uppercase tracking-tight text-white drop-shadow-[0_10px_35px_rgba(6,182,212,0.8)]">
          UFO <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-lime-300 to-emerald-300">ABDUCTION</span>
        </h1>
        <p className="text-xs sm:text-sm font-bold text-slate-300 tracking-wider uppercase mt-1 drop-shadow">
          PILOT THE MOTHERSHIP • ABDUCT PEDESTRIANS • CAUSE CHAOS
        </p>
      </div>

      {/* BOTTOM ACTION BAR - LAUNCH BUTTON & QUICK KEYS */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center gap-4 pb-6 sm:pb-12">
        {/* Quick Controls Pills */}
        <div className="flex flex-wrap justify-center items-center gap-2 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-2xl text-xs text-slate-200">
          <div className="flex items-center gap-1.5 font-bold">
            <kbd className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded font-mono">WASD</kbd>
            <span>Fly</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5 font-bold">
            <kbd className="px-2 py-0.5 bg-slate-800 text-lime-300 rounded font-mono">F / ACTION</kbd>
            <span>Abduct</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5 font-bold">
            <kbd className="px-2 py-0.5 bg-slate-800 text-amber-300 rounded font-mono">SHIFT</kbd>
            <span>Boost</span>
          </div>
        </div>

        {/* MASSIVE BADASS LAUNCH BUTTON */}
        <button
          onClick={onStartGame}
          className="group relative w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2 active:scale-95 transition-all duration-300 border border-cyan-400/50 cursor-pointer overflow-hidden"
        >
          {/* Button Shine Sweep Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          
          <Play size={28} fill="currentColor" className="group-hover:scale-125 transition-transform" />
          <span>START ABDUCTION NOW</span>
        </button>
      </div>
    </div>
  );
};

