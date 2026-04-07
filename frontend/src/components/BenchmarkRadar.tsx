/**
 * Pure SVG radar / spider chart for model benchmark scores.
 * No external dependency — works with 3–6 axes.
 */
import type { Benchmark } from '@/lib/api'

const MAX_SPEED_TPS = 400  // normalize speed to 0-100 scale

interface Axis {
  key: keyof Benchmark
  label: string
  max: number
}

const AXES: Axis[] = [
  { key: 'mmlu',       label: 'MMLU',      max: 100 },
  { key: 'human_eval', label: 'HumanEval', max: 100 },
  { key: 'math',       label: 'Math',      max: 100 },
  { key: 'reasoning',  label: 'Reasoning', max: 100 },
  { key: 'speed_tps',  label: 'Speed',     max: MAX_SPEED_TPS },
]

const N = AXES.length
const CX = 80
const CY = 80
const R = 62

function polarToXY(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function axisAngle(i: number): number {
  return (360 / N) * i
}

interface Props {
  benchmark: Benchmark | null
  color?: string
  size?: number
}

export default function BenchmarkRadar({ benchmark, color = '#4f7dff', size = 160 }: Props) {
  if (!benchmark) {
    return (
      <div className="flex items-center justify-center text-xs text-[#9099b0]" style={{ width: size, height: size }}>
        No benchmark data
      </div>
    )
  }

  // Compute normalized values [0, 1]
  const values = AXES.map(a => {
    const raw = benchmark[a.key] as number | null
    if (raw == null) return 0
    return Math.min(raw / a.max, 1)
  })

  // Data polygon points
  const dataPoints = values.map((v, i) => polarToXY(axisAngle(i), v * R))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'

  // Grid rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      className="overflow-visible"
    >
      {/* Grid rings */}
      {rings.map(r => {
        const pts = AXES.map((_, i) => polarToXY(axisAngle(i), r * R))
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
        return (
          <path
            key={r}
            d={path}
            fill="none"
            stroke={r === 1 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}
            strokeWidth="1"
          />
        )
      })}

      {/* Axis lines */}
      {AXES.map((_, i) => {
        const [x, y] = polarToXY(axisAngle(i), R)
        return (
          <line
            key={i}
            x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)}
            stroke="rgba(0,0,0,0.1)" strokeWidth="1"
          />
        )
      })}

      {/* Data fill */}
      <path d={dataPath} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Data dots */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} />
      ))}

      {/* Axis labels */}
      {AXES.map((axis, i) => {
        const angle = axisAngle(i)
        const [lx, ly] = polarToXY(angle, R + 14)
        const raw = benchmark[axis.key] as number | null
        const display = axis.key === 'speed_tps'
          ? raw != null ? `${raw}t/s` : '—'
          : raw != null ? raw.toFixed(0) : '—'
        return (
          <g key={i}>
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="7.5" fill="#9099b0" fontFamily="monospace"
            >
              {axis.label}
            </text>
            <text
              x={lx.toFixed(1)} y={(parseFloat(ly.toFixed(1)) + 9).toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="7" fill={color} fontFamily="monospace" fontWeight="600"
            >
              {display}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
