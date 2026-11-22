// Extrahiert eine kräftige, aber dunkle Akzentfarbe aus einem Cover für den dynamischen Hintergrund.
const memo = new Map<string, Palette>();

export type Palette = { base: string; glow: string; accent: string };

export const DEFAULT_PALETTE: Palette = { base: '24 32 28', glow: '58 92 70', accent: '134 214 160' };

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)).join(' ');
}

export async function paletteFromImage(url?: string): Promise<Palette> {
  if (!url) return DEFAULT_PALETTE;
  const cached = memo.get(url);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  try {
    await img.decode();
  } catch {
    return DEFAULT_PALETTE;
  }

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return DEFAULT_PALETTE; // CORS
  }

  // Farbtöne in 24 Eimer sortieren, gewichtet nach Sättigung – so gewinnt die "Charakterfarbe", nicht Grau.
  const buckets = Array.from({ length: 24 }, () => ({ w: 0, s: 0, l: 0, h: 0 }));
  let greyW = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.08 || l > 0.95) continue;
    if (s < 0.15) {
      greyW += 1;
      continue;
    }
    const w = s * s * (1 - Math.abs(l - 0.5));
    const b = buckets[Math.floor(h / 15) % 24];
    b.w += w;
    b.s += s * w;
    b.l += l * w;
    b.h += h * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  let palette: Palette;
  if (best.w < 2 || best.w < greyW * 0.02) {
    palette = { base: '26 27 30', glow: '70 72 80', accent: '220 222 228' };
  } else {
    const h = best.h / best.w;
    const s = Math.min(0.75, best.s / best.w);
    palette = {
      base: hslToRgb(h, s * 0.55, 0.11),
      glow: hslToRgb(h, s * 0.8, 0.3),
      accent: hslToRgb(h, Math.max(0.55, s), 0.68),
    };
  }
  memo.set(url, palette);
  return palette;
}
