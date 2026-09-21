import {drawGuideTexture} from "@/components/crt/drawGuideTexture";
import type {GuideProgram} from "@/components/crt/projectPreview";

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
uniform float uGlow;
uniform float uMisalign;
uniform float uFov;
uniform float uTextOpacity;
uniform vec2 uTextPeak;
uniform float uTextBulge;
uniform float uTextInk;
uniform float uTextInside;
uniform vec2 uTextMin;
uniform vec2 uTextMax;
uniform sampler2D uText;
uniform vec2 uHoleCenter;
uniform float uHoleAmount;
uniform float uHoleExpand;
uniform float uEnterScatter;
uniform float uEnterDim;
uniform float uEnterFlash;
uniform float uEnterScan;
uniform float uEnterBlur;
uniform float uEnterCA;
uniform float uNoiseSlow;
uniform sampler2D uGuide;
uniform float uGuideAmount;
uniform float uWash;
uniform vec2 uBandShift;

const float TAU = 6.28318530718;
const float TAU3 = 2.09439510239;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.07 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

vec2 rotate2(vec2 p, float ang) {
  float ca = cos(ang);
  float sa = sin(ang);
  return vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
}

float aspect() {
  return uResolution.x / max(uResolution.y, 1.0);
}

vec2 toAspect(vec2 p) {
  return vec2(p.x * aspect(), p.y);
}

vec2 fromAspect(vec2 p) {
  return vec2(p.x / aspect(), p.y);
}

vec2 screenHalf() {
  return toAspect(vec2(0.5));
}

vec2 fisheye(vec2 uv, vec2 c, float fov, float ior) {
  vec2 d = toAspect(uv - c);
  float r = length(d);
  float rMax = length(screenHalf());
  float rN = r / max(rMax, 0.0001);
  float rpN = tan(min(rN * fov, 1.45)) / max(tan(fov), 0.0001);
  rpN *= ior;
  vec2 dir = d / max(r, 0.00001);
  return c + fromAspect(dir * rpN * rMax);
}

float inBounds(vec2 uv) {
  vec2 e = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return e.x * e.y;
}

vec2 foldEdge(vec2 uv) {
  vec2 n = uv * 2.0 - 1.0;
  vec2 a = abs(n);
  float fx = 0.84 - (a.x - 0.84);
  float fy = 0.84 - (a.y - 0.84);
  n.x = sign(n.x) * mix(a.x, fx, step(0.84, a.x));
  n.y = sign(n.y) * mix(a.y, fy, step(0.84, a.y));
  return n * 0.5 + 0.5;
}

vec3 moireAt(vec2 crtUv, vec2 sensUv, float ang, float scl, float fCrt, float fSens) {
  vec2 cA = toAspect(crtUv);
  vec2 sA = toAspect(sensUv);
  vec2 kCrt = vec2(fCrt, 0.0);
  vec2 kSensX = rotate2(vec2(fSens, 0.0), ang) * scl;
  vec2 kSensY = rotate2(vec2(0.0, fSens), ang) * scl;
  float beat = TAU * dot(cA, kCrt - kSensX);
  float beatY = TAU * dot(sA, kSensY - vec2(0.0, fCrt * 0.33));
  float phase = beat + 0.28 * beatY;
  return 0.5 + 0.5 * cos(vec3(phase, phase + TAU3, phase + TAU3 * 2.0));
}

float analogFrame() {
  return floor(uTime * mix(12.0, 5.0, uNoiseSlow));
}

vec2 analogUv(vec2 uv, float frame) {
  float line = floor(uv.y * uResolution.y);
  float span = mix(1.0, 2.0, hash(vec2(line, frame + 11.0)));
  float jit = (hash(vec2(line, frame)) - 0.5) * 2.0 * span;
  vec2 q = uv;
  q.x += jit / max(uResolution.x, 1.0);

  float slot = floor(frame / 44.0);
  float localF = frame - slot * 44.0;
  float fire = step(0.58, hash(vec2(slot, 9.4)));
  float active = fire * (1.0 - step(3.0, localF));
  float bandC = 0.1 + 0.8 * hash(vec2(slot, 1.7));
  float bandH = mix(0.03, 0.12, hash(vec2(slot, 4.8)));
  float inBand = 1.0 - smoothstep(bandH * 0.42, bandH * 0.58, abs(q.y - bandC));
  float slip = mix(12.0, 38.0, hash(vec2(slot, 2.2)));
  q.x += (hash(vec2(slot, 5.5)) - 0.5) * 2.0 * slip * active * inBand / max(uResolution.x, 1.0);
  return q;
}

