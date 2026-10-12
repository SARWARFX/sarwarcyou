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

export function createProceduralFrameTexture(options: TextureOptions): THREE.CanvasTexture {
  const { title, category, index, total } = options;
  const canvas = document.createElement('canvas');
  // 3:4 portrait resolution
  canvas.width = 1024;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d')!;

  const palette = options.colorTheme || COLOR_PALETTES[index % COLOR_PALETTES.length];

  // 1. Dark obsidian background
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1440);
  bgGrad.addColorStop(0, '#0d0e14');
  bgGrad.addColorStop(0.5, '#131520');
  bgGrad.addColorStop(1, '#08080c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1440);

  // Subtle carbon fiber diagonal texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let i = -1440; i < 2464; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1440, 1440);
    ctx.stroke();
  }

  // 2. Inner fine framing line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, 904, 1320);

  // Corner viewfinder brackets on the canvas
  const cornerLen = 40;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 4;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(40, 40 + cornerLen);
  ctx.lineTo(40, 40);
  ctx.lineTo(40 + cornerLen, 40);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(984 - cornerLen, 40);
  ctx.lineTo(984, 40);
  ctx.lineTo(984, 40 + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(40, 1400 - cornerLen);
  ctx.lineTo(40, 1400);
  ctx.lineTo(40 + cornerLen, 1400);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(984 - cornerLen, 1400);
  ctx.lineTo(984, 1400);
  ctx.lineTo(984, 1400 - cornerLen);
  ctx.stroke();

  // 3. Top Category Tag
  ctx.fillStyle = palette.primary;
  ctx.font = 'bold 30px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`[ ${category.toUpperCase()} // PHOTO ${(index + 1).toString().padStart(2, '0')} ]`, 90, 120);

  // 4. Center Glowing Circular Watermark & Large Index
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.font = 'bold 440px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${(index + 1).toString().padStart(2, '0')}`, 512, 850);

  // Center portrait silhouette frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(262, 380, 500, 660);

  // Neon glowing center icon
  ctx.fillStyle = palette.primary;
  ctx.font = 'bold 28px "Space Grotesk", monospace';
  ctx.fillText('PORTRAIT FRAME • 3D', 512, 720);

  // 5. Clean Title Wrap at Bottom
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 italic 52px "Space Grotesk", sans-serif';

  const cleanName = title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  const words = cleanName.split(' ');
  let line = '';
  const lines: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const testLine = line + (line ? ' ' : '') + words[i];
    if (testLine.length > 18 && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const startY = 1140 - ((lines.length - 1) * 35);
  lines.forEach((l, i) => {
    ctx.fillText(l.toUpperCase(), 512, startY + (i * 64));
  });

  // 6. Bottom spec footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '22px monospace';
  ctx.fillText(`PHOTO ${index + 1} OF ${total} • SARWAR.CYOU`, 512, 1330);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Keep alias for backward compatibility
export const createProceduralCanTexture = createProceduralFrameTexture;

export function createComingSoonTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Dark cyber glass
  ctx.fillStyle = 'rgba(6, 12, 24, 0.9)';
  ctx.fillRect(0, 0, 1024, 1024);

  // Outer glowing border
  ctx.strokeStyle = '#00D2FF';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, 964, 964);

  // Inner dashed border
  ctx.setLineDash([16, 12]);
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(55, 55, 914, 914);
  ctx.setLineDash([]);

  // Top system tag
  ctx.fillStyle = '#00D2FF';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('// FUTURE VAULT ARCHIVE //', 512, 160);

  // Big Glowing COMING SOON
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 84px "Space Grotesk", sans-serif';
  ctx.shadowColor = '#00D2FF';
  ctx.shadowBlur = 35;
  ctx.fillText('COMING SOON', 512, 450);
  ctx.shadowBlur = 0;

  // Title
  ctx.fillStyle = '#00D2FF';
  ctx.font = 'bold 42px "Space Grotesk", sans-serif';
  ctx.fillText(title.toUpperCase(), 512, 550);

  // Subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '26px monospace';
  ctx.fillText(subtitle.toUpperCase(), 512, 640);

  // Bottom Status
  ctx.fillStyle = 'rgba(0, 210, 255, 0.8)';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('ENCRYPTED QUEUE • 0 ITEMS CURRENTLY LOADED', 512, 850);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

