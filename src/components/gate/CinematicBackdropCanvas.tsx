import React, { useEffect, useRef } from 'react';
import { type CinematicTheme } from './themeManager';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
  isPulsar: boolean;
}

interface NebulaNode {
  baseX: number;
  baseY: number;
  radiusMult: number;
  color: string;
  speed: number;
  phaseX: number;
  phaseY: number;
}

/**
 * High-End Cybernetic Constellation & Living Nebula Animated Background Canvas
 * Features:
 * - Fluid multi-node volumetric radiant phosphor aura waves
 * - Dynamic constellation particle web with distance-reactive geometric connecting lines
 * - Pulsar star nodes with specular bloom halos
 * - Subtle architectural coordinate reticles (+) for high-end digital gallery precision
 * - Hardware-accelerated, High-DPI (Retina/4K) calibrated, and zero CPU waste when paused
 */
export const CinematicBackdropCanvas: React.FC<{ theme?: CinematicTheme; isPaused?: boolean }> = ({
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = (canvas.width = window.innerWidth * dpr);
    let height = (canvas.height = window.innerHeight * dpr);

    const handleResize = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.width = window.innerWidth * dpr;
      height = canvas.height = window.innerHeight * dpr;
    };
    window.addEventListener('resize', handleResize);

    // 4 Living Ambient Mesh Nebula Nodes (Soft celestial cyan and violet aura matching showcase)
    const nebulaNodes: NebulaNode[] = [
      {
        baseX: 0.22,
        baseY: 0.32,
        radiusMult: 0.58,
        color: 'rgba(56, 189, 248, ',
        speed: 0.0012,
        phaseX: 0,
        phaseY: 1.2,
      },
      {
        baseX: 0.8,
        baseY: 0.62,
        radiusMult: 0.68,
        color: 'rgba(139, 92, 246, ',
        speed: 0.0009,
        phaseX: 2.1,
        phaseY: 0.7,
      },
      {
        baseX: 0.48,
        baseY: 0.88,
        radiusMult: 0.52,
        color: 'rgba(56, 189, 248, ',
        speed: 0.0014,
        phaseX: 1.4,
        phaseY: 2.4,
      },
      {
        baseX: 0.88,
        baseY: 0.18,
        radiusMult: 0.48,
        color: 'rgba(139, 92, 246, ',
        speed: 0.0008,
        phaseX: 3.2,
        phaseY: 1.5,
      },
    ];

    // Constellation Specular Particles (Scales gracefully based on viewport)
    const count = Math.floor(Math.min(window.innerWidth, 1400) / 16);
    const particleCount = Math.max(45, Math.min(count, 90));

    const particles: Particle[] = Array.from({ length: particleCount }, () => {
      const isPulsar = Math.random() < 0.18;
      const baseRadius = (isPulsar ? Math.random() * 2.0 + 1.8 : Math.random() * 1.3 + 0.7) * dpr;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.42 * dpr,
        vy: (Math.random() - 0.5) * 0.42 * dpr,
        radius: baseRadius,
        baseRadius,
        alpha: Math.random() * 0.45 + 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.025 + 0.015,
        isPulsar,
      };
    });

    let time = 0;
    const maxConnectionDistance = 145 * dpr;

    const render = () => {
      time += 1;

      // 1. Deep Obsidian Base (#030406 matching showcase)
      ctx.fillStyle = '#030406';
      ctx.fillRect(0, 0, width, height);

      // 2. Living Ambient Mesh Nebula Waves (Noticeable radiant luminescence)
      for (let i = 0; i < nebulaNodes.length; i++) {
        const node = nebulaNodes[i];
        const cx = (node.baseX + Math.sin(time * node.speed + node.phaseX) * 0.14) * width;
        const cy = (node.baseY + Math.cos(time * node.speed * 0.85 + node.phaseY) * 0.12) * height;
        const radius = Math.max(width, height) * node.radiusMult;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `${node.color}0.075)`);
        grad.addColorStop(0.35, `${node.color}0.035)`);
        grad.addColorStop(0.7, `${node.color}0.01)`);
        grad.addColorStop(1, 'rgba(3, 4, 6, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Cybernetic Architectural Coordinate Crosshairs (+) at Clean Intervals
      const gridSize = 120 * dpr;
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      const crossSize = 3.5 * dpr;
      for (let x = gridSize; x < width; x += gridSize) {
        for (let y = gridSize; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x - crossSize, y);
          ctx.lineTo(x + crossSize, y);
          ctx.moveTo(x, y - crossSize);
          ctx.lineTo(x, y + crossSize);
          ctx.stroke();
        }
      }

      // 4. Update and Draw Dynamic Geometric Constellation Web
      const len = particles.length;
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen bounds seamlessly
        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;

        // Pulsar breathing effect
        if (p.isPulsar) {
          p.pulsePhase += p.pulseSpeed;
          p.radius = p.baseRadius * (1 + Math.sin(p.pulsePhase) * 0.35);
        }

        // Draw connections between nearby particles
        for (let j = i + 1; j < len; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectionDistance) {
            const lineAlpha = (1 - dist / maxConnectionDistance) * 0.22;
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
            ctx.lineWidth = (1 - dist / maxConnectionDistance) * 1.25 * dpr;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 5. Draw Particles with Phosphor Specular Bloom
      for (let i = 0; i < len; i++) {
        const p = particles[i];

        if (p.isPulsar) {
          // Specular Bloom Halo around Pulsars
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4.0);
          glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
          glowGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.18)');
          glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4.0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Perimeter Edge Vignette (Blends into #050608)
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.7, 'rgba(5, 6, 8, 0.35)');
      vignette.addColorStop(1, '#050608');
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
  }, [isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 select-none"
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  );
};

export default CinematicBackdropCanvas;
