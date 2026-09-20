export type GuideRefract = {
  update: (cx: number, cy: number, amount: number) => void;
  destroy: () => void;
};

export function createGuideRefract(): GuideRefract | null {
  if (typeof document === "undefined") {
    return null;
  }

  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  if (!ctx) {
    return null;
  }

  const pixels = ctx.createImageData(size, size);
  pixels.data.fill(128);
  for (let i = 3; i < pixels.data.length; i += 4) {
    pixels.data[i] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const neutral = canvas.toDataURL("image/png");
  let lastKey = "";

  const update = (cx: number, cy: number, amount: number) => {
    const image = document.getElementById("epg-disp");
    const map = document.getElementById("epg-disp-map");
    if (!image || !map) {
      return;
    }

    const strength = Math.min(1, Math.max(0, amount));
    const key = `${cx.toFixed(3)}:${cy.toFixed(3)}:${strength.toFixed(2)}`;
    if (key === lastKey) {
      return;
    }
    lastKey = key;

    const scale = 6 + 4 * strength;
    map.setAttribute("scale", scale.toFixed(2));

    if (strength < 0.02) {
      image.setAttribute("href", neutral);
      image.setAttribute("xlink:href", neutral);
      return;
    }

    const data = pixels.data;
    const diag = Math.SQRT2;
    const radius = diag * 0.78;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = x / (size - 1);
        const ny = y / (size - 1);
        const dx = nx - cx;
        const dy = ny - cy;
        const dist = Math.hypot(dx, dy);
        const t = Math.min(1, dist / radius);
        const near = 0.5 + 0.5 * Math.cos(t * Math.PI);
        const k = strength * near * 0.22;
        const inv = dist > 0.0001 ? 1 / dist : 0;
        const ox = dx * inv * k;
        const oy = dy * inv * k;
        const i = (y * size + x) * 4;
        data[i] = 128 + ox * 127;
        data[i + 1] = 128 + oy * 127;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const href = canvas.toDataURL("image/png");
    image.setAttribute("href", href);
    image.setAttribute("xlink:href", href);
  };

  return {update, destroy: () => undefined};
}
