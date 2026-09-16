"use client"

import * as React from "react"
import { ICONS } from "@/lib/icon-library"
import type { BoardNode, WireKind } from "@/lib/types"

import { useT } from "@/lib/i18n/client"
/* Palette a bassa fedeltà: le variabili vengono risolte anche nell'SVG esportato */
const C = {
  surface: "var(--card)",
  line: "var(--w-base-300)",
  soft: "var(--w-base-100)",
  softer: "var(--w-base-50)",
  text: "var(--w-base-700)",
  strong: "var(--w-base-800)",
  faint: "var(--w-base-600)",
}

function prop(n: BoardNode, key: string, fallback: string | number | boolean) {
  const v = n.wireProps?.[key]
  return v === undefined ? fallback : v
}

const parts = (s: string) =>
  s
    ? s
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
    : []

function Icon({
  name,
  x,
  y,
  size,
  color,
  width = 1.8,
}: {
  name: string
  x: number
  y: number
  size: number
  color: string
  width?: number
}) {
  const glyph = ICONS[name] ?? []
  const s = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {glyph.map(([tag, attrs], i) =>
        React.createElement(tag, {
          key: i,
          ...(attrs as Record<string, string>),
          fill: "none",
          stroke: color,
          strokeWidth: width,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        })
      )}
    </g>
  )
}

function Txt({
  children,
  x,
  y,
  size,
  color = C.text,
  weight = 400,
  anchor = "start",
  font,
}: {
  children: React.ReactNode
  x: number
  y: number
  size: number
  color?: string
  weight?: number
  anchor?: "start" | "middle" | "end"
  font: string
}) {
  return (
    <text
      x={x}
      y={y}
      fontFamily={font}
      fontSize={size}
      fontWeight={weight}
      fill={color}
      textAnchor={anchor}
      dominantBaseline="middle"
    >
      {children}
    </text>
  )
}

const Bar = ({
  x,
  y,
  w,
  h = 8,
  fill = C.soft,
  r = 4,
}: {
  x: number
  y: number
  w: number
  h?: number
  fill?: string
  r?: number
}) => <rect x={x} y={y} width={Math.max(w, 0)} height={h} rx={r} fill={fill} />

