// Scoreboard storage. The UI only talks to `scoreboard`, which has this async interface:
//   list(limit)          -> entries sorted best-first
//   rankFor(score, wave) -> 1-based rank the score would get, or null if it wouldn't make the board
//   submit(entry)        -> { entry, rank, entries }
//   clear()
// Everything is async so an online provider (fetch to a hosted API) can replace the
// localStorage one later without touching the components.

const KEY = 'cell-defender-scores'
const NAME_KEY = 'cell-defender-name'
export const MAX_ENTRIES = 10
export const MAX_NAME = 16

const byRank = (a, b) => b.score - a.score || b.wave - a.wave || a.date - b.date

function valid(e) {
  return e && typeof e.name === 'string' && Number.isFinite(e.score) && Number.isFinite(e.wave) && Number.isFinite(e.date)
}

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter(valid).sort(byRank) : []
  } catch {
    return [] // corrupted or blocked storage: behave like an empty board
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full / private mode: the run just isn't persisted
  }
}

export function cleanName(s) {
  const n = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
  return n || 'Anonymous'
}

export const localScoreboard = {
  async list(limit = MAX_ENTRIES) {
    return read().slice(0, limit)
  },
  async rankFor(score, wave = 0) {
    if (!(score > 0)) return null
    const probe = { score, wave, date: Date.now() }
    const rank = [...read(), probe].sort(byRank).indexOf(probe) + 1
    return rank <= MAX_ENTRIES ? rank : null
  },
  async submit(entry) {
    const e = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName(entry.name),
      score: Math.max(0, Math.floor(entry.score)),
      wave: Math.max(1, Math.floor(entry.wave)),
      kills: Math.max(0, Math.floor(entry.kills ?? 0)),
      bosses: Math.max(0, Math.floor(entry.bosses ?? 0)),
      time: Math.max(0, Math.round(entry.time ?? 0)),
      device: entry.device === 'mobile' ? 'mobile' : 'desktop',
      date: Date.now(),
    }
    const entries = [...read(), e].sort(byRank).slice(0, MAX_ENTRIES)
    write(entries)
    const rank = entries.findIndex((x) => x.id === e.id) + 1
    return { entry: e, rank: rank || null, entries }
  },
  async clear() {
    write([])
  },
}

export const scoreboard = localScoreboard

export function lastName() {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function rememberName(name) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // ignore
  }
}
