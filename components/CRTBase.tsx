"use client";

import {useEffect, useRef} from "react";

import {readMoireShare} from "@/lib/moireShare";

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform float uFlick;
uniform vec2 uMouse;
uniform vec2 uOffset;
uniform float uEnergy;
uniform vec2 uResolution;
uniform float uDpr;

const float PI2 = 6.2832;
const vec3 DARK = vec3(0.1843137, 0.3098039, 0.6823529);
const vec3 LIGHT = vec3(0.8745098, 0.9568627, 1.0);

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

float cursorMask(vec2 p, vec2 c, vec2 offset) {
  vec2 to = p - c;
  float ang = atan(to.y, to.x);
  float wobble = fbm(vec2(ang * 1.3 + uTime * 0.15, 0.44));
  float radius = 260.0 * (1.0 + 0.25 * wobble);
  float trailLen = length(offset);
  vec2 dir = trailLen > 0.001 ? offset / trailLen : vec2(0.0, 1.0);
  float along = dot(to, dir);
  float side = dot(to, vec2(-dir.y, dir.x));
  float nearH = smoothstep(0.62, 0.88, abs(dir.x));
  float stretch = along < 0.0 ? mix(1.1, 1.0, nearH) : 1.0;
  float dist = length(vec2(along / stretch, side));
  float sigma = radius * 0.78;
  return exp(-(dist * dist) / (2.0 * sigma * sigma));
}

void main() {
  vec2 p = vec2(
    gl_FragCoord.x / max(uDpr, 0.0001),
    uResolution.y - gl_FragCoord.y / max(uDpr, 0.0001)
  );
  vec2 mid = uResolution * 0.5;
  float span = max(length(mid), 0.0001);
  float r = length(p - mid) / span;
  vec2 pb = mid + (p - mid) * (1.0 + 0.06 * r * r);

  vec2 n1 = vec2(sin(0.20943951), cos(0.20943951));
  vec2 n2 = vec2(sin(0.22340214), cos(0.22340214));
  float g1 = 0.5 + 0.5 * cos(PI2 * dot(pb, n1) / 4.0 + uTime * 0.4);
  float g2 = 0.5 + 0.5 * cos(PI2 * dot(pb, n2) / 4.12 + uTime * 0.4);
  float line = g1 * 0.7 + g2 * 0.3;

  float nse = clamp(0.5 + 0.5 * fbm(p * 0.0012 + uTime * 0.01), 0.0, 1.0);
  float contrast = mix(0.70, 1.10, nse);
  float mask = cursorMask(p, uMouse, uOffset);
  contrast *= mix(1.0, 0.6, mask * uEnergy);

  float v = 0.5 + (line - 0.5) * 0.36 * contrast;
  v -= 0.08 * smoothstep(0.2, 1.05, r);

  vec2 lamp = vec2(uResolution.x * 1.35, uResolution.y * 0.5);
  float lampR = uResolution.x * 1.05;
  float lampD = length(p - lamp);
  v += 0.04 * (1.0 - smoothstep(lampR - 120.0, lampR, lampD));
  v += uFlick;

  vec3 tint = mix(DARK, LIGHT, clamp(v, 0.0, 1.0));
  vec3 pivot = mix(DARK, LIGHT, 0.5);
  vec3 color = clamp(vec3(0.5) + (tint - pivot), 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
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

export function CRTBase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
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
    const uFlick = gl.getUniformLocation(program, "uFlick");
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
    const start = performance.now();

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

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const share = readMoireShare();

      gl.useProgram(program);
      gl.viewport(0, 0, width, height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uFlick, (Math.random() * 2 - 1) * 0.008);
      gl.uniform2f(
        uMouse,
        share.hasPointer ? share.mouseX : cssW * 0.5,
        share.hasPointer ? share.mouseY : cssH * 0.5,
      );
      gl.uniform2f(uOffset, share.offsetX, share.offsetY);
      gl.uniform1f(uEnergy, share.hasPointer ? share.energy : 0);
      gl.uniform2f(uResolution, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
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
        zIndex: 9998,
        pointerEvents: "none",
        display: "block",
        width: "100%",
        height: "100%",
        mixBlendMode: "overlay",
        opacity: 0.65,
      }}
    />
  );
}
