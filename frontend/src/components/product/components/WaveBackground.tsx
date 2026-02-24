import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

const VERTEX = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Palette
  const vec3 SKY_TOP    = vec3(0.92, 0.96, 1.0);
  const vec3 SKY_MID    = vec3(0.85, 0.93, 1.0);
  const vec3 SKY_BOTTOM = vec3(0.78, 0.89, 0.99);
  const vec3 CLOUD_COL  = vec3(1.0, 1.0, 1.0);
  const vec3 CLOUD_SHADOW = vec3(0.88, 0.93, 0.98);
  const vec3 WAVE1_COL  = vec3(0.35, 0.65, 0.94);
  const vec3 WAVE2_COL  = vec3(0.48, 0.74, 0.96);
  const vec3 WAVE3_COL  = vec3(0.58, 0.80, 0.97);
  const vec3 WAVE4_COL  = vec3(0.68, 0.86, 0.98);
  const vec3 WAVE5_COL  = vec3(0.76, 0.90, 0.99);
  const vec3 WAVE6_COL  = vec3(0.82, 0.93, 1.0);
  const vec3 FOAM_COL   = vec3(0.95, 0.98, 1.0);

  // --- Noise functions for clouds ---
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  float wave(vec2 uv, float freq, float amp, float speed, float phase) {
    return amp * sin(uv.x * freq + uTime * speed + phase)
         + amp * 0.5 * sin(uv.x * freq * 1.8 + uTime * speed * 1.3 + phase * 2.0)
         + amp * 0.25 * sin(uv.x * freq * 2.6 + uTime * speed * 0.7 + phase * 3.0);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 uvA = vec2(uv.x * aspect, uv.y);

    // --- Sky gradient (3-stop) ---
    vec3 col;
    if (uv.y > 0.5) {
      col = mix(SKY_MID, SKY_TOP, (uv.y - 0.5) * 2.0);
    } else {
      col = mix(SKY_BOTTOM, SKY_MID, uv.y * 2.0);
    }

    // --- Clouds (upper 55%) ---
    float cloudMask = smoothstep(0.45, 0.65, uv.y); // fade in above waves
    if (cloudMask > 0.001) {
      // Large slow-moving cloud layer
      vec2 cloudUV1 = uvA * vec2(1.5, 3.0) + vec2(uTime * 0.015, 0.0);
      float c1 = fbm(cloudUV1);
      c1 = smoothstep(0.35, 0.65, c1);

      // Smaller faster detail layer
      vec2 cloudUV2 = uvA * vec2(3.0, 5.0) + vec2(uTime * 0.03, uTime * 0.005);
      float c2 = fbm(cloudUV2);
      c2 = smoothstep(0.4, 0.7, c2);

      // Wispy high-altitude layer
      vec2 cloudUV3 = uvA * vec2(2.0, 8.0) + vec2(uTime * 0.02, -uTime * 0.003);
      float c3 = fbm(cloudUV3);
      c3 = smoothstep(0.45, 0.7, c3) * 0.4;

      float cloud = c1 * 0.6 + c2 * 0.3 + c3;
      cloud = clamp(cloud, 0.0, 1.0);

      // Cloud shadow (darken underside slightly)
      float shadow = smoothstep(0.5, 0.3, c1) * 0.15;
      vec3 cloudColor = mix(CLOUD_COL, CLOUD_SHADOW, shadow);

      col = mix(col, cloudColor, cloud * cloudMask * 0.55);
    }

    // --- Waves (6 layers with depth) ---
    // Layer 6 — highest, most subtle
    float w6 = wave(uvA, 2.0, 0.03, 0.3, 0.5);
    float m6 = smoothstep(0.0, 0.08, (0.68 + w6) - uv.y);
    col = mix(col, WAVE6_COL, m6 * 0.2);

    // Layer 5
    float w5 = wave(uvA, 2.5, 0.04, 0.35, 1.0);
    float m5 = smoothstep(0.0, 0.07, (0.58 + w5) - uv.y);
    col = mix(col, WAVE5_COL, m5 * 0.28);

    // Layer 4
    float w4 = wave(uvA, 3.0, 0.05, 0.45, 0.0);
    float m4 = smoothstep(0.0, 0.06, (0.48 + w4) - uv.y);
    col = mix(col, WAVE4_COL, m4 * 0.38);

    // Layer 3
    float w3 = wave(uvA, 4.0, 0.055, 0.6, 1.5);
    float m3 = smoothstep(0.0, 0.05, (0.37 + w3) - uv.y);
    col = mix(col, WAVE3_COL, m3 * 0.48);

    // Layer 2
    float w2 = wave(uvA, 5.0, 0.06, 0.8, 3.0);
    float m2 = smoothstep(0.0, 0.04, (0.25 + w2) - uv.y);
    col = mix(col, WAVE2_COL, m2 * 0.58);

    // Layer 1 — closest, most vivid, with foam
    float w1 = wave(uvA, 6.0, 0.065, 1.0, 4.5);
    float edge1 = (0.14 + w1) - uv.y;
    float m1 = smoothstep(0.0, 0.035, edge1);
    col = mix(col, WAVE1_COL, m1 * 0.68);

    // Foam on wave crests
    float foam = smoothstep(0.002, 0.0, abs(edge1 - 0.01)) * 0.5;
    foam += smoothstep(0.003, 0.0, abs(((0.25 + w2) - uv.y) - 0.008)) * 0.35;
    foam += smoothstep(0.004, 0.0, abs(((0.37 + w3) - uv.y) - 0.006)) * 0.25;
    col = mix(col, FOAM_COL, foam);

    // Shimmer on water surface
    float shimmer = 0.015 * sin(uvA.x * 50.0 + uTime * 2.5) * sin(uv.y * 35.0 - uTime * 1.8);
    col += shimmer * smoothstep(0.5, 0.0, uv.y);

    // Depth darkening at very bottom
    col = mix(col, WAVE1_COL * 0.85, smoothstep(0.15, 0.0, uv.y) * 0.3);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function WaveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new Renderer({ alpha: false, antialias: true });
    const gl = renderer.gl;
    el.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [el.offsetWidth, el.offsetHeight] },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number;
    const update = (t: number) => {
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      el.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}
