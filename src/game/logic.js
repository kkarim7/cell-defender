import * as THREE from 'three'
import { useGame } from './store'
import { updatePowerups, maybeDrop, spawnPickup, shieldBlocks, hudPowers, emptyPowers } from './powerups'
import { BOSS_INFO, bossForWave, updateBoss } from './bosses'

export const ARENA_R = 24
export const TAU = Math.PI * 2
const DASH_CD = 1.4
const PLAYER_SPEED = 7.5
// Infection: each live germ adds `load * INFECTION_GAIN` %/s, the immune system removes
// INFECTION_RECOVERY %/s, and every kill cures `cure` %. Clearing a wave cures WAVE_CURE %.
const INFECTION_GAIN = 0.9
const INFECTION_RECOVERY = 1.0
const WAVE_CURE = 15
export const rand = (a, b) => a + Math.random() * (b - a)

// Boss reveal: the camera pulls back to frame the player and the boss, holds, then returns.
// Game time slows to BOSS_INTRO_SLOWMO at the peak so you aren't punished while zoomed out (1 = off).
const BOSS_INTRO = { in: 0.9, hold: 1.8, out: 1.1 }
const BOSS_INTRO_SLOWMO = 0.45

// 0 → 1 → 0 smoothstep envelope over the reveal
export function introBlend(intro) {
  const { t, dur } = intro
  let k = t < BOSS_INTRO.in ? t / BOSS_INTRO.in : t > dur - BOSS_INTRO.out ? (dur - t) / BOSS_INTRO.out : 1
  k = Math.min(1, Math.max(0, k))
  return k * k * (3 - 2 * k)
}

export const TYPES = {
  bacteria: { r: 0.75, hp: 2, score: 10, load: 0.22, cure: 1.5, color: '#9be15d', small: true },
  virus: { r: 0.55, hp: 1, score: 15, load: 0.08, cure: 1, color: '#ff4f8b', small: true },
  parasite: { r: 1.45, hp: 14, score: 60, load: 0.45, cure: 5, color: '#a66bff', segs: 6, spacing: 1.45 },
  larva: { r: 0.8, hp: 4, score: 20, load: 0.15, cure: 1.5, color: '#c9a2ff', segs: 4, spacing: 0.9, small: true },
  megabac: { r: 2.2, hp: 45, score: 300, load: 0.6, cure: 12, color: '#9be15d', boss: true },
  phage: { r: 2.4, hp: 90, score: 600, load: 0.8, cure: 18, color: '#ff6aa0', boss: true },
  worm: { r: 1.9, hp: 130, score: 800, load: 1, cure: 20, color: '#9a4dff', segs: 12, spacing: 1.75, boss: true },
}

function makePlayer() {
  return {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    r: 1.4,
    hp: 100,
    invuln: 0,
    hurt: 0,
    dashT: 0,
    dashCd: 0,
    dashDir: new THREE.Vector3(0, 0, -1),
    face: new THREE.Vector3(0, 0, -1), // last movement direction (touch aim fallback)
    fireCd: 0,
  }
}

function freshState() {
  return {
    player: makePlayer(),
    enemies: [],
    bullets: [],
    shots: [], // enemy projectiles
    particles: [],
    pickups: [],
    effects: [],
    ...emptyPowers(),
    boss: null,
    bossIntro: null, // { e, t, dur } while the reveal camera is active
    timeScale: 1,
    wave: 0,
    queue: [],
    spawnT: 0,
    interT: 0,
    cleared: false,
    infection: 0,
    infTrend: 0,
    lastInf: 0,
    score: 0,
    kills: 0,
    bossKills: 0,
    time: 0,
    shake: 0,
    bannerT: 0,
    toastT: 0,
    pickupT: 20,
    dirty: true,
  }
}

