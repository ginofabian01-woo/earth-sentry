// Procedural Earth-like texture generated on a 2D canvas (no external image
// download needed). Value-noise fBm defines continents; poles get ice caps.

function mkNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const grad = (h: number, x: number, y: number) => {
    const u = (h & 1) === 0 ? x : -x;
    const v = (h & 2) === 0 ? y : -y;
    return u + v;
  };
  const noise2 = (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, x, y), grad(ba, x - 1, y), u),
      lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u),
      v,
    );
  };
  return (x: number, y: number, octaves = 5) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm; // ~[-1,1]
  };
}

export function makeEarthTexture(gl: WebGL2RenderingContext, w = 1024, h = 512): WebGLTexture {
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const noise = mkNoise(1337);

  for (let y = 0; y < h; y++) {
    const lat = (y / h) * 2 - 1; // -1 pole .. 1 pole
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 6;
      const ny = (y / h) * 3;
      const e = noise(nx, ny, 6) + 0.12 - Math.abs(lat) * 0.15;
      const i = (y * w + x) * 4;
      let r: number, g: number, b: number;
      if (e > 0.02) {
        // land: greens -> browns with elevation
        const t = Math.min(1, e * 2);
        r = 60 + t * 90;
        g = 90 + t * 40;
        b = 45 + t * 20;
        if (e > 0.42) { r = 150; g = 140; b = 120; } // highland
      } else {
        // ocean: depth-shaded blue
        const d = Math.min(1, -e * 3);
        r = 8 + d * 6;
        g = 40 + d * 20;
        b = 80 + d * 60;
      }
      // ice caps
      const ice = Math.max(0, Math.abs(lat) - 0.82) / 0.18;
      if (ice > 0) {
        r = r + (235 - r) * ice;
        g = g + (240 - g) * ice;
        b = b + (245 - b) * ice;
      }
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}