vec4 sampleTextRaw(vec2 uv) {
  float alive = inBounds(uv);
  vec4 t = texture2D(uText, clamp(uv, 0.0, 1.0));
  t.a *= alive;
  t.rgb *= alive;
  return t;
}

vec4 sampleText(vec2 uv) {
  vec2 peak = uTextPeak;
  float span = max(uTextMax.x - uTextMin.x, 0.0001);
  float t = clamp((uv.x - uTextMin.x) / span, 0.0, 0.999);
  float idx = floor(t * 7.0);
  float cell0 = uTextMin.x + (idx / 7.0) * span;
  float cell1 = uTextMin.x + ((idx + 1.0) / 7.0) * span;
  vec2 letterC = vec2((cell0 + cell1) * 0.5, (uTextMin.y + uTextMax.y) * 0.5);

  vec2 d = toAspect(letterC - peak);
  float charW = span / 7.0;
  float radius = length(toAspect(vec2(charW * 2.0, 0.0)));
  float sigma = max(radius / 2.2, 0.0001);
  float g = exp(-dot(d, d) / (2.0 * sigma * sigma));
  float mag = mix(1.0, 1.15, uTextBulge * g);
  vec2 scaled = letterC + (uv - letterC) / mag;

  float motion = clamp(uTextInk, 0.0, 1.0);
  float inside = clamp(uTextInside, 0.0, 1.0);
  vec3 mint = vec3(0.847, 0.961, 0.871);
  vec3 hot = vec3(0.97, 0.99, 1.0);
  vec3 faded = vec3(1.0);
  vec3 insideCol = mix(mint, hot, motion);
  vec3 col = mix(faded, insideCol, inside);
  col = mix(vec3(1.0), mix(col, vec3(0.96, 0.99, 1.0), uWash * 0.85), max(uWash, motion));

  vec2 dir = toAspect(uv - letterC);
  float ca = mix(0.0017, 0.0009, g);
  vec2 off = fromAspect(dir / max(length(dir), 0.00001) * ca);
  vec4 tR = sampleTextRaw(scaled + off);
  vec4 tG = sampleTextRaw(scaled);
  vec4 tB = sampleTextRaw(scaled - off);

  vec2 px = 3.2 / uResolution;
  float halo = 0.0;
  halo += sampleTextRaw(scaled + vec2(px.x, 0.0)).a;
  halo += sampleTextRaw(scaled - vec2(px.x, 0.0)).a;
  halo += sampleTextRaw(scaled + vec2(0.0, px.y)).a;
  halo += sampleTextRaw(scaled - vec2(0.0, px.y)).a;
  halo += sampleTextRaw(scaled + px * 0.72).a;
  halo += sampleTextRaw(scaled - px * 0.72).a;
  halo *= 0.167;
  float bloom = (max(0.0, halo - tG.a) + halo * mix(0.22, 0.42, uWash)) * mix(motion * inside, uWash, 0.55);

  vec4 text = vec4(col, tG.a);
  text.rgb += vec3(0.16, -0.03, -0.05) * (tR.a - tG.a);
  text.rgb += vec3(-0.04, 0.01, 0.2) * (tB.a - tG.a);
  text.rgb = mix(text.rgb, hot, bloom * 0.85);
  text.a = max(tG.a, max(tR.a, tB.a));
  return text;
}

vec3 phosphorBase() {
  vec3 electricA = vec3(0.122, 0.247, 0.902);
  vec3 electricB = vec3(0.141, 0.282, 0.941);
  vec3 rest = mix(electricA, electricB, 0.4);
  vec3 tealA = vec3(0.122, 0.722, 0.847);
  vec3 tealB = vec3(0.165, 0.769, 0.902);
  float swirl = fbm(gl_FragCoord.xy * 0.00105 + vec2(0.0, uTime * 0.035));
  vec3 lit = mix(tealA, tealB, 0.28 + 0.5 * swirl);
  return mix(rest, lit, uWash);
}

