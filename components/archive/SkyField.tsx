"use client";

import {useEffect, useRef} from "react";

import {ARCHIVE} from "@/components/archive/archiveConfig";
import {
  CLOUD_PERSP_MAX,
  CLOUD_SPD_MAX,
  publishCloudRise,
  resetCloudRise,
} from "@/lib/cloudRise";

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

const FRAG = `precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLock;
uniform float uSat;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p){
  float v = 0.0;
  v += 0.5 * noise(p);
  v += 0.25 * noise(p * 2.02);
  v += 0.125 * noise(p * 4.07);
  v += 0.0625 * noise(p * 8.13);
  v += 0.03125 * noise(p * 16.2);
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float y = uv.y;
  float persp = mix(0.4, ${CLOUD_PERSP_MAX.toFixed(1)}, y * y * (3.0 - 2.0 * y));
  vec2 p = vec2((uv.x - 0.5) * persp * 1.7, y * persp);
  float spd = mix(0.1, ${CLOUD_SPD_MAX.toFixed(2)}, y * y);
  p.y -= uTime * spd;
  float n = fbm(p * 2.8);
  float n2 = fbm(p * 5.4 + vec2(n, 2.0));
  float cloud = smoothstep(0.36, 0.76, n * 0.6 + n2 * 0.5) * mix(0.48, 1.05, y);
  vec3 sky = mix(vec3(0.76, 0.80, 0.84), vec3(0.38, 0.54, 0.74), y);
  vec3 col = mix(sky, vec3(0.94, 0.94, 0.92), cloud * 0.9);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSat);
  col = col * 0.94 + vec3(0.03, 0.03, 0.028);
  col *= 0.78 + 0.22 * uLock;
  float g = hash(uv * uRes + uTime);
  col += (g - 0.5) * mix(0.14, 0.03, uLock);
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function startWebGL(
  canvas: HTMLCanvasElement,
  lockRef: {current: number},
  host: HTMLDivElement | null,
  band: HTMLDivElement | null,
) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    failIfMajorPerformanceCaveat: false,
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
    return null;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uLock = gl.getUniformLocation(program, "uLock");
  const uSat = gl.getUniformLocation(program, "uSat");
  gl.clearColor(0.52, 0.6, 0.7, 1);
  return {gl, program, buf, vs, fs, uRes, uTime, uLock, uSat, host, band};
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function paint2d(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  lock: number,
) {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const sat = ARCHIVE.skySat;
  for (let y = 0; y < h; y += 1) {
    const yn = 1 - y / h;
    const persp = 0.4 + 2 * yn * yn;
    const spd = 0.1 + 0.72 * yn * yn;
    for (let x = 0; x < w; x += 1) {
      const xn = x / w;
      const px = (xn - 0.5) * persp * 6;
      const py = yn * persp * 4 - t * spd;
      const n =
        0.5 * hash2(Math.floor(px), Math.floor(py)) +
        0.25 * hash2(Math.floor(px * 2), Math.floor(py * 2)) +
        0.125 * hash2(Math.floor(px * 4), Math.floor(py * 4));
      const cloud = Math.max(0, Math.min(1, (n - 0.38) / 0.34)) * (0.5 + 0.55 * yn);
      let r = 0.66 + (0.46 - 0.66) * yn;
      let g = 0.7 + (0.57 - 0.7) * yn;
      let b = 0.74 + (0.7 - 0.74) * yn;
      r = r + (0.9 - r) * cloud * 0.86;
      g = g + (0.9 - g) * cloud * 0.86;
      b = b + (0.88 - b) * cloud * 0.86;
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      r = luma + (r - luma) * sat;
      g = luma + (g - luma) * sat;
      b = luma + (b - luma) * sat;
      const fade = 0.7 + 0.3 * lock;
      const i = (y * w + x) * 4;
      data[i] = Math.round(r * fade * 230 + 10);
      data[i + 1] = Math.round(g * fade * 230 + 9);
      data[i + 2] = Math.round(b * fade * 230 + 8);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

type SkyFieldProps = {
  lock: number;
  rush?: number;
};

export function SkyField({lock, rush = 0}: SkyFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(lock);
  const rushRef = useRef(rush);
  lockRef.current = lock;
  rushRef.current = rush;

  useEffect(() => {
    if (ARCHIVE.backgroundVideo) {
      return;
    }
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return;
    }
    const start = performance.now();
    resetCloudRise();
    let raf = 0;
    let last = start;
    let clock = 0;
    let speed = 0;
    let nextBand = start + 1600;
    let bandY = 1.08;
    let banding = false;
    const web = startWebGL(canvas, lockRef, host, bandRef.current);
    const ctx = web ? null : canvas.getContext("2d");
    host.dataset.engine = web ? "webgl" : "2d";

    const size = () => {
      const w = Math.max(2, Math.floor(window.innerWidth * ARCHIVE.skyBuffer));
      const h = Math.max(
        2,
        Math.floor((window.visualViewport?.height ?? window.innerHeight) * ARCHIVE.skyBuffer),
      );
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return {w, h};
    };

    const tickTrack = (now: number) => {
      host.style.transform = `translateY(${now % 120 < 60 ? 0 : 1}px)`;
      const band = bandRef.current;
      if (!band) {
        return;
      }
      if (!banding && now >= nextBand) {
        banding = true;
        bandY = 1.06;
      }
      if (banding) {
        bandY -= 0.0032;
        band.style.opacity = "0.5";
        band.style.top = `${bandY * 100}%`;
        if (bandY < -0.08) {
          banding = false;
          band.style.opacity = "0";
          nextBand = now + 2000 + Math.random() * 2400;
        }
      }
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const {w, h} = size();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speed += (rushRef.current - speed) * Math.min(1, dt * 2.2);
      clock += dt * (1 + speed * 6.5);
      publishCloudRise(clock);
      const t = clock;
      if (web) {
        const {gl, program, buf, uRes, uTime, uLock, uSat} = web;
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, t);
        gl.uniform1f(uLock, lockRef.current);
        gl.uniform1f(uSat, ARCHIVE.skySat);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else if (ctx) {
        paint2d(ctx, w, h, t, lockRef.current);
      }
      tickTrack(now);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      resetCloudRise();
      window.cancelAnimationFrame(raf);
      if (web) {
        web.gl.deleteBuffer(web.buf);
        web.gl.deleteProgram(web.program);
        web.gl.deleteShader(web.vs);
        web.gl.deleteShader(web.fs);
      }
    };
  }, []);

  const video = ARCHIVE.backgroundVideo;

  return (
    <div ref={hostRef} className="arc-sky" aria-hidden>
      {video ? (
        <video className="arc-sky__media" src={video} muted loop playsInline autoPlay />
      ) : (
        <canvas ref={canvasRef} className="arc-sky__media" />
      )}
      <div ref={bandRef} className="arc-sky__track" />
    </div>
  );
}
