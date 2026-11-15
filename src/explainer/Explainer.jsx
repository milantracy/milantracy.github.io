import { useEffect, useState } from 'react'
import './explainer.css'
import Banner from '../site/Banner.jsx'
import Footer from '../site/Footer.jsx'

// A step-through animated diagram, shared by every explainer page.
//
// scene: {
//   width, height,
//   points: { id: [x, y] },                 // where packets travel
//   zones:  [{ x, y, w, h, label, kind, activeOn: [actorIds] }],  // kind: 'dashed' | 'band'
//   dots:   [{ at: pointId, label }],       // small labelled stops inside a zone
//   boxes:  [{ id, x, y, w, h, label, sub }],
// }
// mode: { label, blurb, steps, idle: [boxIds], subs: { boxId: text } }
// step: { path: [pointIds], actor, title, text, kind: 'rpc' | 'alt' | undefined, count: { key: n } }
// counters: [{ key, label }]

const BOX_GAP = 5 // space between an arrow and the box it starts or ends at
const DOT_GAP = 7 // same, for a labelled dot

// How far (0..1) along p→q the segment leaves rect r, if p is inside r.
function exitT([px, py], [qx, qy], r) {
  const dx = qx - px, dy = qy - py
  let t = Infinity
  if (dx > 0) t = Math.min(t, (r.x + r.w - px) / dx)
  if (dx < 0) t = Math.min(t, (r.x - px) / dx)
  if (dy > 0) t = Math.min(t, (r.y + r.h - py) / dy)
  if (dy < 0) t = Math.min(t, (r.y - py) / dy)
  return t
}

// The visible trail, one straight segment per hop. Each segment is trimmed so
// it starts and ends at the edge of a box (or just short of a dot) instead of
// its centre, where the arrowhead would be hidden. `from`/`to` are distances
// along the untrimmed centre-to-centre path, used to time the animation.
function trailSegments(scene, keys) {
  const dotAt = new Set((scene.dots || []).map((d) => d.at))
  const boxAt = ([x, y]) => scene.boxes.find((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)
  // t along p→q (from p's end) at which to start drawing.
  const trim = (key, p, q) => {
    const b = boxAt(p)
    if (b) {
      const g = { x: b.x - BOX_GAP, y: b.y - BOX_GAP, w: b.w + 2 * BOX_GAP, h: b.h + 2 * BOX_GAP }
      return exitT(p, q, g)
    }
    if (dotAt.has(key)) return DOT_GAP / Math.hypot(q[0] - p[0], q[1] - p[1])
    return 0
  }
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  const segs = []
  let walked = 0
  for (let i = 0; i < keys.length - 1; i++) {
    const p = scene.points[keys[i]], q = scene.points[keys[i + 1]]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    const t0 = trim(keys[i], p, q)
    const t1 = 1 - trim(keys[i + 1], q, p)
    if (t1 > t0) {
      segs.push({ a: lerp(p, q, t0), b: lerp(p, q, t1), from: walked + t0 * len, to: walked + t1 * len })
    }
    walked += len
  }
  return { segs, total: walked }
}

const SPEED = 320 // diagram px per second
const MIN_DUR = 0.7, MAX_DUR = 1.8 // seconds for a whole step's path

function Diagram({ scene, step, mode }) {
  const { segs, total } = trailSegments(scene, step.path)
  const dur = Math.min(MAX_DUR, Math.max(MIN_DUR, total / SPEED))
  const sec = (dist) => (dist / total) * dur
  const kind = step.kind || ''
  const stepKey = `${step.path.join('>')}|${step.title}`
  const last = segs[segs.length - 1]
  const idle = new Set(mode.idle || [])
  const subs = mode.subs || {}
  return (
    <svg className="diagram" viewBox={`0 0 ${scene.width} ${scene.height}`} role="img"
      aria-label={`Diagram: ${step.title}`}>
      {scene.zones.map((z) => (
        <g key={z.label}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="10"
            className={`zone ${z.kind} ${z.activeOn?.includes(step.actor) ? 'active' : ''}`} />
          <text x={z.x + 10} y={z.y + 18} className="zone-label">{z.label}</text>
        </g>
      ))}

      {(scene.dots || []).map((dot) => {
        const [x, y] = scene.points[dot.at]
        return (
          <g key={dot.at} className={step.actor === dot.at ? 'dot active' : 'dot'}>
            <circle cx={x} cy={y} r="4" />
            <text x={x} y={y + 18}>{dot.label}</text>
          </g>
        )
      })}

      {scene.boxes.map((b) => (
        <g key={b.id}
          className={`box ${step.actor === b.id ? 'active' : ''} ${idle.has(b.id) ? 'idle' : ''}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 4} className="box-label">{b.label}</text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 13} className="box-sub">{subs[b.id] ?? b.sub}</text>
        </g>
      ))}

      {/* Current hop, drawn above the boxes. Each segment draws in turn, in
          step with the packet riding along it; the arrowhead appears when the
          last segment finishes. */}
      {segs.map((s, i) => {
        const timing = { animationDelay: `${sec(s.from)}s`, animationDuration: `${sec(s.to) - sec(s.from)}s` }
        return (
          <g key={`${stepKey}#${i}`}>
            <line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} pathLength="1"
              className={`trail ${kind}`} style={timing} />
            <circle r="5" className={`packet ${kind}`}
              style={{ ...timing, '--ax': `${s.a[0]}px`, '--ay': `${s.a[1]}px`, '--bx': `${s.b[0]}px`, '--by': `${s.b[1]}px` }} />
          </g>
        )
      })}
      {last && (
        <path key={`${stepKey}#head`} d="M-8,-4 L0,0 L-8,4" className={`arrowhead ${kind}`}
          style={{ animationDelay: `${sec(last.to)}s` }}
          transform={`translate(${last.b[0]},${last.b[1]}) rotate(${Math.atan2(last.b[1] - last.a[1], last.b[0] - last.a[0]) * 180 / Math.PI})`} />
      )}
    </svg>
  )
}

