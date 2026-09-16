"use client"

import * as React from "react"
import { Glyph } from "./glyph"
import { getSwatch } from "@/lib/palette"
import { fontStack } from "@/lib/fonts"
import type { BoardNode, BoardTheme, WireKind } from "@/lib/types"

import { useT } from "@/lib/i18n/client"
/* Palette a bassa fedeltà, coerente con il tema chiaro/scuro */
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

function Bar({
  w,
  h = 8,
  color = C.soft,
  radius = 4,
  style,
}: {
  w: number | string
  h?: number
  color?: string
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: color,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

export function WireBody({
  node,
  theme,
}: {
  node: BoardNode
  theme: BoardTheme
}) {
  const t = useT()
  const kind = (node.wire ?? "button") as WireKind
  const sw = getSwatch(node.color)
  const accent = node.color === "white" ? "var(--w-base-700)" : sw.solid
  const accentSoft = node.color === "white" ? C.soft : sw.fill
  const r = node.radius ?? theme.cornerRadius
  const font = fontStack(theme.font)
  const label = node.text

  const base: React.CSSProperties = {
    width: "100%",
    height: "100%",
    fontFamily: font,
    fontSize: node.fontSize,
    color: C.text,
    display: "flex",
  }

  const framed = (
    children: React.ReactNode,
    extra?: React.CSSProperties
  ): React.ReactElement => (
    <div
      style={{
        ...base,
        background: C.surface,
        border: `1.5px solid ${C.line}`,
        borderRadius: r * 0.8,
        overflow: "hidden",
        ...extra,
      }}
    >
      {children}
    </div>
  )

  switch (kind) {
    case "button": {
      const variant = String(prop(node, "variant", "primary"))
      const filled = variant === "primary"
      const ghost = variant === "ghost"
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            justifyContent: "center",
            background: filled ? accent : ghost ? "transparent" : C.surface,
            color: filled ? "#fff" : accent,
            border: ghost ? "none" : filled ? "none" : `1.5px solid ${accent}`,
            borderRadius: Math.min(r, node.h / 2),
            fontWeight: 600,
            padding: "0 12px",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>
      )
    }

    case "iconButton":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            justifyContent: "center",
            background:
              String(prop(node, "variant", "outline")) === "primary"
                ? accent
                : C.surface,
            border:
              String(prop(node, "variant", "outline")) === "primary"
                ? "none"
                : `1.5px solid ${C.line}`,
            borderRadius: Math.min(r, node.h / 2),
          }}
        >
          <Glyph
            name={String(prop(node, "icon", "plus"))}
            size={Math.min(node.w, node.h) * 0.5}
            color={
              String(prop(node, "variant", "outline")) === "primary"
                ? "#fff"
                : accent
            }
            strokeWidth={1.9}
          />
        </div>
      )

    case "badge":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            justifyContent: "center",
            background: accentSoft,
            color: node.color === "white" ? C.text : sw.text,
            borderRadius: node.h / 2,
            fontSize: Math.min(node.fontSize, node.h * 0.55),
            fontWeight: 600,
            padding: "0 10px",
          }}
        >
          {label}
        </div>
      )

    case "link":
      return (
        <div style={{ ...base, alignItems: "center" }}>
          <span
            style={{
              color: accent,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {label}
          </span>
        </div>
      )

    case "divider":
      return (
        <div style={{ ...base, alignItems: "center" }}>
          <div style={{ width: "100%", height: 1.5, background: C.line }} />
        </div>
      )

    case "heading":
      return (
        <div style={{ ...base, alignItems: "center" }}>
          <span
            style={{
              fontSize: Math.max(14, node.h * 0.55),
              fontWeight: 700,
              color: C.strong,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {label}
          </span>
        </div>
      )

    case "paragraph": {
      const lines = Number(prop(node, "lines", 4))
      const gap = node.h / Math.max(lines, 1)
      return (
        <div
          style={{
            ...base,
            flexDirection: "column",
            justifyContent: "space-evenly",
            padding: "2px 0",
          }}
        >
          {Array.from({ length: lines }).map((_, i) => (
            <Bar
              key={i}
              w={i === lines - 1 ? "62%" : "100%"}
              h={Math.min(10, gap * 0.45)}
            />
          ))}
        </div>
      )
    }

    case "input":
    case "select":
    case "searchField": {
      const hasLabel = kind !== "searchField" && !!label
      const fieldH = hasLabel ? node.h - 20 : node.h
      return (
        <div style={{ ...base, flexDirection: "column", gap: 4 }}>
          {hasLabel ? (
            <span
              style={{
                fontSize: Math.min(12, node.fontSize),
                color: C.faint,
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          ) : null}
          <div
            style={{
              height: fieldH,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
              background: C.surface,
              border: `1.5px solid ${C.line}`,
              borderRadius: r * 0.7,
            }}
          >
            {kind === "searchField" ? (
              <Glyph name="search" size={15} color={C.faint} strokeWidth={2} />
            ) : null}
            <span
              style={{
                color: C.faint,
                flex: 1,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {String(prop(node, "placeholder", t("Testo…")))}
            </span>
            {kind === "select" ? (
              <Glyph
                name="chevron-down"
                size={15}
                color={C.faint}
                strokeWidth={2}
              />
            ) : null}
          </div>
        </div>
      )
    }

    case "textarea":
      return (
        <div style={{ ...base, flexDirection: "column", gap: 4 }}>
          {label ? (
            <span
              style={{
                fontSize: Math.min(12, node.fontSize),
                color: C.faint,
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          ) : null}
          <div
            style={{
              flex: 1,
              padding: 10,
              background: C.surface,
              border: `1.5px solid ${C.line}`,
              borderRadius: r * 0.7,
              color: C.faint,
            }}
          >
            {String(prop(node, "placeholder", t("Scrivi…")))}
          </div>
        </div>
      )

    case "checkbox":
    case "radio": {
      const checked = Boolean(prop(node, "checked", true))
      const s = Math.min(node.h, 22)
      return (
        <div style={{ ...base, alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: s,
              height: s,
              flexShrink: 0,
              borderRadius: kind === "radio" ? "50%" : r * 0.4,
              border: `1.6px solid ${checked ? accent : C.line}`,
              background: checked && kind === "checkbox" ? accent : C.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {checked && kind === "checkbox" ? (
              <Glyph
                name="check"
                size={s * 0.68}
                color="#fff"
                strokeWidth={3}
              />
            ) : null}
            {checked && kind === "radio" ? (
              <div
                style={{
                  width: s * 0.45,
                  height: s * 0.45,
                  borderRadius: "50%",
                  background: accent,
                }}
              />
            ) : null}
          </div>
          <span style={{ color: C.text }}>{label}</span>
        </div>
      )
    }

    case "toggle": {
      const checked = Boolean(prop(node, "checked", true))
      const h = Math.min(node.h, 24)
      return (
        <div style={{ ...base, alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: h * 1.75,
              height: h,
              flexShrink: 0,
              borderRadius: h,
              background: checked ? accent : C.line,
              display: "flex",
              alignItems: "center",
              padding: 2,
              justifyContent: checked ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                width: h - 4,
                height: h - 4,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </div>
          <span style={{ color: C.text }}>{label}</span>
        </div>
      )
    }

    case "slider": {
      const v = Number(prop(node, "value", 60))
      return (
        <div style={{ ...base, alignItems: "center" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 6,
              background: C.soft,
              borderRadius: 3,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${v}%`,
                background: accent,
                borderRadius: 3,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${v}%`,
                top: "50%",
                width: 16,
                height: 16,
                marginLeft: -8,
                marginTop: -8,
                borderRadius: "50%",
                background: C.surface,
                border: `2px solid ${accent}`,
              }}
            />
          </div>
        </div>
      )
    }

    case "progress": {
      const v = Number(prop(node, "value", 45))
      return (
        <div style={{ ...base, alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              height: Math.min(node.h, 10),
              background: C.soft,
              borderRadius: 99,
            }}
          >
            <div
              style={{
                width: `${v}%`,
                height: "100%",
                background: accent,
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      )
    }

    case "rating": {
      const v = Number(prop(node, "value", 4))
      const s = Math.min(node.h, node.w / 5.4)
      return (
        <div style={{ ...base, alignItems: "center", gap: 3 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Glyph
              key={i}
              name="star"
              size={s}
              color={i < v ? accent : C.line}
              strokeWidth={i < v ? 2.4 : 1.8}
            />
          ))}
        </div>
      )
    }

    case "stepper":
      return framed(
        <>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRight: `1.5px solid ${C.line}`,
            }}
          >
            <Glyph name="minus" size={14} color={C.faint} />
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.strong,
              fontWeight: 600,
            }}
          >
            {String(prop(node, "value", 2))}
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: `1.5px solid ${C.line}`,
            }}
          >
            <Glyph name="plus" size={14} color={C.faint} />
          </div>
        </>
      )

    case "avatar":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            justifyContent: "center",
            background: accentSoft,
            borderRadius:
              String(prop(node, "shape", "circle")) === "circle"
                ? "50%"
                : r * 0.7,
            color: accent,
          }}
        >
          {label ? (
            <span
              style={{
                fontWeight: 700,
                fontSize: Math.min(node.h, node.w) * 0.4,
              }}
            >
              {label.slice(0, 2)}
            </span>
          ) : (
            <Glyph
              name="user"
              size={Math.min(node.w, node.h) * 0.55}
              color={accent}
              strokeWidth={1.8}
            />
          )}
        </div>
      )

    case "image":
    case "video":
    case "map":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            justifyContent: "center",
            background: C.softer,
            border: `1.5px solid ${C.line}`,
            borderRadius: r * 0.8,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {kind === "image" ? (
            <svg
              width="100%"
              height="100%"
              style={{ position: "absolute", inset: 0 }}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path
                d="M0 0 L100 100 M100 0 L0 100"
                stroke={C.line}
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
          <Glyph
            name={
              kind === "image"
                ? "image"
                : kind === "video"
                  ? "circle-play"
                  : "map"
            }
            size={Math.min(node.w, node.h) * 0.28}
            color={C.faint}
            strokeWidth={1.6}
            style={{ position: "relative" }}
          />
        </div>
      )

    case "chart": {
      const type = String(prop(node, "type", "bar"))
      const pad = 12
      return (
        <div
          style={{
            ...base,
            background: C.surface,
            border: `1.5px solid ${C.line}`,
            borderRadius: r * 0.8,
            padding: pad,
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
          >
            {type === "bar" &&
              [28, 46, 34, 58, 40, 52].map((v, i) => (
                <rect
                  key={i}
                  x={4 + i * 16}
                  y={60 - v}
                  width="10"
                  height={v}
                  rx="2"
                  fill={accent}
                  opacity={0.25 + i * 0.12}
                />
              ))}
            {type === "line" && (
              <>
                <polyline
                  points="2,48 20,32 38,38 56,18 74,26 96,8"
                  fill="none"
                  stroke={accent}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="2,60 2,48 20,32 38,38 56,18 74,26 96,8 96,60"
                  fill={accent}
                  opacity="0.12"
                />
              </>
            )}
            {type === "pie" && (
              <>
                <circle cx="50" cy="30" r="26" fill={accentSoft} />
                <path d="M50 30 L50 4 A26 26 0 0 1 74 40 Z" fill={accent} />
              </>
            )}
          </svg>
        </div>
      )
    }

    case "card":
      return framed(
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <div
            style={{
              height: "48%",
              background: C.softer,
              borderBottom: `1.5px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph name="image" size={22} color={C.faint} strokeWidth={1.6} />
          </div>
          <div
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
            }}
          >
            <span style={{ fontWeight: 600, color: C.strong }}>{label}</span>
            <Bar w="100%" h={7} />
            <Bar w="70%" h={7} />
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  height: 22,
                  padding: "0 10px",
                  borderRadius: 99,
                  background: accent,
                  color: "#fff",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 600,
                }}
              >
                {t("Apri")}
              </div>
            </div>
          </div>
        </div>
      )

    case "list": {
      const rows = Number(prop(node, "rows", 4))
      const withAvatar = Boolean(prop(node, "avatar", true))
      return framed(
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 12px",
                borderBottom: i < rows - 1 ? `1px solid ${C.soft}` : "none",
              }}
            >
              {withAvatar ? (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: accentSoft,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <Bar w="55%" h={7} color={C.line} />
                <Bar w="80%" h={6} />
              </div>
              <Glyph
                name="chevron-right"
                size={15}
                color={C.faint}
                strokeWidth={2}
              />
            </div>
          ))}
        </div>
      )
    }

    case "calendar": {
      const cells = Array.from({ length: 35 })
      return framed(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: 10,
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: C.strong,
              fontWeight: 600,
            }}
          >
            <Glyph
              name="chevron-left"
              size={14}
              color={C.faint}
              strokeWidth={2}
            />
            <span style={{ fontSize: Math.min(13, node.fontSize) }}>
              {label || t("Settembre")}
            </span>
            <Glyph
              name="chevron-right"
              size={14}
              color={C.faint}
              strokeWidth={2}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 3,
              flex: 1,
            }}
          >
            {cells.map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 4,
                  background:
                    i === 17 ? accent : i % 6 === 0 ? C.soft : "transparent",
                  border: i === 17 ? "none" : `1px solid ${C.soft}`,
                }}
              />
            ))}
          </div>
        </div>
      )
    }

    case "navbar": {
      const items = parts(label)
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            gap: 18,
            padding: "0 16px",
            background: C.surface,
            borderBottom: `1.5px solid ${C.line}`,
            borderRadius: r * 0.6,
          }}
        >
          <span style={{ fontWeight: 700, color: C.strong }}>
            {items[0] ?? t("Logo")}
          </span>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginLeft: 8,
            }}
          >
            {items.slice(1).map((t, i) => (
              <span key={i} style={{ color: C.faint }}>
                {t}
              </span>
            ))}
          </div>
          <div
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: accentSoft,
            }}
          />
        </div>
      )
    }

    case "tabs": {
      const items = parts(label)
      return (
        <div
          style={{
            ...base,
            alignItems: "stretch",
            borderBottom: `1.5px solid ${C.line}`,
          }}
        >
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                color: i === 0 ? accent : C.faint,
                fontWeight: i === 0 ? 600 : 400,
                borderBottom:
                  i === 0 ? `2.5px solid ${accent}` : "2.5px solid transparent",
                marginBottom: -1.5,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )
    }

    case "breadcrumb": {
      const items = parts(label)
      return (
        <div style={{ ...base, alignItems: "center", gap: 6, color: C.faint }}>
          {items.map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 ? (
                <Glyph
                  name="chevron-right"
                  size={13}
                  color={C.line}
                  strokeWidth={2}
                />
              ) : null}
              <span
                style={{ color: i === items.length - 1 ? C.strong : C.faint }}
              >
                {t}
              </span>
            </React.Fragment>
          ))}
        </div>
      )
    }

    case "sidebarNav": {
      const items = parts(label)
      return framed(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: 10,
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px 12px",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: accent,
              }}
            />
            <Bar w="55%" h={8} color={C.line} />
          </div>
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 8px",
                borderRadius: 7,
                background: i === 0 ? accentSoft : "transparent",
                color: i === 0 ? accent : C.faint,
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: "currentColor",
                  opacity: 0.6,
                }}
              />
              {t}
            </div>
          ))}
        </div>,
        { background: C.softer }
      )
    }

    case "modal":
      return framed(
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: `1.5px solid ${C.soft}`,
            }}
          >
            <span style={{ fontWeight: 600, color: C.strong }}>{label}</span>
            <Glyph
              name="x"
              size={16}
              color={C.faint}
              strokeWidth={2}
              style={{ marginLeft: "auto" }}
            />
          </div>
          <div
            style={{
              flex: 1,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Bar w="100%" h={8} />
            <Bar w="85%" h={8} />
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              padding: 12,
              borderTop: `1.5px solid ${C.soft}`,
            }}
          >
            <div
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: r * 0.6,
                border: `1.5px solid ${C.line}`,
                color: C.faint,
                display: "flex",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              {t("Annulla")}
            </div>
            <div
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: r * 0.6,
                background: accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {t("Conferma")}
            </div>
          </div>
        </div>,
        { boxShadow: "0 18px 40px -18px rgba(15,1,26,0.35)" }
      )

    case "alert":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            background: accentSoft,
            border: `1.5px solid ${accent}`,
            borderRadius: r * 0.8,
            color: node.color === "white" ? C.strong : sw.text,
          }}
        >
          <Glyph name="circle-check" size={18} color={accent} strokeWidth={2} />
          <span>{label}</span>
        </div>
      )

    case "tooltip":
      return (
        <div
          style={{
            ...base,
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "var(--w-base-800)",
              color: "var(--w-base-0)",
              borderRadius: r * 0.7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 10px",
            }}
          >
            {label}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              marginLeft: -5,
              width: 10,
              height: 10,
              background: "var(--w-base-800)",
              transform: "rotate(45deg)",
              borderRadius: 2,
            }}
          />
        </div>
      )

    case "pagination":
      return (
        <div
          style={{
            ...base,
            alignItems: "center",
            gap: 5,
            justifyContent: "center",
          }}
        >
          <Glyph
            name="chevron-left"
            size={15}
            color={C.faint}
            strokeWidth={2}
          />
          {[1, 2, 3, 4].map((n, i) => (
            <div
              key={n}
              style={{
                width: node.h * 0.85,
                height: node.h * 0.85,
                borderRadius: r * 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: i === 0 ? accent : "transparent",
                color: i === 0 ? "#fff" : C.faint,
                border: i === 0 ? "none" : `1.2px solid ${C.line}`,
                fontSize: 12,
              }}
            >
              {n}
            </div>
          ))}
          <Glyph
            name="chevron-right"
            size={15}
            color={C.faint}
            strokeWidth={2}
          />
        </div>
      )

    case "footer": {
      const items = parts(label)
      return (
        <div
          style={{
            ...base,
            background: C.softer,
            borderTop: `1.5px solid ${C.line}`,
            padding: "12px 16px",
            gap: 24,
            borderRadius: r * 0.6,
          }}
        >
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: C.strong,
                  fontSize: Math.min(12, node.fontSize),
                }}
              >
                {t}
              </span>
              <Bar w="70%" h={5} />
              <Bar w="55%" h={5} />
            </div>
          ))}
        </div>
      )
    }

    default:
      return framed(
        <span style={{ margin: "auto", color: C.faint }}>{label}</span>
      )
  }
}
