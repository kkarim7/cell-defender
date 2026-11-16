import { create } from 'zustand'

const IS_TOUCH = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || !!window.matchMedia?.('(pointer: coarse)').matches)

// Glow (bloom post-processing). Off by default on phones: several mobile GPUs flicker with the
// half-float bloom buffers. `?fx=on|off` in the URL overrides; the menu toggle is remembered.
function initialGlow() {
  const url = new URLSearchParams(location.search).get('fx')
  if (url) return url !== 'off'
  const saved = localStorage.getItem('cell-defender-glow')
  if (saved) return saved === 'on'
  return !IS_TOUCH
}

// React-facing state only (HUD + entity list version). Per-frame data lives in `world`.
export const useGame = create((set) => ({
  status: 'menu', // 'menu' | 'playing' | 'gameover'
  hp: 100,
  infection: 0,
  infTrend: 0,
  score: 0,
  wave: 0,
  dash: 1,
  banner: null,
  toast: null,
  boss: null,
  powers: [],
  reason: '',
  result: null, // { score, wave, kills, bosses, time } of the last finished run
  best: Number(localStorage.getItem('cell-defender-best') || 0),
  // touch UI (twin sticks); flips on the first touch / mouse press
  touch: IS_TOUCH,
  glow: initialGlow(),
  setGlow: (on) => {
    localStorage.setItem('cell-defender-glow', on ? 'on' : 'off')
    set({ glow: on })
  },
  enemyVersion: 0,
  bump: () => set((s) => ({ enemyVersion: s.enemyVersion + 1 })),
}))
