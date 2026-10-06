import { useEffect, useRef, useState } from 'react'
import { formatDate, percent } from '../../utils/automationFormat'

// Pass rate per run, oldest → newest. One series (so no legend: the card title names it).
// Marks follow the chart spec: 2px line, 8px markers with a 2px surface ring, hairline grid,
// a crosshair that snaps to the nearest run, and the same readout on keyboard focus.
const HEIGHT = 200
const PAD = { top: 12, right: 16, bottom: 26, left: 40 }
const ACCENT = 'var(--color-signal)'
const GRID = 'var(--color-hairline)'

export default function PassRateChart({ trend }) {
  const wrapRef = useRef(null)
  // 0 until measured: nothing is drawn wider than its card, even for a frame.
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (trend.length === 1 ? plotW / 2 : (i * plotW) / (trend.length - 1))
  const y = (rate) => PAD.top + (1 - rate) * plotH

  // Runs with nothing executed have no rate: the line breaks there instead of dropping to 0.
  const segments = []
  let current = []
  trend.forEach((point, i) => {
    if (point.passRate == null) {
      if (current.length) segments.push(current)
      current = []
    } else {
      current.push(`${x(i)},${y(point.passRate)}`)
    }
  })
  if (current.length) segments.push(current)

  function nearest(clientX) {
    const rect = wrapRef.current.getBoundingClientRect()
    const px = clientX - rect.left
    let best = 0
    trend.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i })
    return best
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(trend.length - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? trend.length) - 1))
    else return
    e.preventDefault()
  }

  const tickEvery = Math.max(1, Math.ceil(trend.length / Math.max(2, Math.floor(plotW / 70))))
  const point = active != null ? trend[active] : null

  return (
    <div ref={wrapRef} className="relative" style={{ minHeight: HEIGHT }}>
      {width > 0 && (
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Pass rate for the last ${trend.length} runs. Use the arrow keys to read each run.`}
        tabIndex={0}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? trend.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle"
                  className="fill-muted text-[11px] tabular-nums">{tick * 100}%</text>
          </g>
        ))}
        {trend.map((p, i) => (i % tickEvery === 0 || i === trend.length - 1) && (
          <text key={p.runId} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">
            #{p.runId}
          </text>
        ))}
        {point && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-hairline-strong)" strokeWidth="1" />
        )}
        {segments.map((points, i) => (
          <polyline key={i} points={points.join(' ')} fill="none" stroke={ACCENT} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {trend.map((p, i) => p.passRate != null && (
          <circle key={p.runId} cx={x(i)} cy={y(p.passRate)} r={i === active ? 5 : 4} fill={ACCENT}
                  stroke="var(--color-surface)" strokeWidth="2" />
        ))}
      </svg>
      )}
      {point && width > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-hairline bg-surface px-2.5 py-2 text-[12px] shadow-[var(--shadow-card)]"
          style={{ left: Math.min(Math.max(x(active) - 75, 0), width - 160) }}
        >
          <p className="text-[14px] font-semibold text-ink">{percent(point.passRate)}</p>
          <p className="text-muted">Run #{point.runId}{point.at ? ` · ${formatDate(point.at)}` : ''}</p>
          <p className="mt-1 text-muted tabular-nums">
            {point.passed} passed · {point.failed} failed{point.flaky ? ` · ${point.flaky} flaky` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

