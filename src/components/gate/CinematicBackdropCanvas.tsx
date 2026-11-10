import React, { useEffect, useRef } from 'react';
import { BIENNALE_AVANT_GARDE_THEME, type CinematicTheme } from './themeManager';

interface DustMote {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  wobbleSpeed: number;
  wobbleOffset: number;
  isLime: boolean;
}

export const CinematicBackdropCanvas: React.FC<{ theme?: CinematicTheme; isPaused?: boolean }> = ({
  theme = BIENNALE_AVANT_GARDE_THEME,
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Minimalist monochrome & acid lime gallery ambient dust motes (replaces old cyan space dust)
    const dustMotes: DustMote[] = Array.from({ length: 35 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.2 + 0.6,
      speedY: -(Math.random() * 0.18 + 0.08),
      speedX: (Math.random() - 0.5) * 0.12,
      opacity: Math.random() * 0.25 + 0.1,
      wobbleSpeed: Math.random() * 0.01 + 0.003,
      wobbleOffset: Math.random() * Math.PI * 2,
      isLime: Math.random() > 0.65,
    }));

    let time = 0;

    const render = () => {
      time += 0.008;

      // 1. Pure Obsidian Base: #050505
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Architectural Gallery Exhibition Grid (64px interval)
      const gridSize = 64;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 3. Grid Crosshair Micro-Points at Intersections
      ctx.fillStyle = 'rgba(204, 255, 0, 0.035)';
      for (let x = 0; x < width; x += gridSize * 2) {
        for (let y = 0; y < height; y += gridSize * 2) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      // 4. Ambient Acid Lime Gallery Spotlight Aura (Upper-Center Subtle Radial Glow)
      const cx = width * 0.5;
      const cy = height * 0.28 + Math.sin(time * 0.4) * 15;
      const spotGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.65);
      spotGrad.addColorStop(0, 'rgba(204, 255, 0, 0.032)');
      spotGrad.addColorStop(0.35, 'rgba(30, 36, 10, 0.02)');
      spotGrad.addColorStop(0.75, 'rgba(8, 8, 8, 0.01)');
      spotGrad.addColorStop(1, 'rgba(5, 5, 5, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);

      // 5. Floating Gallery Spotlight Dust Motes (Warm White + Lime)
      for (let i = 0; i < dustMotes.length; i++) {
        const p = dustMotes[i];
        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.25 + p.speedX;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        ctx.fillStyle = p.isLime
          ? `rgba(204, 255, 0, ${p.opacity * 0.9})`
          : `rgba(240, 240, 245, ${p.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Seamless Perimeter Vignette (Blends into #050505)
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.38,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.65, 'rgba(5, 5, 5, 0.45)');
      vignette.addColorStop(1, '#050505');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      if (!isPaused) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 select-none"
      style={{ display: 'block' }}
    />
  );
};

export default CinematicBackdropCanvas;
