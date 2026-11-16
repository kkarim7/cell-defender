import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { scoreboard, cleanName, lastName, rememberName, MAX_NAME } from '../game/scoreboard'

const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function ScoreTable({ entries, highlightId }) {
  if (!entries.length) return <p className="scores-empty">No scores yet. Be the first!</p>
  return (
    <table className="scores">
      <thead>
        <tr>
          <th>#</th>
          <th className="name">Name</th>
          <th>Score</th>
          <th>Wave</th>
          <th className="opt">Date</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={e.id ?? i} className={e.id && e.id === highlightId ? 'me' : ''}>
            <td>{i + 1}</td>
            <td className="name">{e.name}</td>
            <td>
              <b>{e.score}</b>
            </td>
            <td>{e.wave}</td>
            <td className="opt">{fmtDate(e.date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function useEntries() {
  const [entries, setEntries] = useState(null)
  useEffect(() => {
    let live = true
    scoreboard.list().then((l) => live && setEntries(l))
    return () => {
      live = false
    }
  }, [])
  return [entries, setEntries]
}

// Menu "High scores" view.
export function MenuScores({ onBack }) {
  const [entries, setEntries] = useEntries()
  const clear = async () => {
    if (!window.confirm('Delete all saved scores on this device?')) return
    await scoreboard.clear()
    localStorage.removeItem('cell-defender-best')
    useGame.setState({ best: 0 })
    setEntries([])
  }
  return (
    <>
      <h2 className="scores-title">High scores</h2>
      {entries ? <ScoreTable entries={entries} /> : <p className="scores-empty">Loading…</p>}
      <div className="row">
        <button onClick={onBack}>Back</button>
        {entries?.length > 0 && (
          <button className="chip" onClick={clear}>
            Clear scores
          </button>
        )}
      </div>
    </>
  )
}

// Game-over flow: if the run makes the top 10, ask for a name, then show the board with it highlighted.
export function GameOverScores({ result, onDone }) {
  const [entries, setEntries] = useEntries()
  const [rank, setRank] = useState(undefined)
  const [saved, setSaved] = useState(null) // { id, rank }
  const [skipped, setSkipped] = useState(false)
  const [name, setName] = useState(lastName)
  const touch = useGame((s) => s.touch)

  useEffect(() => {
    let live = true
    scoreboard.rankFor(result.score, result.wave).then((r) => live && setRank(r))
    return () => {
      live = false
    }
  }, [result])

  const save = async (ev) => {
    ev.preventDefault()
    const n = cleanName(name)
    rememberName(n)
    const res = await scoreboard.submit({ ...result, name: n, device: touch ? 'mobile' : 'desktop' })
    setEntries(res.entries)
    setSaved({ id: res.entry.id, rank: res.rank })
    onDone?.()
  }

  if (rank === undefined || entries === null) return <p className="scores-empty">Loading…</p>

  if (rank && !saved && !skipped) {
    return (
      <form className="name-entry" onSubmit={save}>
        <p className="new-high">
          New high score! You placed <b>#{rank}</b>
        </p>
        <div className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="Your name"
            aria-label="Your name"
            autoFocus={!touch}
            enterKeyHint="done"
            autoComplete="nickname"
          />
          <button type="submit">Save</button>
        </div>
        <button type="button" className="link" onClick={() => setSkipped(true)}>
          Skip
        </button>
      </form>
    )
  }

  return (
    <>
      {saved?.rank && <p className="new-high">Saved as #{saved.rank}</p>}
      {!rank && <p className="scores-note">Not in the top 10 this time</p>}
      <ScoreTable entries={entries} highlightId={saved?.id} />
    </>
  )
}

export { fmtTime }
