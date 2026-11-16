import { world, startGame } from './logic'
import { useGame } from './store'

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export const isTouchDevice = () =>
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches)

// Keyboard + mouse. Touch input is handled by <TouchControls/> (virtual twin sticks).
export function setupInput() {
  const { input } = world
  const setTouch = (on) => {
    if (useGame.getState().touch !== on) useGame.setState({ touch: on })
  }
  const typing = (e) => e.target instanceof Element && !!e.target.closest('input, textarea, [contenteditable]')
  const kd = (e) => {
    if (typing(e)) return // name entry: don't move, dash or restart while typing
    if (BLOCK.has(e.code)) e.preventDefault()
    if (e.repeat) return
    input.keys.add(e.code)
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dash = true
    if (e.code === 'Enter' && useGame.getState().status !== 'playing') startGame()
  }
  const ku = (e) => input.keys.delete(e.code)
  const mm = (e) => {
    if (e.pointerType === 'touch') return
    input.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  }
  const md = (e) => {
    if (e.pointerType === 'touch') return setTouch(true)
    setTouch(false)
    mm(e)
    if (e.button === 0) input.mouseDown = true
  }
  const mu = (e) => {
    if (e.pointerType !== 'touch' && e.button === 0) input.mouseDown = false
  }
  const blur = () => {
    input.keys.clear()
    input.mouseDown = false
    input.move.set(0, 0)
    input.aiming = false
  }
  const prevent = (e) => e.preventDefault()

  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  window.addEventListener('pointermove', mm)
  window.addEventListener('pointerdown', md)
  window.addEventListener('pointerup', mu)
  window.addEventListener('blur', blur)
  window.addEventListener('contextmenu', prevent)
  // iOS Safari: block pinch-zoom gestures that ignore user-scalable=no
  document.addEventListener('gesturestart', prevent)
  return () => {
    window.removeEventListener('keydown', kd)
    window.removeEventListener('keyup', ku)
    window.removeEventListener('pointermove', mm)
    window.removeEventListener('pointerdown', md)
    window.removeEventListener('pointerup', mu)
    window.removeEventListener('blur', blur)
    window.removeEventListener('contextmenu', prevent)
    document.removeEventListener('gesturestart', prevent)
  }
}