export const world = {
  ...freshState(),
  aim: new THREE.Vector3(0, 0, -5),
  // move: analog touch stick (x, y=z). aimStick: unit direction from the right touch stick.
  input: { keys: new Set(), mouseDown: false, dash: false, ndc: new THREE.Vector2(), move: new THREE.Vector2(), aimStick: new THREE.Vector2(0, -1), aiming: false },
  nextId: 1,
  hudT: 0,
}

export function resetWorld() {
  Object.assign(world, freshState())
}

export function startGame() {
  resetWorld()
  useGame.setState({ status: 'playing', hp: 100, infection: 0, score: 0, wave: 1, dash: 1, reason: '', boss: null, powers: [], toast: null })
  startWave(1)
  useGame.getState().bump()
}

export function banner(title, sub = '') {
  useGame.setState({ banner: { title, sub, key: Math.random() } })
  world.bannerT = 3
}

export function toast(title, sub, color) {
  useGame.setState({ toast: { title, sub, color, key: Math.random() } })
  world.toastT = 2.4
}

const WAVE_TIPS = {
  1: 'Bacteria! Touch them to engulf them before they multiply.',
  2: 'Viruses swarm you. Dash (Space) through them to eat them safely.',
  3: 'A parasite! Too big to eat. Click to fire enzyme granules.',
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function startWave(n) {
  world.wave = n
  world.cleared = false
  const boss = bossForWave(n)
  const k = boss ? 0.5 : 1
  const bac = Math.round((3 + 2 * n) * k)
  const vir = n >= 2 ? Math.round(3 * (n - 1) * k) : 0
  const par = n >= 3 && !boss ? Math.floor((n - 1) / 2) : 0
  const q = shuffle([...Array(bac).fill('bacteria'), ...Array(vir).fill('virus')])
  for (let i = 0; i < par; i++) q.splice(Math.floor(q.length * (0.4 + 0.6 * Math.random())), 0, 'parasite')
  if (boss) q.splice(Math.min(q.length, 3), 0, boss)
  world.queue = q
  world.spawnT = 1.5
  useGame.setState({ wave: n })
  banner(`Wave ${n}`, WAVE_TIPS[n] ?? (boss ? 'Something big is coming…' : 'The infection is adapting. Stay alive.'))
}

export function spawnEnemy(type, x, z) {
  const T = TYPES[type]
  const e = {
    id: world.nextId++,
    type,
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(),
    r: T.r,
    hp: T.hp,
    heading: rand(0, TAU),
    divideT: rand(7, 11),
    flash: 0,
    hitCd: 0,
    age: 0,
    dying: null,
    dead: false,
    seed: rand(0, 100),
  }
  if (T.segs) {
    e.segments = Array.from({ length: T.segs }, (_, i) => new THREE.Vector3(x - i * T.spacing * 0.5, 0, z))
    e.segR = Array.from({ length: T.segs }, (_, i) => T.r * (1 - i / (T.segs * 1.5)))
    e.spacing = T.spacing
  }
  if (T.boss) {
    e.hp = e.maxHp = Math.round(T.hp * (1 + 0.15 * Math.max(0, world.wave - 2)))
    e.state = 'roam'
    e.stateT = 0
    e.timers = { a: 3, b: 5 }
    world.boss = e
    world.shake = 0.8
    world.bossIntro = { e, t: 0, dur: BOSS_INTRO.in + BOSS_INTRO.hold + BOSS_INTRO.out }
    banner(`Boss: ${BOSS_INFO[type].name}`, BOSS_INFO[type].desc)
  }
  world.enemies.push(e)
  world.dirty = true
  return e
}

function spawnAtEdge(type) {
  const p = world.player.pos
  if (TYPES[type].boss) {
    const a = p.lengthSq() > 1 ? Math.atan2(-p.z, -p.x) : rand(0, TAU)
    return spawnEnemy(type, Math.cos(a) * (ARENA_R - 4), Math.sin(a) * (ARENA_R - 4))
  }
  for (let tries = 0; tries < 12; tries++) {
    const a = rand(0, TAU)
    const x = Math.cos(a) * (ARENA_R - 2)
    const z = Math.sin(a) * (ARENA_R - 2)
    if (Math.hypot(x - p.x, z - p.z) > 10 || tries === 11) return spawnEnemy(type, x, z)
  }
}

export function burst(pos, color, n = 12, speed = 6, size = 0.18) {
  const c = new THREE.Color(color)
  for (let i = 0; i < n; i++) {
    if (world.particles.length > 480) world.particles.shift()
    const a = rand(0, TAU)
    const s = rand(0.3, 1) * speed
    world.particles.push({
      pos: pos.clone(),
      vel: new THREE.Vector3(Math.cos(a) * s, rand(0.5, 3), Math.sin(a) * s),
      life: 1,
      decay: rand(1.2, 2.2),
      size: size * rand(0.6, 1.4),
      color: c,
    })
  }
}

// expanding glow ring (nova, boss death)
export function ringFx(pos, maxR, color, dur = 0.6) {
  world.effects.push({ pos: pos.clone(), maxR, color: new THREE.Color(color), t: 0, dur })
}

export function clampArena(pos, r) {
  const d = Math.hypot(pos.x, pos.z)
  const max = ARENA_R - r
  if (d > max) {
    pos.x *= max / d
    pos.z *= max / d
    return true
  }
  return false
}

function gameOver(reason) {
  const s = useGame.getState()
  const best = Math.max(s.best, world.score)
  localStorage.setItem('cell-defender-best', String(best))
  burst(world.player.pos, '#f4f1ff', 40, 10, 0.3)
  const result = { score: world.score, wave: world.wave, kills: world.kills, bosses: world.bossKills, time: Math.round(world.time) }
  useGame.setState({ status: 'gameover', reason, best, result, score: world.score, hp: Math.max(0, Math.round(world.player.hp)), banner: null, toast: null })
}

export function hurt(amount, from) {
  const p = world.player
  if (p.invuln > 0 || p.dashT > 0) return false
  if (shieldBlocks(from)) return false
  p.hp -= amount
  p.invuln = 0.8
  p.hurt = 1
  world.shake = 0.5
  const dx = p.pos.x - from.x
  const dz = p.pos.z - from.z
  const d = Math.hypot(dx, dz) || 1
  p.vel.set((dx / d) * 16, 0, (dz / d) * 16)
  burst(p.pos, '#ff6b8b', 10, 5, 0.16)
  if (p.hp <= 0) gameOver('Your white blood cell was destroyed.')
  return true
}

export function killEnemy(e) {
  if (e.dead || e.dying) return
  const T = TYPES[e.type]
  e.dead = true
  world.dirty = true
  world.score += T.score
  world.kills++
  cureInfection(T.cure)
  if (T.boss) {
    burst(e.pos, T.color, 70, 14, 0.4)
    burst(e.pos, '#ffffff', 30, 9, 0.25)
    ringFx(e.pos, 12, T.color, 0.9)
    world.shake = 1.2
    world.boss = null
    world.bossKills++
    spawnPickup(null, e.pos.x + 1.5, e.pos.z)
    spawnPickup(null, e.pos.x - 1.5, e.pos.z)
    banner(`${BOSS_INFO[e.type].name} destroyed!`, `+${T.score}`)
  } else {
    burst(e.pos, T.color, e.type === 'parasite' ? 30 : 14, 7, e.type === 'parasite' ? 0.3 : 0.18)
    maybeDrop(e, 0.1)
  }
  const larvaAt = e.type === 'parasite' ? [2, 4] : e.type === 'worm' ? [3, 6, 9] : []
  for (const i of larvaAt) {
    const s = e.segments[i]
    spawnEnemy('larva', s.x, s.z).age = 0.2
  }
}

export function cureInfection(amount) {
  world.infection = Math.max(0, world.infection - amount)
}

export function damageEnemy(e, n) {
  if (e.dead || e.dying) return
  e.hp -= n
  e.flash = 1
  if (e.hp <= 0) killEnemy(e)
}

export function engulf(e) {
  if (e.dying || e.dead) return
  e.dying = { t: 0 }
  world.score += TYPES[e.type].score
  world.kills++
  cureInfection(TYPES[e.type].cure)
  const p = world.player
  p.hp = Math.min(100, p.hp + 1)
  burst(e.pos, TYPES[e.type].color, 6, 3, 0.12)
  maybeDrop(e, 0.05)
}

const raycaster = new THREE.Raycaster()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()
const tmp = new THREE.Vector3()

function updateParticles(dt) {
  for (const pt of world.particles) {
    pt.pos.addScaledVector(pt.vel, dt)
    pt.vel.multiplyScalar(Math.exp(-dt * 3))
    pt.life -= pt.decay * dt
  }
  world.particles = world.particles.filter((pt) => pt.life > 0)
  for (const fx of world.effects) fx.t += dt
  world.effects = world.effects.filter((fx) => fx.t < fx.dur)
}

function nearestEnemy(pos, maxD) {
  let best = null
  let bd = maxD * maxD
  for (const e of world.enemies) {
    if (e.dead || e.dying) continue
    const d = (e.pos.x - pos.x) ** 2 + (e.pos.z - pos.z) ** 2
    if (d < bd) {
      bd = d
      best = e
    }
  }
  return best
}

function updateBullets(dt) {
  for (const b of world.bullets) {
    if (b.homing) {
      const t = nearestEnemy(b.pos, 12)
      if (t) {
        const speed = b.vel.length()
        tmp.set(t.pos.x - b.pos.x, 0, t.pos.z - b.pos.z).setLength(speed)
        b.vel.lerp(tmp, 1 - Math.exp(-dt * 7)).setLength(speed)
      }
    }
    b.pos.addScaledVector(b.vel, dt)
    b.life -= dt
    if (Math.hypot(b.pos.x, b.pos.z) > ARENA_R + 2) b.life = 0
  }
  const p = world.player
  for (const s of world.shots) {
    s.pos.addScaledVector(s.vel, dt)
    s.life -= dt
    if (Math.hypot(s.pos.x, s.pos.z) > ARENA_R + 1) s.life = 0
    if (s.life > 0 && p.hp > 0 && Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < p.r + 0.3) {
      s.life = 0
      hurt(7, s.pos)
      burst(s.pos, '#ff7ab8', 6, 3, 0.12)
    }
  }
  world.shots = world.shots.filter((s) => s.life > 0)
}

export function fireShot(from, dirX, dirZ, speed = 7) {
  const l = Math.hypot(dirX, dirZ) || 1
  world.shots.push({ pos: from.clone().setY(0.3), vel: new THREE.Vector3((dirX / l) * speed, 0, (dirZ / l) * speed), life: 4 })
}

function updatePlayer(dt) {
  const p = world.player
  const k = world.input.keys
  let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
  let iz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
  let len = Math.hypot(ix, iz)
  if (len) {
    ix /= len
    iz /= len
  } else if (world.input.move.lengthSq() > 0) {
    // analog touch stick: partial tilt = partial speed
    ix = world.input.move.x
    iz = world.input.move.y
    len = Math.hypot(ix, iz)
  }
  if (len) p.face.set(ix, 0, iz).normalize()

  p.dashCd = Math.max(0, p.dashCd - dt)
  p.invuln = Math.max(0, p.invuln - dt)
  p.hurt = Math.max(0, p.hurt - dt * 4)

  if (world.input.dash && p.dashCd <= 0) {
    if (len) p.dashDir.set(ix, 0, iz).normalize()
    else p.dashDir.set(world.aim.x - p.pos.x, 0, world.aim.z - p.pos.z).normalize()
    p.dashT = 0.26
    p.dashCd = DASH_CD
  }
  world.input.dash = false

  if (p.dashT > 0) {
    p.dashT -= dt
    p.vel.set(p.dashDir.x * 26, 0, p.dashDir.z * 26)
    if (Math.random() < 0.7) burst(p.pos, '#ffffff', 1, 1.5, 0.22)
  } else {
    tmp.set(ix * PLAYER_SPEED, 0, iz * PLAYER_SPEED)
    p.vel.lerp(tmp, 1 - Math.exp(-dt * 9))
  }
  p.pos.addScaledVector(p.vel, dt)
  clampArena(p.pos, p.r)

  // shoot enzyme granules (or homing antibodies when powered up) toward the cursor
  p.fireCd -= dt
  if ((world.input.mouseDown || world.input.aiming) && p.fireCd <= 0) {
    const anti = world.active.antibodies > 0
    p.fireCd = anti ? 0.085 : 0.16
    const dir = tmp.set(world.aim.x - p.pos.x, 0, world.aim.z - p.pos.z)
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1)
    dir.normalize()
    if (anti) dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, rand(-0.25, 0.25))
    world.bullets.push({
      pos: p.pos.clone().addScaledVector(dir, p.r + 0.2),
      vel: dir.clone().multiplyScalar(anti ? 19 : 22),
      life: anti ? 1.5 : 0.9,
      homing: anti,
    })
  }
}

