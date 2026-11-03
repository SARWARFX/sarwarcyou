import React, { useEffect, useRef } from 'react';

interface AmbientFogCanvasProps {
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

export const AmbientFogCanvas: React.FC<AmbientFogCanvasProps> = ({ intensity = 'normal' }) => {
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

    // Ambient floating particles
    const particleCount = intensity === 'dense' ? 65 : 40;
    const particles: AshParticle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.6,
      speedY: Math.random() * 0.5 + 0.25,
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
      wobbleSpeed: Math.random() * 0.015 + 0.005,
      wobbleOffset: Math.random() * Math.PI * 2,
    }));

    // Drifting volumetric fog cloud layers
    const fogLayers = [
      { x: 0, speed: 0.16, scaleY: 0.75, opacity: 0.22, color: 'rgba(26, 30, 38, ' },
      { x: 0, speed: -0.1, scaleY: 0.85, opacity: 0.18, color: 'rgba(18, 22, 28, ' },
      { x: 0, speed: 0.24, scaleY: 0.65, opacity: 0.26, color: 'rgba(30, 36, 46, ' },
    ];

    let time = 0;

    const render = () => {
      time += 0.012;

      // 1. Dark, refined slate canvas backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#07080a');
      bgGrad.addColorStop(0.5, '#0e1014');
      bgGrad.addColorStop(1, '#050608');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Volumetric drifting procedural fog bands
      for (let i = 0; i < fogLayers.length; i++) {
        const layer = fogLayers[i];
        layer.x = (layer.x + layer.speed) % (width * 1.5);

        const fogGrad = ctx.createRadialGradient(
          (layer.x + width * 0.5) % (width * 1.5) - width * 0.25,
          height * (0.35 + i * 0.2) + Math.sin(time * 0.8 + i) * 30,
          width * 0.1,
          (layer.x + width * 0.5) % (width * 1.5) - width * 0.25,
          height * (0.35 + i * 0.2),
          width * 0.8
        );
        fogGrad.addColorStop(0, `${layer.color}${layer.opacity})`);
        fogGrad.addColorStop(0.5, `${layer.color}${layer.opacity * 0.5})`);
        fogGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Falling micro-ambient particles with subtle sine drift
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.5 + p.speedX;

        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;

        ctx.fillStyle = `rgba(210, 215, 225, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Subtle dark peripheral vignette
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.4,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.7, 'rgba(4, 5, 7, 0.4)');
      vignette.addColorStop(1, 'rgba(2, 3, 4, 0.85)');
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
