import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Red blood cell: lathe of the Evans–Fung biconcave disc profile.
function rbcGeometry() {
  const h = (x) => 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.207 + 2.003 * x * x - 1.123 * x ** 4) * 1.35
  const pts = []
  const N = 28
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 0.999
    pts.push(new THREE.Vector2(x, -h(x)))
  }
  for (let i = N; i >= 0; i--) {
    const x = (i / N) * 0.999
    pts.push(new THREE.Vector2(x, h(x)))
  }
  return new THREE.LatheGeometry(pts, 40)
}

// Virus spikes: stalk + knob on the 12 icosahedron + 20 dodecahedron directions.
function virusSpikes(coreR = 0.45) {
  const phi = (1 + Math.sqrt(5)) / 2
  const ip = 1 / phi
  const dirs = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ]
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) dirs.push([sx, sy, sz])
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    dirs.push([0, a * ip, b * phi], [a * ip, b * phi, 0], [a * phi, 0, b * ip])
  }
  const up = new THREE.Vector3(0, 1, 0)
  const parts = []
  dirs.forEach((d, i) => {
    const dir = new THREE.Vector3(...d).normalize()
    const big = i < 12
    const len = big ? 0.34 : 0.24
    const stalk = new THREE.CylinderGeometry(0.035, 0.055, len, 6, 1, true)
    stalk.translate(0, coreR + len / 2 - 0.04, 0)
    const tip = new THREE.SphereGeometry(big ? 0.1 : 0.075, 10, 8)
    tip.translate(0, coreR + len - 0.02, 0)
    const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir))
    stalk.applyMatrix4(m)
    tip.applyMatrix4(m)
    parts.push(stalk, tip)
  })
  return mergeGeometries(parts)
}

function flagellum() {
  const pts = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 3) * 0.14 * t, 0, -t * 1.2))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 5, false)
}

function antibody() {
  const stem = new THREE.CylinderGeometry(0.055, 0.055, 0.36, 6)
  stem.rotateX(Math.PI / 2)
  stem.translate(0, 0, -0.18)
  const parts = [stem]
  for (const s of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6)
    arm.translate(0, 0.15, 0)
    arm.rotateX(Math.PI / 2)
    arm.rotateY(s * 0.6)
    parts.push(arm)
  }
  return mergeGeometries(parts)
}

const capsule = new THREE.CapsuleGeometry(0.42, 0.85, 10, 24)
capsule.rotateX(Math.PI / 2) // long axis along +z

export const GEO = {
  sphere: new THREE.SphereGeometry(1, 48, 32),
  sphereLow: new THREE.SphereGeometry(1, 12, 8),
  capsule,
  flagellum: flagellum(),
  virusSpikes: virusSpikes(),
  rbc: rbcGeometry(),
  mouth: new THREE.TorusGeometry(0.32, 0.09, 8, 20),
  antibody: antibody(),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
  hex: new THREE.CylinderGeometry(1, 1, 1, 6),
  icosa: new THREE.IcosahedronGeometry(1, 0),
  arc: new THREE.TorusGeometry(0.62, 0.07, 6, 20, Math.PI * 1.1),
  box: new THREE.BoxGeometry(1, 1, 1),
  ring: new THREE.RingGeometry(0.86, 1, 64),
}
