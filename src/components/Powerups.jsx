import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { world } from '../game/logic'
import { POWERUPS, TENTACLE_ARMS, TENTACLE_SEGS } from '../game/powerups'
import { useGame } from '../game/store'
import { makeCellMaterial } from '../game/materials'
import { GEO } from '../game/geometries'

const TAU = Math.PI * 2
const dummy = new THREE.Object3D()

function useMaterials(factory, deps = []) {
  const mats = useMemo(factory, deps)
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

// Little symbol orbiting inside each pickup so they read differently at a glance.
function Icon({ type, mat }) {
  if (type === 'tentacles')
    return [0, 1, 2].map((i) => <mesh key={i} geometry={GEO.arc} material={mat} rotation={[Math.PI / 2, 0, (i * TAU) / 3]} />)
  if (type === 'antibodies')
    return [0, 1, 2].map((i) => (
      <mesh key={i} geometry={GEO.antibody} material={mat} position={[Math.cos((i * TAU) / 3) * 0.62, 0, Math.sin((i * TAU) / 3) * 0.62]} rotation-y={-(i * TAU) / 3} scale={1.6} />
    ))
  if (type === 'shield') return <mesh geometry={GEO.mouth} material={mat} rotation-x={Math.PI / 2} scale={2.1} />
  if (type === 'nova')
    return Array.from({ length: 8 }, (_, i) => (
      <mesh key={i} geometry={GEO.sphereLow} material={mat} position={[Math.cos((i * TAU) / 8) * 0.65, 0, Math.sin((i * TAU) / 8) * 0.65]} scale={0.1} />
    ))
  return (
    <group>
      <mesh geometry={GEO.box} material={mat} scale={[0.7, 0.16, 0.2]} position-y={0.55} />
      <mesh geometry={GEO.box} material={mat} scale={[0.2, 0.16, 0.7]} position-y={0.55} />
    </group>
  )
}

function Pickup({ pk }) {
  const g = useRef()
  const spin = useRef()
  const P = POWERUPS[pk.type]
  const mats = useMaterials(() => {
    const c = new THREE.Color(P.color)
    return {
      core: makeCellMaterial({ color: P.color, shade: '#' + c.clone().multiplyScalar(0.55).getHexString(), rim: '#ffffff', glow: 1.4, emissive: 0.35, wobble: 0.1 }),
      shell: makeCellMaterial({ color: P.color, rim: P.color, opacity: 0.1, glow: 1.2, wobble: 0.05, rimPower: 3 }),
      icon: new THREE.MeshBasicMaterial({ color: new THREE.Color(P.color).multiplyScalar(2) }),
    }
  })
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    g.current.position.set(pk.pos.x, 0.6 + Math.sin(t * 3 + pk.id) * 0.2, pk.pos.z)
    spin.current.rotation.y += dt * 1.6
    g.current.scale.setScalar(Math.min(1, pk.age / 0.3))
    g.current.visible = pk.life > 3 || Math.floor(t * 8) % 2 === 0
  })
  return (
    <group ref={g}>
      <mesh geometry={GEO.sphere} material={mats.core} scale={0.38} />
      <mesh geometry={GEO.sphere} material={mats.shell} scale={0.95} />
      <group ref={spin}>
        <Icon type={pk.type} mat={mats.icon} />
      </group>
      <Html center position={[0, 1.5, 0]} zIndexRange={[5, 0]} pointerEvents="none">
        <div className="pickup-label" style={{ color: P.color }}>
          {P.name}
        </div>
      </Html>
    </group>
  )
}

export function Pickups() {
  useGame((s) => s.enemyVersion)
  return world.pickups.map((pk) => <Pickup key={pk.id} pk={pk} />)
}

// Tentacle Whips: 4 arms of glowing pseudopod beads swinging around the player.
const TENTACLE_COUNT = TENTACLE_ARMS * TENTACLE_SEGS
export function Tentacles() {
  const mesh = useRef()
  const mats = useMaterials(() => ({
    arm: makeCellMaterial({ color: '#ffe6cc', shade: '#e08a5a', rim: '#ffb066', glow: 0.9, wobble: 0.02, rimPower: 1.8 }),
  }))
  useFrame(() => {
    const tc = world.tentacle
    mesh.current.visible = tc.extend > 0.02
    if (!mesh.current.visible) return
    tc.points.forEach((pt, i) => {
      dummy.position.copy(pt.pos)
      dummy.scale.setScalar(Math.max(0.001, pt.r))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[GEO.sphere, mats.arm, TENTACLE_COUNT]} frustumCulled={false} />
}

// Mucus Shield: translucent glowing bubble with one orbiting bead per remaining hit.
export function Shield() {
  const g = useRef()
  const beads = useRef()
  const mats = useMaterials(() => ({
    bubble: makeCellMaterial({ color: '#9a8cff', rim: '#d4ceff', opacity: 0.08, glow: 1.3, wobble: 0.06, rimPower: 3, flashColor: '#ffffff' }),
    bead: new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9b0ff').multiplyScalar(2.2) }),
  }))
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const on = world.active.shield > 0
    g.current.visible = on
    if (!on) return
    g.current.position.copy(world.player.pos)
    const blink = world.active.shield < 2 && Math.floor(t * 8) % 2 === 0
    g.current.scale.setScalar((2.1 + Math.sin(t * 3) * 0.06) * (blink ? 0.96 : 1))
    mats.bubble.uniforms.uFlash.value = world.shieldFlash * 0.6
    beads.current.rotation.y += dt * 2
    beads.current.children.forEach((c, i) => (c.visible = i < world.shieldHits))
  })
  return (
    <group ref={g} visible={false}>
      <mesh geometry={GEO.sphere} material={mats.bubble} renderOrder={3} />
      <group ref={beads}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={GEO.sphereLow} material={mats.bead} position={[Math.cos((i * TAU) / 4), 0, Math.sin((i * TAU) / 4)]} scale={0.07} />
        ))}
      </group>
    </group>
  )
}
