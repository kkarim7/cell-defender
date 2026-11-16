import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world, step, introBlend } from '../game/logic'
import { useGame } from '../game/store'
import { timeUniform } from '../game/materials'
import { GEO } from '../game/geometries'

const dummy = new THREE.Object3D()
const look = new THREE.Vector3()
const MAX_BULLETS = 160
const MAX_SHOTS = 160
const MAX_PARTICLES = 500

export function GameLoop() {
  useFrame((state, dt) => {
    timeUniform.value = state.clock.elapsedTime
    if (import.meta.env.DEV && window.__cell) window.__cell.camera = state.camera
    step(dt, state.camera)
  })
  return null
}

const CAM_OFFSET = new THREE.Vector3(0, 23, 12)
const BASE_VIEW = 24 // ground units visible top-to-bottom at zoom 1 (conservative for the tilted camera)
const MAX_ZOOM = 2.6
const camOffset = new THREE.Vector3()
const focus = new THREE.Vector3() // smoothed point the camera looks at
const want = new THREE.Vector3()
const mid = new THREE.Vector3()
let zoom = 1 // smoothed multiplier on the camera offset
let primed = false

export function CameraRig() {
  useFrame((state, dt) => {
    const p = world.player.pos
    const aspect = state.size.width / state.size.height
    // pull back on portrait screens so a phone still sees a useful slice of the arena
    const portrait = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1

    // normal play: follow the player, leading slightly toward the aim point
    want.set(p.x + (world.aim.x - p.x) * 0.12, 0, p.z + (world.aim.z - p.z) * 0.12)
    let wantZoom = 1

    // boss reveal: blend toward a shot that frames both the player and the boss
    const intro = world.bossIntro
    if (intro) {
      const k = introBlend(intro)
      const b = intro.e.pos
      mid.set((p.x + b.x) / 2, 0, (p.z + b.z) / 2)
      const margin = intro.e.r * 2 + 10
      // extra vertical room: tall bosses project upward on screen and the HUD/boss bar cover the top edge
      const fitH = (Math.abs(p.z - b.z) + margin + 6) / (BASE_VIEW * portrait)
      const fitW = (Math.abs(p.x - b.x) + margin) / (BASE_VIEW * portrait * aspect)
      const fit = Math.min(MAX_ZOOM, Math.max(1.35, fitH, fitW))
      want.lerp(mid, k)
      wantZoom = 1 + (fit - 1) * k
    }

    if (!primed) {
      focus.copy(want)
      zoom = wantZoom
      primed = true
    }
    const s = 1 - Math.exp(-dt * 4)
    focus.lerp(want, s)
    zoom += (wantZoom - zoom) * s

    camOffset.copy(CAM_OFFSET).multiplyScalar(portrait * zoom)
    state.camera.position.copy(focus).add(camOffset)
    if (world.shake > 0) {
      state.camera.position.x += (Math.random() - 0.5) * world.shake
      state.camera.position.z += (Math.random() - 0.5) * world.shake
    }
    state.camera.lookAt(focus)
  })
  return null
}

function setCount(meshes, n) {
  for (const m of meshes) {
    m.count = n
    m.instanceMatrix.needsUpdate = true
  }
}

// Player projectiles: glowing enzyme granules, or Y-shaped homing antibodies.
export function Bullets() {
  const core = useRef()
  const halo = useRef()
  const anti = useRef()
  const antiHalo = useRef()
  useFrame(() => {
    let n = 0
    let m = 0
    for (const b of world.bullets) {
      if (b.homing) {
        if (m >= MAX_BULLETS) continue
        dummy.position.copy(b.pos)
        dummy.scale.setScalar(1.3)
        dummy.lookAt(look.copy(b.pos).add(b.vel))
        dummy.updateMatrix()
        anti.current.setMatrixAt(m, dummy.matrix)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0.32)
        dummy.updateMatrix()
        antiHalo.current.setMatrixAt(m, dummy.matrix)
        m++
      } else {
        if (n >= MAX_BULLETS) continue
        dummy.position.copy(b.pos)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0.17)
        dummy.updateMatrix()
        core.current.setMatrixAt(n, dummy.matrix)
        dummy.scale.setScalar(0.42)
        dummy.updateMatrix()
        halo.current.setMatrixAt(n, dummy.matrix)
        n++
      }
    }
    setCount([core.current, halo.current], n)
    setCount([anti.current, antiHalo.current], m)
  })
  return (
    <>
      <instancedMesh ref={core} args={[GEO.sphereLow, undefined, MAX_BULLETS]} frustumCulled={false}>
        <meshBasicMaterial color={[3, 2.7, 1.6]} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[GEO.sphereLow, undefined, MAX_BULLETS]} frustumCulled={false}>
        <meshBasicMaterial color={[1.4, 0.95, 0.25]} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={anti} args={[GEO.antibody, undefined, MAX_BULLETS]} frustumCulled={false}>
        <meshBasicMaterial color={[0.9, 2.6, 3.2]} />
      </instancedMesh>
      <instancedMesh ref={antiHalo} args={[GEO.sphereLow, undefined, MAX_BULLETS]} frustumCulled={false}>
        <meshBasicMaterial color={[0.1, 0.6, 0.9]} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  )
}

