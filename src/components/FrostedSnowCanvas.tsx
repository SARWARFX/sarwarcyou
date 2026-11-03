import React, { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  opacity: number;
  wobbleSpeed: number;
  wobbleOffset: number;
  layer: 'bg' | 'mid' | 'fg';
}

export const FrostedSnowCanvas: React.FC = () => {
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

    // Initialize 3-layer parallax snowfall
    const snowflakes: Snowflake[] = [];

    // Layer 1: Background distant micro-snow (100 particles)
    for (let i = 0; i < 100; i++) {
      snowflakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.2 + 0.6,
        speedY: Math.random() * 0.7 + 0.4,
        speedX: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.35 + 0.15,
        wobbleSpeed: Math.random() * 0.015 + 0.005,
        wobbleOffset: Math.random() * Math.PI * 2,
        layer: 'bg',
      });
    }

    // Layer 2: Midground crisp snowflakes (60 particles)
    for (let i = 0; i < 60; i++) {
      snowflakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 1.8,
        speedY: Math.random() * 1.2 + 1.0,
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.4 + 0.5,
        wobbleSpeed: Math.random() * 0.02 + 0.01,
        wobbleOffset: Math.random() * Math.PI * 2,
        layer: 'mid',
      });
    }

    // Layer 3: Foreground cinematic bokeh snowflakes (18 particles)
    for (let i = 0; i < 18; i++) {
      snowflakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 5 + 6,
        speedY: Math.random() * 1.6 + 2.2,
        speedX: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.2 + 0.18,
        wobbleSpeed: Math.random() * 0.012 + 0.008,
        wobbleOffset: Math.random() * Math.PI * 2,
        layer: 'fg',
      });
    }

    // Soft winter atmospheric drift nodes
    const frostMistNodes = [
      { baseX: 0.2, baseY: 0.3, radius: 0.5, color: 'rgba(140, 190, 240, 0.045)', speed: 0.0008, phase: 0 },
      { baseX: 0.8, baseY: 0.4, radius: 0.6, color: 'rgba(170, 215, 255, 0.04)', speed: 0.0006, phase: 2.1 },
      { baseX: 0.5, baseY: 0.85, radius: 0.55, color: 'rgba(130, 175, 220, 0.035)', speed: 0.001, phase: 1.4 },
    ];

    let time = 0;

    const render = () => {
      time += 0.015;

      // 1. Deep arctic winter night foundation gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#070b12');
      skyGrad.addColorStop(0.3, '#0d1522');
      skyGrad.addColorStop(0.65, '#121d2e');
      skyGrad.addColorStop(1, '#080d16');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Drifting procedural frost mist / cold winter air glow
      for (let i = 0; i < frostMistNodes.length; i++) {
        const node = frostMistNodes[i];
        const cx = (node.baseX + Math.sin(time * node.speed * 60 + node.phase) * 0.08) * width;
        const cy = (node.baseY + Math.cos(time * node.speed * 40 + node.phase) * 0.06) * height;
        const r = width * node.radius;

        const mistGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        mistGrad.addColorStop(0, node.color);
        mistGrad.addColorStop(0.6, 'rgba(150, 195, 235, 0.015)');
        mistGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = mistGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Falling snow particles
      const breeze = Math.sin(time * 0.5) * 0.35 + 0.15; // Gentle winter wind drift

      for (let i = 0; i < snowflakes.length; i++) {
        const p = snowflakes[i];

        p.y += p.speedY;
        p.x += Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * 0.6 + p.speedX + breeze;

        // Wrap around vertically
        if (p.y > height + p.radius + 10) {
          p.y = -p.radius - 5;
          p.x = Math.random() * width;
        }

        // Wrap around horizontally
        if (p.x > width + 20) {
          p.x = -15;
        } else if (p.x < -20) {
          p.x = width + 15;
        }

        if (p.layer === 'fg') {
          // Foreground bokeh snowflakes: soft out-of-focus blur gradient
          const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          radial.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
          radial.addColorStop(0.4, `rgba(230, 245, 255, ${p.opacity * 0.6})`);
          radial.addColorStop(1, 'rgba(215, 235, 255, 0)');
          ctx.fillStyle = radial;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.layer === 'mid') {
          // Midground snowflakes: crisp with slight halo glow
          ctx.fillStyle = `rgba(240, 248, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Background micro-snow: subtle soft point
          ctx.fillStyle = `rgba(210, 230, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Subtle frosted ice vignette around screen perimeter
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.45,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.7, 'rgba(10, 18, 30, 0.2)');
      vignette.addColorStop(1, 'rgba(6, 12, 22, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      {/* Crystalline winter snowfall canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none -z-10 w-full h-full"
        style={{ imageRendering: 'auto' }}
      />

      {/* Frosted edge glass overlay for authentic frosted window aesthetics */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          boxShadow: 'inset 0 0 120px rgba(180, 220, 255, 0.06), inset 0 0 40px rgba(255, 255, 255, 0.03)',
        }}
      />
    </>
  );
};

export default FrostedSnowCanvas;