vec3 applyMoire(vec3 color, vec3 moire) {
  vec3 cyan = vec3(0.1, 0.46, 0.86);
  vec3 mag = vec3(0.92, 0.16, 0.78);
  float magenta = moire.x * moire.z * (1.0 - moire.y * 0.62);
  float fringe = mix(0.08, 1.0, uMisalign);
  float live = max(uGlow, uWash);
  vec3 sharp = color;
  sharp += mag * magenta * (0.18 + 0.82 * uGlow) * fringe * live;
  sharp += cyan * moire.z * (0.08 + 0.28 * uGlow) * fringe * live;
  sharp += moire * 0.025 * uMisalign * live;
  return mix(sharp, color, uWash);
}

vec3 worldAt(vec2 fish, vec2 sensUv, float ang, float scl, float fCrt, float fSens) {
  float frame = analogFrame();
  vec2 q = analogUv(fish, frame);
  vec2 qSurf = 0.5 + (q - 0.5) / max(1.0 + uEnterScatter * 0.35, 1.0);

  vec2 qA = toAspect(qSurf);
  vec2 warp = vec2(
    fbm(qA * 2.35 + vec2(uTime * 0.08, 0.17)),
    fbm(qA * 2.05 + vec2(-0.31, uTime * 0.066))
  );
  vec2 crtUv = qSurf + fromAspect((warp - 0.5) * 0.022 * uMisalign);
  vec3 moire = moireAt(crtUv, sensUv, ang, scl, fCrt, fSens);

  vec3 color = phosphorBase();
  color = applyMoire(color, moire);

  return color;
}

