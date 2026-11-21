import React, { useEffect, useRef, useState } from 'react';
import { type CinematicTheme } from './themeManager';

export const ANIMATION_PRESETS = [
  'CONSTELLATION',
  'PLASMA_EMBERS',
  'COSMIC_NEBULA',
  'QUANTUM_HORIZON',
  'HYPERSPACE_TUNNEL',
  'SILICON_TRACES',
] as const;

export type BackgroundAnimationType = typeof ANIMATION_PRESETS[number];

/**
 * Ensures the chosen animation is fixed throughout a single visit (session).
 * It will not change upon tab or page switching.
 */
function getVisitBackgroundAnimation(): BackgroundAnimationType {
  if (typeof window === 'undefined') return 'CONSTELLATION';
  try {
    const saved = sessionStorage.getItem('sarwar_visit_bg_animation');
    if (saved && ANIMATION_PRESETS.includes(saved as BackgroundAnimationType)) {
      return saved as BackgroundAnimationType;
    }
    const chosen = ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)];
    sessionStorage.setItem('sarwar_visit_bg_animation', chosen);
    return chosen;
  } catch {
    return 'CONSTELLATION';
  }
}

export const CinematicBackdropCanvas: React.FC<{
  theme?: CinematicTheme;
  isPaused?: boolean;
  forcedType?: BackgroundAnimationType;
}> = ({ isPaused = false, forcedType }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fixed for each visit
  const [animationType] = useState<BackgroundAnimationType>(() => {
    return forcedType || getVisitBackgroundAnimation();
  });

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
      initCurrentEngine();
    };
    window.addEventListener('resize', handleResize);

    // =========================================================================
    // 1. ENGINE: CONSTELLATION MESH
    // =========================================================================
    interface ConstellationParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      isPulsar: boolean;
      pulsePhase: number;
    }
    let constellationParticles: ConstellationParticle[] = [];

    const initConstellation = () => {
      const count = Math.min(Math.round((width * height) / 32000), 75);
      constellationParticles = [];
      for (let i = 0; i < count; i++) {
        constellationParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45 * dpr,
          vy: (Math.random() - 0.5) * 0.45 * dpr,
          radius: (Math.random() * 1.5 + 1.0) * dpr,
          isPulsar: Math.random() < 0.18,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    const renderConstellation = (time: number) => {
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, width, height);

      const grad = ctx.createRadialGradient(width * 0.3, height * 0.4, 0, width * 0.3, height * 0.4, width * 0.55);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const grad2 = ctx.createRadialGradient(width * 0.75, height * 0.65, 0, width * 0.75, height * 0.65, width * 0.6);
      grad2.addColorStop(0, 'rgba(168, 85, 247, 0.07)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      const maxDist = 135 * dpr;
      for (let i = 0; i < constellationParticles.length; i++) {
        const p1 = constellationParticles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;
        if (p1.x < 0) p1.x = width;
        if (p1.x > width) p1.x = 0;
        if (p1.y < 0) p1.y = height;
        if (p1.y > height) p1.y = 0;

        for (let j = i + 1; j < constellationParticles.length; j++) {
          const p2 = constellationParticles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.28;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.8 * dpr;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = p1.isPulsar ? '#38bdf8' : '#ffffff';
        ctx.beginPath();
        const r = p1.isPulsar ? p1.radius * (1 + 0.35 * Math.sin(time * 0.003 + p1.pulsePhase)) : p1.radius;
        ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // =========================================================================
    // 2. ENGINE: PLASMA ENERGY EMBERS
    // =========================================================================
    interface EmberParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      colorType: 'cyan' | 'violet' | 'red';
      flicker: number;
    }
    let emberParticles: EmberParticle[] = [];

    const initPlasmaEmbers = () => {
      const count = Math.min(Math.round((width * height) / 22000), 100);
      emberParticles = [];
      for (let i = 0; i < count; i++) {
        emberParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.6 * dpr,
          vy: -(Math.random() * 0.9 + 0.4) * dpr,
          radius: (Math.random() * 2.2 + 0.8) * dpr,
          colorType: Math.random() < 0.6 ? 'cyan' : Math.random() < 0.5 ? 'violet' : 'red',
          flicker: Math.random() * Math.PI * 2,
        });
      }
    };

    const renderPlasmaEmbers = (time: number) => {
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, width, height);

      for (let p of emberParticles) {
        p.x += p.vx + Math.sin(time * 0.002 + p.flicker) * 0.3 * dpr;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        const alpha = 0.45 + 0.35 * Math.sin(time * 0.004 + p.flicker);
        const col =
          p.colorType === 'cyan'
            ? `56, 189, 248, ${alpha}`
            : p.colorType === 'violet'
            ? `168, 85, 247, ${alpha}`
            : `239, 68, 68, ${alpha}`;

        ctx.fillStyle = `rgba(${col})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${col.replace(`, ${alpha}`, ', 0.06')})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // =========================================================================
    // 3. ENGINE: COSMIC NEBULA & STAR DUST
    // =========================================================================
    interface CosmicStar {
      x: number;
      y: number;
      size: number;
      alpha: number;
      speed: number;
    }
    let cosmicStars: CosmicStar[] = [];

    const initCosmicNebula = () => {
      const count = 150;
      cosmicStars = [];
      for (let i = 0; i < count; i++) {
        cosmicStars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: (Math.random() * 1.6 + 0.4) * dpr,
          alpha: Math.random() * 0.7 + 0.2,
          speed: (Math.random() * 0.15 + 0.05) * dpr,
        });
      }
    };

    const renderCosmicNebula = (time: number) => {
      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, width, height);

      const cx = width * 0.5 + Math.cos(time * 0.0004) * (width * 0.15);
      const cy = height * 0.5 + Math.sin(time * 0.0003) * (height * 0.12);

      const neb1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.45);
      neb1.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
      neb1.addColorStop(0.6, 'rgba(168, 85, 247, 0.06)');
      neb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, width, height);

      for (let s of cosmicStars) {
        s.y += s.speed;
        if (s.y > height) s.y = 0;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    };

    // =========================================================================
    // 4. ENGINE: QUANTUM HORIZON (Topographic Sine Perspective)
    // =========================================================================
    const renderQuantumHorizon = (time: number) => {
      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, width, height);

      const numLines = 14;
      const startY = height * 0.42;
      const endY = height * 0.98;
      const stepY = (endY - startY) / numLines;

      for (let i = 0; i < numLines; i++) {
        const curY = startY + i * stepY;
        const progress = i / numLines;
        const alpha = 0.08 + progress * 0.35;
        const color = i % 2 === 0 ? `rgba(56, 189, 248, ${alpha})` : `rgba(168, 85, 247, ${alpha})`;

        ctx.strokeStyle = color;
        ctx.lineWidth = (0.8 + progress * 1.4) * dpr;
        ctx.beginPath();

        const waveSpeed = time * 0.0008 + i * 0.25;
        const amp = (12 + progress * 40) * dpr;

        for (let x = 0; x <= width; x += 12 * dpr) {
          const normX = x / width;
          const distFromCenter = Math.abs(normX - 0.5) * 2;
          const centerMask = Math.exp(-distFromCenter * distFromCenter * 2.2);

          const yDisp =
            Math.sin(normX * 8 + waveSpeed) * amp * centerMask +
            Math.cos(normX * 14 - waveSpeed * 0.7) * (amp * 0.4) * centerMask;

          if (x === 0) ctx.moveTo(x, curY + yDisp);
          else ctx.lineTo(x, curY + yDisp);
        }
        ctx.stroke();
      }
    };

    // =========================================================================
    // 5. ENGINE: HYPERSPACE TUNNEL (Warp Relativistic Drift)
    // =========================================================================
    interface TunnelStar {
      angle: number;
      radius: number;
      speed: number;
      length: number;
      color: string;
    }
    let tunnelStars: TunnelStar[] = [];

    const createTunnelStar = (): TunnelStar => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1.5;
      return {
        angle,
        radius: Math.random() * 40 * dpr,
        speed,
        length: Math.random() * 18 + 8,
        color: Math.random() < 0.7 ? '#38bdf8' : '#a855f7',
      };
    };

    const initHyperspaceTunnel = () => {
      const count = 180;
      tunnelStars = [];
      for (let i = 0; i < count; i++) {
        tunnelStars.push(createTunnelStar());
      }
    };

    const renderHyperspaceTunnel = () => {
      ctx.fillStyle = 'rgba(3, 5, 10, 0.28)';
      ctx.fillRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const maxR = Math.sqrt(cx * cx + cy * cy);

      for (let s of tunnelStars) {
        s.radius += s.speed * dpr * (s.radius / (60 * dpr) + 0.4);
        if (s.radius > maxR) {
          Object.assign(s, createTunnelStar());
        }

        const x1 = cx + Math.cos(s.angle) * s.radius;
        const y1 = cy + Math.sin(s.angle) * s.radius;
        const tailR = Math.max(0, s.radius - s.length * dpr * (s.radius / maxR + 0.2));
        const x2 = cx + Math.cos(s.angle) * tailR;
        const y2 = cy + Math.sin(s.angle) * tailR;

        const progress = s.radius / maxR;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = Math.min(1, progress * 1.5);
        ctx.lineWidth = (0.8 + progress * 2.0) * dpr;

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    };

    // =========================================================================
    // 6. ENGINE: SILICON TRACES (PCB Orthogonal Grid & Data Pulses)
    // =========================================================================
    interface CircuitNode {
      x: number;
      y: number;
      conns: CircuitNode[];
    }
    interface CircuitPulse {
      curr: CircuitNode;
      target: CircuitNode;
      t: number;
      speed: number;
    }
    let circuitNodes: CircuitNode[] = [];
    let circuitPulses: CircuitPulse[] = [];

    const initCircuitTraces = () => {
      const gridSize = 45 * dpr;
      const cols = Math.ceil(width / gridSize);
      const rows = Math.ceil(height / gridSize);
      circuitNodes = [];
      circuitPulses = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.35) {
            circuitNodes.push({
              x: c * gridSize,
              y: r * gridSize,
              conns: [],
            });
          }
        }
      }

      for (let i = 0; i < circuitNodes.length; i++) {
        const n1 = circuitNodes[i];
        for (let j = i + 1; j < circuitNodes.length; j++) {
          const n2 = circuitNodes[j];
          const dx = Math.abs(n1.x - n2.x);
          const dy = Math.abs(n1.y - n2.y);
          if ((dx === gridSize && dy === 0) || (dx === 0 && dy === gridSize)) {
            n1.conns.push(n2);
          }
        }
      }

      for (let k = 0; k < 25; k++) {
        const start = circuitNodes[Math.floor(Math.random() * circuitNodes.length)];
        if (start && start.conns.length > 0) {
          circuitPulses.push({
            curr: start,
            target: start.conns[0],
            t: 0,
            speed: Math.random() * 0.02 + 0.015,
          });
        }
      }
    };

    const renderCircuitTraces = () => {
      ctx.fillStyle = '#04060b';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      ctx.lineWidth = 1 * dpr;
      for (let n1 of circuitNodes) {
        for (let n2 of n1.conns) {
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();
        }
      }

      for (let p of circuitPulses) {
        p.t += p.speed;
        if (p.t >= 1) {
          p.curr = p.target;
          p.t = 0;
          if (p.curr.conns.length > 0) {
            p.target = p.curr.conns[Math.floor(Math.random() * p.curr.conns.length)];
          }
        }
        const px = p.curr.x + (p.target.x - p.curr.x) * p.t;
        const py = p.curr.y + (p.target.y - p.curr.y) * p.t;

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(px, py, 6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // =========================================================================
    // INITIALIZATION & DISPATCH LOOP
    // =========================================================================
    const initCurrentEngine = () => {
      if (animationType === 'CONSTELLATION') initConstellation();
      else if (animationType === 'PLASMA_EMBERS') initPlasmaEmbers();
      else if (animationType === 'COSMIC_NEBULA') initCosmicNebula();
      else if (animationType === 'HYPERSPACE_TUNNEL') initHyperspaceTunnel();
      else if (animationType === 'SILICON_TRACES') initCircuitTraces();
    };

    initCurrentEngine();

    const render = (time: number) => {
      if (animationType === 'CONSTELLATION') renderConstellation(time);
      else if (animationType === 'PLASMA_EMBERS') renderPlasmaEmbers(time);
      else if (animationType === 'COSMIC_NEBULA') renderCosmicNebula(time);
      else if (animationType === 'QUANTUM_HORIZON') renderQuantumHorizon(time);
      else if (animationType === 'HYPERSPACE_TUNNEL') renderHyperspaceTunnel();
      else if (animationType === 'SILICON_TRACES') renderCircuitTraces();

      if (!isPaused) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [animationType, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 select-none"
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  );
};

export default CinematicBackdropCanvas;