// Boss projectiles: pink viral payload blobs.
export function EnemyShots() {
  const core = useRef()
  const halo = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const n = Math.min(world.shots.length, MAX_SHOTS)
    for (let i = 0; i < n; i++) {
      dummy.position.copy(world.shots[i].pos)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0.26 * (1 + 0.15 * Math.sin(t * 12 + i)))
      dummy.updateMatrix()
      core.current.setMatrixAt(i, dummy.matrix)
      dummy.scale.setScalar(0.6)
      dummy.updateMatrix()
      halo.current.setMatrixAt(i, dummy.matrix)
    }
    setCount([core.current, halo.current], n)
  })
  return (
    <>
      <instancedMesh ref={core} args={[GEO.sphereLow, undefined, MAX_SHOTS]} frustumCulled={false}>
        <meshBasicMaterial color={[3, 0.9, 1.9]} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[GEO.sphereLow, undefined, MAX_SHOTS]} frustumCulled={false}>
        <meshBasicMaterial color={[1.2, 0.15, 0.6]} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  )
}

export function Particles() {
  const mesh = useRef()
  useLayoutEffect(() => {
    const c = new THREE.Color('#ffffff')
    for (let i = 0; i < MAX_PARTICLES; i++) mesh.current.setColorAt(i, c)
    mesh.current.instanceColor.needsUpdate = true
  }, [])
  useFrame(() => {
    const ps = world.particles
    const n = Math.min(ps.length, MAX_PARTICLES)
    for (let i = 0; i < n; i++) {
      const p = ps[i]
      dummy.position.copy(p.pos)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(p.size * Math.max(0, p.life))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
      mesh.current.setColorAt(i, p.color)
    }
    setCount([mesh.current], n)
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[GEO.sphereLow, undefined, MAX_PARTICLES]} frustumCulled={false}>
      {/* >1 multiplier so sparks catch the bloom */}
      <meshBasicMaterial color={[1.7, 1.7, 1.7]} />
    </instancedMesh>
  )
}

// Expanding shockwave rings (Histamine Burst, boss deaths).
const RING_POOL = 6
export function Rings() {
  const refs = useRef([])
  useFrame(() => {
    for (let i = 0; i < RING_POOL; i++) {
      const m = refs.current[i]
      const fx = world.effects[i]
      if (!m) continue
      m.visible = !!fx
      if (!fx) continue
      const k = fx.t / fx.dur
      const ease = 1 - Math.pow(1 - k, 3)
      m.position.set(fx.pos.x, 0.2, fx.pos.z)
      m.scale.setScalar(Math.max(0.01, fx.maxR * ease))
      m.material.color.copy(fx.color).multiplyScalar(2.5)
      m.material.opacity = 1 - k
    }
  })
  return Array.from({ length: RING_POOL }, (_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={GEO.ring} rotation-x={-Math.PI / 2} visible={false}>
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  ))
}

export function Reticle() {
  const g = useRef()
  useFrame(() => {
    g.current.position.set(world.aim.x, 0.05, world.aim.z)
    g.current.visible = useGame.getState().status === 'playing'
  })
  return (
    <group ref={g}>
      <mesh geometry={GEO.ring} rotation-x={-Math.PI / 2} scale={0.42}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh geometry={GEO.sphereLow} scale={0.07}>
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}
