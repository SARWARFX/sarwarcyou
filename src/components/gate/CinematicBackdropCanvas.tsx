import React, { useEffect, useRef } from 'react';
import type { CinematicTheme } from './themeManager';

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

export const CinematicBackdropCanvas: React.FC<{ theme: CinematicTheme; isPaused?: boolean }> = ({
  theme,
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

    // Particles initialized according to theme
    const particles: Particle[] = Array.from({ length: theme.particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.8,
      speedY: (Math.random() * 0.4 + 0.2) * (theme.particleSpeed / 0.4),
      speedX: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.4 + 0.15,
      wobbleSpeed: Math.random() * 0.015 + 0.005,
      wobbleOffset: Math.random() * Math.PI * 2,
    }));

    // Drifting volumetric fog cloud nodes
    const fogLayers = [
      { x: 0, speed: 0.12, scaleY: 0.7, opacity: 0.25 },
      { x: 0, speed: -0.08, scaleY: 0.8, opacity: 0.18 },
      { x: 0, speed: 0.18, scaleY: 0.6, opacity: 0.22 },
    ];

    let time = 0;

    const render = () => {
      time += 0.01;

      // 1. Base Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, theme.bgGradient[0]);
      bgGrad.addColorStop(0.5, theme.bgGradient[1]);
      bgGrad.addColorStop(1, theme.bgGradient[2]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Volumetric atmospheric fog waves
      for (let i = 0; i < fogLayers.length; i++) {
        const layer = fogLayers[i];
        layer.x = (layer.x + layer.speed) % (width * 1.5);

        const cx = (layer.x + width * 0.5) % (width * 1.5) - width * 0.25;
        const cy = height * (0.35 + i * 0.2) + Math.sin(time * 0.6 + i) * 25;

        const fogGrad = ctx.createRadialGradient(cx, cy, width * 0.08, cx, cy, width * 0.75);
        fogGrad.addColorStop(0, `${theme.fogColor}${layer.opacity})`);
        fogGrad.addColorStop(0.5, `${theme.fogColor}${layer.opacity * 0.4})`);
        fogGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Subtle ambient glow accent
      if (theme.glowAccent) {
        const glowGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.45,
          10,
          width * 0.5,
          height * 0.45,
          width * 0.6
        );
        glowGrad.addColorStop(0, theme.glowAccent);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 4. Floating atmospheric particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.4 + p.speedX;

        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        ctx.fillStyle = `${theme.particleColor}${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Heavy cinematic vignette
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.6, 'rgba(0,0,0,0.3)');
      vignette.addColorStop(1, theme.vignetteColor);
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
      className="fixed inset-0 pointer-events-none -z-10 w-full h-full"
      style={{ imageRendering: 'auto' }}
    />
  );
};
