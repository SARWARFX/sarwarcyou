import React, { useEffect, useRef } from 'react';

export const AuraCanvas: React.FC = () => {
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

    // 4 Chromatic living ambient light nodes
    const nodes = [
      {
        baseX: 0.25,
        baseY: 0.3,
        radiusMult: 0.55,
        color: 'rgba(28, 48, 85, ',
        speed: 0.0025,
        phaseX: 0,
        phaseY: 1.2,
      },
      {
        baseX: 0.75,
        baseY: 0.45,
        radiusMult: 0.65,
        color: 'rgba(54, 32, 78, ',
        speed: 0.002,
        phaseX: 2.1,
        phaseY: 0.5,
      },
      {
        baseX: 0.5,
        baseY: 0.8,
        radiusMult: 0.6,
        color: 'rgba(22, 52, 68, ',
        speed: 0.003,
        phaseX: 1.5,
        phaseY: 2.7,
      },
      {
        baseX: 0.85,
        baseY: 0.15,
        radiusMult: 0.45,
        color: 'rgba(38, 28, 54, ',
        speed: 0.0018,
        phaseX: 3.2,
        phaseY: 1.8,
      },
    ];

    let t = 0;

    const render = () => {
      t += 1;

      // 1. Deep obsidian base foundation
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#07080a');
      bgGrad.addColorStop(0.5, '#0a0c10');
      bgGrad.addColorStop(1, '#050608');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Living chromatic mesh gradients
      for (const node of nodes) {
        const x = (node.baseX + Math.sin(t * node.speed + node.phaseX) * 0.12) * width;
        const y = (node.baseY + Math.cos(t * node.speed * 0.8 + node.phaseY) * 0.1) * height;
        const r = Math.max(width, height) * node.radiusMult;

        const radial = ctx.createRadialGradient(x, y, 0, x, y, r);
        radial.addColorStop(0, `${node.color}0.42)`);
        radial.addColorStop(0.45, `${node.color}0.18)`);
        radial.addColorStop(0.8, `${node.color}0.04)`);
        radial.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Ultra-subtle optical vignette for soft peripheral focus
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.45,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.8, 'rgba(5, 6, 8, 0.35)');
      vignette.addColorStop(1, 'rgba(3, 4, 6, 0.7)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
      style={{ display: 'block' }}
    />
  );
};
