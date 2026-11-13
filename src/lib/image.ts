/**
 * Shrinks a photo in the browser before upload: max 1200px on the long side, WebP at ~82% quality.
 * Phone photos (3-8 MB) become ~100-250 KB, so pages load faster and storage bandwidth lasts longer.
 * SVG/GIF and anything that fails to decode are uploaded unchanged.
 */
export async function optimizeImage(file: File, maxDim = 1200, quality = 0.82): Promise<{ blob: Blob; ext: string; type: string }> {
  const keep = { blob: file as Blob, ext: (file.name.split('.').pop() || 'png').toLowerCase(), type: file.type || 'application/octet-stream' };
  if (!file.type.startsWith('image/') || /svg|gif/.test(file.type)) return keep;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return keep;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', quality));
    if (!blob || blob.size >= file.size) return keep; // already small - don't make it bigger
    return { blob, ext: 'webp', type: 'image/webp' };
  } catch { return keep; }
}

export const IMAGE_CACHE = '31536000'; // 1 year - file names are unique per upload
