import React, { useEffect, useRef } from 'react';
// @ts-ignore
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import './Aurora.css';

const VERT = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

in vec2 vUv;
out vec4 fragColor;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Gradient logic
  vec3 c1 = uColorStops[0];
  vec3 c2 = uColorStops[1];
  vec3 c3 = uColorStops[2];

  vec3 rampColor;
  if (uv.x < 0.5) {
    rampColor = mix(c1, c2, uv.x * 2.0);
  } else {
    rampColor = mix(c2, c3, (uv.x - 0.5) * 2.0);
  }

  // Noise movement
  float noise = snoise(vec2(uv.x * 1.5 + uTime * 0.05, uv.y * 0.5 + uTime * 0.1)) * uAmplitude;

  // Aurora shape
  float dist = abs(uv.y - 0.5 + noise * 0.5);
  float intensity = 1.0 - smoothstep(0.0, uBlend, dist);

  // Final color
  fragColor = vec4(rampColor * intensity, intensity * 0.6); // Alpha 0.6
}
`;

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
}

export default function Aurora(props: AuroraProps) {
  const {
    colorStops = ['#60A5FA', '#818CF8', '#A78BFA'], // Blue -> Indigo -> Purple (Enterprise friendly)
    amplitude = 1.0,
    blend = 0.5,
    speed = 0.5
  } = props;

  const ctnDom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2)
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    // Proper blending for "light" effect
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for glow effect

    let program: any;

    function resize() {
      if (!ctn) return;
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      renderer.setSize(width, height);
      if (program) {
        program.uniforms.uResolution.value = [width, height];
      }
    }

    window.addEventListener('resize', resize);

    const geometry = new Triangle(gl);

    const colors = colorStops.map(hex => {
      // @ts-ignore
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colors },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let animateId = 0;
    let timeVal = 0;

    const update = () => {
      animateId = requestAnimationFrame(update);
      timeVal += 0.01 * speed;

      if (program) {
        program.uniforms.uTime.value = timeVal;
        renderer.render({ scene: mesh });
      }
    };

    resize();
    animateId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, []);

  return <div ref={ctnDom} className="aurora-container" />;
}
