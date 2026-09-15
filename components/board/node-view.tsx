"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { fontScale, fontStack } from "@/lib/fonts"
import { getSwatch, rgba, whim } from "@/lib/palette"
import { isPathShape, shapeDetail, shapePath, textInset } from "@/lib/shapes"
import { FRAME_SPECS, tableCell } from "@/lib/items"
import { Glyph } from "./glyph"
import { ChartSvg } from "@/components/shared/chart-graphic"
import { useIsDark } from "@/lib/use-theme"
import { WireBody } from "./wireframe"
import type { BoardNode, BoardTheme, Side, TableData } from "@/lib/types"

export const SELECT_COLOR = whim.blue[400]

const HANDLE_SIDES: Exclude<Side, "auto">[] = ["top", "right", "bottom", "left"]
export type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
const RESIZE_DIRS: { dir: ResizeDir; x: number; y: number; cursor: string }[] =
  [
    { dir: "nw", x: 0, y: 0, cursor: "nwse-resize" },
    { dir: "n", x: 0.5, y: 0, cursor: "ns-resize" },
    { dir: "ne", x: 1, y: 0, cursor: "nesw-resize" },
    { dir: "e", x: 1, y: 0.5, cursor: "ew-resize" },
    { dir: "se", x: 1, y: 1, cursor: "nwse-resize" },
    { dir: "s", x: 0.5, y: 1, cursor: "ns-resize" },
    { dir: "sw", x: 0, y: 1, cursor: "nesw-resize" },
    { dir: "w", x: 0, y: 0.5, cursor: "ew-resize" },
  ]

function radiusOf(node: BoardNode, theme: BoardTheme) {
  if (node.kind === "frame")
    return node.radius ?? FRAME_SPECS[node.frame ?? "plain"].radius
  if (node.shape === "pill" || node.shape === "ellipse") return 9999
  return node.radius ?? theme.cornerRadius
}

