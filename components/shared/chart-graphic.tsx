import * as React from "react"
import {
  formatValue,
  niceScale,
  parseNumber,
  seriesColor,
  sliceColor,
  type ChartSpec,
} from "@/lib/chart"
import { rgba, whim } from "@/lib/palette"

/**
 * Disegno di un grafico in SVG nativo: niente librerie, niente <foreignObject>.
 * È un <g> da mettere dentro a qualsiasi SVG, così lo usano il documento, la
 * board e le esportazioni in SVG/PNG/PDF senza differenze.
 */

type Colors = { text: string; muted: string; grid: string; surface: string }

function chartColors(dark: boolean): Colors {
  return dark
    ? {
        text: whim.base[50],
        muted: rgba("#ffffff", 0.62),
        grid: rgba("#ffffff", 0.14),
        surface: whim.base[900],
      }
    : {
        text: whim.base[800],
        muted: whim.base[600],
        grid: whim.base[200],
        surface: "#ffffff",
      }
}

const FONT = 11
const charW = (size: number) => size * 0.56
const textWidth = (s: string, size = FONT) => s.length * charW(size)

function clip(s: string, max: number, size = FONT) {
  const room = Math.max(1, Math.floor(max / charW(size)))
  return s.length > room ? `${s.slice(0, Math.max(1, room - 1))}…` : s
}

/** Curva morbida che passa per tutti i punti (Catmull-Rom → Bézier) */
function smoothPath(points: [number, number][]) {
  if (points.length < 3) return linePath(points)
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

function linePath(points: [number, number][]) {
  return points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")
}

type LegendItem = { label: string; color: string }

function legendLayout(
  items: LegendItem[],
  position: ChartSpec["legend"],
  width: number
) {
  if (position === "none" || items.length === 0) {
    return { rows: [] as LegendItem[][], height: 0, width: 0 }
  }
  if (position === "right") {
    const w = Math.min(
      150,
      Math.max(...items.map((i) => textWidth(i.label))) + 26
    )
    return { rows: items.map((i) => [i]), height: items.length * 18, width: w }
  }
  const rows: LegendItem[][] = [[]]
  let used = 0
  for (const item of items) {
    const w = Math.min(160, textWidth(item.label)) + 30
    if (used + w > width && rows[rows.length - 1].length) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1].push(item)
    used += w
  }
  return { rows, height: rows.length * 18 + 6, width: 0 }
}

export function ChartGraphic({
  spec,
  width,
  height,
  dark = false,
  font,
}: {
  spec: ChartSpec
  width: number
  height: number
  dark?: boolean
  font?: string
}) {
  const c = chartColors(dark)
  const pad = 12
  const radial = spec.type === "pie" || spec.type === "doughnut"
  const titleH = spec.title.trim() ? 28 : 0

  const legendItems: LegendItem[] = radial
    ? spec.categories.map((label, i) => ({ label, color: sliceColor(spec, i) }))
    : spec.series.map((s, i) => ({
        label: s.name,
        color: seriesColor(spec, i),
      }))
  const legend = legendLayout(legendItems, spec.legend, width - pad * 2)

  const area = {
    x: pad,
    y: pad + titleH + (spec.legend === "top" ? legend.height : 0),
    w: width - pad * 2 - (spec.legend === "right" ? legend.width + 10 : 0),
    h:
      height -
      pad * 2 -
      titleH -
      (spec.legend === "top" || spec.legend === "bottom" ? legend.height : 0),
  }

  let body: React.ReactNode
  if (
    !spec.categories.length ||
    !spec.series.length ||
    area.w < 40 ||
    area.h < 40
  ) {
    body = (
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        fontSize={12}
        fill={c.muted}
      >
        Nessun dato
      </text>
    )
  } else if (radial) {
    body = <Radial spec={spec} area={area} colors={c} />
  } else if (spec.type === "radar") {
    body = <Radar spec={spec} area={area} colors={c} />
  } else {
    body = <Cartesian spec={spec} area={area} colors={c} />
  }

  // la legenda
  const legendNodes: React.ReactNode[] = []
  if (legend.rows.length) {
    legend.rows.forEach((row, r) => {
      const rowW = row.reduce(
        (sum, it) => sum + Math.min(160, textWidth(it.label)) + 30,
        0
      )
      let x =
        spec.legend === "right"
          ? width - pad - legend.width
          : (width - rowW) / 2
      const y =
        spec.legend === "top"
          ? pad + titleH + 4 + r * 18
          : spec.legend === "bottom"
            ? height - pad - legend.height + 8 + r * 18
            : area.y + (area.h - legend.height) / 2 + r * 18
      for (const it of row) {
        legendNodes.push(
          <g key={`${r}-${it.label}-${x}`}>
            <rect x={x} y={y} width={10} height={10} rx={2.5} fill={it.color} />
            <text x={x + 15} y={y + 9} fontSize={FONT} fill={c.text}>
              {clip(
                it.label,
                spec.legend === "right" ? legend.width - 20 : 140
              )}
            </text>
          </g>
        )
        x += Math.min(160, textWidth(it.label)) + 30
      }
    })
  }

  return (
    <g fontFamily={font} style={{ fontVariantNumeric: "tabular-nums" }}>
      {titleH ? (
        <text
          x={width / 2}
          y={pad + 16}
          textAnchor="middle"
          fontSize={15}
          fontWeight={700}
          fill={c.text}
        >
          {clip(spec.title, width - pad * 2, 15)}
        </text>
      ) : null}
      {body}
      {legendNodes}
    </g>
  )
}

