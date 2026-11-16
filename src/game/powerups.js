import * as THREE from 'three'
import { world, rand, TAU, TYPES, ARENA_R, burst, killEnemy, damageEnemy, ringFx, toast, touches, clampArena } from './logic'

export const POWERUPS = {
  tentacles: { name: 'Tentacle Whips', desc: 'Swinging pseudopods smack every germ nearby', color: '#ffa24d', duration: 12 },
  antibodies: { name: 'Antibody Volley', desc: 'Rapid-fire homing antibodies', color: '#4fd8ff', duration: 10 },
  shield: { name: 'Mucus Shield', desc: 'Absorbs the next 4 hits', color: '#9a8cff', duration: 16 },
  nova: { name: 'Histamine Burst', desc: 'A shockwave blasts everything around you', color: '#ffe14d', duration: 0 },
  heal: { name: 'Platelet Patch', desc: '+35 health', color: '#ff6b9d', duration: 0 },
}

export const TENTACLE_ARMS = 4
export const TENTACLE_SEGS = 14
const TENTACLE_LEN = 4.6
const NOVA_R = 9

// Called while logic.js initialises, so it must not touch module-level consts here.
export function emptyPowers() {
  return {
    active: { tentacles: 0, antibodies: 0, shield: 0 },
    shieldHits: 0,
    shieldFlash: 0,
    shieldCd: 0,
    tentacle: {
      angle: 0,
      extend: 0,
      points: Array.from({ length: 4 * 14 }, () => ({ pos: new THREE.Vector3(), r: 0 })),
    },
  }
}

function pickType() {
  const w = { tentacles: 3, antibodies: 3, shield: 2, nova: 2, heal: world.player.hp < 70 ? 3 : 0.6 }
  let total = 0
  for (const k in w) total += w[k]
  let r = Math.random() * total
  for (const k in w) {
    r -= w[k]
    if (r <= 0) return k
  }
  return 'tentacles'
}

export function spawnPickup(type, x, z) {
  if (world.pickups.length >= 5) return
  const pos = new THREE.Vector3(x, 0, z)
  clampArena(pos, 1.5)
  world.pickups.push({ id: world.nextId++, type: type ?? pickType(), pos, age: 0, life: 16 })
  world.dirty = true
}

export function maybeDrop(e, chance) {
  const c = e.type === 'parasite' ? 0.35 : chance
  if (world.pickups.length < 3 && Math.random() < c) spawnPickup(null, e.pos.x, e.pos.z)
}

function nova() {
  const p = world.player
  ringFx(p.pos, NOVA_R, POWERUPS.nova.color, 0.6)
  burst(p.pos, '#fff3a0', 40, 14, 0.2)
  world.shake = 0.9
  for (const e of world.enemies) {
    if (e.dead || e.dying || !touches(e, p.pos, NOVA_R)) continue
    const T = TYPES[e.type]
    if (T.small) killEnemy(e)
    else damageEnemy(e, T.boss ? 10 : 7)
  }
  world.shots = world.shots.filter((s) => Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) > NOVA_R)
}

function activate(type) {
  const P = POWERUPS[type]
  const p = world.player
  toast(P.name, P.desc, P.color)
  burst(p.pos, P.color, 18, 6, 0.2)
  if (type === 'heal') {
    p.hp = Math.min(100, p.hp + 35)
    return
  }
  if (type === 'nova') return nova()
  world.active[type] = P.duration
  if (type === 'shield') world.shieldHits = 4
}

// Returns true if the shield absorbed the hit.
export function shieldBlocks() {
  if (world.active.shield <= 0 || world.shieldHits <= 0) return false
  if (world.shieldCd > 0) return true // brief grace so one contact doesn't drain every charge
  world.shieldHits--
  world.shieldFlash = 1
  world.shieldCd = 0.5
  burst(world.player.pos, POWERUPS.shield.color, 14, 6, 0.16)
  if (world.shieldHits <= 0) world.active.shield = 0
  return true
}

function updateTentacles(dt) {
  const tc = world.tentacle
  const p = world.player
  const left = world.active.tentacles
  const target = left > 0 ? Math.min(1, left / 0.5) : 0
  tc.extend += (target - tc.extend) * (1 - Math.exp(-dt * 8))
  if (tc.extend < 0.02) {
    for (const pt of tc.points) pt.r = 0
    return
  }
  tc.angle += dt * 2.6
  const t = world.time
  for (let i = 0; i < TENTACLE_ARMS; i++) {
    const base = tc.angle + (i * TAU) / TENTACLE_ARMS
    // walk outward as a connected chain so beads never separate; the bend travels down the arm like a whip
    let dirA = base
    let x = p.pos.x + Math.cos(base) * p.r * 0.8 * tc.extend
    let z = p.pos.z + Math.sin(base) * p.r * 0.8 * tc.extend
    const stepLen = (TENTACLE_LEN / TENTACLE_SEGS) * tc.extend
    for (let j = 0; j < TENTACLE_SEGS; j++) {
      const f = (j + 1) / TENTACLE_SEGS
      dirA += -0.05 + Math.sin(t * 5 - j * 0.5 + i * 1.7) * 0.1
      x += Math.cos(dirA) * stepLen
      z += Math.sin(dirA) * stepLen
      const pt = tc.points[i * TENTACLE_SEGS + j]
      pt.pos.set(x, 0.15, z)
      pt.r = (0.44 - 0.22 * f) * Math.max(0.3, tc.extend)
    }
  }
  if (tc.extend < 0.5) return
  for (const e of world.enemies) {
    if (e.dead || e.dying || e.age < 0.25 || e.hitCd > 0) continue
    for (const pt of tc.points) {
      if (!touches(e, pt.pos, pt.r)) continue
      if (TYPES[e.type].small) killEnemy(e)
      else {
        damageEnemy(e, 1)
        e.hitCd = 0.22
      }
      burst(pt.pos, '#ffc38a', 4, 3, 0.1)
      break
    }
  }
}

export function updatePowerups(dt) {
  const p = world.player
  for (const k in world.active) {
    if (world.active[k] > 0) {
      world.active[k] = Math.max(0, world.active[k] - dt)
      if (k === 'shield' && world.active[k] === 0) world.shieldHits = 0
    }
  }
  world.shieldFlash = Math.max(0, world.shieldFlash - dt * 3)
  world.shieldCd = Math.max(0, world.shieldCd - dt)

  let removed = false
  for (const pk of world.pickups) {
    pk.age += dt
    pk.life -= dt
    if (pk.life > 0 && Math.hypot(pk.pos.x - p.pos.x, pk.pos.z - p.pos.z) < p.r + 0.8) {
      activate(pk.type)
      pk.life = 0
    }
    if (pk.life <= 0) removed = true
  }
  if (removed) {
    world.pickups = world.pickups.filter((pk) => pk.life > 0)
    world.dirty = true
  }

  world.pickupT -= dt
  if (world.pickupT <= 0) {
    world.pickupT = rand(18, 26)
    if (world.pickups.length < 2) {
      const a = rand(0, TAU)
      const r = rand(4, ARENA_R - 4)
      spawnPickup(null, Math.cos(a) * r, Math.sin(a) * r)
    }
  }

  updateTentacles(dt)
}

export function hudPowers() {
  return Object.keys(world.active)
    .filter((k) => world.active[k] > 0)
    .map((k) => ({
      type: k,
      name: POWERUPS[k].name,
      color: POWERUPS[k].color,
      frac: world.active[k] / POWERUPS[k].duration,
      extra: k === 'shield' ? `${world.shieldHits} hits` : `${Math.ceil(world.active[k])}s`,
    }))
}