/** path del tratto a mano libera: i punti sono normalizzati 0…1 */
export function drawPath(points: number[], w: number, h: number) {
  if (!points || points.length < 4) return ""
  const p = (i: number) => ({ x: points[i * 2] * w, y: points[i * 2 + 1] * h })
  const n = points.length / 2
  let d = `M ${p(0).x.toFixed(2)} ${p(0).y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const a = p(i)
    const b = p(i + 1)
    d += ` Q ${a.x.toFixed(2)} ${a.y.toFixed(2)} ${((a.x + b.x) / 2).toFixed(2)} ${((a.y + b.y) / 2).toFixed(2)}`
  }
  const last = p(n - 1)
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return d
}

/* ------------------------------- Corpi ---------------------------------- */

function ShapeBody({
  node,
  theme,
  editing,
}: {
  node: BoardNode
  theme: BoardTheme
  editing: boolean
}) {
  const sw = getSwatch(node.color)
  const r = radiusOf(node, theme)
  const isText = node.shape === "text"
  const isNote = node.shape === "note"
  const path = isPathShape(node.shape)
  const detail = shapeDetail(node.shape, node.w, node.h)
  const stroke = node.outline && !isText && !isNote ? sw.border : "transparent"

  const shadow =
    node.shadow && !isText
      ? isNote
        ? `0 6px 14px -4px ${rgba(whim.base[900], 0.18)}, 0 1px 2px ${rgba(whim.base[900], 0.08)}`
        : `0 2px 5px -2px ${rgba(whim.base[900], 0.12)}, 0 1px 1px ${rgba(whim.base[900], 0.05)}`
      : "none"

  return (
    <>
      {path ? (
        <svg
          width={node.w}
          height={node.h}
          viewBox={`0 0 ${node.w} ${node.h}`}
          className="absolute inset-0 overflow-visible"
          style={{
            filter: node.shadow
              ? `drop-shadow(0 2px 4px ${rgba(whim.base[900], 0.14)})`
              : undefined,
          }}
        >
          <path
            d={shapePath(node.shape, node.w, node.h, r)}
            fill={sw.fill}
            stroke={node.outline ? sw.border : "transparent"}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {detail ? (
            <path
              d={detail}
              fill="none"
              stroke={node.outline ? sw.border : "transparent"}
              strokeWidth={1.5}
            />
          ) : null}
        </svg>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            borderRadius: r,
            background: isText ? "transparent" : sw.fill,
            boxShadow: `${shadow}${stroke !== "transparent" ? `, inset 0 0 0 1.5px ${stroke}` : ""}`,
            transition: "border-radius 120ms ease, background 120ms ease",
          }}
        />
      )}
      {!editing ? <NodeText node={node} theme={theme} color={sw.text} /> : null}
    </>
  )
}

function NodeText({
  node,
  theme,
  color,
  placeholder,
}: {
  node: BoardNode
  theme: BoardTheme
  color: string
  placeholder?: string
}) {
  const inset =
    node.kind === "shape"
      ? textInset(node.shape, node.w, node.h)
      : { x: 10, y: 10 }
  return (
    <div
      className="pointer-events-none absolute flex items-center overflow-hidden"
      style={{
        left: inset.x,
        right: inset.x,
        top: inset.y,
        bottom: inset.y,
        justifyContent:
          node.align === "left"
            ? "flex-start"
            : node.align === "right"
              ? "flex-end"
              : "center",
      }}
    >
      <span
        className="break-words whitespace-pre-wrap"
        style={{
          fontFamily: fontStack(theme.font),
          fontSize: node.fontSize * fontScale(theme.font),
          fontWeight: node.bold ? 700 : 500,
          fontStyle: node.italic ? "italic" : "normal",
          color,
          textAlign: node.align,
          lineHeight: 1.32,
          width: node.align === "center" ? undefined : "100%",
        }}
      >
        {node.text || (
          <span style={{ opacity: 0.3 }}>{placeholder ?? "Testo…"}</span>
        )}
      </span>
    </div>
  )
}

function FrameBody({ node, theme }: { node: BoardNode; theme: BoardTheme }) {
  const kind = node.frame ?? "plain"
  const spec = FRAME_SPECS[kind]
  const r = radiusOf(node, theme)
  const sw = getSwatch(node.color)

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: r,
        background: node.color === "white" ? "var(--card)" : sw.fill,
        boxShadow: `inset 0 0 0 1.5px var(--w-base-300)${
          node.shadow ? `, 0 10px 30px -12px ${rgba(whim.base[900], 0.25)}` : ""
        }`,
      }}
    >
      {kind === "browser" ? (
        <div
          className="flex items-center gap-2 px-3"
          style={{
            height: spec.chrome,
            background: "var(--w-base-50)",
            borderBottom: "1.5px solid var(--w-base-200)",
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              style={{ width: 9, height: 9, borderRadius: 99, background: c }}
            />
          ))}
          <div
            className="ml-2 flex-1"
            style={{
              height: 16,
              borderRadius: 99,
              background: "var(--w-base-200)",
              maxWidth: "60%",
            }}
          />
        </div>
      ) : null}
      {kind === "phone" ? (
        <div
          className="relative flex justify-center"
          style={{ height: spec.chrome }}
        >
          <div
            style={{
              width: 110,
              height: 22,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
              background: "var(--w-base-300)",
            }}
          />
        </div>
      ) : null}
      {kind === "watch" ? (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: `inset 0 0 0 8px var(--w-base-200)`,
            borderRadius: r,
          }}
        />
      ) : null}
    </div>
  )
}

function SectionBody({ node, theme }: { node: BoardNode; theme: BoardTheme }) {
  const sw = getSwatch(node.color)
  const r = radiusOf(node, theme)
  return (
    <div
      className="absolute inset-0"
      style={{
        borderRadius: r,
        background: rgba(sw.solid, 0.06),
        border: `1.5px dashed ${rgba(sw.solid, 0.45)}`,
      }}
    />
  )
}

function SectionLabel({ node, theme }: { node: BoardNode; theme: BoardTheme }) {
  const sw = getSwatch(node.color)
  return (
    <div
      className="pointer-events-none absolute left-0 flex items-center gap-1.5 rounded-md px-2 py-0.5 whitespace-nowrap"
      style={{
        top: -26,
        background: sw.fill,
        color: sw.text,
        fontFamily: fontStack(theme.font),
        fontSize: node.fontSize,
        fontWeight: node.bold ? 700 : 600,
      }}
    >
      {node.text || "Sezione"}
    </div>
  )
}

function FrameLabel({ node, theme }: { node: BoardNode; theme: BoardTheme }) {
  return (
    <div
      className="pointer-events-none absolute left-0 whitespace-nowrap"
      style={{
        top: -22,
        color: "var(--w-base-600)",
        fontFamily: fontStack(theme.font),
        fontSize: node.fontSize,
        fontWeight: 500,
      }}
    >
      {node.text || FRAME_SPECS[node.frame ?? "plain"].label}
    </div>
  )
}

/** Grafico sulla board: una card con il disegno vettoriale */
function ChartBody({ node, theme }: { node: BoardNode; theme: BoardTheme }) {
  const dark = useIsDark()
  const r = radiusOf(node, theme)
  if (!node.chart) return null
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: r,
        background: dark ? whim.base[800] : "#ffffff",
        boxShadow: `${node.outline ? "inset 0 0 0 1.5px var(--w-base-300)" : "inset 0 0 0 0 transparent"}${
          node.shadow ? `, 0 2px 8px -2px ${rgba(whim.base[900], 0.14)}` : ""
        }`,
      }}
    >
      <ChartSvg
        spec={node.chart}
        width={node.w}
        height={node.h}
        dark={dark}
        font={fontStack(theme.font)}
      />
    </div>
  )
}

function TableBody({
  node,
  theme,
  editingCell,
  onCellCommit,
}: {
  node: BoardNode
  theme: BoardTheme
  editingCell: number | null
  onCellCommit: (index: number, value: string) => void
}) {
  const t = node.table as TableData
  const sw = getSwatch(node.color)
  const r = radiusOf(node, theme)
  if (!t) return null

  const totalW = t.colW.reduce((a, b) => a + b, 0) || 1
  const totalH = t.rowH.reduce((a, b) => a + b, 0) || 1

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: r * 0.8,
        background: "var(--card)",
        boxShadow: `inset 0 0 0 1.5px var(--w-base-300)${
          node.shadow ? `, 0 2px 6px -2px ${rgba(whim.base[900], 0.12)}` : ""
        }`,
        fontFamily: fontStack(theme.font),
        fontSize: node.fontSize,
        display: "grid",
        gridTemplateColumns: t.colW
          .map((w) => `${(w / totalW) * 100}%`)
          .join(" "),
        gridTemplateRows: t.rowH.map((h) => `${(h / totalH) * 100}%`).join(" "),
      }}
    >
      {Array.from({ length: t.rows * t.cols }).map((_, i) => {
        const row = Math.floor(i / t.cols)
        const col = i % t.cols
        const isHeader = t.header && row === 0
        const bg = isHeader
          ? sw.fill
          : t.striped && row % 2 === 0
            ? "var(--w-base-50)"
            : "transparent"
        return (
          <div
            key={i}
            data-cell={i}
            style={{
              background: bg,
              color: isHeader ? sw.text : "var(--w-base-800)",
              fontWeight: isHeader ? 700 : 400,
              borderRight:
                col < t.cols - 1 ? "1px solid var(--w-base-200)" : "none",
              borderBottom:
                row < t.rows - 1 ? "1px solid var(--w-base-200)" : "none",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            {editingCell === i ? (
              <input
                autoFocus
                defaultValue={tableCell(t, row, col)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => onCellCommit(i, e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter" || e.key === "Escape") {
                    e.preventDefault()
                    onCellCommit(i, e.currentTarget.value)
                  }
                }}
                className="w-full bg-transparent outline-none"
                style={{ font: "inherit", color: "inherit" }}
              />
            ) : (
              <span className="truncate">{tableCell(t, row, col)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function IconBody({ node }: { node: BoardNode }) {
  const sw = getSwatch(node.color)
  const color =
    node.strokeColor ?? (node.color === "white" ? whim.base[700] : sw.solid)
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Glyph
        name={node.icon ?? "star"}
        size="100%"
        color={color}
        strokeWidth={node.strokeWidth ?? 1.8}
      />
    </div>
  )
}

function DrawBody({ node }: { node: BoardNode }) {
  const sw = getSwatch(node.color)
  const color = node.strokeColor ?? sw.solid
  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={node.w}
      height={node.h}
      viewBox={`0 0 ${node.w} ${node.h}`}
      style={{ opacity: node.opacity ?? 1 }}
    >
      <path
        d={drawPath(node.points ?? [], node.w, node.h)}
        fill="none"
        stroke={color}
        strokeWidth={node.strokeWidth ?? 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------ NodeView -------------------------------- */

type Props = {
  node: BoardNode
  theme: BoardTheme
  selected: boolean
  editing: boolean
  editingCell: number | null
  interactive: boolean
  showHandles: boolean
  showResize: boolean
  zoom: number
  /*
   * I gestori ricevono l'elemento: così hanno un'identità fissa per tutta la
   * board e `memo` ridisegna solo gli elementi che cambiano davvero.
   */
  onPointerDown: (node: BoardNode, e: React.PointerEvent) => void
  onDoubleClick: (node: BoardNode, e: React.MouseEvent) => void
  onContextMenu?: (node: BoardNode, e: React.MouseEvent) => void
  onTextCommit: (node: BoardNode, value: string) => void
  onCellCommit: (node: BoardNode, index: number, value: string) => void
  onConnectStart: (
    node: BoardNode,
    side: Exclude<Side, "auto">,
    e: React.PointerEvent
  ) => void
  onResizeStart: (
    node: BoardNode,
    dir: ResizeDir,
    e: React.PointerEvent
  ) => void
}

export const NodeView = React.memo(function NodeView({
  node,
  theme,
  selected,
  editing,
  editingCell,
  interactive,
  showHandles,
  showResize,
  zoom,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
  onTextCommit,
  onCellCommit,
  onConnectStart,
  onResizeStart,
}: Props) {
  const sw = getSwatch(node.color)
  const r = radiusOf(node, theme)
  const [hover, setHover] = React.useState(false)
  const isPath = node.kind === "shape" && isPathShape(node.shape)
  const canConnect = node.kind !== "draw"

  const textStyle: React.CSSProperties = {
    fontFamily: fontStack(theme.font),
    fontSize: node.fontSize * fontScale(theme.font),
    fontWeight: node.bold ? 700 : 500,
    fontStyle: node.italic ? "italic" : "normal",
    color: node.kind === "frame" || node.kind === "section" ? sw.text : sw.text,
    textAlign: node.align,
    lineHeight: 1.32,
  }

  let body: React.ReactNode = null
  if (node.kind === "shape")
    body = <ShapeBody node={node} theme={theme} editing={editing} />
  else if (node.kind === "frame") body = <FrameBody node={node} theme={theme} />
  else if (node.kind === "section")
    body = <SectionBody node={node} theme={theme} />
  else if (node.kind === "table")
    body = (
      <TableBody
        node={node}
        theme={theme}
        editingCell={editingCell}
        onCellCommit={(index, value) => onCellCommit(node, index, value)}
      />
    )
  else if (node.kind === "chart") body = <ChartBody node={node} theme={theme} />
  else if (node.kind === "icon") body = <IconBody node={node} />
  else if (node.kind === "wire") body = <WireBody node={node} theme={theme} />
  else if (node.kind === "draw") body = <DrawBody node={node} />

  return (
    <div
      data-node-id={node.id}
      className="absolute select-none"
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        pointerEvents: interactive ? "auto" : "none",
        opacity: node.kind === "draw" ? 1 : (node.opacity ?? 1),
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        className={cn(
          "absolute inset-0",
          !editing && !node.locked && "cursor-move"
        )}
        onPointerDown={(e) => onPointerDown(node, e)}
        onDoubleClick={(e) => onDoubleClick(node, e)}
        onContextMenu={
          onContextMenu ? (e) => onContextMenu(node, e) : undefined
        }
      >
        {body}

        {editing ? (
          <textarea
            autoFocus
            defaultValue={node.text}
            onBlur={(e) => onTextCommit(node, e.currentTarget.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (
                e.key === "Escape" ||
                (e.key === "Enter" && (e.metaKey || e.ctrlKey))
              ) {
                e.preventDefault()
                onTextCommit(node, e.currentTarget.value)
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-2.5 outline-none"
            style={{ ...textStyle, display: "block" }}
          />
        ) : null}
      </div>

      {node.kind === "section" ? (
        <SectionLabel node={node} theme={theme} />
      ) : null}
      {node.kind === "frame" ? <FrameLabel node={node} theme={theme} /> : null}

      {selected ? (
        <div
          className="pointer-events-none absolute"
          style={{
            inset: -3,
            borderRadius: isPath ? 6 : r + 3,
            boxShadow: `0 0 0 ${1.5 / zoom + 0.5}px ${SELECT_COLOR}`,
          }}
        />
      ) : null}

      {showHandles && canConnect && (hover || selected) ? (
        <>
          {HANDLE_SIDES.map((side) => {
            const pos: React.CSSProperties =
              side === "top"
                ? { left: "50%", top: 0, transform: "translate(-50%, -50%)" }
                : side === "bottom"
                  ? {
                      left: "50%",
                      top: "100%",
                      transform: "translate(-50%, -50%)",
                    }
                  : side === "left"
                    ? {
                        left: 0,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                      }
                    : {
                        left: "100%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                      }
            const size = Math.max(9, 11 / Math.max(zoom, 0.4))
            return (
              <div
                key={side}
                onPointerDown={(e) => onConnectStart(node, side, e)}
                className="board-handle absolute rounded-full border-2 bg-background transition-transform hover:scale-125"
                style={{
                  ...pos,
                  width: size,
                  height: size,
                  borderColor: SELECT_COLOR,
                  cursor: "crosshair",
                  pointerEvents: "auto",
                }}
              />
            )
          })}
        </>
      ) : null}

      {showResize ? (
        <>
          {RESIZE_DIRS.map((h) => {
            const size = Math.max(7, 9 / Math.max(zoom, 0.4))
            return (
              <div
                key={h.dir}
                onPointerDown={(e) => onResizeStart(node, h.dir, e)}
                className="board-handle absolute rounded-[3px] border bg-background"
                style={{
                  left: `${h.x * 100}%`,
                  top: `${h.y * 100}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  borderColor: SELECT_COLOR,
                  cursor: h.cursor,
                  pointerEvents: "auto",
                }}
              />
            )
          })}
        </>
      ) : null}
    </div>
  )
})
