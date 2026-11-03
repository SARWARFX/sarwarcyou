import React, { useEffect, useRef } from 'react';

interface SilentHillCanvasProps {
  intensity?: 'normal' | 'dense';
}

interface AshParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  wobbleSpeed: number;
  wobbleOffset: number;
}

export const SilentHillCanvas: React.FC<SilentHillCanvasProps> = ({ intensity = 'normal' }) => {
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

    // Initialize ambient ash particles (Silent Hill flakes)
    const particleCount = intensity === 'dense' ? 90 : 55;
    const ashParticles: AshParticle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.7 + 0.35,
      speedX: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.55 + 0.15,
      wobbleSpeed: Math.random() * 0.02 + 0.008,
      wobbleOffset: Math.random() * Math.PI * 2,
    }));

    // Drifting volumetric fog cloud layers
    const fogLayers = [
      { x: 0, speed: 0.18, scaleY: 0.75, opacity: 0.28, color: 'rgba(28, 32, 38, ' },
      { x: 0, speed: -0.12, scaleY: 0.85, opacity: 0.22, color: 'rgba(20, 24, 29, ' },
      { x: 0, speed: 0.28, scaleY: 0.65, opacity: 0.32, color: 'rgba(34, 38, 46, ' },
    ];

    let time = 0;

    const render = () => {
      time += 0.015;

      // 1. Dark, cold industrial slate canvas backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090a0c');
      bgGrad.addColorStop(0.5, '#101215');
      bgGrad.addColorStop(1, '#07080a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Volumetric drifting procedural fog bands
      for (let i = 0; i < fogLayers.length; i++) {
        const layer = fogLayers[i];
        layer.x = (layer.x + layer.speed) % (width * 1.5);

        const fogGrad = ctx.createRadialGradient(
          (layer.x + width * 0.5) % (width * 1.5) - width * 0.25,
          height * (0.35 + i * 0.2) + Math.sin(time * 0.8 + i) * 35,
          width * 0.1,
          (layer.x + width * 0.5) % (width * 1.5) - width * 0.25,
          height * (0.35 + i * 0.2),
          width * 0.75
        );
        fogGrad.addColorStop(0, `${layer.color}${layer.opacity})`);
        fogGrad.addColorStop(0.5, `${layer.color}${layer.opacity * 0.5})`);
        fogGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Falling Ash particles with subtle sine-wave drift
      for (let i = 0; i < ashParticles.length; i++) {
        const p = ashParticles[i];
        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.6 + p.speedX;

        // Wrap around bottom/sides
        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;

        ctx.fillStyle = `rgba(195, 200, 208, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Heavy psychological vignette on screen perimeter
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.7, 'rgba(5, 6, 8, 0.45)');
      vignette.addColorStop(1, 'rgba(3, 4, 5, 0.88)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
      style={{ display: 'block' }}
    />
  );
};
