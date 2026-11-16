import * as THREE from 'three'
import { noise } from './noise'

// One shared time uniform for every animated material.
export const timeUniform = { value: 0 }

const cellVert = /* glsl */ `
uniform float uTime;
uniform float uWobble;
uniform float uWobbleFreq;
uniform float uSeed;
uniform vec3 uPodDir;
uniform float uPod;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vLocal;
${noise}
void main() {
  float seed = uSeed;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
    seed += instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.11;
  #endif
  vec3 p = position;
  float n = snoise(normal * uWobbleFreq + vec3(uTime * 0.7 + seed));
  // pseudopod bulge toward uPodDir (used by the white blood cell)
  float pod = pow(max(dot(normal, uPodDir), 0.0), 4.0) * uPod;
  p += normal * (n * uWobble + pod * (0.8 + 0.4 * n));
  vec4 world = m * vec4(p, 1.0);
  vNormalW = normalize(mat3(m) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  vLocal = position + vec3(seed);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const cellFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uShade;
uniform vec3 uRim;
uniform vec3 uSpot;
uniform vec3 uFlashColor;
uniform float uSpotAmount;
uniform float uSpotScale;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uOpacity;
uniform float uFlash;
uniform float uGlow;
uniform float uEmissive;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vLocal;
${noise}
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(vec3(-0.35, 1.0, 0.45));
  // soft two-tone "flat illustration" shading
  float d = smoothstep(0.3, 0.75, dot(N, L) * 0.5 + 0.5);
  vec3 col = mix(uShade, uColor, d);
  if (uSpotAmount > 0.0) {
    float s = snoise(vLocal * uSpotScale);
    col = mix(col, uSpot, smoothstep(0.42, 0.48, s) * uSpotAmount);
  }
  // Kurzgesagt-style glowing rim
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
  col = mix(col, uRim, clamp(fres * uRimStrength, 0.0, 1.0));
  // HDR boost (> 1.0) is what the bloom pass picks up
  col *= 1.0 + uEmissive;
  col += uRim * fres * uGlow;
  col = mix(col, uFlashColor, uFlash);
  // never let a NaN/Inf reach the bloom buffers: one bad pixel gets blurred into a flashing blob
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  col = clamp(col, 0.0, 8.0);
  float a = clamp(uOpacity + fres * (1.0 - uOpacity), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`

export function makeCellMaterial(o = {}) {
  const color = new THREE.Color(o.color ?? '#ffffff')
  const opacity = o.opacity ?? 1
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uSeed: { value: o.seed ?? Math.random() * 100 },
      uWobble: { value: o.wobble ?? 0.06 },
      uWobbleFreq: { value: o.wobbleFreq ?? 1.6 },
      uPodDir: { value: new THREE.Vector3(1, 0, 0) },
      uPod: { value: 0 },
      uColor: { value: color },
      uShade: { value: o.shade ? new THREE.Color(o.shade) : color.clone().multiplyScalar(0.55) },
      uRim: { value: new THREE.Color(o.rim ?? '#ffffff') },
      uSpot: { value: new THREE.Color(o.spot ?? '#000000') },
      uFlashColor: { value: new THREE.Color(o.flashColor ?? '#ffffff') },
      uSpotAmount: { value: o.spot ? (o.spotAmount ?? 1) : 0 },
      uSpotScale: { value: o.spotScale ?? 2.5 },
      uRimPower: { value: o.rimPower ?? 2.5 },
      uRimStrength: { value: o.rimStrength ?? 0.9 },
      uOpacity: { value: opacity },
      uFlash: { value: 0 },
      uGlow: { value: o.glow ?? 0 },
      uEmissive: { value: o.emissive ?? 0 },
    },
    vertexShader: cellVert,
    fragmentShader: cellFrag,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side: o.side ?? THREE.FrontSide,
  })
}

export function makeFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uA: { value: new THREE.Color('#3d0a1e') },
      uB: { value: new THREE.Color('#5c1230') },
      uC: { value: new THREE.Color('#7d2045') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
      varying vec3 vW;
      ${noise}
      void main() {
        vec2 p = vW.xz;
        float n1 = snoise(vec3(p * 0.04 + vec2(-uTime * 0.05, 0.0), uTime * 0.03));
        float n2 = snoise(vec3(p * 0.11 + vec2(-uTime * 0.1, 3.0), uTime * 0.05));
        vec3 col = mix(uA, uB, smoothstep(-0.05, 0.05, n1));
        col = mix(col, uC, smoothstep(0.5, 0.56, n2) * 0.6);
        float d = length(p);
        col *= 1.0 - 0.6 * smoothstep(28.0, 75.0, d);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}
