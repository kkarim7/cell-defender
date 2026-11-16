import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '../game/logic'
import { useGame } from '../game/store'
import { makeCellMaterial } from '../game/materials'
import { GEO } from '../game/geometries'

const TAU = Math.PI * 2

function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return a + d * t
}

// grow-in on spawn, shrink when engulfed
function lifeScale(e) {
  let s = Math.min(1, e.age / 0.45)
  s = 1 - Math.pow(1 - s, 3)
  if (e.dying) s *= Math.max(0, 1 - e.dying.t / 0.35)
  return s
}

function useMaterial(factory) {
  const mat = useMemo(factory, [])
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}

const flagellumMat = new THREE.MeshBasicMaterial({ color: '#4c9a35' })
const mouthMat = new THREE.MeshBasicMaterial({ color: '#2e0f5c' })

// Regular bacterium, and the Mega Bacterium boss (same model, scaled + angrier palette).
function Bacterium({ e }) {
  const g = useRef()
  const flag = useRef()
  const mega = e.type === 'megabac'
  const base = mega ? [3.2, 3.2, 2.9] : [1.2, 1.2, 1.2]
  const mat = useMaterial(() =>
    makeCellMaterial(
      mega
        ? { color: '#86d64a', shade: '#2f7a2b', rim: '#f0ffb0', spot: '#4fa83a', spotScale: 1.6, wobble: 0.08, glow: 0.5, seed: e.seed }
        : { color: '#9be15d', shade: '#4b9f3b', rim: '#eaffc2', spot: '#6ec44c', spotScale: 3.2, wobble: 0.05, glow: 0.2, seed: e.seed },
    ),
  )
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    g.current.position.copy(e.pos)
    if (mega && e.state === 'windup') {
      g.current.position.x += (Math.random() - 0.5) * 0.25
      g.current.position.z += (Math.random() - 0.5) * 0.25
    }
    if (e.vel.lengthSq() > 0.02) {
      g.current.rotation.y = lerpAngle(g.current.rotation.y, Math.atan2(e.vel.x, e.vel.z), 1 - Math.exp(-dt * (mega ? 3 : 6)))
    }
    const s = lifeScale(e)
    const w = Math.sin(t * (mega ? 3 : 6) + e.seed)
    g.current.scale.set(base[0] * s * (1 - 0.04 * w), base[1] * s, base[2] * s * (1 + 0.05 * w))
    mat.uniforms.uFlash.value = e.flash * (mega ? 0.45 : 1)
    flag.current.children.forEach((c, i) => {
      c.rotation.y = Math.sin(t * (mega ? 6 : 12) + i * 2 + e.seed) * 0.45
    })
  })
  return (
    <group ref={g}>
      <mesh geometry={GEO.capsule} material={mat} />
      <group ref={flag} position={[0, 0, -0.75]}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * TAU) / 3]}>
            <mesh geometry={GEO.flagellum} material={flagellumMat} position={[0.12, 0, 0]} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Virus({ e }) {
  const g = useRef()
  const core = useMaterial(() =>
    makeCellMaterial({ color: '#ff4f8b', shade: '#a8235a', rim: '#ffc9dc', wobble: 0.04, wobbleFreq: 3, glow: 0.5, seed: e.seed }),
  )
  const spikes = useMaterial(() =>
    makeCellMaterial({ color: '#ffd166', shade: '#e0782e', rim: '#fff3c4', wobble: 0, glow: 0.35, seed: e.seed }),
  )
  useFrame((state, dt) => {
    g.current.position.copy(e.pos)
    g.current.rotation.x += dt * 1.3
    g.current.rotation.y += dt * 0.9
    g.current.scale.setScalar(lifeScale(e))
    core.uniforms.uFlash.value = e.flash
    spikes.uniforms.uFlash.value = e.flash
  })
  return (
    <group ref={g}>
      <mesh geometry={GEO.sphere} material={core} scale={0.45} />
      <mesh geometry={GEO.virusSpikes} material={spikes} />
    </group>
  )
}

const WORM_PALETTES = {
  parasite: { color: '#a66bff', shade: '#5a2fb0', rim: '#efe2ff', spot: '#7d45dc', spotScale: 2, glow: 0.3 },
  larva: { color: '#c9a2ff', shade: '#7a4fd0', rim: '#efe2ff', spot: '#a679f0', spotScale: 2, glow: 0.3 },
  worm: { color: '#9a4dff', shade: '#3f1891', rim: '#ffd6f5', spot: '#ff7ad1', spotScale: 1.4, glow: 0.6 },
}