/** Rendering nativo in SVG dei componenti wireframe (usato da anteprime ed export) */
export function WireSvg({
  node,
  font,
  accent,
  accentSoft,
  accentText,
  radius,
}: {
  node: BoardNode
  font: string
  accent: string
  accentSoft: string
  accentText: string
  radius: number
}) {
  const t = useT()
  const kind = (node.wire ?? "button") as WireKind
  const w = node.w
  const h = node.h
  const fs = node.fontSize
  const label = node.text
  const r = radius

  const frame = (fill = C.surface, stroke = C.line, rr?: number) => (
    <rect
      x={0}
      y={0}
      width={w}
      height={h}
      rx={rr ?? r * 0.8}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.5}
    />
  )

  switch (kind) {
    case "button": {
      const variant = String(prop(node, "variant", "primary"))
      const filled = variant === "primary"
      const ghost = variant === "ghost"
      return (
        <>
          <rect
            width={w}
            height={h}
            rx={Math.min(r, h / 2)}
            fill={filled ? accent : "none"}
            stroke={ghost || filled ? "none" : accent}
            strokeWidth={1.5}
          />
          <Txt
            x={w / 2}
            y={h / 2}
            size={fs}
            weight={600}
            anchor="middle"
            font={font}
            color={filled ? "#fff" : accent}
          >
            {label}
          </Txt>
        </>
      )
    }

    case "iconButton": {
      const filled = String(prop(node, "variant", "outline")) === "primary"
      const size = Math.min(w, h) * 0.5
      return (
        <>
          <rect
            width={w}
            height={h}
            rx={Math.min(r, h / 2)}
            fill={filled ? accent : C.surface}
            stroke={filled ? "none" : C.line}
            strokeWidth={1.5}
          />
          <Icon
            name={String(prop(node, "icon", "plus"))}
            x={(w - size) / 2}
            y={(h - size) / 2}
            size={size}
            color={filled ? "#fff" : accent}
            width={1.9}
          />
        </>
      )
    }

    case "badge":
      return (
        <>
          <rect width={w} height={h} rx={h / 2} fill={accentSoft} />
          <Txt
            x={w / 2}
            y={h / 2}
            size={Math.min(fs, h * 0.55)}
            weight={600}
            anchor="middle"
            font={font}
            color={accentText}
          >
            {label}
          </Txt>
        </>
      )

    case "link":
      return (
        <>
          <Txt x={0} y={h / 2} size={fs} font={font} color={accent}>
            {label}
          </Txt>
          <line
            x1={0}
            y1={h / 2 + fs * 0.6}
            x2={label.length * fs * 0.52}
            y2={h / 2 + fs * 0.6}
            stroke={accent}
            strokeWidth={1}
          />
        </>
      )

    case "divider":
      return (
        <line
          x1={0}
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke={C.line}
          strokeWidth={1.5}
        />
      )

    case "heading":
      return (
        <Txt
          x={0}
          y={h / 2}
          size={Math.max(14, h * 0.55)}
          weight={700}
          font={font}
          color={C.strong}
        >
          {label}
        </Txt>
      )

    case "paragraph": {
      const lines = Number(prop(node, "lines", 4))
      const gap = h / Math.max(lines, 1)
      const bh = Math.min(10, gap * 0.45)
      return (
        <>
          {Array.from({ length: lines }).map((_, i) => (
            <Bar
              key={i}
              x={0}
              y={i * gap + (gap - bh) / 2}
              w={i === lines - 1 ? w * 0.62 : w}
              h={bh}
            />
          ))}
        </>
      )
    }

    case "input":
    case "select":
    case "searchField": {
      const hasLabel = kind !== "searchField" && !!label
      const top = hasLabel ? 20 : 0
      const fh = h - top
      const px = kind === "searchField" ? 30 : 10
      return (
        <>
          {hasLabel ? (
            <Txt
              x={0}
              y={9}
              size={Math.min(12, fs)}
              weight={500}
              font={font}
              color={C.faint}
            >
              {label}
            </Txt>
          ) : null}
          <rect
            x={0}
            y={top}
            width={w}
            height={fh}
            rx={r * 0.7}
            fill={C.surface}
            stroke={C.line}
            strokeWidth={1.5}
          />
          {kind === "searchField" ? (
            <Icon
              name="search"
              x={10}
              y={top + fh / 2 - 7.5}
              size={15}
              color={C.faint}
              width={2}
            />
          ) : null}
          <Txt x={px} y={top + fh / 2} size={fs} font={font} color={C.faint}>
            {String(prop(node, "placeholder", t("Testo…")))}
          </Txt>
          {kind === "select" ? (
            <Icon
              name="chevron-down"
              x={w - 25}
              y={top + fh / 2 - 7.5}
              size={15}
              color={C.faint}
              width={2}
            />
          ) : null}
        </>
      )
    }

    case "textarea": {
      const top = label ? 20 : 0
      return (
        <>
          {label ? (
            <Txt
              x={0}
              y={9}
              size={Math.min(12, fs)}
              weight={500}
              font={font}
              color={C.faint}
            >
              {label}
            </Txt>
          ) : null}
          <rect
            x={0}
            y={top}
            width={w}
            height={h - top}
            rx={r * 0.7}
            fill={C.surface}
            stroke={C.line}
            strokeWidth={1.5}
          />
          <Txt x={10} y={top + 16} size={fs} font={font} color={C.faint}>
            {String(prop(node, "placeholder", t("Scrivi…")))}
          </Txt>
        </>
      )
    }

    case "checkbox":
    case "radio": {
      const checked = Boolean(prop(node, "checked", true))
      const s = Math.min(h, 22)
      const cy = h / 2
      return (
        <>
          {kind === "radio" ? (
            <circle
              cx={s / 2}
              cy={cy}
              r={s / 2 - 0.8}
              fill={C.surface}
              stroke={checked ? accent : C.line}
              strokeWidth={1.6}
            />
          ) : (
            <rect
              x={0}
              y={cy - s / 2}
              width={s}
              height={s}
              rx={r * 0.4}
              fill={checked ? accent : C.surface}
              stroke={checked ? accent : C.line}
              strokeWidth={1.6}
            />
          )}
          {checked && kind === "checkbox" ? (
            <path
              d={`M ${s * 0.26} ${cy} L ${s * 0.44} ${cy + s * 0.18} L ${s * 0.74} ${cy - s * 0.2}`}
              fill="none"
              stroke="#fff"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {checked && kind === "radio" ? (
            <circle cx={s / 2} cy={cy} r={s * 0.22} fill={accent} />
          ) : null}
          <Txt x={s + 8} y={cy} size={fs} font={font}>
            {label}
          </Txt>
        </>
      )
    }

    case "toggle": {
      const checked = Boolean(prop(node, "checked", true))
      const th = Math.min(h, 24)
      const tw = th * 1.75
      const cy = h / 2
      return (
        <>
          <rect
            x={0}
            y={cy - th / 2}
            width={tw}
            height={th}
            rx={th / 2}
            fill={checked ? accent : C.line}
          />
          <circle
            cx={checked ? tw - th / 2 : th / 2}
            cy={cy}
            r={th / 2 - 2}
            fill="#fff"
          />
          <Txt x={tw + 8} y={cy} size={fs} font={font}>
            {label}
          </Txt>
        </>
      )
    }

    case "slider": {
      const v = Number(prop(node, "value", 60)) / 100
      const cy = h / 2
      return (
        <>
          <rect x={0} y={cy - 3} width={w} height={6} rx={3} fill={C.soft} />
          <rect
            x={0}
            y={cy - 3}
            width={w * v}
            height={6}
            rx={3}
            fill={accent}
          />
          <circle
            cx={w * v}
            cy={cy}
            r={8}
            fill={C.surface}
            stroke={accent}
            strokeWidth={2}
          />
        </>
      )
    }

    case "progress": {
      const v = Number(prop(node, "value", 45)) / 100
      const bh = Math.min(h, 10)
      const y = (h - bh) / 2
      return (
        <>
          <rect x={0} y={y} width={w} height={bh} rx={bh / 2} fill={C.soft} />
          <rect
            x={0}
            y={y}
            width={w * v}
            height={bh}
            rx={bh / 2}
            fill={accent}
          />
        </>
      )
    }

    case "rating": {
      const v = Number(prop(node, "value", 4))
      const s = Math.min(h, w / 5.4)
      return (
        <>
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon
              key={i}
              name="star"
              x={i * (s + 3)}
              y={(h - s) / 2}
              size={s}
              color={i < v ? accent : C.line}
              width={i < v ? 2.4 : 1.8}
            />
          ))}
        </>
      )
    }

    case "stepper":
      return (
        <>
          {frame()}
          <line
            x1={w / 3}
            y1={0}
            x2={w / 3}
            y2={h}
            stroke={C.line}
            strokeWidth={1.5}
          />
          <line
            x1={(w * 2) / 3}
            y1={0}
            x2={(w * 2) / 3}
            y2={h}
            stroke={C.line}
            strokeWidth={1.5}
          />
          <Icon
            name="minus"
            x={w / 6 - 7}
            y={h / 2 - 7}
            size={14}
            color={C.faint}
            width={2}
          />
          <Txt
            x={w / 2}
            y={h / 2}
            size={fs}
            weight={600}
            anchor="middle"
            font={font}
            color={C.strong}
          >
            {String(prop(node, "value", 2))}
          </Txt>
          <Icon
            name="plus"
            x={(w * 5) / 6 - 7}
            y={h / 2 - 7}
            size={14}
            color={C.faint}
            width={2}
          />
        </>
      )

    case "avatar": {
      const round = String(prop(node, "shape", "circle")) === "circle"
      const s = Math.min(w, h)
      return (
        <>
          {round ? (
            <circle cx={w / 2} cy={h / 2} r={s / 2} fill={accentSoft} />
          ) : (
            <rect width={w} height={h} rx={r * 0.7} fill={accentSoft} />
          )}
          {label ? (
            <Txt
              x={w / 2}
              y={h / 2}
              size={s * 0.4}
              weight={700}
              anchor="middle"
              font={font}
              color={accent}
            >
              {label.slice(0, 2)}
            </Txt>
          ) : (
            <Icon
              name="user"
              x={w / 2 - s * 0.275}
              y={h / 2 - s * 0.275}
              size={s * 0.55}
              color={accent}
            />
          )}
        </>
      )
    }

    case "image":
    case "video":
    case "map": {
      const s = Math.min(w, h) * 0.28
      return (
        <>
          <rect
            width={w}
            height={h}
            rx={r * 0.8}
            fill={C.softer}
            stroke={C.line}
            strokeWidth={1.5}
          />
          {kind === "image" ? (
            <path
              d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`}
              stroke={C.line}
              strokeWidth={1}
            />
          ) : null}
          <Icon
            name={
              kind === "image"
                ? "image"
                : kind === "video"
                  ? "circle-play"
                  : "map"
            }
            x={(w - s) / 2}
            y={(h - s) / 2}
            size={s}
            color={C.faint}
            width={1.6}
          />
        </>
      )
    }

    case "chart": {
      const type = String(prop(node, "type", "bar"))
      const p = 12
      const iw = w - p * 2
      const ih = h - p * 2
      return (
        <>
          {frame()}
          <g transform={`translate(${p} ${p})`}>
            {type === "bar" &&
              [0.47, 0.77, 0.57, 0.97, 0.67, 0.87].map((v, i) => (
                <rect
                  key={i}
                  x={(iw / 6) * i + iw * 0.02}
                  y={ih * (1 - v)}
                  width={iw / 9}
                  height={ih * v}
                  rx={2}
                  fill={accent}
                  opacity={0.25 + i * 0.12}
                />
              ))}
            {type === "line" && (
              <>
                <polyline
                  points={[
                    [0.02, 0.8],
                    [0.2, 0.53],
                    [0.38, 0.63],
                    [0.56, 0.3],
                    [0.74, 0.43],
                    [0.96, 0.13],
                  ]
                    .map(([px, py]) => `${px * iw},${py * ih}`)
                    .join(" ")}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {type === "pie" && (
              <>
                <circle
                  cx={iw / 2}
                  cy={ih / 2}
                  r={Math.min(iw, ih) / 2.2}
                  fill={accentSoft}
                />
                <path
                  d={`M ${iw / 2} ${ih / 2} L ${iw / 2} ${ih / 2 - Math.min(iw, ih) / 2.2} A ${Math.min(iw, ih) / 2.2} ${Math.min(iw, ih) / 2.2} 0 0 1 ${iw / 2 + Math.min(iw, ih) / 2.4} ${ih / 2 + Math.min(iw, ih) / 8} Z`}
                  fill={accent}
                />
              </>
            )}
          </g>
        </>
      )
    }

    case "card": {
      const hh = h * 0.48
      return (
        <>
          {frame()}
          <path
            d={`M 0 ${r * 0.8} Q 0 0 ${r * 0.8} 0 L ${w - r * 0.8} 0 Q ${w} 0 ${w} ${r * 0.8} L ${w} ${hh} L 0 ${hh} Z`}
            fill={C.softer}
          />
          <line
            x1={0}
            y1={hh}
            x2={w}
            y2={hh}
            stroke={C.line}
            strokeWidth={1.5}
          />
          <Icon
            name="image"
            x={w / 2 - 11}
            y={hh / 2 - 11}
            size={22}
            color={C.faint}
            width={1.6}
          />
          <Txt
            x={12}
            y={hh + 20}
            size={fs}
            weight={600}
            font={font}
            color={C.strong}
          >
            {label}
          </Txt>
          <Bar x={12} y={hh + 32} w={w - 24} h={7} />
          <Bar x={12} y={hh + 45} w={(w - 24) * 0.7} h={7} />
          <rect
            x={12}
            y={h - 34}
            width={54}
            height={22}
            rx={11}
            fill={accent}
          />
          <Txt
            x={39}
            y={h - 23}
            size={11}
            weight={600}
            anchor="middle"
            font={font}
            color="#fff"
          >
            {t("Apri")}
          </Txt>
        </>
      )
    }

    case "list": {
      const rows = Number(prop(node, "rows", 4))
      const withAvatar = Boolean(prop(node, "avatar", true))
      const rh = h / rows
      return (
        <>
          {frame()}
          {Array.from({ length: rows }).map((_, i) => {
            const y = i * rh
            const cx = 12
            return (
              <g key={i}>
                {i < rows - 1 ? (
                  <line
                    x1={0}
                    y1={y + rh}
                    x2={w}
                    y2={y + rh}
                    stroke={C.soft}
                    strokeWidth={1}
                  />
                ) : null}
                {withAvatar ? (
                  <circle
                    cx={cx + 13}
                    cy={y + rh / 2}
                    r={13}
                    fill={accentSoft}
                  />
                ) : null}
                <Bar
                  x={withAvatar ? cx + 36 : cx}
                  y={y + rh / 2 - 9}
                  w={(w - 90) * 0.55}
                  h={7}
                  fill={C.line}
                />
                <Bar
                  x={withAvatar ? cx + 36 : cx}
                  y={y + rh / 2 + 2}
                  w={(w - 90) * 0.8}
                  h={6}
                />
                <Icon
                  name="chevron-right"
                  x={w - 26}
                  y={y + rh / 2 - 7.5}
                  size={15}
                  color={C.faint}
                  width={2}
                />
              </g>
            )
          })}
        </>
      )
    }

    case "calendar": {
      const pad = 10
      const headH = 22
      const gw = (w - pad * 2) / 7
      const gh = (h - pad * 2 - headH) / 5
      return (
        <>
          {frame()}
          <Icon
            name="chevron-left"
            x={pad}
            y={pad + 4}
            size={14}
            color={C.faint}
            width={2}
          />
          <Txt
            x={w / 2}
            y={pad + 11}
            size={Math.min(13, fs)}
            weight={600}
            anchor="middle"
            font={font}
            color={C.strong}
          >
            {label || t("Settembre")}
          </Txt>
          <Icon
            name="chevron-right"
            x={w - pad - 14}
            y={pad + 4}
            size={14}
            color={C.faint}
            width={2}
          />
          {Array.from({ length: 35 }).map((_, i) => (
            <rect
              key={i}
              x={pad + (i % 7) * gw + 1.5}
              y={pad + headH + Math.floor(i / 7) * gh + 1.5}
              width={gw - 3}
              height={gh - 3}
              rx={4}
              fill={i === 17 ? accent : i % 6 === 0 ? C.soft : "none"}
              stroke={i === 17 ? "none" : C.soft}
              strokeWidth={1}
            />
          ))}
        </>
      )
    }

    case "navbar": {
      const items = parts(label)
      const cy = h / 2
      const widths = items.map((t, i) =>
        i === 0 ? t.length * fs * 0.6 + 26 : t.length * fs * 0.56 + 18
      )
      const offsets = widths.reduce<number[]>(
        (acc, w0, i) => [
          ...acc,
          (acc[i - 1] ?? 16) + (i === 0 ? 0 : widths[i - 1]),
        ],
        []
      )
      return (
        <>
          <rect width={w} height={h} rx={r * 0.6} fill={C.surface} />
          <line x1={0} y1={h} x2={w} y2={h} stroke={C.line} strokeWidth={1.5} />
          {items.map((t, i) => (
            <Txt
              key={i}
              x={offsets[i]}
              y={cy}
              size={fs}
              weight={i === 0 ? 700 : 400}
              font={font}
              color={i === 0 ? C.strong : C.faint}
            >
              {t}
            </Txt>
          ))}
          <circle cx={w - 30} cy={cy} r={14} fill={accentSoft} />
        </>
      )
    }

    case "tabs": {
      const items = parts(label)
      const widths = items.map((t) => t.length * fs * 0.56 + 28)
      const offsets = widths.map((_, i) =>
        widths.slice(0, i).reduce((a, b) => a + b, 0)
      )
      return (
        <>
          <line x1={0} y1={h} x2={w} y2={h} stroke={C.line} strokeWidth={1.5} />
          {items.map((t, i) => (
            <g key={i}>
              <Txt
                x={offsets[i] + widths[i] / 2}
                y={h / 2}
                size={fs}
                weight={i === 0 ? 600 : 400}
                anchor="middle"
                font={font}
                color={i === 0 ? accent : C.faint}
              >
                {t}
              </Txt>
              {i === 0 ? (
                <line
                  x1={offsets[i]}
                  y1={h - 1}
                  x2={offsets[i] + widths[i]}
                  y2={h - 1}
                  stroke={accent}
                  strokeWidth={2.5}
                />
              ) : null}
            </g>
          ))}
        </>
      )
    }

    case "breadcrumb": {
      const items = parts(label)
      const widths = items.map((t) => t.length * fs * 0.56 + 22)
      const offsets = widths.map((_, i) =>
        widths.slice(0, i).reduce((a, b) => a + b, 0)
      )
      return (
        <>
          {items.map((t, i) => (
            <g key={i}>
              {i > 0 ? (
                <Icon
                  name="chevron-right"
                  x={offsets[i] - 16}
                  y={h / 2 - 6.5}
                  size={13}
                  color={C.line}
                  width={2}
                />
              ) : null}
              <Txt
                x={offsets[i]}
                y={h / 2}
                size={fs}
                font={font}
                color={i === items.length - 1 ? C.strong : C.faint}
              >
                {t}
              </Txt>
            </g>
          ))}
        </>
      )
    }

    case "sidebarNav": {
      const items = parts(label)
      const pad = 10
      const ih = 32
      return (
        <>
          {frame(C.softer)}
          <rect
            x={pad + 8}
            y={pad + 6}
            width={22}
            height={22}
            rx={6}
            fill={accent}
          />
          <Bar x={pad + 38} y={pad + 13} w={w * 0.4} h={8} fill={C.line} />
          {items.map((t, i) => {
            const y = pad + 44 + i * (ih + 4)
            return (
              <g key={i}>
                {i === 0 ? (
                  <rect
                    x={pad}
                    y={y}
                    width={w - pad * 2}
                    height={ih}
                    rx={7}
                    fill={accentSoft}
                  />
                ) : null}
                <rect
                  x={pad + 8}
                  y={y + ih / 2 - 3}
                  width={6}
                  height={6}
                  rx={2}
                  fill={i === 0 ? accent : C.faint}
                  opacity={0.6}
                />
                <Txt
                  x={pad + 23}
                  y={y + ih / 2}
                  size={fs}
                  weight={i === 0 ? 600 : 400}
                  font={font}
                  color={i === 0 ? accent : C.faint}
                >
                  {t}
                </Txt>
              </g>
            )
          })}
        </>
      )
    }

    case "modal":
      return (
        <>
          {frame()}
          <line
            x1={0}
            y1={42}
            x2={w}
            y2={42}
            stroke={C.soft}
            strokeWidth={1.5}
          />
          <Txt
            x={14}
            y={21}
            size={fs}
            weight={600}
            font={font}
            color={C.strong}
          >
            {label}
          </Txt>
          <Icon
            name="x"
            x={w - 30}
            y={13}
            size={16}
            color={C.faint}
            width={2}
          />
          <Bar x={14} y={62} w={w - 28} h={8} />
          <Bar x={14} y={78} w={(w - 28) * 0.85} h={8} />
          <line
            x1={0}
            y1={h - 54}
            x2={w}
            y2={h - 54}
            stroke={C.soft}
            strokeWidth={1.5}
          />
          <rect
            x={w - 190}
            y={h - 42}
            width={78}
            height={30}
            rx={r * 0.6}
            fill="none"
            stroke={C.line}
            strokeWidth={1.5}
          />
          <Txt
            x={w - 151}
            y={h - 27}
            size={12}
            anchor="middle"
            font={font}
            color={C.faint}
          >
            {t("Annulla")}
          </Txt>
          <rect
            x={w - 100}
            y={h - 42}
            width={86}
            height={30}
            rx={r * 0.6}
            fill={accent}
          />
          <Txt
            x={w - 57}
            y={h - 27}
            size={12}
            weight={600}
            anchor="middle"
            font={font}
            color="#fff"
          >
            {t("Conferma")}
          </Txt>
        </>
      )

    case "alert":
      return (
        <>
          <rect
            width={w}
            height={h}
            rx={r * 0.8}
            fill={accentSoft}
            stroke={accent}
            strokeWidth={1.5}
          />
          <Icon
            name="circle-check"
            x={14}
            y={h / 2 - 9}
            size={18}
            color={accent}
            width={2}
          />
          <Txt x={42} y={h / 2} size={fs} font={font} color={accentText}>
            {label}
          </Txt>
        </>
      )

    case "tooltip":
      return (
        <>
          <rect width={w} height={h} rx={r * 0.7} fill="var(--w-base-800)" />
          <path
            d={`M ${w / 2 - 6} ${h} L ${w / 2} ${h + 6} L ${w / 2 + 6} ${h} Z`}
            fill="var(--w-base-800)"
          />
          <Txt
            x={w / 2}
            y={h / 2}
            size={fs}
            anchor="middle"
            font={font}
            color="var(--w-base-0)"
          >
            {label}
          </Txt>
        </>
      )

    case "pagination": {
      const s = h * 0.85
      const total = 4
      const gap = 5
      const startX = (w - (total * s + (total - 1) * gap)) / 2
      return (
        <>
          <Icon
            name="chevron-left"
            x={startX - 24}
            y={h / 2 - 7.5}
            size={15}
            color={C.faint}
            width={2}
          />
          {[1, 2, 3, 4].map((n, i) => {
            const x = startX + i * (s + gap)
            return (
              <g key={n}>
                <rect
                  x={x}
                  y={(h - s) / 2}
                  width={s}
                  height={s}
                  rx={r * 0.5}
                  fill={i === 0 ? accent : "none"}
                  stroke={i === 0 ? "none" : C.line}
                  strokeWidth={1.2}
                />
                <Txt
                  x={x + s / 2}
                  y={h / 2}
                  size={12}
                  anchor="middle"
                  font={font}
                  color={i === 0 ? "#fff" : C.faint}
                >
                  {n}
                </Txt>
              </g>
            )
          })}
          <Icon
            name="chevron-right"
            x={startX + total * (s + gap) + 8}
            y={h / 2 - 7.5}
            size={15}
            color={C.faint}
            width={2}
          />
        </>
      )
    }

    case "footer": {
      const items = parts(label)
      const colW = (w - 32) / Math.max(items.length, 1)
      return (
        <>
          <rect width={w} height={h} rx={r * 0.6} fill={C.softer} />
          <line x1={0} y1={0} x2={w} y2={0} stroke={C.line} strokeWidth={1.5} />
          {items.map((t, i) => {
            const x = 16 + i * colW
            return (
              <g key={i}>
                <Txt
                  x={x}
                  y={20}
                  size={Math.min(12, fs)}
                  weight={600}
                  font={font}
                  color={C.strong}
                >
                  {t}
                </Txt>
                <Bar x={x} y={32} w={colW * 0.6} h={5} />
                <Bar x={x} y={43} w={colW * 0.45} h={5} />
              </g>
            )
          })}
        </>
      )
    }

    default:
      return (
        <>
          {frame()}
          <Txt
            x={w / 2}
            y={h / 2}
            size={fs}
            anchor="middle"
            font={font}
            color={C.faint}
          >
            {label}
          </Txt>
        </>
      )
  }
}
