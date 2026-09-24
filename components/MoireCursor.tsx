"use client";

import {useEffect, useRef} from "react";

import {publishMoireShare, readMoireShare} from "@/lib/moireShare";
import {publishMotion} from "@/lib/sound/soundBus";

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uOffset;
uniform float uEnergy;
uniform vec2 uResolution;
uniform float uDpr;

const float PI2 = 6.2832;
const float P = 3.0;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m *= m;
  m *= m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

vec2 fbm2(vec2 p) {
  return vec2(fbm(p), fbm(p + vec2(19.2, 7.1)));
}

vec2 rotate2(vec2 v, float ang) {
  float c = cos(ang);
  float s = sin(ang);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 cameraQ(vec2 p, vec2 c, float theta, float scl) {
  float rr = length(p - c) / 600.0;
  vec2 q = c + rotate2(p - c, theta) * scl * (1.0 + 0.06 * rr * rr);
  q += (fbm2(p * 0.0015 + uTime * 0.02) - 0.5) * 8.0;
  return q;
}

vec3 palAt(vec2 p, vec2 c, float theta, float scl) {
  vec2 q = cameraQ(p, c, theta, scl);
  float dx = (q.x - p.x) / P;
  float dy = (q.y - p.y) / P;
  float beatR = 0.5 + 0.5 * cos(PI2 * (dx + 0.0) + 0.32 * (dy + 0.0));
  float beatG = 0.5 + 0.5 * cos(PI2 * (dx + 0.333) + 0.32 * (dy + 0.333));
  float beatB = 0.5 + 0.5 * cos(PI2 * (dx + 0.667) + 0.32 * (dy + 0.667));
  vec3 col =
    beatR * vec3(1.0, 0.561, 0.839) +
    beatG * vec3(0.498, 0.965, 1.0) +
    beatB * vec3(0.604, 0.482, 1.0);
  return col / 1.6;
}

vec3 palAtPink(vec2 p, vec2 c, float theta, float scl) {
  vec2 q = cameraQ(p, c, theta, scl);
  float dx = (q.x - p.x) / P;
  float dy = (q.y - p.y) / P;
  float beatR = 0.5 + 0.5 * cos(PI2 * (dx + 0.0) + 0.32 * (dy + 0.0));
  return vec3(1.0, 0.561, 0.839) * beatR / 1.6;
}

void main() {
  vec2 p = vec2(
    gl_FragCoord.x / max(uDpr, 0.0001),
    uResolution.y - gl_FragCoord.y / max(uDpr, 0.0001)
  );
  vec2 c = uMouse;

  float shakeA = fbm(vec2(uTime * 0.08, 0.31));
  float shakeB = fbm(vec2(uTime * 0.06 + 5.0, 1.17));
  float theta = radians(0.5) + uOffset.x * 0.00012 + (shakeA - 0.5) * radians(0.4);
  float scl = 1.0 + 0.012 + length(uOffset) * 0.00008 + (shakeB - 0.5) * 0.004;

  vec2 to = p - c;
  float ang = atan(to.y, to.x);
  float wobble = fbm(vec2(ang * 1.3 + uTime * 0.15, 0.44));
  float radius = 260.0 * (1.0 + 0.25 * wobble);

  vec2 trail = uOffset;
  float trailLen = length(trail);
  vec2 dir = trailLen > 0.001 ? trail / trailLen : vec2(1.0, 0.0);
  float along = dot(to, dir);
  float side = dot(to, vec2(-dir.y, dir.x));
  float stretch = along < 0.0 ? 1.3 : 1.0;
  float dist = length(vec2(along / stretch, side));
  float mask = 1.0 - smoothstep(radius, radius + 200.0, dist);

  if (mask <= 0.0 || uEnergy <= 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  const float GA = 2.399963;
  vec3 acc = palAt(p, c, theta, scl);
  float wsum = 1.0;
  for (int i = 1; i <= 10; i++) {
    float fi = float(i);
    float a = fi * GA;
    float rad = 6.0 * sqrt(fi / 10.0);
    vec2 o = vec2(cos(a), sin(a)) * rad;
    float w = exp(-dot(o, o) / (2.0 * 2.4 * 2.4));
    acc += palAt(p + o, c, theta, scl) * w;
    wsum += w;
  }
  vec3 soft = acc / max(wsum, 0.0001);

  vec3 gacc = pow(soft, vec3(2.2));
  float gw = 1.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i) + 1.0;
    float a = fi * GA;
    vec2 o = vec2(cos(a), sin(a)) * 14.0;
    float w = exp(-dot(o, o) / (2.0 * 9.0 * 9.0));
    vec3 s = palAt(p + o, c, theta, scl);
    gacc += pow(max(s, vec3(0.0)), vec3(2.2)) * w;
    gw += w;
  }
  vec3 glow = gacc / max(gw, 0.0001);

  vec2 haloDir = trailLen > 0.001 ? dir : vec2(1.0, 0.0);
  vec3 pinkSpread = palAtPink(p + haloDir * 2.0, c, theta, scl);
  vec3 col = max(soft * 0.75 + glow * 0.6 + pinkSpread * 0.22, vec3(0.0));
  float glowAmt = clamp(dot(glow, vec3(0.33, 0.33, 0.34)), 0.0, 1.0);
  col = mix(col, vec3(1.0), glowAmt * 0.25);

  vec2 hex = p / 5.2;
  hex.x += 0.5 * floor(mod(hex.y, 2.0));
  vec2 hf = fract(hex) - 0.5;
  float dots = 1.0 - smoothstep(0.16, 0.36, length(hf));
  col += vec3(1.0) * dots * 0.12 * glowAmt;

  vec3 violet = vec3(0.604, 0.482, 1.0);
  col = mix(col, violet, (1.0 - mask) * 0.42);

  float flick = 1.0 + (hash(vec2(floor(uTime * 72.0), 4.8)) - 0.5) * 0.04;
  col *= flick;
  col = max(col, vec3(0.0));

  float alpha = max(mask * uEnergy * 0.4, 0.0);
  gl_FragColor = vec4(col * alpha, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
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
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function MoireCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uOffset = gl.getUniformLocation(program, "uOffset");
    const uEnergy = gl.getUniformLocation(program, "uEnergy");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uDpr = gl.getUniformLocation(program, "uDpr");

    let width = 1;
    let height = 1;
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;
    let raf = 0;
    let hasPointer = false;
    let targetX = 0;
    let targetY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let lagX = 0;
    let lagY = 0;
    let energy = 0;
    let prevX = 0;
    let prevY = 0;
    let sim = 0;
    let lastNow = performance.now();

    const resize = () => {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      const nextW = Math.max(1, Math.round(cssW * dpr));
      const nextH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      width = nextW;
      height = nextH;
      gl.viewport(0, 0, width, height);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!readMoireShare().interact) {
        return;
      }
      targetX = event.clientX;
      targetY = event.clientY;
      if (!hasPointer) {
        mouseX = targetX;
        mouseY = targetY;
        lagX = targetX;
        lagY = targetY;
        hasPointer = true;
      }
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const share = readMoireShare();
      sim += ((now - lastNow) / 1000) * share.timeScale;
      lastNow = now;
      const follow = share.interact ? share.timeScale : 0;

      mouseX += (targetX - mouseX) * 0.12 * follow;
      mouseY += (targetY - mouseY) * 0.12 * follow;
      lagX += (mouseX - lagX) * 0.035 * follow;
      lagY += (mouseY - lagY) * 0.035 * follow;

      const offX = mouseX - lagX;
      const offY = mouseY - lagY;
      const targetEnergy = Math.min(1, Math.max(0, Math.hypot(offX, offY) / 140));
      energy += (targetEnergy - energy) * 0.06 * (follow > 0 ? follow : 0);
      const speed = hasPointer && follow > 0
        ? Math.min(1, Math.hypot(mouseX - prevX, mouseY - prevY) / 28)
        : 0;
      prevX = mouseX;
      prevY = mouseY;
      publishMotion({
        energy: hasPointer ? energy : 0,
        x: cssW > 0 ? mouseX / cssW : 0.5,
        y: cssH > 0 ? mouseY / cssH : 0.5,
        speed,
      });
      publishMoireShare({
        mouseX,
        mouseY,
        offsetX: offX,
        offsetY: offY,
        energy: hasPointer ? energy : 0,
        hasPointer,
      });

      gl.useProgram(program);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!hasPointer || energy <= 0.0005) {
        return;
      }

      gl.uniform1f(uTime, sim);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform2f(uOffset, offX, offY);
      gl.uniform1f(uEnergy, energy);
      gl.uniform2f(uResolution, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    window.addEventListener("pointermove", onPointerMove, {passive: true});
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      publishMoireShare({
        mouseX: 0,
        mouseY: 0,
        offsetX: 0,
        offsetY: 0,
        energy: 0,
        hasPointer: false,
      });
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        display: "block",
        width: "100%",
        height: "100%",
        mixBlendMode: "screen",
      }}
    />
  );
}
