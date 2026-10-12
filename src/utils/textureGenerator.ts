import * as THREE from 'three';

interface TextureOptions {
  title: string;
  category: string;
  index: number;
  total: number;
  colorTheme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const COLOR_PALETTES = [
  { primary: '#00D2FF', secondary: '#0066FF', accent: '#7000FF' }, // Cyber Cyan
  { primary: '#FF007A', secondary: '#9D00FF', accent: '#00E5FF' }, // Neon Violet
  { primary: '#00F5A0', secondary: '#00D2FF', accent: '#0072FF' }, // Emerald Ice
  { primary: '#FF8A00', secondary: '#FF0055', accent: '#7A00FF' }, // Solar Flare
  { primary: '#E59DE6', secondary: '#71BD96', accent: '#00A6E2' }, // Ciao Pastel
];

export function createProceduralCanTexture(options: TextureOptions): THREE.CanvasTexture {
  const { title, category, index, total } = options;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const palette = options.colorTheme || COLOR_PALETTES[index % COLOR_PALETTES.length];

  // 1. Dark metallic brushed background
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
  bgGrad.addColorStop(0, '#0a0b10');
  bgGrad.addColorStop(0.5, '#12141f');
  bgGrad.addColorStop(1, '#050608');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle metallic texture lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 1024; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // 2. Neon gradient decorative accent panels
  const barGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  barGrad.addColorStop(0, palette.primary);
  barGrad.addColorStop(0.5, palette.secondary);
  barGrad.addColorStop(1, palette.accent);

  ctx.fillStyle = barGrad;
  ctx.fillRect(80, 120, 864, 12);
  ctx.fillRect(80, 900, 864, 12);

  // Vertical cyber side marks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(80, 150, 4, 730);
  ctx.fillRect(940, 150, 4, 730);

  // 3. Category & Stage Tag
  ctx.fillStyle = palette.primary;
  ctx.font = 'bold 32px "Space Grotesk", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText(`[ ${category.toUpperCase()} // #0${(index + 1).toString().padStart(2, '0')} ]`, 120, 220);

  // 4. Large Index Number in Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.font = 'bold 340px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${(index + 1).toString().padStart(2, '0')}`, 512, 620);

  // 5. Main Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 italic 54px "Space Grotesk", sans-serif';

  // Multi-line wrap title
  const words = title.replace(/\.[^/.]+$/, '').split(/[\s_-]+/);
  let line = '';
  const lines: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const testLine = line + (line ? ' ' : '') + words[i];
    if (testLine.length > 16 && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const startY = 480 - ((lines.length - 1) * 35);
  lines.forEach((l, i) => {
    ctx.fillText(l.toUpperCase(), 512, startY + (i * 70));
  });

  // 6. Holographic Badge in Center
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.strokeRect(362, 700, 300, 60);

  ctx.fillStyle = palette.primary;
  ctx.font = 'bold 24px "Space Grotesk", monospace';
  ctx.fillText('SARWAR.CYOU 3D', 512, 738);

  // 7. Tech specs readout
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '20px monospace';
  ctx.fillText(`STREAM // GOOGLE DRIVE CLOUD • ${index + 1}/${total}`, 512, 850);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
