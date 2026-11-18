import React, { useRef, useEffect } from 'react';

interface FluidNode {
  x: number;
  y: number;
  targetY: number;
  velocity: number;
}

interface CyberBubble {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  wobble: number;
  alpha: number;
}

export interface CryoFluidCanvasProps {
  fillPercent: number; // 0 to 100
  isPlaybackReady: boolean;
}

/**
 * CryoFluidCanvas — Photorealistic 1D Spring-Mass Cryogenic Cyber Fluid
 * - Style 3: Bioluminescent Neon Plasma
 * - Physics: 32-column spring mesh with surface tension, damping, and wave coupling
 * - Renders electric cyan fluid body, laser meniscus, and floating cyber motes
 * - Automatically tears down animation loop when playback begins to consume 0% CPU
 */
export const CryoFluidCanvas: React.FC<CryoFluidCanvasProps> = ({
  fillPercent,
  isPlaybackReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillPctRef = useRef(fillPercent);
  const isReadyRef = useRef(isPlaybackReady);

  useEffect(() => {
    fillPctRef.current = fillPercent;
  }, [fillPercent]);

  useEffect(() => {
    isReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isActive = true;

    const nodeCount = 28;
    const tension = 0.03;
    const damping = 0.045;
    const spread = 0.22;

    let width = canvas.clientWidth || 200;
    let height = canvas.clientHeight || 356;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Initialize surface nodes
    const nodes: FluidNode[] = [];
    for (let i = 0; i <= nodeCount; i++) {
      nodes.push({
        x: (i / nodeCount) * width,
        y: height,
        targetY: height,
        velocity: 0,
      });
    }

    // Initialize cyber bubbles/motes
    const bubbles: CyberBubble[] = [];
    const maxBubbles = 26;
    for (let i = 0; i < maxBubbles; i++) {
      bubbles.push({
        x: Math.random() * width,
        y: height + Math.random() * 40,
        radius: Math.random() * 2.2 + 0.8,
        speedY: Math.random() * 1.6 + 1.0,
        wobble: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.7 + 0.3,
      });
    }

    let currentFill = fillPctRef.current;

    const tick = () => {
      if (!isActive) return;

      // Smoothly interpolate current fill towards target
      const targetFill = isReadyRef.current ? 100 : fillPctRef.current;
      currentFill += (targetFill - currentFill) * 0.12;

      const surfaceY = height - (Math.max(0, Math.min(100, currentFill)) / 100) * height;

      // Update node target Y
      for (let i = 0; i <= nodeCount; i++) {
        nodes[i].targetY = surfaceY;
        // Natural gentle fluid motion
        if (Math.random() < 0.08 && currentFill < 98) {
          nodes[i].velocity += (Math.random() - 0.5) * 3.5;
        }
      }

      // 1. Spring physics
      for (let i = 0; i <= nodeCount; i++) {
        const node = nodes[i];
        const dy = node.y - node.targetY;
        const accel = -tension * dy - damping * node.velocity;
        node.y += node.velocity;
        node.velocity += accel;
      }

      // 2. Neighbor coupling
      const leftDeltas = new Array(nodes.length).fill(0);
      const rightDeltas = new Array(nodes.length).fill(0);

      for (let step = 0; step < 6; step++) {
        for (let i = 0; i < nodes.length; i++) {
          if (i > 0) {
            leftDeltas[i] = spread * (nodes[i].y - nodes[i - 1].y);
            nodes[i - 1].velocity += leftDeltas[i];
          }
          if (i < nodes.length - 1) {
            rightDeltas[i] = spread * (nodes[i].y - nodes[i + 1].y);
            nodes[i + 1].velocity += rightDeltas[i];
          }
        }
        for (let i = 0; i < nodes.length; i++) {
          if (i > 0) nodes[i - 1].y += leftDeltas[i];
          if (i < nodes.length - 1) nodes[i + 1].y += rightDeltas[i];
        }
      }

      // 3. Update bubbles
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.y -= b.speedY;
        b.wobble += 0.08;
        b.x += Math.sin(b.wobble) * 0.4;

        if (b.y < surfaceY || b.y < 0) {
          b.y = height + Math.random() * 20;
          b.x = Math.random() * width;
        }
      }

      // 4. Render
      ctx.clearRect(0, 0, width, height);

      if (currentFill > 0.5) {
        // Fluid Body
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(nodes[0].x, nodes[0].y);

        for (let i = 0; i < nodes.length - 1; i++) {
          const curr = nodes[i];
          const next = nodes[i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);
        ctx.lineTo(width, height);
        ctx.closePath();

        // Style 3 Cryo Plasma Gradient
        const cyanGrad = ctx.createLinearGradient(0, surfaceY, 0, height);
        cyanGrad.addColorStop(0, 'rgba(0, 240, 255, 0.72)');
        cyanGrad.addColorStop(0.25, 'rgba(6, 182, 212, 0.78)');
        cyanGrad.addColorStop(0.75, 'rgba(2, 45, 80, 0.88)');
        cyanGrad.addColorStop(1, 'rgba(1, 15, 28, 0.94)');
        ctx.fillStyle = cyanGrad;
        ctx.fill();

        ctx.clip();

        // Render micro cyber motes
        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          if (b.y > surfaceY && b.y < height) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 211, 238, ${b.alpha * 0.9})`;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 6;
            ctx.fill();
          }
        }
        ctx.restore();

        // Neon Laser Meniscus Edge
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (let i = 0; i < nodes.length - 1; i++) {
          const curr = nodes[i];
          const next = nodes[i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
      }

      // If fully ready and faded out, stop animation to save battery
      if (isReadyRef.current && currentFill >= 99.8) {
        isActive = false;
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-700 ${
        isPlaybackReady ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      />
      {/* Curved glass specular glare reflection */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 14%, transparent 28%, transparent 65%, rgba(255,255,255,0.04) 75%, transparent 85%)',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 0,
          outline: 'none',
        }}
      />
      {/* Top right HUD buffer percentage */}
      <div
        className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 border border-[#00f0ff]/30 text-[9px] font-mono font-bold text-[#00f0ff] shadow-[0_0_10px_rgba(0,0,0,0.9)]"
        style={{ borderRadius: 0, outline: 'none' }}
      >
        {Math.round(fillPercent)}%
      </div>
      {/* Bottom status badge */}
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1.5 px-1.5 py-0.5 bg-black/85 border border-[#00f0ff]/30 text-[9px] font-mono font-bold text-[#38bdf8]"
        style={{ borderRadius: 0, outline: 'none' }}
      >
        <span className="w-1.5 h-1.5 bg-[#00f0ff] shadow-[0_0_6px_#00f0ff] animate-pulse" />
        <span>CRYO-BUFFER</span>
      </div>
    </div>
  );
};
