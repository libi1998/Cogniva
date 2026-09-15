"use client"

import * as React from "react"
import {
  buildEdgeGeometry,
  dashFor,
  headInset,
  headPath,
  transformFor,
} from "@/lib/geometry"
import { hashSeed, sketchify } from "@/lib/sketch"
import { fontStack } from "@/lib/fonts"
import { whim } from "@/lib/palette"
import type { BoardEdge, BoardNode, BoardTheme } from "@/lib/types"

const SELECT_COLOR = whim.blue[400]

export function resolveEdge(edge: BoardEdge, theme: BoardTheme) {
  const a = theme.arrows
  return {
    routing: edge.routing ?? a.routing,
    head: edge.head ?? a.head,
    tail: edge.tail ?? a.tail,
    style: edge.style ?? a.style,
    width: edge.width ?? a.width,
    color: edge.color ?? a.color,
  }
}

type Props = {
  edge: BoardEdge
  from: BoardNode
  to: BoardNode
  theme: BoardTheme
  /** colore effettivo del canvas: riempie le punte vuote e lo sfondo dell'etichetta */
  background: string
  selected: boolean
  editing: boolean
  /* gestori con identità fissa: ricevono la freccia su cui si agisce */
  onPointerDown: (edge: BoardEdge, e: React.PointerEvent) => void
  onDoubleClick: (edge: BoardEdge, e: React.MouseEvent) => void
  onContextMenu?: (edge: BoardEdge, e: React.MouseEvent) => void
  onLabelCommit: (edge: BoardEdge, value: string) => void
  onLabelCancel: () => void
}

/**
 * Una freccia della board. È memoizzata: spostando un elemento si ridisegnano
 * solo le frecce collegate a lui.
 */
export const EdgeView = React.memo(function EdgeView({
  edge,
  from,
  to,
  theme,
  background,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
  onLabelCommit,
  onLabelCancel,
}: Props) {
  const cfg = resolveEdge(edge, theme)
  const headSize = 4.6 + cfg.width * 1.9

  const geo = React.useMemo(
    () =>
      buildEdgeGeometry(
        from,
        to,
        cfg.routing,
        edge.fromSide,
        edge.toSide,
        theme.arrows.cornerRadius,
        headInset(cfg.tail, headSize),
        headInset(cfg.head, headSize)
      ),
    [
      from,
      to,
      cfg.routing,
      cfg.head,
      cfg.tail,
      edge.fromSide,
      edge.toSide,
      theme.arrows.cornerRadius,
      headSize,
    ]
  )

  const isSketch = cfg.style === "sketch"
  const seed = React.useMemo(() => hashSeed(edge.id), [edge.id])
  const sketchD = React.useMemo(
    () => (isSketch ? sketchify(geo.d, seed, 2 + cfg.width * 0.5) : null),
    [isSketch, geo.d, seed, cfg.width]
  )

  const d = isSketch && sketchD ? sketchD : geo.d
  const dash = dashFor(cfg.style, cfg.width)
  const jitter = isSketch ? ((seed % 100) / 100 - 0.5) * 7 : 0

  const head = headPath(cfg.head, headSize)
  const tail = headPath(cfg.tail, headSize)

  const label = edge.label
  const pointerDown = (e: React.PointerEvent) => onPointerDown(edge, e)
  const doubleClick = (e: React.MouseEvent) => onDoubleClick(edge, e)
  const contextMenu = onContextMenu
    ? (e: React.MouseEvent) => onContextMenu(edge, e)
    : undefined

  return (
    <g className="group" style={{ pointerEvents: "none" }}>
      {/* zona cliccabile */}
      <path
        d={geo.d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, cfg.width * 8)}
        strokeLinecap="round"
        data-edge-id={edge.id}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onPointerDown={pointerDown}
        onDoubleClick={doubleClick}
        onContextMenu={contextMenu}
      />

      {selected ? (
        <path
          d={d}
          fill="none"
          stroke={SELECT_COLOR}
          strokeOpacity={0.25}
          strokeWidth={cfg.width + 7}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      <path
        d={d}
        fill="none"
        stroke={cfg.color}
        strokeWidth={cfg.width}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      />

      {head ? (
        <path
          d={head.d}
          transform={`${transformFor(geo.end, geo.endAngle)} rotate(${jitter})`}
          fill={head.filled ? cfg.color : background}
          stroke={cfg.color}
          strokeWidth={head.filled ? 0 : Math.max(1.2, cfg.width * 0.9)}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      {tail ? (
        <path
          d={tail.d}
          transform={`${transformFor(geo.start, geo.startAngle + Math.PI)} rotate(${-jitter})`}
          fill={tail.filled ? cfg.color : background}
          stroke={cfg.color}
          strokeWidth={tail.filled ? 0 : Math.max(1.2, cfg.width * 0.9)}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      {label || editing ? (
        <foreignObject
          x={geo.mid.x - 130}
          y={geo.mid.y - 18}
          width={260}
          height={36}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div className="flex h-full w-full items-center justify-center">
            {editing ? (
              <input
                autoFocus
                defaultValue={label}
                onBlur={(e) => onLabelCommit(edge, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onLabelCommit(edge, e.currentTarget.value)
                  }
                  if (e.key === "Escape") {
                    e.preventDefault()
                    onLabelCancel()
                  }
                  e.stopPropagation()
                }}
                className="pointer-events-auto max-w-[220px] rounded-md border border-(--sel) bg-background px-1.5 py-0.5 text-center text-[13px] outline-none"
                style={
                  {
                    "--sel": SELECT_COLOR,
                    fontFamily: fontStack(theme.font),
                  } as React.CSSProperties
                }
              />
            ) : (
              <span
                data-edge-id={edge.id}
                onDoubleClick={doubleClick}
                onPointerDown={pointerDown}
                onContextMenu={contextMenu}
                className="pointer-events-auto max-w-[240px] cursor-pointer truncate rounded-md px-1.5 py-0.5 text-[13px] leading-tight font-medium"
                style={{
                  fontFamily: fontStack(theme.font),
                  color: cfg.color,
                  background,
                  boxShadow: `0 0 0 3px ${background}`,
                }}
              >
                {label}
              </span>
            )}
          </div>
        </foreignObject>
      ) : null}
    </g>
  )
})
