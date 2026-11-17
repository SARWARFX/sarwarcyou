import React, { useRef, useEffect } from 'react';

export const TacticalTelemetryGraph: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dataPoints = [25, 45, 30, 68, 55, 82, 40, 72, 88, 60, 48, 75, 92, 80];

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const time = performance.now() * 0.002;
      dataPoints.shift();
      const nextVal = 30 + Math.sin(time * 2) * 22 + Math.cos(time * 3.5) * 18 + (Math.random() * 10);
      dataPoints.push(Math.max(10, Math.min(90, nextVal)));

      const stepX = w / (dataPoints.length - 1);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.4;

      for (let i = 0; i < dataPoints.length; i++) {
        const x = i * stepX;
        const y = h - (dataPoints[i] / 100) * (h - 4);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevY = h - (dataPoints[i - 1] / 100) * (h - 4);
          ctx.lineTo(x, prevY); // Strict horizontal
          ctx.lineTo(x, y);     // Strict vertical
        }
      }
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      className="w-48 sm:w-56 h-10 relative bg-transparent"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block bg-transparent"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      />
    </div>
  );
};

export default TacticalTelemetryGraph;