type Area = { x: number; y: number; w: number; h: number }

/* ------------------------ istogramma, barre, linee ----------------------- */

function Cartesian({
  spec,
  area,
  colors: c,
}: {
  spec: ChartSpec
  area: Area
  colors: Colors
}) {
  const horizontal = spec.type === "bar"
  const scatter = spec.type === "scatter"
  const stacked =
    spec.stacked &&
    (spec.type === "column" || spec.type === "bar" || spec.type === "area")
  const n = spec.categories.length

  // estremi dei valori, sommati se in pila
  let min = Infinity
  let max = -Infinity
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      for (const s of spec.series) {
        const v = s.values[i] ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      max = Math.max(max, pos)
      min = Math.min(min, neg)
    }
  } else {
    for (const s of spec.series) {
      for (const v of s.values) {
        max = Math.max(max, v)
        min = Math.min(min, v)
      }
    }
  }
  const scale = niceScale(min, max, Math.max(2, Math.round(area.h / 46)))
  const tickLabels = scale.values.map(formatValue)

  // x numerico per la dispersione
  const numeric = spec.categories.every((cat) => /^\s*-?[\d.,]+\s*$/.test(cat))
  const xs = spec.categories.map((cat, i) =>
    numeric ? parseNumber(cat) : i + 1
  )
  const xScale = scatter
    ? niceScale(
        Math.min(...xs),
        Math.max(...xs),
        Math.max(2, Math.round(area.w / 70))
      )
    : null

  const yTitleW = spec.yTitle.trim() ? 18 : 0
  const xTitleH = spec.xTitle.trim() ? 18 : 0
  const valueLabelW = Math.max(...tickLabels.map((t) => textWidth(t))) + 8
  const catLabelW = Math.min(
    area.w * 0.32,
    Math.max(...spec.categories.map((t) => textWidth(t))) + 10
  )
  const leftW = yTitleW + (horizontal ? catLabelW : valueLabelW)
  const bottomH = xTitleH + 20

  const plot = {
    x: area.x + leftW,
    y: area.y + 6,
    w: Math.max(10, area.w - leftW - 6),
    h: Math.max(10, area.h - bottomH - 6),
  }

  const valueAt = (v: number) =>
    horizontal
      ? plot.x + ((v - scale.min) / (scale.max - scale.min)) * plot.w
      : plot.y + plot.h - ((v - scale.min) / (scale.max - scale.min)) * plot.h
  const zero = valueAt(0)
  const band = (horizontal ? plot.h : plot.w) / n
  const center = (i: number) =>
    horizontal ? plot.y + band * (i + 0.5) : plot.x + band * (i + 0.5)
  const xAt = (i: number) =>
    xScale
      ? plot.x + ((xs[i] - xScale.min) / (xScale.max - xScale.min)) * plot.w
      : center(i)

  const out: React.ReactNode[] = []

  // griglia e valori dell'asse
  scale.values.forEach((v, i) => {
    const p = valueAt(v)
    if (spec.grid || v === 0) {
      out.push(
        horizontal ? (
          <line
            key={`g${i}`}
            x1={p}
            x2={p}
            y1={plot.y}
            y2={plot.y + plot.h}
            stroke={v === 0 ? c.muted : c.grid}
            strokeWidth={v === 0 ? 1 : 0.8}
          />
        ) : (
          <line
            key={`g${i}`}
            x1={plot.x}
            x2={plot.x + plot.w}
            y1={p}
            y2={p}
            stroke={v === 0 ? c.muted : c.grid}
            strokeWidth={v === 0 ? 1 : 0.8}
          />
        )
      )
    }
    out.push(
      horizontal ? (
        <text
          key={`t${i}`}
          x={p}
          y={plot.y + plot.h + 14}
          textAnchor="middle"
          fontSize={FONT - 1}
          fill={c.muted}
        >
          {tickLabels[i]}
        </text>
      ) : (
        <text
          key={`t${i}`}
          x={plot.x - 6}
          y={p + 3.5}
          textAnchor="end"
          fontSize={FONT - 1}
          fill={c.muted}
        >
          {tickLabels[i]}
        </text>
      )
    )
  })

  // etichette delle categorie (o dei valori x per la dispersione)
  if (xScale) {
    xScale.values.forEach((v, i) => {
      const p = plot.x + ((v - xScale.min) / (xScale.max - xScale.min)) * plot.w
      out.push(
        <text
          key={`x${i}`}
          x={p}
          y={plot.y + plot.h + 14}
          textAnchor="middle"
          fontSize={FONT - 1}
          fill={c.muted}
        >
          {formatValue(v)}
        </text>
      )
    })
  } else {
    const every = Math.ceil(
      (Math.max(...spec.categories.map((t) => textWidth(t, FONT - 1))) + 8) /
        Math.max(1, band)
    )
    spec.categories.forEach((cat, i) => {
      if (!horizontal && every > 1 && i % every) return
      out.push(
        horizontal ? (
          <text
            key={`c${i}`}
            x={plot.x - 6}
            y={center(i) + 3.5}
            textAnchor="end"
            fontSize={FONT - 1}
            fill={c.muted}
          >
            {clip(cat, catLabelW - 8, FONT - 1)}
          </text>
        ) : (
          <text
            key={`c${i}`}
            x={center(i)}
            y={plot.y + plot.h + 14}
            textAnchor="middle"
            fontSize={FONT - 1}
            fill={c.muted}
          >
            {clip(cat, band * every - 4, FONT - 1)}
          </text>
        )
      )
    })
  }

  // titoli degli assi
  if (spec.yTitle.trim()) {
    const cx = area.x + 8
    const cy = plot.y + plot.h / 2
    out.push(
      <text
        key="yt"
        x={cx}
        y={cy}
        textAnchor="middle"
        fontSize={FONT}
        fontWeight={600}
        fill={c.muted}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        {clip(spec.yTitle, plot.h)}
      </text>
    )
  }
  if (spec.xTitle.trim()) {
    out.push(
      <text
        key="xt"
        x={plot.x + plot.w / 2}
        y={area.y + area.h - 2}
        textAnchor="middle"
        fontSize={FONT}
        fontWeight={600}
        fill={c.muted}
      >
        {clip(spec.xTitle, plot.w)}
      </text>
    )
  }

  const ns = spec.series.length

  if (spec.type === "column" || spec.type === "bar") {
    const inner = band * 0.72
    const barSize = stacked ? inner : inner / ns
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      for (let si = 0; si < ns; si++) {
        const s = spec.series[si]
        const v = s.values[i] ?? 0
        const color = seriesColor(spec, si)
        let from: number
        let to: number
        if (stacked) {
          from = valueAt(v >= 0 ? pos : neg)
          to = valueAt(v >= 0 ? pos + v : neg + v)
          if (v >= 0) pos += v
          else neg += v
        } else {
          from = zero
          to = valueAt(v)
        }
        const offset = stacked ? 0 : si * barSize
        const start = center(i) - inner / 2 + offset
        const gap = stacked ? 0 : Math.min(2, barSize * 0.12)
        const rect = horizontal
          ? {
              x: Math.min(from, to),
              y: start + gap / 2,
              width: Math.abs(to - from),
              height: Math.max(0.5, barSize - gap),
            }
          : {
              x: start + gap / 2,
              y: Math.min(from, to),
              width: Math.max(0.5, barSize - gap),
              height: Math.abs(to - from),
            }
        out.push(
          <rect
            key={`b${si}-${i}`}
            {...rect}
            rx={Math.min(3, barSize / 4)}
            fill={color}
          />
        )
        if (spec.labels && v !== 0) {
          const label = formatValue(v)
          out.push(
            horizontal ? (
              <text
                key={`bl${si}-${i}`}
                x={stacked ? (from + to) / 2 : to + (v >= 0 ? 4 : -4)}
                y={rect.y + rect.height / 2 + 3.5}
                textAnchor={stacked ? "middle" : v >= 0 ? "start" : "end"}
                fontSize={FONT - 1}
                fontWeight={600}
                fill={stacked ? "#ffffff" : c.text}
              >
                {label}
              </text>
            ) : (
              <text
                key={`bl${si}-${i}`}
                x={rect.x + rect.width / 2}
                y={stacked ? (from + to) / 2 + 3.5 : to + (v >= 0 ? -4 : 12)}
                textAnchor="middle"
                fontSize={FONT - 1}
                fontWeight={600}
                fill={stacked ? "#ffffff" : c.text}
              >
                {label}
              </text>
            )
          )
        }
      }
    }
  } else {
    // linee, aree e dispersione
    const base = new Array(n).fill(0)
    const order =
      spec.type === "area" && !stacked
        ? [...spec.series.keys()]
        : [...spec.series.keys()]
    const layers: React.ReactNode[] = []
    const tops: React.ReactNode[] = []
    for (const si of order) {
      const s = spec.series[si]
      const color = seriesColor(spec, si)
      const points: [number, number][] = []
      const lower: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const v = s.values[i] ?? 0
        const b = stacked ? base[i] : 0
        points.push([xAt(i), valueAt(b + v)])
        lower.push([xAt(i), valueAt(b)])
        if (stacked) base[i] += v
      }
      const path = spec.smooth ? smoothPath(points) : linePath(points)
      if (spec.type === "area") {
        const back = [...lower].reverse()
        const d = `${path} L${back.map((p) => `${p[0]},${p[1]}`).join(" L")} Z`
        layers.push(
          <path
            key={`a${si}`}
            d={d}
            fill={color}
            fillOpacity={stacked ? 0.85 : 0.3}
            stroke="none"
          />
        )
      }
      if (spec.type !== "scatter") {
        tops.push(
          <path
            key={`l${si}`}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      }
      points.forEach(([x, y], i) => {
        if (spec.type === "area" && !spec.labels) return
        tops.push(
          <circle
            key={`p${si}-${i}`}
            cx={x}
            cy={y}
            r={spec.type === "scatter" ? 4.5 : 3.2}
            fill={spec.type === "scatter" ? color : c.surface}
            stroke={color}
            strokeWidth={spec.type === "scatter" ? 0 : 2}
            fillOpacity={spec.type === "scatter" ? 0.85 : 1}
          />
        )
        if (spec.labels) {
          tops.push(
            <text
              key={`pl${si}-${i}`}
              x={x}
              y={y - 8}
              textAnchor="middle"
              fontSize={FONT - 1}
              fontWeight={600}
              fill={c.text}
            >
              {formatValue(s.values[i] ?? 0)}
            </text>
          )
        }
      })
    }
    out.push(...layers, ...tops)
  }

  return <g>{out}</g>
}