// Parasite, its larvae, and the Giant Tapeworm boss: a chain of blobby segments.
function Parasite({ e }) {
  const refs = useRef([])
  const mat = useMaterial(() => makeCellMaterial({ ...WORM_PALETTES[e.type], wobble: 0.07, seed: e.seed }))
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const s = lifeScale(e)
    mat.uniforms.uFlash.value = e.flash * (e.type === 'worm' ? 0.45 : 1)
    e.segments.forEach((seg, i) => {
      const m = refs.current[i]
      if (!m) return
      m.position.copy(seg)
      m.scale.setScalar(e.segR[i] * s * (1 + 0.08 * Math.sin(t * 4 - i * 0.9)))
      if (i === 0 && e.vel.lengthSq() > 0.01) m.rotation.y = Math.atan2(e.vel.x, e.vel.z)
    })
  })
  return (
    <group>
      {e.segments.map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={GEO.sphere} material={mat}>
          {i === 0 && <mesh geometry={GEO.mouth} material={mouthMat} position={[0, 0.1, 0.88]} scale={0.9} />}
        </mesh>
      ))}
    </group>
  )
}

// Bacteriophage boss: faceted icosahedral head, ringed tail sheath, six spider legs.
function Segment({ a, b, r, material }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    return {
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    }
  }, [a, b])
  return <mesh geometry={GEO.cylinder} material={material} position={position} quaternion={quaternion} scale={[r, length, r]} />
}

const KNEE = [1.5, 1.0, 0]
const FOOT = [2.5, -0.55, 0]
const HIP = [0.45, 0, 0]

function Phage({ e }) {
  const g = useRef()
  const head = useRef()
  const legs = useRef([])
  const headMat = useMaterial(() =>
    makeCellMaterial({ color: '#ff6aa0', shade: '#a62a62', rim: '#ffe0ec', wobble: 0, glow: 0.7, rimPower: 2, seed: e.seed }),
  )
  const tailMat = useMaterial(() => makeCellMaterial({ color: '#ffd6e6', shade: '#c27a9a', rim: '#ffffff', wobble: 0, glow: 0.3 }))
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    g.current.position.copy(e.pos)
    g.current.rotation.y += dt * 0.5
    g.current.scale.setScalar(lifeScale(e) * 1.2)
    head.current.position.y = 3.5 + Math.sin(t * 2) * 0.15
    head.current.rotation.y = t * 0.3
    headMat.uniforms.uFlash.value = e.flash * 0.45
    tailMat.uniforms.uFlash.value = e.flash * 0.45
    legs.current.forEach((l, i) => l && (l.rotation.z = Math.sin(t * 6 + i * Math.PI) * 0.12))
  })
  return (
    <group ref={g}>
      <mesh ref={head} geometry={GEO.icosa} material={headMat} scale={1.55} />
      <mesh geometry={GEO.cylinder} material={tailMat} position={[0, 2.05, 0]} scale={[0.6, 0.2, 0.6]} />
      <mesh geometry={GEO.cylinder} material={tailMat} position={[0, 1.3, 0]} scale={[0.3, 1.5, 0.3]} />
      {[0.75, 1.05, 1.35, 1.65].map((y) => (
        <mesh key={y} geometry={GEO.mouth} material={tailMat} position={[0, y, 0]} rotation-x={Math.PI / 2} scale={1.3} />
      ))}
      <mesh geometry={GEO.hex} material={tailMat} position={[0, 0.55, 0]} scale={[0.75, 0.25, 0.75]} />
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} rotation-y={(i * TAU) / 6}>
          <group ref={(el) => (legs.current[i] = el)} position={[0, 0.55, 0]}>
            <Segment a={HIP} b={KNEE} r={0.09} material={tailMat} />
            <Segment a={KNEE} b={FOOT} r={0.07} material={tailMat} />
            <mesh geometry={GEO.sphereLow} material={tailMat} position={KNEE} scale={0.14} />
            <mesh geometry={GEO.sphereLow} material={headMat} position={FOOT} scale={0.12} />
          </group>
        </group>
      ))}
    </group>
  )
}

export function Enemies() {
  useGame((s) => s.enemyVersion)
  return world.enemies.map((e) => {
    if (e.type === 'bacteria' || e.type === 'megabac') return <Bacterium key={e.id} e={e} />
    if (e.type === 'virus') return <Virus key={e.id} e={e} />
    if (e.type === 'phage') return <Phage key={e.id} e={e} />
    return <Parasite key={e.id} e={e} />
  })
}