function updateEnemies(dt) {
  const p = world.player
  const mult = 1 + (world.wave - 1) * 0.06
  const list = world.enemies
  const n0 = list.length
  let bacteriaCount = 0
  let load = 0
  for (const e of list) if (e.type === 'bacteria' && !e.dying) bacteriaCount++

  for (let i = 0; i < n0; i++) {
    const e = list[i]
    if (e.dead) continue
    e.age += dt
    e.flash = Math.max(0, e.flash - dt * 6)
    e.hitCd = Math.max(0, e.hitCd - dt)
    if (e.dying) {
      e.dying.t += dt
      e.pos.lerp(p.pos, 1 - Math.exp(-dt * 12))
      if (e.dying.t > 0.35) {
        e.dead = true
        world.dirty = true
      }
      continue
    }
    const T = TYPES[e.type]
    load += T.load

    const dx = p.pos.x - e.pos.x
    const dz = p.pos.z - e.pos.z
    const d = Math.hypot(dx, dz) || 1

    if (T.boss) {
      updateBoss(e, dt, mult, dx / d, dz / d, d, bacteriaCount)
    } else if (e.type === 'bacteria') {
      if (d < 6) {
        tmp.set(-dx / d, 0, -dz / d).multiplyScalar(3.0 * mult)
        e.heading = Math.atan2(-dz, -dx)
      } else {
        e.heading += Math.sin(world.time * 0.8 + e.seed) * 1.5 * dt
        tmp.set(Math.cos(e.heading), 0, Math.sin(e.heading)).multiplyScalar(1.3 * mult)
      }
      e.vel.lerp(tmp, 1 - Math.exp(-dt * 3))
      e.divideT -= dt
      if (e.divideT <= 0) {
        e.divideT = rand(8, 12)
        if (bacteriaCount < 40) {
          const a = e.heading + Math.PI / 2
          const c = spawnEnemy('bacteria', e.pos.x + Math.cos(a) * 0.9, e.pos.z + Math.sin(a) * 0.9)
          c.divideT = rand(9, 13)
          bacteriaCount++
          burst(e.pos, '#d8ffb0', 5, 2, 0.1)
        }
      }
    } else if (e.type === 'virus') {
      const w = Math.sin(world.time * 5 + e.seed) * 1.6
      const sp = 4.3 * mult
      tmp.set((dx / d) * sp - (dz / d) * w, 0, (dz / d) * sp + (dx / d) * w)
      e.vel.lerp(tmp, 1 - Math.exp(-dt * 3))
    } else {
      const sp = (e.type === 'parasite' ? 2.1 : 3.2) * mult
      const w = Math.sin(world.time * 2 + e.seed) * 0.8
      tmp.set((dx / d) * sp - (dz / d) * w, 0, (dz / d) * sp + (dx / d) * w)
      e.vel.lerp(tmp, 1 - Math.exp(-dt * 1.5))
    }

    e.pos.addScaledVector(e.vel, dt)
    if (clampArena(e.pos, e.r) && e.type === 'bacteria') e.heading += Math.PI

    if (e.segments) {
      e.segments[0].copy(e.pos)
      for (let s = 1; s < e.segments.length; s++) {
        const a = e.segments[s]
        const b = e.segments[s - 1]
        tmp.subVectors(a, b)
        const l = tmp.length()
        if (l > e.spacing) a.copy(b).addScaledVector(tmp.divideScalar(l), e.spacing)
      }
    }
  }

  // mass-weighted separation so cells don't stack and bosses shove small fry
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.dying || a.dead) continue
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      if (b.dying || b.dead) continue
      const dx = b.pos.x - a.pos.x
      const dz = b.pos.z - a.pos.z
      const min = a.r + b.r
      const d2 = dx * dx + dz * dz
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const push = ((min - d) / d) * 0.5
        const ma = a.r * a.r
        const mb = b.r * b.r
        const wa = mb / (ma + mb)
        const wb = ma / (ma + mb)
        a.pos.x -= dx * push * wa
        a.pos.z -= dz * push * wa
        b.pos.x += dx * push * wb
        b.pos.z += dz * push * wb
      }
    }
  }
  return load
}

