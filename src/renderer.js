const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const PADDING = 20;
const TILE_TEXT_SPACING = 1.5;
const TILE_IMAGE_SPACING = 1.2;
const DEFAULT_WATERMARK_TEXT = '© BmScriptsBox';
const CJK_PATTERN = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;
const CJK_FONT_CANDIDATES = [
  'Microsoft YaHei',
  'Noto Sans SC',
  'Source Han Sans SC',
  'Microsoft JhengHei',
  'SimHei',
  'SimSun',
  'PingFang SC',
];

let availableFonts = null;

function getAvailableFonts() {
  if (!availableFonts) {
    try {
      availableFonts = new Set(GlobalFonts.families.map((f) => (f && f.family) || f));
    } catch {
      availableFonts = new Set();
    }
  }
  return availableFonts;
}

function resolveCjkFont() {
  const available = getAvailableFonts();
  return CJK_FONT_CANDIDATES.find((name) => available.has(name)) || 'Microsoft YaHei';
}

// @napi-rs/canvas has no system font fallback: a Latin-only family renders CJK as .notdef.
// When the text contains CJK, substitute an available system CJK font.
function resolveFont(text, preferred) {
  if (!CJK_PATTERN.test(text)) return preferred;
  const available = getAvailableFonts();
  if (preferred && available.has(preferred) && CJK_FONT_CANDIDATES.indexOf(preferred) !== -1) {
    return preferred;
  }
  return resolveCjkFont();
}

function getPosition(canvasW, canvasH, elemW, elemH, pos) {
  const positions = {
    nw: { x: PADDING + elemW / 2, y: PADDING + elemH / 2 },
    n: { x: canvasW / 2, y: PADDING + elemH / 2 },
    ne: { x: canvasW - PADDING - elemW / 2, y: PADDING + elemH / 2 },
    w: { x: PADDING + elemW / 2, y: canvasH / 2 },
    c: { x: canvasW / 2, y: canvasH / 2 },
    e: { x: canvasW - PADDING - elemW / 2, y: canvasH / 2 },
    sw: { x: PADDING + elemW / 2, y: canvasH - PADDING - elemH / 2 },
    s: { x: canvasW / 2, y: canvasH - PADDING - elemH / 2 },
    se: { x: canvasW - PADDING - elemW / 2, y: canvasH - PADDING - elemH / 2 },
  };
  return positions[pos] || positions.c;
}

function renderTextWatermark(ctx, canvas, settings) {
  const text = String(settings.watermarkText == null ? '' : settings.watermarkText);
  if (!text.trim()) return;
  const font = resolveFont(text, settings.fontFamily || 'Arial');
  const size = settings.fontSize || 48;
  const color = settings.textColor || '#ffffff';
  const strokeColor = settings.strokeColor || '#000000';
  const strokeWidth = settings.strokeWidth || 0;

  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = size;
  const radians = ((settings.rotation || 0) * Math.PI) / 180;

  if (settings.tileMode) {
    const spacing = Math.max(textWidth, textHeight) * TILE_TEXT_SPACING;
    for (let y = -canvas.height; y < canvas.height * 2; y += spacing) {
      for (let x = -canvas.width; x < canvas.width * 2; x += spacing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(radians);
        if (strokeWidth > 0) ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  } else {
    const pos = getPosition(canvas.width, canvas.height, textWidth, textHeight, settings.position || 'c');
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(radians);
    if (strokeWidth > 0) ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

function renderImageWatermark(ctx, canvas, settings, watermarkImage) {
  if (!watermarkImage) return;
  const scale = (settings.watermarkScale || 20) / 100;
  const wmWidth = canvas.width * scale;
  const wmHeight = (watermarkImage.height / watermarkImage.width) * wmWidth;
  const radians = ((settings.rotation || 0) * Math.PI) / 180;

  if (settings.tileMode) {
    const spacing = Math.max(wmWidth, wmHeight) * TILE_IMAGE_SPACING;
    for (let y = -canvas.height; y < canvas.height * 2; y += spacing) {
      for (let x = -canvas.width; x < canvas.width * 2; x += spacing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(radians);
        ctx.drawImage(watermarkImage, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
        ctx.restore();
      }
    }
  } else {
    const pos = getPosition(canvas.width, canvas.height, wmWidth, wmHeight, settings.position || 'c');
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(radians);
    ctx.drawImage(watermarkImage, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
    ctx.restore();
  }
}

async function render(buffer, settings) {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, image.width, image.height);
  ctx.drawImage(image, 0, 0);

  ctx.globalAlpha = settings.opacity !== undefined ? settings.opacity : 0.7;

  if (settings.watermarkType === 'image' && settings.watermarkImagePath) {
    try {
      const wmImage = await loadImage(settings.watermarkImagePath);
      renderImageWatermark(ctx, canvas, settings, wmImage);
    } catch {
      // Watermark image unavailable: fall back to text so the image still gets marked.
      renderTextWatermark(ctx, canvas, {
        ...settings,
        watermarkType: 'text',
        watermarkText: settings.watermarkText || DEFAULT_WATERMARK_TEXT,
      });
    }
  } else {
    renderTextWatermark(ctx, canvas, settings);
  }

  ctx.globalAlpha = 1;
  return { buffer: canvas.toBuffer('image/png') };
}

module.exports = { render, getPosition, renderTextWatermark, renderImageWatermark, resolveFont };