/* ----------------------------- torta e anello ---------------------------- */

function Radial({
  spec,
  area,
  colors: c,
}: {
  spec: ChartSpec
  area: Area
  colors: Colors
}) {
  const values = spec.categories.map((_, i) =>
    Math.max(0, spec.series[0]?.values[i] ?? 0)
  )
  const total = values.reduce((a, b) => a + b, 0)
  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2
  const r = Math.max(10, Math.min(area.w, area.h) / 2 - 4)
  const inner = spec.type === "doughnut" ? r * 0.58 : 0
  if (total <= 0) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={c.grid}
        strokeWidth={2}
      />
    )
  }

  const out: React.ReactNode[] = []
  let angle = -Math.PI / 2
  values.forEach((v, i) => {
    if (v <= 0) return
    const sweep = (v / total) * Math.PI * 2
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    const color = sliceColor(spec, i)
    const large = sweep > Math.PI ? 1 : 0
    const p = (a: number, rad: number) =>
      `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`
    let d: string
    if (sweep >= Math.PI * 2 - 1e-6) {
      // una fetta sola: due archi, perché un arco di 360° non si disegna
      d = inner
        ? `M${p(a0, r)} A${r},${r} 0 1 1 ${p(a0 + Math.PI, r)} A${r},${r} 0 1 1 ${p(a0, r)} M${p(a0, inner)} A${inner},${inner} 0 1 0 ${p(a0 + Math.PI, inner)} A${inner},${inner} 0 1 0 ${p(a0, inner)} Z`
        : `M${p(a0, r)} A${r},${r} 0 1 1 ${p(a0 + Math.PI, r)} A${r},${r} 0 1 1 ${p(a0, r)} Z`
    } else if (inner) {
      d = `M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, inner)} A${inner},${inner} 0 ${large} 0 ${p(a0, inner)} Z`
    } else {
      d = `M${cx},${cy} L${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} Z`
    }
    out.push(
      <path
        key={`s${i}`}
        d={d}
        fill={color}
        stroke={c.surface}
        strokeWidth={1.5}
        fillRule="evenodd"
      />
    )
    if (sweep > 0.22) {
      const mid = (a0 + a1) / 2
      const lr = inner ? (r + inner) / 2 : r * 0.64
      const label = spec.labels
        ? formatValue(v)
        : `${Math.round((v / total) * 100)}%`
      out.push(
        <text
          key={`sl${i}`}
          x={cx + Math.cos(mid) * lr}
          y={cy + Math.sin(mid) * lr + 4}
          textAnchor="middle"
          fontSize={FONT}
          fontWeight={700}
          fill="#ffffff"
        >
          {label}
        </text>
      )
    }
  })
  if (inner) {
    out.push(
      <text
        key="total"
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={Math.max(11, Math.min(20, inner / 2.6))}
        fontWeight={700}
        fill={c.text}
      >
        {formatValue(total)}
      </text>
    )
  }
  return <g>{out}</g>
}

