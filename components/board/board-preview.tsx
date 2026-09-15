"use client"

import * as React from "react"
import { fontStack } from "@/lib/fonts"
import { getSwatch, isDark, rgba, whim } from "@/lib/palette"
import { ChartGraphic } from "@/components/shared/chart-graphic"
import { isPathShape, shapePath, textInset } from "@/lib/shapes"
import {
  buildEdgeGeometry,
  headInset,
  headPath,
  transformFor,
  dashFor,
} from "@/lib/geometry"
import { ICONS } from "@/lib/icon-library"
import { FRAME_SPECS, sortedForRender } from "@/lib/items"
import { resolveEdge } from "./edge-view"
import { WireSvg } from "./wire-svg"
import type { BoardData, BoardNode } from "@/lib/types"

/** Divide il testo in righe che stanno nella larghezza data (stima) */
function wrap(text: string, width: number, fontSize: number) {
  const perChar = fontSize * 0.53
  const max = Math.max(1, Math.floor(width / perChar))
  const out: string[] = []
  for (const para of text.split("\n")) {
    let line = ""
    for (const word of para.split(" ")) {
      if (!line.length) line = word
      else if ((line + " " + word).length <= max) line += " " + word
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out.slice(0, 8)
}

/** Card dei grafici: bianca in chiaro, scura in scuro, come a video */
function chartCard() {
  if (typeof document === "undefined") return "#ffffff"
  return document.documentElement.classList.contains("dark")
    ? whim.base[800]
    : "#ffffff"
}

function NodeShapeSvg({
  node,
  radius,
  font,
}: {
  node: BoardNode
  radius: number
  font: string
}) {
  const sw = getSwatch(node.color)
  const stroke = node.outline ? sw.border : "transparent"

  if (node.kind === "chart" && node.chart) {
    const card = chartCard()
    const dark = isDark(card)
    return (
      <g>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={radius}
          fill={card}
          stroke={node.outline ? "var(--w-base-300)" : "none"}
          strokeWidth={1.5}
        />
        <g transform={`translate(${node.x} ${node.y})`}>
          <ChartGraphic
            spec={node.chart}
            width={node.w}
            height={node.h}
            dark={dark}
            font={font}
          />
        </g>
      </g>
    )
  }

  if (node.kind === "draw" && node.points) {
    const pts = node.points
    let d = ""
    for (let i = 0; i < pts.length; i += 2) {
      const x = node.x + pts[i] * node.w
      const y = node.y + pts[i + 1] * node.h
      d += (i === 0 ? "M " : " L ") + `${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return (
      <path
        d={d}
        fill="none"
        stroke={node.strokeColor ?? sw.solid}
        strokeWidth={node.strokeWidth ?? 3}
        strokeOpacity={node.opacity ?? 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  if (node.kind === "icon") {
    const glyph = ICONS[node.icon ?? "star"] ?? []
    const s = Math.min(node.w, node.h) / 24
    return (
      <g
        transform={`translate(${node.x + (node.w - 24 * s) / 2} ${node.y + (node.h - 24 * s) / 2}) scale(${s})`}
      >
        {glyph.map(([tag, attrs], i) =>
          React.createElement(tag, {
            key: i,
            ...(attrs as Record<string, string>),
            fill: "none",
            stroke:
              node.strokeColor ??
              (node.color === "white" ? whim.base[700] : sw.solid),
            strokeWidth: node.strokeWidth ?? 1.8,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          })
        )}
      </g>
    )
  }

  if (node.kind === "section") {
    return (
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={radius}
        fill={rgba(sw.solid, 0.06)}
        stroke={rgba(sw.solid, 0.45)}
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
    )
  }

  if (node.kind === "frame") {
    const spec = FRAME_SPECS[node.frame ?? "plain"]
    return (
      <g>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={radius}
          fill={node.color === "white" ? "var(--card)" : sw.fill}
          stroke="var(--w-base-300)"
          strokeWidth={1.5}
        />
        {node.frame === "browser" ? (
          <g>
            <path
              d={`M ${node.x} ${node.y + radius} Q ${node.x} ${node.y} ${node.x + radius} ${node.y} L ${node.x + node.w - radius} ${node.y} Q ${node.x + node.w} ${node.y} ${node.x + node.w} ${node.y + radius} L ${node.x + node.w} ${node.y + spec.chrome} L ${node.x} ${node.y + spec.chrome} Z`}
              fill="var(--w-base-50)"
            />
            <line
              x1={node.x}
              y1={node.y + spec.chrome}
              x2={node.x + node.w}
              y2={node.y + spec.chrome}
              stroke="var(--w-base-200)"
              strokeWidth={1.5}
            />
            {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
              <circle
                key={c}
                cx={node.x + 16 + i * 15}
                cy={node.y + spec.chrome / 2}
                r={4.5}
                fill={c}
              />
            ))}
            <rect
              x={node.x + 66}
              y={node.y + spec.chrome / 2 - 8}
              width={Math.min(node.w * 0.6, node.w - 90)}
              height={16}
              rx={8}
              fill="var(--w-base-200)"
            />
          </g>
        ) : null}
        {node.frame === "phone" ? (
          <path
            d={`M ${node.x + node.w / 2 - 55} ${node.y} L ${node.x + node.w / 2 + 55} ${node.y} L ${node.x + node.w / 2 + 55} ${node.y + 8} Q ${node.x + node.w / 2 + 55} ${node.y + 22} ${node.x + node.w / 2 + 41} ${node.y + 22} L ${node.x + node.w / 2 - 41} ${node.y + 22} Q ${node.x + node.w / 2 - 55} ${node.y + 22} ${node.x + node.w / 2 - 55} ${node.y + 8} Z`}
            fill="var(--w-base-300)"
          />
        ) : null}
        {node.frame === "watch" ? (
          <rect
            x={node.x + 4}
            y={node.y + 4}
            width={node.w - 8}
            height={node.h - 8}
            rx={radius - 4}
            fill="none"
            stroke="var(--w-base-200)"
            strokeWidth={8}
          />
        ) : null}
      </g>
    )
  }

  if (node.kind === "table" && node.table) {
    const t = node.table
    const totalW = t.colW.reduce((a, b) => a + b, 0) || 1
    const totalH = t.rowH.reduce((a, b) => a + b, 0) || 1
    const lines: React.ReactElement[] = []
    let acc = 0
    for (let c = 0; c < t.cols - 1; c++) {
      acc += (t.colW[c] / totalW) * node.w
      lines.push(
        <line
          key={`c${c}`}
          x1={node.x + acc}
          x2={node.x + acc}
          y1={node.y}
          y2={node.y + node.h}
          stroke="var(--w-base-200)"
          strokeWidth={1}
        />
      )
    }
    acc = 0
    for (let r = 0; r < t.rows - 1; r++) {
      acc += (t.rowH[r] / totalH) * node.h
      lines.push(
        <line
          key={`r${r}`}
          x1={node.x}
          x2={node.x + node.w}
          y1={node.y + acc}
          y2={node.y + acc}
          stroke="var(--w-base-200)"
          strokeWidth={1}
        />
      )
    }
    // contenuto delle celle (troncato in base alla larghezza stimata)
    const cells: React.ReactElement[] = []
    const stripes: React.ReactElement[] = []
    let cy = 0
    for (let r = 0; r < t.rows; r++) {
      const rh = (t.rowH[r] / totalH) * node.h
      const isHeader = t.header && r === 0
      if (t.striped && !isHeader && r % 2 === 0) {
        stripes.push(
          <rect
            key={`s${r}`}
            x={node.x}
            y={node.y + cy}
            width={node.w}
            height={rh}
            fill="var(--w-base-50)"
          />
        )
      }
      let cx = 0
      for (let c = 0; c < t.cols; c++) {
        const cw = (t.colW[c] / totalW) * node.w
        const raw = t.cells[r * t.cols + c] ?? ""
        const maxChars = Math.max(
          1,
          Math.floor((cw - 16) / (node.fontSize * 0.55))
        )
        const value =
          raw.length > maxChars
            ? `${raw.slice(0, Math.max(1, maxChars - 1))}…`
            : raw
        if (value) {
          cells.push(
            <text
              key={`t${r}-${c}`}
              x={node.x + cx + 8}
              y={node.y + cy + rh / 2}
              fontFamily={font}
              fontSize={node.fontSize}
              fontWeight={isHeader ? 700 : 400}
              fill={isHeader ? sw.text : "var(--w-base-800)"}
              dominantBaseline="central"
            >
              {value}
            </text>
          )
        }
        cx += cw
      }
      cy += rh
    }

    return (
      <g>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={radius * 0.8}
          fill="var(--card)"
          stroke="var(--w-base-300)"
          strokeWidth={1.5}
        />
        {stripes}
        {t.header ? (
          <rect
            x={node.x}
            y={node.y}
            width={node.w}
            height={(t.rowH[0] / totalH) * node.h}
            fill={sw.fill}
          />
        ) : null}
        {lines}
        {cells}
      </g>
    )
  }

  if (node.kind === "wire") {
    const accent = node.color === "white" ? "var(--w-base-700)" : sw.solid
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <WireSvg
          node={node}
          font={font}
          accent={accent}
          accentSoft={node.color === "white" ? "var(--w-base-100)" : sw.fill}
          accentText={node.color === "white" ? "var(--w-base-800)" : sw.text}
          radius={radius}
        />
      </g>
    )
  }

  if (node.shape === "ellipse") {
    return (
      <ellipse
        cx={node.x + node.w / 2}
        cy={node.y + node.h / 2}
        rx={node.w / 2}
        ry={node.h / 2}
        fill={sw.fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
    )
  }
  if (isPathShape(node.shape)) {
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <path
          d={shapePath(node.shape, node.w, node.h, radius)}
          fill={sw.fill}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
    )
  }
  return (
    <rect
      x={node.x}
      y={node.y}
      width={node.w}
      height={node.h}
      rx={node.shape === "pill" ? node.h / 2 : radius}
      fill={node.shape === "text" ? "transparent" : sw.fill}
      stroke={
        node.shape === "note" || node.shape === "text" ? "transparent" : stroke
      }
      strokeWidth={1.5}
    />
  )
}

function NodeLabel({ node, font }: { node: BoardNode; font: string }) {
  if (
    !node.text ||
    node.kind === "icon" ||
    node.kind === "draw" ||
    node.kind === "wire"
  )
    return null

  const sw = getSwatch(node.color)
  const inset =
    node.kind === "shape"
      ? textInset(node.shape, node.w, node.h)
      : { x: 10, y: 10 }
  const size = node.fontSize
  // sezioni e frame hanno l'etichetta fuori dal riquadro, in alto a sinistra
  const above = node.kind === "section" || node.kind === "frame"
  const chip = node.kind === "section"
  const lines = wrap(node.text, node.w - inset.x * 2, size)

  const cx = above
    ? node.x + (chip ? 8 : 0)
    : node.align === "left"
      ? node.x + inset.x
      : node.align === "right"
        ? node.x + node.w - inset.x
        : node.x + node.w / 2
  const anchor = above
    ? "start"
    : node.align === "left"
      ? "start"
      : node.align === "right"
        ? "end"
        : "middle"
  const y = above
    ? node.y - size * 0.7 - 6
    : node.y + node.h / 2 - ((lines.length - 1) * size * 1.32) / 2

  return (
    <>
      {chip ? (
        <rect
          x={node.x}
          y={node.y - size - 13}
          width={node.text.length * size * 0.58 + 16}
          height={size + 11}
          rx={5}
          fill={sw.fill}
        />
      ) : null}
      <text
        x={cx}
        y={y}
        textAnchor={anchor}
        fontFamily={font}
        fontSize={size}
        fontWeight={node.bold ? 700 : above ? 600 : 500}
        fontStyle={node.italic ? "italic" : "normal"}
        fill={node.kind === "frame" ? "var(--w-base-600)" : sw.text}
        dominantBaseline="central"
      >
        {lines.map((l, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.32}>
            {l}
          </tspan>
        ))}
      </text>
    </>
  )
}

export function boardPreviewBounds(data: BoardData, pad = 40) {
  if (!data.nodes.length) return { x: 0, y: 0, w: 400, h: 300 }
  const minX = Math.min(...data.nodes.map((n) => n.x))
  const minY = Math.min(
    ...data.nodes.map(
      (n) => n.y - (n.kind === "section" || n.kind === "frame" ? 28 : 0)
    )
  )
  const maxX = Math.max(...data.nodes.map((n) => n.x + n.w))
  const maxY = Math.max(...data.nodes.map((n) => n.y + n.h))
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  }
}

/** Rendering statico di una board in SVG: usato per anteprime ed embed */
export function BoardPreview({
  data,
  background,
  className,
  style,
  padding = 40,
  fit = "meet",
  bounds,
}: {
  data: BoardData
  background?: string
  className?: string
  style?: React.CSSProperties
  padding?: number
  fit?: "meet" | "slice"
  /** riquadro esplicito: usato quando la board ha una pagina impostata */
  bounds?: { x: number; y: number; w: number; h: number }
}) {
  const b = bounds ?? boardPreviewBounds(data, padding)
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const font = fontStack(data.theme.font)
  const ordered = sortedForRender(data.nodes)

  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      preserveAspectRatio={`xMidYMid ${fit}`}
      className={className}
      style={{ background, ...style }}
    >
      {data.edges.map((e) => {
        const from = byId.get(e.from)
        const to = byId.get(e.to)
        if (!from || !to) return null
        const cfg = resolveEdge(e, data.theme)
        const size = 4.6 + cfg.width * 1.9
        const geo = buildEdgeGeometry(
          from,
          to,
          cfg.routing,
          e.fromSide,
          e.toSide,
          data.theme.arrows.cornerRadius,
          headInset(cfg.tail, size),
          headInset(cfg.head, size)
        )
        const head = headPath(cfg.head, size)
        const tail = headPath(cfg.tail, size)
        return (
          <g key={e.id}>
            <path
              d={geo.d}
              fill="none"
              stroke={cfg.color}
              strokeWidth={cfg.width}
              strokeDasharray={dashFor(cfg.style, cfg.width)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {head ? (
              <path
                d={head.d}
                transform={transformFor(geo.end, geo.endAngle)}
                fill={head.filled ? cfg.color : (background ?? "#fff")}
                stroke={cfg.color}
                strokeWidth={head.filled ? 0 : Math.max(1.2, cfg.width * 0.9)}
                strokeLinejoin="round"
              />
            ) : null}
            {tail ? (
              <path
                d={tail.d}
                transform={transformFor(geo.start, geo.startAngle + Math.PI)}
                fill={tail.filled ? cfg.color : (background ?? "#fff")}
                stroke={cfg.color}
                strokeWidth={tail.filled ? 0 : Math.max(1.2, cfg.width * 0.9)}
                strokeLinejoin="round"
              />
            ) : null}
            {e.label ? (
              <text
                x={geo.mid.x}
                y={geo.mid.y + 4}
                textAnchor="middle"
                fontFamily={font}
                fontSize={13}
                fill={cfg.color}
                stroke={background ?? "#fff"}
                strokeWidth={4}
                paintOrder="stroke"
              >
                {e.label}
              </text>
            ) : null}
          </g>
        )
      })}

      {ordered.map((n) => (
        <g key={n.id}>
          <NodeShapeSvg
            node={n}
            radius={n.radius ?? data.theme.cornerRadius}
            font={font}
          />
          <NodeLabel node={n} font={font} />
        </g>
      ))}
    </svg>
  )
}