function Stepper({ scene, mode, counters }) {
  const { steps } = mode
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const step = steps[i]

  useEffect(() => {
    if (!playing) return
    if (i >= steps.length - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setI((n) => n + 1), 2400)
    return () => clearTimeout(t)
  }, [playing, i, steps.length])

  const done = steps.slice(0, i + 1)
  const sum = (k) => done.reduce((a, s) => a + (s.count?.[k] || 0), 0)
  const last = steps.length - 1

  return (
    <div className="explainer">
      {mode.blurb && <p className="blurb">{mode.blurb}</p>}
      <Diagram scene={scene} step={step} mode={mode} />

      <div className="caption" aria-live="polite">
        <div className="step-num">Step {i + 1} / {steps.length}</div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
      </div>

      <div className="controls">
        <button onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)) }}
          disabled={i === 0}>← Back</button>
        <button className="primary" onClick={() => {
          if (i === last) setI(0)
          setPlaying((p) => !p)
        }}>{playing ? 'Pause' : i === last ? 'Replay' : 'Play'}</button>
        <button onClick={() => { setPlaying(false); setI((n) => Math.min(last, n + 1)) }}
          disabled={i === last}>Next →</button>
      </div>

      {counters?.length > 0 && (
        <dl className="counters" style={{ gridTemplateColumns: `repeat(${counters.length}, 1fr)` }}>
          {counters.map((c) => (
            <div key={c.key}><dt>{c.label}</dt><dd>{sum(c.key)}</dd></div>
          ))}
        </dl>
      )}
    </div>
  )
}

// Tabs over several modes (or a single stepper when there is one mode).
export default function Explainer({ scene, modes, counters, initial }) {
  const keys = Object.keys(modes)
  const [mode, setMode] = useState(initial || keys[0])
  return (
    <>
      {keys.length > 1 && (
        <div className="tabs" role="tablist">
          {keys.map((k) => (
            <button key={k} role="tab" aria-selected={mode === k}
              className={mode === k ? 'selected' : ''} onClick={() => setMode(k)}>
              {modes[k].label}
            </button>
          ))}
        </div>
      )}
      <Stepper key={mode} scene={typeof scene === 'function' ? scene(mode) : scene}
        mode={modes[mode]} counters={counters} />
    </>
  )
}

// Shared page frame: back links, title, intro, explainer, footer.
export function ExplainerPage({ title, children }) {
  return (
    <>
      <Banner current="log" />
      <main className="explainer-page">
        <nav className="trail" aria-label="Breadcrumb">
          <a href="/log/">Logbook</a> <span aria-hidden="true">›</span>{' '}
          <a href="/log/?tag=gvisor-101">gVisor 101</a>
        </nav>
        <h1>{title}</h1>
        {children}
      </main>
      <Footer />
    </>
  )
}
