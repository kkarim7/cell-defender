import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '../game/logic'
import { makeCellMaterial } from '../game/materials'
import { GEO } from '../game/geometries'

const TAU = Math.PI * 2
const Y = new THREE.Vector3(0, 1, 0)
const tmp = new THREE.Vector3()

// Multi-lobed nucleus like a neutrophil, plus pink granules floating in the cytoplasm.
const LOBES = [
  [-0.34, 0.12, 0.1, 0.34],
  [0.28, 0.16, -0.12, 0.32],
  [0.04, 0.1, 0.36, 0.3],
]
const GRANULES = Array.from({ length: 16 }, () => {
  const a = Math.random() * TAU
  const r = 0.35 + Math.random() * 0.4
  return [Math.cos(a) * r, 0.1 + (Math.random() - 0.5) * 0.4, Math.sin(a) * r, 0.045 + Math.random() * 0.035]
})

export function Player() {
  const root = useRef()
  const body = useRef()
  const nuc = useRef()
  const mats = useMemo(
    () => ({
      membrane: makeCellMaterial({
        color: '#f6f3ff',
        shade: '#b4aae8',
        rim: '#ffffff',
        opacity: 0.45,
        wobble: 0.07,
        wobbleFreq: 1.8,
        rimPower: 2.2,
        glow: 0.45,
        flashColor: '#ff3d6e',
      }),
      nucleus: makeCellMaterial({ color: '#8550ec', shade: '#4a2499', rim: '#c9b0ff', rimStrength: 0.6, wobble: 0.06, wobbleFreq: 2.2 }),
      granule: makeCellMaterial({ color: '#ff9fd0', shade: '#d0569a', rim: '#ffe6f3', wobble: 0 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const dir = useMemo(() => new THREE.Vector3(1, 0, 0), [])

  useFrame((state, dt) => {
    const p = world.player
    const t = state.clock.elapsedTime
    root.current.position.copy(p.pos)
    root.current.visible = p.hp > 0 && (p.invuln <= 0 || Math.floor(t * 16) % 2 === 0)

    const speed = p.vel.length()
    const s = Math.min(speed / 12, 1)
    if (speed > 0.6) dir.lerp(tmp.copy(p.vel).normalize(), 1 - Math.exp(-dt * 8)).normalize()
    else dir.applyAxisAngle(Y, dt * 0.7)

    const m = mats.membrane.uniforms
    m.uPodDir.value.copy(dir)
    const podTarget = 0.16 + 0.4 * s + (p.dashT > 0 ? 0.25 : 0)
    m.uPod.value += (podTarget - m.uPod.value) * (1 - Math.exp(-dt * 6))
    m.uFlash.value = p.hurt * 0.8

    body.current.scale.setScalar(1.4 * (1 + 0.03 * Math.sin(t * 2.2)))
    nuc.current.rotation.y += dt * 0.35
    // cytoplasm lags behind the membrane when moving
    nuc.current.position.set(-dir.x * 0.1 * s, 0, -dir.z * 0.1 * s)
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <group ref={nuc}>
          {LOBES.map(([x, y, z, r], i) => (
            <mesh key={i} geometry={GEO.sphere} material={mats.nucleus} position={[x, y, z]} scale={r} />
          ))}
          {GRANULES.map(([x, y, z, r], i) => (
            <mesh key={i} geometry={GEO.sphereLow} material={mats.granule} position={[x, y, z]} scale={r} />
          ))}
        </group>
        <mesh geometry={GEO.sphere} material={mats.membrane} renderOrder={2} />
      </group>
    </group>
  )
}
