import React, { useEffect, useRef } from 'react';
import { MIDNIGHT_OBSIDIAN_THEME, type CinematicTheme } from './themeManager';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  wobbleSpeed: number;
  wobbleOffset: number;
}

export const CinematicBackdropCanvas: React.FC<{ theme?: CinematicTheme; isPaused?: boolean }> = ({
  theme = MIDNIGHT_OBSIDIAN_THEME,
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

    // Cool cyan-white mist particles (rgba(186, 230, 253, alpha))
    const particles: Particle[] = Array.from({ length: theme.particleCount || 52 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.8,
      speedY: Math.random() * 0.35 + 0.15,
      speedX: (Math.random() - 0.5) * 0.22,
      opacity: Math.random() * 0.45 + 0.2,
      wobbleSpeed: Math.random() * 0.015 + 0.005,
      wobbleOffset: Math.random() * Math.PI * 2,
    }));

    // Drifting volumetric fog cloud nodes
    const fogLayers = [
      { x: 0, speed: 0.1, scaleY: 0.7, opacity: 0.24 },
      { x: 0, speed: -0.07, scaleY: 0.8, opacity: 0.16 },
      { x: 0, speed: 0.15, scaleY: 0.6, opacity: 0.2 },
    ];

    let time = 0;

    const render = () => {
      time += 0.01;

      // 1. Permanent Solid Midnight Abyss Base: #03060a
      ctx.fillStyle = '#03060a';
      ctx.fillRect(0, 0, width, height);

      // 2. Radial Glow Overlay: circle at 50% 40%, rgba(8, 20, 38, 0.65) 0%, #020408 80%
      const cx = width * 0.5;
      const cy = height * 0.4;
      const radialGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.68);
      radialGlow.addColorStop(0, 'rgba(8, 20, 38, 0.65)');
      radialGlow.addColorStop(0.5, 'rgba(5, 12, 24, 0.75)');
      radialGlow.addColorStop(0.8, '#020408');
      radialGlow.addColorStop(1, '#03060a');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Volumetric atmospheric midnight mist waves
      for (let i = 0; i < fogLayers.length; i++) {
        const layer = fogLayers[i];
        layer.x = (layer.x + layer.speed) % (width * 1.5);

        const fx = (layer.x + width * 0.5) % (width * 1.5) - width * 0.25;
        const fy = height * (0.35 + i * 0.2) + Math.sin(time * 0.5 + i) * 22;

        const fogGrad = ctx.createRadialGradient(fx, fy, width * 0.08, fx, fy, width * 0.75);
        fogGrad.addColorStop(0, `rgba(12, 28, 54, ${layer.opacity})`);
        fogGrad.addColorStop(0.5, `rgba(12, 28, 54, ${layer.opacity * 0.4})`);
        fogGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 4. Cool cyan halo accent
      const haloGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        15,
        width * 0.5,
        height * 0.45,
        width * 0.55
      );
      haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, width, height);

      // 5. Floating atmospheric particles: cool cyan-white shimmer (rgba(186, 230, 253, alpha))
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.35 + p.speedX;

        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        ctx.fillStyle = `rgba(186, 230, 253, ${p.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Deep cinematic edge vignette
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.65, 'rgba(0,0,0,0.35)');
      vignette.addColorStop(1, 'rgba(2, 4, 8, 0.94)');
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
