import { useEffect, useRef } from 'react'
import { world } from '../game/logic'
import { useGame } from '../game/store'

const STICK_R = 56 // px the knob can travel
const DEADZONE = 0.12

// Floating twin-stick controls: left half of the screen moves, right half aims and fires.
// Each stick appears wherever the thumb lands. The DASH button sits bottom-right.
export function TouchControls() {
  const status = useGame((s) => s.status)
  const touch = useGame((s) => s.touch)
  const dash = useGame((s) => s.dash)
  const layer = useRef()
  const els = { move: { base: useRef(), knob: useRef() }, aim: { base: useRef(), knob: useRef() } }
  const active = status === 'playing' && touch

  useEffect(() => {
    if (!active) return
    const el = layer.current
    const { input } = world
    const sticks = { move: null, aim: null }

    const show = (kind, s) => {
      const b = els[kind].base.current
      b.style.opacity = 1
      b.style.transform = `translate(${s.ox}px, ${s.oy}px)`
    }
    const hide = (kind) => {
      els[kind].base.current.style.opacity = 0
      els[kind].knob.current.style.transform = 'translate(0px, 0px)'
    }
    const update = (kind, e) => {
      const s = sticks[kind]
      let dx = e.clientX - s.ox
      let dy = e.clientY - s.oy
      const len = Math.hypot(dx, dy)
      if (len > STICK_R) {
        dx *= STICK_R / len
        dy *= STICK_R / len
      }
      els[kind].knob.current.style.transform = `translate(${dx}px, ${dy}px)`
      const vx = dx / STICK_R
      const vy = dy / STICK_R
      // screen-down is world +z with this camera, so the stick maps straight onto the ground plane
      if (kind === 'move') {
        if (Math.hypot(vx, vy) < DEADZONE) input.move.set(0, 0)
        else input.move.set(vx, vy)
      } else if (len > 10) {
        input.aimStick.set(dx / len, dy / len)
      }
    }
    const down = (e) => {
      if (e.pointerType === 'mouse' || e.target.closest?.('.dash-btn')) return
      e.preventDefault()
      const kind = e.clientX < window.innerWidth / 2 ? 'move' : 'aim'
      if (sticks[kind]) return
      sticks[kind] = { id: e.pointerId, ox: e.clientX, oy: e.clientY }
      el.setPointerCapture?.(e.pointerId)
      show(kind, sticks[kind])
      if (kind === 'aim') input.aiming = true
      update(kind, e)
    }
    const move = (e) => {
      for (const kind of ['move', 'aim']) if (sticks[kind]?.id === e.pointerId) update(kind, e)
    }
    const up = (e) => {
      for (const kind of ['move', 'aim']) {
        if (sticks[kind]?.id !== e.pointerId) continue
        sticks[kind] = null
        hide(kind)
        if (kind === 'move') input.move.set(0, 0)
        else input.aiming = false
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      input.move.set(0, 0)
      input.aiming = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!active) return null
  const ready = dash >= 1
  return (
    <div className="touch-layer" ref={layer}>
      <div className="touch-hint left">move</div>
      <div className="touch-hint right">aim · fire</div>
      {['move', 'aim'].map((k) => (
        <div key={k} className={`stick ${k}`} ref={els[k].base}>
          <div className="stick-knob" ref={els[k].knob} />
        </div>
      ))}
      <button
        className={`dash-btn ${ready ? 'ready' : ''}`}
        style={{ '--fill': `${Math.min(1, dash) * 360}deg` }}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          world.input.dash = true
        }}
      >
        DASH
      </button>
    </div>
  )
}
