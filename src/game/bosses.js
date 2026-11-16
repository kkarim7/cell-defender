import * as THREE from 'three'
import { world, rand, TAU, spawnEnemy, fireShot, burst } from './logic'

export const BOSS_INFO = {
  megabac: { name: 'Mega Bacterium', desc: 'Too big to engulf. It charges at you and buds new bacteria.' },
  phage: { name: 'Bacteriophage', desc: 'Fires rings of viral payload and launches virus swarms.' },
  worm: { name: 'Giant Tapeworm', desc: 'Shoot every segment. It spits at you while it hunts.' },
}

// Mini-boss every 2nd wave, big boss every 4th (alternating phage / worm).
export function bossForWave(n) {
  if (n % 4 === 0) return (n / 4) % 2 === 1 ? 'phage' : 'worm'
  if (n % 2 === 0) return 'megabac'
  return null
}

const tmp = new THREE.Vector3()
const from = new THREE.Vector3()

function shootFrom(e, dx, dz, speed) {
  const l = Math.hypot(dx, dz) || 1
  from.copy(e.pos).addScaledVector(tmp.set(dx / l, 0, dz / l), e.r * 0.9)
  fireShot(from, dx, dz, speed)
}

export function updateBoss(e, dt, mult, ux, uz, d, bacteriaCount) {
  e.stateT += dt
  const enraged = e.hp < e.maxHp * 0.5

  if (e.type === 'megabac') {
    if (e.state === 'roam') {
      tmp.set(ux, 0, uz).multiplyScalar(1.5 * mult)
      e.vel.lerp(tmp, 1 - Math.exp(-dt * 2))
      e.timers.a -= dt
      e.timers.b -= dt
      if (e.timers.b <= 0) {
        e.timers.b = enraged ? 3.5 : 5
        if (bacteriaCount < 40) {
          for (let k = 0; k < 2; k++) {
            const a = rand(0, TAU)
            spawnEnemy('bacteria', e.pos.x + Math.cos(a) * 2.8, e.pos.z + Math.sin(a) * 2.8)
          }
          burst(e.pos, '#d8ffb0', 12, 5, 0.18)
        }
      }
      if (e.timers.a <= 0 && d < 16) {
        e.state = 'windup'
        e.stateT = 0
      }
    } else if (e.state === 'windup') {
      e.vel.multiplyScalar(Math.exp(-dt * 6))
      e.flash = 0.35 + 0.35 * Math.sin(e.stateT * 30)
      e.chargeDir = new THREE.Vector3(ux, 0, uz)
      if (e.stateT > 0.8) {
        e.state = 'charge'
        e.stateT = 0
      }
    } else {
      e.vel.set(e.chargeDir.x * 13 * mult, 0, e.chargeDir.z * 13 * mult)
      if (Math.random() < 0.5) burst(e.pos, '#bff58a', 1, 2, 0.25)
      if (e.stateT > 0.85) {
        e.state = 'roam'
        e.stateT = 0
        e.timers.a = enraged ? 3.5 : 5.5
      }
    }
  } else if (e.type === 'phage') {
    // hover at mid range and circle the player
    const radial = d > 11 ? 1 : d < 7 ? -1 : 0
    tmp.set(ux * radial * 2.5 - uz * 2, 0, uz * radial * 2.5 + ux * 2).multiplyScalar(mult)
    e.vel.lerp(tmp, 1 - Math.exp(-dt * 1.5))
    e.timers.a -= dt
    if (e.timers.a <= 0) {
      e.timers.a = enraged ? 2.2 : 3.2
      const n = enraged ? 18 : 14
      const off = rand(0, TAU)
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU
        shootFrom(e, Math.cos(a), Math.sin(a), 6.5)
      }
      e.flash = 0.6
    }
    e.timers.b -= dt
    if (e.timers.b <= 0) {
      e.timers.b = enraged ? 5 : 7
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU)
        spawnEnemy('virus', e.pos.x + Math.cos(a) * 3, e.pos.z + Math.sin(a) * 3)
      }
    }
  } else if (e.type === 'worm') {
    const sp = 3.3 * mult
    const w = Math.sin(world.time * 2.2 + e.seed) * 1.2
    tmp.set(ux * sp - uz * w, 0, uz * sp + ux * w)
    e.vel.lerp(tmp, 1 - Math.exp(-dt * 1.8))
    e.timers.a -= dt
    if (e.timers.a <= 0) {
      e.timers.a = enraged ? 3 : 4.5
      const base = Math.atan2(uz, ux)
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.2
        shootFrom(e, Math.cos(a), Math.sin(a), 9)
      }
      e.flash = 0.6
    }
  }
}
