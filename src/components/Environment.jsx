import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA_R } from '../game/logic'
import { makeCellMaterial, makeFloorMaterial } from '../game/materials'
import { GEO } from '../game/geometries'

const dummy = new THREE.Object3D()
const rand = (a, b) => a + Math.random() * (b - a)

export function Floor() {
  const mat = useMemo(makeFloorMaterial, [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -9, 0]} material={mat}>
      <planeGeometry args={[400, 400]} />
    </mesh>
  )
}

// Red blood cells drifting with the blood flow beneath the play plane.
const RBC_COUNT = 70
export function BloodCells() {
  const mesh = useRef()
  const mat = useMemo(
    () => makeCellMaterial({ color: '#ec3450', shade: '#8f1230', rim: '#ff9a9a', wobble: 0.025, wobbleFreq: 1.2, rimPower: 2, side: THREE.DoubleSide }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const cells = useMemo(
    () =>
      Array.from({ length: RBC_COUNT }, () => ({
        x: rand(-60, 60),
        y: rand(-7.5, -2),
        z: rand(-45, 45),
        speed: rand(1.5, 3.5),
        rx: rand(0, Math.PI),
        rz: rand(0, Math.PI),
        spin: rand(-0.6, 0.6),
        scale: rand(1.3, 1.8),
      })),
    [],
  )
  useFrame((_, dt) => {
    cells.forEach((c, i) => {
      c.x += c.speed * dt
      if (c.x > 60) c.x = -60
      c.rx += c.spin * dt
      c.rz += c.spin * 0.7 * dt
      dummy.position.set(c.x, c.y, c.z)
      dummy.rotation.set(c.rx, 0, c.rz)
      dummy.scale.setScalar(c.scale)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[GEO.rbc, mat, RBC_COUNT]} frustumCulled={false} />
}

// Rings of tissue (endothelial) cells forming the vessel wall around the arena.
function ring(count, radius, y, size) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + rand(-0.03, 0.03)
    const s = size * rand(0.85, 1.15)
    return { x: Math.cos(a) * radius, y, z: Math.sin(a) * radius, rot: -a - Math.PI / 2, sx: s * 1.4, sy: s * 0.75, sz: s }
  })
}

export function TissueWall() {
  const cellsRef = useRef()
  const nucRef = useRef()
  const cellMat = useMemo(
    () => makeCellMaterial({ color: '#ff8aa6', shade: '#c4466f', rim: '#ffe0e8', wobble: 0.05, wobbleFreq: 1.4 }),
    [],
  )
  const nucMat = useMemo(() => makeCellMaterial({ color: '#b23a7a', shade: '#6e1c4d', rim: '#ff9ccc', wobble: 0.05 }), [])
  useEffect(
    () => () => {
      cellMat.dispose()
      nucMat.dispose()
    },
    [cellMat, nucMat],
  )
  const cells = useMemo(() => [...ring(46, ARENA_R + 2.2, 0, 1.7), ...ring(58, ARENA_R + 6, -2.5, 2.3)], [])
  useLayoutEffect(() => {
    cells.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z)
      dummy.rotation.set(0, c.rot, 0)
      dummy.scale.set(c.sx, c.sy, c.sz)
      dummy.updateMatrix()
      cellsRef.current.setMatrixAt(i, dummy.matrix)
      dummy.position.set(c.x, c.y + c.sy * 0.55, c.z)
      dummy.scale.set(c.sx * 0.38, c.sy * 0.55, c.sz * 0.42)
      dummy.updateMatrix()
      nucRef.current.setMatrixAt(i, dummy.matrix)
    })
    cellsRef.current.instanceMatrix.needsUpdate = true
    nucRef.current.instanceMatrix.needsUpdate = true
  }, [cells])
  return (
    <>
      <instancedMesh ref={cellsRef} args={[GEO.sphere, cellMat, cells.length]} frustumCulled={false} />
      <instancedMesh ref={nucRef} args={[GEO.sphere, nucMat, cells.length]} frustumCulled={false} />
    </>
  )
}