/* ---------------------------------- radar -------------------------------- */

function Radar({
  spec,
  area,
  colors: c,
}: {
  spec: ChartSpec
  area: Area
  colors: Colors
}) {
  const n = spec.categories.length
  const all = spec.series.flatMap((s) => s.values)
  const scale = niceScale(Math.min(0, ...all), Math.max(...all), 4)
  const labelW = Math.min(
    90,
    Math.max(...spec.categories.map((t) => textWidth(t)))
  )
  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2
  const r = Math.max(10, Math.min(area.w / 2 - labelW - 8, area.h / 2 - 18))
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    const rad = ((v - scale.min) / (scale.max - scale.min)) * r
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as const
  }
  const out: React.ReactNode[] = []
  scale.values.forEach((v, k) => {
    if (k === 0) return
    const ring = Array.from({ length: n }, (_, i) => at(i, v).join(",")).join(
      " "
    )
    out.push(
      <polygon
        key={`r${k}`}
        points={ring}
        fill="none"
        stroke={c.grid}
        strokeWidth={0.8}
      />
    )
  })
  spec.categories.forEach((cat, i) => {
    const [x, y] = at(i, scale.max)
    out.push(
      <line
        key={`ax${i}`}
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke={c.grid}
        strokeWidth={0.8}
      />
    )
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    const lx = cx + Math.cos(a) * (r + 10)
    const ly = cy + Math.sin(a) * (r + 10)
    out.push(
      <text
        key={`al${i}`}
        x={lx}
        y={ly + 3.5}
        textAnchor={
          Math.abs(Math.cos(a)) < 0.2
            ? "middle"
            : Math.cos(a) > 0
              ? "start"
              : "end"
        }
        fontSize={FONT - 1}
        fill={c.muted}
      >
        {clip(cat, labelW, FONT - 1)}
      </text>
    )
  })
  spec.series.forEach((s, si) => {
    const color = seriesColor(spec, si)
    const pts = spec.categories.map((_, i) => at(i, s.values[i] ?? 0))
    out.push(
      <polygon
        key={`p${si}`}
        points={pts.map((p) => p.join(",")).join(" ")}
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    )
    if (spec.labels) {
      pts.forEach(([x, y], i) =>
        out.push(
          <text
            key={`pl${si}-${i}`}
            x={x}
            y={y - 6}
            textAnchor="middle"
            fontSize={FONT - 2}
            fontWeight={600}
            fill={c.text}
          >
            {formatValue(s.values[i] ?? 0)}
          </text>
        )
      )
    }
  })
  return <g>{out}</g>
}

/** Il grafico dentro al suo SVG, per documenti e pannelli */
export function ChartSvg({
  spec,
  width,
  height,
  dark,
  font,
  className,
  fluid,
}: {
  spec: ChartSpec
  width: number
  height: number
  dark?: boolean
  font?: string
  className?: string
  /** si allarga al contenitore mantenendo le proporzioni */
  fluid?: boolean
}) {
  return (
    <svg
      className={className}
      width={fluid ? "100%" : width}
      height={fluid ? "100%" : height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={spec.title || "Grafico"}
    >
      <ChartGraphic
        spec={spec}
        width={width}
        height={height}
        dark={dark}
        font={font}
      />
    </svg>
  )
}
