import { useState } from 'react'
import { useGame } from '../game/store'
import { MenuScores, GameOverScores, fmtTime } from './Leaderboard'
import { startGame } from '../game/logic'

function Bar({ label, value, color, track, trend }) {
  return (
    <div className="bar">
      <div className="bar-label">
        {label}
        {trend === 1 && <span className="trend up">▲ rising</span>}
        {trend === -1 && <span className="trend down">▼ falling</span>}
      </div>
      <div className="bar-track" style={{ background: track }}>
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  )
}

function TopBar() {
  const hp = useGame((s) => s.hp)
  const infection = useGame((s) => s.infection)
  const infTrend = useGame((s) => s.infTrend)
  const score = useGame((s) => s.score)
  const wave = useGame((s) => s.wave)
  const dash = useGame((s) => s.dash)
  const touch = useGame((s) => s.touch)
  return (
    <>
      <div className="panel left">
        <Bar label="HEALTH" value={hp} color="linear-gradient(90deg,#f6f3ff,#cfc4ff)" track="rgba(40,10,40,.55)" />
        <Bar
          label="INFECTION"
          value={infection}
          trend={infTrend}
          color={infection > 70 ? 'linear-gradient(90deg,#c6f06b,#ff5d5d)' : 'linear-gradient(90deg,#9be15d,#c6f06b)'}
          track="rgba(40,10,40,.55)"
        />
      </div>
      <div className="panel right">
        <div className="stat">
          <span>SCORE</span>
          <b>{score}</b>
        </div>
        <div className="stat">
          <span>WAVE</span>
          <b>{wave}</b>
        </div>
      </div>
      {!touch && (
        <div className={`dash ${dash >= 1 ? 'ready' : ''}`}>
          <div className="dash-fill" style={{ width: `${Math.min(1, dash) * 100}%` }} />
          <span>DASH · SPACE</span>
        </div>
      )}
    </>
  )
}

function BossBar() {
  const boss = useGame((s) => s.boss)
  if (!boss) return null
  return (
    <div className="boss">
      <div className="boss-name">{boss.name}</div>
      <div className="boss-track">
        <div className="boss-fill" style={{ width: `${boss.frac * 100}%`, background: boss.color, boxShadow: `0 0 16px ${boss.color}` }} />
      </div>
    </div>
  )
}

function Powers() {
  const powers = useGame((s) => s.powers)
  if (!powers.length) return null
  return (
    <div className="powers">
      {powers.map((p) => (
        <div className="power" key={p.type}>
          <div className="power-head">
            <i style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            <span>{p.name}</span>
            <em>{p.extra}</em>
          </div>
          <div className="power-track">
            <div className="power-fill" style={{ width: `${p.frac * 100}%`, background: p.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Toast() {
  const toast = useGame((s) => s.toast)
  if (!toast) return null
  return (
    <div className="toast" key={toast.key}>
      <b style={{ color: toast.color }}>{toast.title}</b>
      <span>{toast.sub}</span>
    </div>
  )
}

function Banner() {
  const banner = useGame((s) => s.banner)
  if (!banner) return null
  return (
    <div className="banner" key={banner.key}>
      <h2>{banner.title}</h2>
      {banner.sub && <p>{banner.sub}</p>}
    </div>
  )
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <i style={{ background: '#9be15d' }} />
        <span><b>Bacteria</b> Touch to engulf. Multiply if ignored. Every kill pushes the infection back down.</span>
      </li>
      <li>
        <i style={{ background: '#ff4f8b' }} />
        <span><b>Virus</b> Fast swarmers. They hurt on contact, so dash through them to eat them.</span>
      </li>
      <li>
        <i style={{ background: '#a66bff' }} />
        <span><b>Parasite</b> Too big to eat. Shoot it. Splits into larvae when killed.</span>
      </li>
      <li>
        <i style={{ background: '#ffa24d' }} />
        <span><b>Power-ups</b> Grab glowing orbs: tentacle whips, homing antibodies, shields, shockwaves, healing.</span>
      </li>
      <li>
        <i style={{ background: '#ff6aa0' }} />
        <span><b>Bosses</b> A mini-boss every 2nd wave, a big boss every 4th.</span>
      </li>
    </ul>
  )
}

function Controls() {
  const touch = useGame((s) => s.touch)
  return touch ? (
    <p className="controls">
      <kbd>Left thumb</kbd> move · <kbd>Right thumb</kbd> aim &amp; fire · <kbd>DASH</kbd> button
    </p>
  ) : (
    <p className="controls">
      <kbd>WASD</kbd> move · <kbd>Mouse</kbd> aim · <kbd>Click</kbd> shoot enzymes · <kbd>Space</kbd> dash
    </p>
  )
}

function GlowToggle() {
  const glow = useGame((s) => s.glow)
  const setGlow = useGame((s) => s.setGlow)
  return (
    <div className="settings">
      <button className={`chip ${glow ? 'on' : ''}`} onClick={() => setGlow(!glow)}>
        Glow: {glow ? 'On' : 'Off'}
      </button>
      <span>Turn glow off if the screen flickers</span>
    </div>
  )
}

function Menu() {
  const touch = useGame((s) => s.touch)
  const [view, setView] = useState('info')
  if (view === 'scores')
    return (
      <div className="screen">
        <div className="card">
          <MenuScores onBack={() => setView('info')} />
        </div>
      </div>
    )
  return (
    <div className="screen">
      <div className="card">
        <h1>Cell Defender</h1>
        <p className="tag">You are a white blood cell. Something got in. Clean it up.</p>
        <Legend />
        <Controls />
        <div className="row">
          <button onClick={startGame}>{touch ? 'Tap to start' : 'Start · Enter'}</button>
          <button className="secondary" onClick={() => setView('scores')}>
            High scores
          </button>
        </div>
        <GlowToggle />
      </div>
    </div>
  )
}

function GameOver() {
  const reason = useGame((s) => s.reason)
  const touch = useGame((s) => s.touch)
  const best = useGame((s) => s.best)
  const result = useGame((s) => s.result) ?? { score: 0, wave: 0, kills: 0, bosses: 0, time: 0 }
  return (
    <div className="screen">
      <div className="card">
        <h1>Infection Wins</h1>
        <p className="tag">{reason}</p>
        <div className="final">
          <div>
            <span>SCORE</span>
            <b>{result.score}</b>
          </div>
          <div>
            <span>WAVE</span>
            <b>{result.wave}</b>
          </div>
          <div>
            <span>KILLS</span>
            <b>{result.kills}</b>
          </div>
          <div className="opt">
            <span>TIME</span>
            <b>{fmtTime(result.time)}</b>
          </div>
          <div>
            <span>BEST</span>
            <b>{Math.max(best, result.score)}</b>
          </div>
        </div>
        <GameOverScores result={result} />
        <button onClick={startGame}>{touch ? 'Play again' : 'Play again · Enter'}</button>
        <GlowToggle />
      </div>
    </div>
  )
}

export function Hud() {
  const status = useGame((s) => s.status)
  return (
    <div className="hud">
      {status !== 'menu' && <TopBar />}
      {status === 'playing' && (
        <>
          <BossBar />
          <Powers />
          <Toast />
          <Banner />
        </>
      )}
      {status === 'menu' && <Menu />}
      {status === 'gameover' && <GameOver />}
    </div>
  )
}