export function touches(e, pos, r) {
  if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r + e.r * 0.85) return true
  if (e.segments) {
    for (let s = 1; s < e.segments.length; s++) {
      const sg = e.segments[s]
      if (Math.hypot(sg.x - pos.x, sg.z - pos.z) < r + e.segR[s] * 0.85) return true
    }
  }
  return false
}

function bounceOff(e, speed) {
  const p = world.player
  const dx = p.pos.x - e.pos.x
  const dz = p.pos.z - e.pos.z
  const d = Math.hypot(dx, dz) || 1
  p.vel.set((dx / d) * speed, 0, (dz / d) * speed)
}

function collisions() {
  const p = world.player
  const dashing = p.dashT > 0
  for (const e of world.enemies) {
    if (e.dead || e.dying || e.age < 0.25) continue
    if (!touches(e, p.pos, p.r)) continue
    const T = TYPES[e.type]
    if (e.type === 'bacteria' || (dashing && (e.type === 'virus' || e.type === 'larva'))) {
      engulf(e)
    } else if (e.type === 'virus') {
      hurt(8, e.pos)
      e.dead = true
      world.dirty = true
      burst(e.pos, T.color, 10, 5, 0.14)
    } else if (dashing) {
      // too big to engulf: dashing in bruises it and bounces you off
      damageEnemy(e, T.boss ? 4 : 3)
      p.dashT = 0
      bounceOff(e, 14)
    } else {
      const dmg = T.boss ? (e.state === 'charge' ? 26 : 20) : e.type === 'parasite' ? 18 : 10
      if (!hurt(dmg, e.pos) && p.invuln <= 0) bounceOff(e, 12)
    }
    if (useGame.getState().status !== 'playing') return
  }

  for (const b of world.bullets) {
    if (b.life <= 0) continue
    for (const e of world.enemies) {
      if (e.dead || e.dying) continue
      if (touches(e, b.pos, 0.2)) {
        damageEnemy(e, 1)
        b.life = 0
        burst(b.pos, b.homing ? '#8be9ff' : '#ffe27a', 4, 3, 0.1)
        break
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0)
}

export function step(dt, camera) {
  dt = Math.min(dt, 1 / 30)
  // the reveal runs on real time; everything else on (possibly slowed) game time
  const intro = world.bossIntro
  if (intro) {
    intro.t += dt
    if (intro.t >= intro.dur || intro.e.dead || useGame.getState().status !== 'playing') world.bossIntro = null
  }
  world.timeScale = world.bossIntro ? 1 - (1 - BOSS_INTRO_SLOWMO) * introBlend(world.bossIntro) : 1
  dt *= world.timeScale
  const inp = world.input
  if (useGame.getState().touch) {
    // touch: aim along the right stick, or ahead of the player when it's released
    const pp = world.player.pos
    if (inp.aiming) world.aim.set(pp.x + inp.aimStick.x * 8, 0, pp.z + inp.aimStick.y * 8)
    else world.aim.copy(pp).addScaledVector(world.player.face, 6)
  } else {
    raycaster.setFromCamera(inp.ndc, camera)
    if (raycaster.ray.intersectPlane(ground, hit)) world.aim.copy(hit)
  }

  updateParticles(dt)
  world.shake = Math.max(0, world.shake - dt * 2)

  if (useGame.getState().status !== 'playing') {
    updateBullets(dt)
    world.bullets = world.bullets.filter((b) => b.life > 0)
    world.player.vel.multiplyScalar(Math.exp(-dt * 4))
    return
  }

  world.time += dt
  updatePlayer(dt)
  updateBullets(dt)

  // waves
  if (world.queue.length) {
    world.spawnT -= dt
    if (world.spawnT <= 0) {
      spawnAtEdge(world.queue.shift())
      world.spawnT = Math.max(0.3, 1.3 - world.wave * 0.1)
    }
  } else if (!world.cleared && !world.enemies.some((e) => !e.dead && !e.dying)) {
    world.cleared = true
    world.interT = 3.4
    world.player.hp = Math.min(100, world.player.hp + 20)
    cureInfection(WAVE_CURE)
    banner(`Wave ${world.wave} cleared!`, `+20 health · −${WAVE_CURE}% infection`)
    const a = rand(0, TAU)
    spawnPickup(null, world.player.pos.x + Math.cos(a) * 5, world.player.pos.z + Math.sin(a) * 5)
  }
  if (world.cleared) {
    world.interT -= dt
    if (world.interT <= 0) startWave(world.wave + 1)
  }

  const load = updateEnemies(dt)
  updatePowerups(dt)
  collisions()

  const prevInf = world.infection
  world.infection = Math.min(100, Math.max(0, world.infection + (load * INFECTION_GAIN - INFECTION_RECOVERY) * dt))
  // smoothed %/s for the HUD trend arrow (kills/cures are applied earlier this frame, so measure from last frame)
  world.infTrend += ((world.infection - (world.lastInf ?? prevInf)) / dt - world.infTrend) * (1 - Math.exp(-dt * 2))
  world.lastInf = world.infection
  if (world.infection >= 100 && useGame.getState().status === 'playing') {
    gameOver('The infection overwhelmed the body.')
  }

  if (world.enemies.some((e) => e.dead)) {
    world.enemies = world.enemies.filter((e) => !e.dead)
    world.dirty = true
  }
  if (world.dirty) {
    world.dirty = false
    useGame.getState().bump()
  }

  if (world.bannerT > 0) {
    world.bannerT -= dt
    if (world.bannerT <= 0) useGame.setState({ banner: null })
  }
  if (world.toastT > 0) {
    world.toastT -= dt
    if (world.toastT <= 0) useGame.setState({ toast: null })
  }

  world.hudT -= dt
  if (world.hudT <= 0 && useGame.getState().status === 'playing') {
    world.hudT = 0.1
    const b = world.boss
    useGame.setState({
      hp: Math.max(0, Math.round(world.player.hp)),
      infection: world.infection,
      infTrend: world.infTrend > 0.15 ? 1 : world.infTrend < -0.15 ? -1 : 0,
      score: world.score,
      dash: 1 - world.player.dashCd / DASH_CD,
      boss: b && !b.dead ? { name: BOSS_INFO[b.type].name, frac: Math.max(0, b.hp / b.maxHp), color: TYPES[b.type].color } : null,
      powers: hudPowers(),
    })
  }
}

// Dev-only handle for debugging in the browser console.
if (import.meta.env.DEV) window.__cell = { world, spawnEnemy, startGame, step, useGame, spawnPickup }
