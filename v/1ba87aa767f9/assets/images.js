// 교수가 고른 캡처를 보내기 전에 줄인다: 긴 쪽 1600px 이하, 1.5MB 이하 JPEG.
// 다시 그려서 저장하므로 사진 속 위치 정보(EXIF)도 같이 빠진다.
import { LIMITS } from './validate.js';

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch (e) { /* 아래 방법으로 다시 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** → { blob, width, height } */
export async function shrink(file, maxPx = LIMITS.shotPx, maxBytes = LIMITS.shotBytes) {
  const src = await decode(file);
  const w0 = src.width;
  const h0 = src.height;
  let scale = Math.min(1, maxPx / Math.max(w0, h0));
  for (let round = 0; round < 6; round += 1) {
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
    for (const q of [0.88, 0.8, 0.7]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= maxBytes) {
        if (src.close) src.close();
        return { blob, width: w, height: h };
      }
    }
    scale *= 0.8;
  }
  if (src.close) src.close();
  throw new Error('캡처를 줄이지 못했습니다. 다른 캡처로 다시 골라 주세요.');
}