vec4 sampleGuide(vec2 uv) {
  float alive = inBounds(uv);
  vec4 t = texture2D(uGuide, clamp(uv, 0.0, 1.0));
  t *= alive;
  return t;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 mouse = vec2(uMouse.x, 1.0 - uMouse.y);
  vec2 halfA = screenHalf();
  vec2 mouseA = toAspect(mouse - 0.5);
  vec2 maxShift = halfA * (0.12 / max(halfA.y, 0.0001));
  vec2 c = vec2(0.5) + fromAspect(clamp(mouseA, -maxShift, maxShift));

  vec2 d0 = toAspect(uv - c);
  float r = length(d0);
  float rMax = length(halfA);
  float rN = r / max(rMax, 0.0001);
  vec2 edgeN = abs(uv * 2.0 - 1.0);
  float edge = max(edgeN.x, edgeN.y);
  float ca = max(smoothstep(0.22, 0.92, rN), smoothstep(0.62, 0.98, edge));
  ca = max(ca, uEnterCA);
  float fov = uFov;
  float iorG = mix(1.0, mix(1.012, 1.05, uEnterCA), ca);
  float iorB = mix(1.0, mix(1.025, 1.09, uEnterCA), ca);

  vec2 fishR = fisheye(uv, c, fov, mix(1.0, 1.000, ca));
  vec2 fishG = fisheye(uv, c, fov, iorG);
  vec2 fishB = fisheye(uv, c, fov, iorB);

  vec2 sensUv = uv;

  float ang = radians(clamp(uMouse.x - 0.5, -0.5, 0.5) * 16.0) * uMisalign;
  float scl = mix(1.0, mix(0.97, 1.03, clamp(uMouse.y, 0.0, 1.0)), uMisalign);
  float fCrt = uResolution.y / 2.62;
  float fSens = uResolution.y / 2.84;

  vec3 colR = worldAt(fishR, sensUv, ang, scl, fCrt, fSens);
  vec3 colG = worldAt(fishG, sensUv, ang, scl, fCrt, fSens);
  vec3 colB = worldAt(fishB, sensUv, ang, scl, fCrt, fSens);
  vec3 color = vec3(colR.r, colG.g, colB.b);

  vec2 ndc = uv * 2.0 - 1.0;
  float edgeMix = max(
    smoothstep(0.84, 1.0, abs(ndc.x)),
    smoothstep(0.84, 1.0, abs(ndc.y))
  );
  vec2 folded = foldEdge(uv);
  vec2 foldG = fisheye(folded, c, fov, iorG);
  vec3 foldCol = worldAt(foldG, folded, ang, scl, fCrt, fSens);
  color = mix(color, foldCol, edgeMix * 0.3);

  if (uEnterBlur > 0.02) {
    vec2 mid = vec2(0.5);
    vec3 streak = color;
    streak += worldAt(fisheye(mix(uv, mid, uEnterBlur * 0.045), c, fov, iorG), mix(uv, mid, uEnterBlur * 0.045), ang, scl, fCrt, fSens);
    streak += worldAt(fisheye(mix(uv, mid, uEnterBlur * 0.09), c, fov, iorG), mix(uv, mid, uEnterBlur * 0.09), ang, scl, fCrt, fSens);
    streak += worldAt(fisheye(mix(uv, mid, uEnterBlur * 0.14), c, fov, iorG), mix(uv, mid, uEnterBlur * 0.14), ang, scl, fCrt, fSens);
    color = mix(color, streak * 0.25, uEnterBlur * 0.7);
  }

  float lum = dot(color, vec3(0.22, 0.48, 0.30));
  color += color * smoothstep(0.18, 0.78, lum) * uGlow * vec3(0.4, 0.8, 1.05) * (1.0 - uWash);

  float sphere = clamp(rN, 0.0, 1.0);
  float depth = sqrt(max(0.0, 1.0 - sphere * sphere));
  float rim = 1.0 - smoothstep(0.74, 1.0, edge);
  float vignette = mix(0.34, 1.0, pow(depth, 0.82) * mix(0.62, 1.0, rim));
  vec3 edgeBlue = vec3(0.082, 0.188, 0.722);
  vec3 restVig = mix(edgeBlue, color, vignette);
  vec3 washEdge = vec3(0.227, 0.247, 0.816);
  vec3 washVig = mix(washEdge, color, mix(0.42, 1.0, vignette));
  color = mix(restVig, washVig, uWash);
  color *= 1.0 - uEnterDim;

  float wipe = 1.0 - smoothstep(0.0, 0.045, abs(uv.y - uEnterScan));
  color += vec3(0.72, 0.9, 1.0) * wipe * 0.4 * step(0.004, uEnterScan) * (1.0 - uEnterScan);
  color = mix(color, vec3(1.0), uEnterFlash);

  vec2 winC = vec2(0.5, 0.62);
  vec2 winR = vec2(0.44, 0.16);
  vec2 sWin = (uv - winC) / winR;
  float rr = length(sWin);
  float z = sqrt(max(0.0, 1.0 - min(rr * rr, 1.0)));
  float mask = exp(-(rr * rr) / 0.82);
  mask *= 1.0 - smoothstep(0.92, 1.38, rr);
  mask *= smoothstep(0.50, 0.57, uv.y);
  mask *= clamp(uGuideAmount, 0.0, 1.0);

  vec3 glass = mix(color, vec3(0.2, 0.52, 0.82), 0.32);
  color = mix(color, glass, mask * 0.5);

  float mag = mix(0.5, 1.18, 1.0 - z);
  vec2 gUV = vec2(0.5, 0.84) + sWin * mag * vec2(0.24, 0.2);
  float caAmt = smoothstep(0.42, 1.0, rr);
  vec2 gDir = toAspect(sWin);
  vec2 caOff = fromAspect(gDir / max(length(gDir), 0.00001) * 0.008 * caAmt);
  vec4 gR = sampleGuide(gUV + caOff);
  vec4 gG = sampleGuide(gUV);
  vec4 gB = sampleGuide(gUV - caOff);
  vec3 gCol = vec3(gR.r, gG.g, gB.b);
  gCol += vec3(0.55, 0.22, 0.05) * max(gR.a - gG.a, 0.0) * caAmt;
  gCol += vec3(0.2, 0.06, 0.48) * max(gB.a - gG.a, 0.0) * caAmt;
  float gA = max(gG.a, max(gR.a, gB.a));
  color = mix(color, gCol, mask * gA * 0.95);

  float frame = analogFrame();
  float alpha = 1.0 - uHoleExpand;

  vec2 qText = analogUv(fishG, frame);
  vec2 qSurf = 0.5 + (qText - 0.5) / max(1.0 + uEnterScatter * 0.35, 1.0);
  vec4 text = sampleText(qSurf);
  float textAmt = uTextOpacity * (1.0 - uEnterScatter);
  color = mix(color, text.rgb, text.a * textAmt);
  alpha = mix(alpha, 1.0, text.a * textAmt);

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

export type MoireFrame = {
  mouseX: number;
  mouseY: number;
  glow: number;
  misalign: number;
  time: number;
  fov: number;
  textOpacity: number;
  textPeakX: number;
  textPeakY: number;
  textBulge: number;
  textInk: number;
  textInside: number;
  holeCenterX: number;
  holeCenterY: number;
  holeAmount: number;
  holeExpand: number;
  enterScatter: number;
  enterDim: number;
  enterFlash: number;
  enterScan: number;
  enterBlur: number;
  enterCA: number;
  noiseSlow: number;
  guideAmount: number;
  wash: number;
  bandShiftX: number;
  bandShiftY: number;
};

export type TextBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const DEFAULT_TEXT_BOUNDS: TextBounds = {
  minX: 0.18,
  maxX: 0.82,
  minY: 0.42,
  maxY: 0.58,
};

export type CrtMoireGl = {
  render: (frame: MoireFrame) => void;
  resize: (cssWidth: number, cssHeight: number) => void;
  setGuide: (programs: GuideProgram[]) => void;
  getTextBounds: () => TextBounds;
  destroy: () => void;
};

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function drawWelcome(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): TextBounds {
  ctx.clearRect(0, 0, width, height);
  const size = height * 0.123;
  const tracking = size * 0.22;
  const text = "WELCOME";
  ctx.font = `500 ${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(216, 245, 222, 0.96)";
  ctx.shadowColor = "rgba(176, 255, 196, 0.4)";
  ctx.shadowBlur = size * 0.22;

  let total = 0;
  const widths: number[] = [];
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w;
  }
  total += tracking * (text.length - 1);

  let x = width * 0.5 - total * 0.5;
  const startX = x;
  const y = height * 0.5;
  text.split("").forEach((ch, index) => {
    ctx.fillText(ch, x, y);
    x += widths[index] + tracking;
  });

  const padX = size * 0.55 / width;
  const padY = size * 0.7 / height;
  return {
    minX: startX / width - padX,
    maxX: (startX + total) / width + padX,
    minY: 0.5 - padY,
    maxY: 0.5 + padY,
  };
}

export function createCrtMoireGl(canvas: HTMLCanvasElement): CrtMoireGl | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    return null;
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program));
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const textCanvas = document.createElement("canvas");
  const textCtx = textCanvas.getContext("2d");
  const textTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const guideCanvas = document.createElement("canvas");
  const guideCtx = guideCanvas.getContext("2d");
  const guideTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, guideTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uGlow = gl.getUniformLocation(program, "uGlow");
  const uMisalign = gl.getUniformLocation(program, "uMisalign");
  const uFov = gl.getUniformLocation(program, "uFov");
  const uTextOpacity = gl.getUniformLocation(program, "uTextOpacity");
  const uTextPeak = gl.getUniformLocation(program, "uTextPeak");
  const uTextBulge = gl.getUniformLocation(program, "uTextBulge");
  const uTextInk = gl.getUniformLocation(program, "uTextInk");
  const uTextInside = gl.getUniformLocation(program, "uTextInside");
  const uTextMin = gl.getUniformLocation(program, "uTextMin");
  const uTextMax = gl.getUniformLocation(program, "uTextMax");
  const uText = gl.getUniformLocation(program, "uText");
  const uHoleCenter = gl.getUniformLocation(program, "uHoleCenter");
  const uHoleAmount = gl.getUniformLocation(program, "uHoleAmount");
  const uHoleExpand = gl.getUniformLocation(program, "uHoleExpand");
  const uEnterScatter = gl.getUniformLocation(program, "uEnterScatter");
  const uEnterDim = gl.getUniformLocation(program, "uEnterDim");
  const uEnterFlash = gl.getUniformLocation(program, "uEnterFlash");
  const uEnterScan = gl.getUniformLocation(program, "uEnterScan");
  const uEnterBlur = gl.getUniformLocation(program, "uEnterBlur");
  const uEnterCA = gl.getUniformLocation(program, "uEnterCA");
  const uNoiseSlow = gl.getUniformLocation(program, "uNoiseSlow");
  const uGuide = gl.getUniformLocation(program, "uGuide");
  const uGuideAmount = gl.getUniformLocation(program, "uGuideAmount");
  const uWash = gl.getUniformLocation(program, "uWash");
  const uBandShift = gl.getUniformLocation(program, "uBandShift");

  gl.clearColor(0, 0, 0, 0);

  let width = 1;
  let height = 1;
  let textBounds: TextBounds = {...DEFAULT_TEXT_BOUNDS};
  let programs: GuideProgram[] = [];

  const uploadText = () => {
    if (!textCtx) {
      return;
    }
    textBounds = drawWelcome(textCtx, textCanvas.width, textCanvas.height);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textCanvas,
    );
  };

  const uploadGuide = () => {
    if (!guideCtx) {
      return;
    }
    drawGuideTexture(guideCtx, guideCanvas.width, guideCanvas.height, programs);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, guideTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      guideCanvas,
    );
  };

  const resize = (cssWidth: number, cssHeight: number) => {
    const dpr = window.devicePixelRatio || 1;
    const nextW = Math.max(1, Math.round(cssWidth * dpr));
    const nextH = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    width = nextW;
    height = nextH;
    const textScale = Math.min(2, 4096 / nextW, 4096 / nextH);
    textCanvas.width = Math.max(1, Math.round(nextW * textScale));
    textCanvas.height = Math.max(1, Math.round(nextH * textScale));
    guideCanvas.width = Math.max(1, nextW);
    guideCanvas.height = Math.max(1, nextH);
    gl.viewport(0, 0, width, height);
    uploadText();
    uploadGuide();
  };

  const setGuide = (next: GuideProgram[]) => {
    programs = next;
    uploadGuide();
  };

  const getTextBounds = () => textBounds;

  const render = (frame: MoireFrame) => {
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, guideTex);
    gl.uniform2f(uResolution, width, height);
    gl.uniform2f(uMouse, frame.mouseX, frame.mouseY);
    gl.uniform1f(uTime, frame.time);
    gl.uniform1f(uGlow, frame.glow);
    gl.uniform1f(uMisalign, frame.misalign);
    gl.uniform1f(uFov, frame.fov);
    gl.uniform1f(uTextOpacity, frame.textOpacity);
    gl.uniform2f(uTextPeak, frame.textPeakX, frame.textPeakY);
    gl.uniform1f(uTextBulge, frame.textBulge);
    gl.uniform1f(uTextInk, frame.textInk);
    gl.uniform1f(uTextInside, frame.textInside);
    gl.uniform2f(uTextMin, textBounds.minX, 1.0 - textBounds.maxY);
    gl.uniform2f(uTextMax, textBounds.maxX, 1.0 - textBounds.minY);
    gl.uniform1i(uText, 0);
    gl.uniform1i(uGuide, 1);
    gl.uniform1f(uGuideAmount, frame.guideAmount);
    gl.uniform1f(uWash, frame.wash);
    gl.uniform2f(uBandShift, frame.bandShiftX, frame.bandShiftY);
    gl.uniform2f(uHoleCenter, frame.holeCenterX, frame.holeCenterY);
    gl.uniform1f(uHoleAmount, frame.holeAmount);
    gl.uniform1f(uHoleExpand, frame.holeExpand);
    gl.uniform1f(uEnterScatter, frame.enterScatter);
    gl.uniform1f(uEnterDim, frame.enterDim);
    gl.uniform1f(uEnterFlash, frame.enterFlash);
    gl.uniform1f(uEnterScan, frame.enterScan);
    gl.uniform1f(uEnterBlur, frame.enterBlur);
    gl.uniform1f(uEnterCA, frame.enterCA);
    gl.uniform1f(uNoiseSlow, frame.noiseSlow);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const destroy = () => {
    gl.deleteBuffer(buffer);
    gl.deleteTexture(textTex);
    gl.deleteTexture(guideTex);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };

  return {render, resize, setGuide, getTextBounds, destroy};
}
