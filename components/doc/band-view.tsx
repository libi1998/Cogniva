"use client"

import * as React from "react"
import {
  bandFieldValue,
  bandSegments,
  type BandField,
  type BandVars,
} from "@/lib/header-footer"
import type { BandContent, BandNode, DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Intestazione o piè di pagina di una pagina, già riempiti: le righe con la
 * loro formattazione, le immagini e i campi (numero di pagina, titolo…).
 *
 * Una riga con le tabulazioni si divide in tre parti come le tabulazioni
 * predefinite di Word: il primo pezzo a sinistra, quello dopo la prima
 * tabulazione al centro della riga, quello dopo la seconda a destra.
 *
 * Il contenuto arriva già ripulito (sanitizeBand): qui si disegnano solo i
 * nodi e le formattazioni conosciuti.
 */
export function BandView({
  content,
  vars,
  theme,
  kind,
  className,
  style,
}: {
  content: BandContent
  vars: BandVars
  theme: DocTheme
  /** intestazione o piè: si misura per spostare il testo, se serve */
  kind?: "header" | "footer"
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      data-band=""
      data-band-kind={kind}
      className={cn("doc-band", className)}
      style={style}
    >
      {(content.content ?? []).map((paragraph, i) => (
        <BandParagraph
          key={i}
          paragraph={paragraph}
          vars={vars}
          theme={theme}
        />
      ))}
    </div>
  )
}

function BandParagraph({
  paragraph,
  vars,
  theme,
}: {
  paragraph: BandNode
  vars: BandVars
  theme: DocTheme
}) {
  const border = paragraph.attrs?.border
  const style: React.CSSProperties = {
    textAlign:
      (paragraph.attrs?.textAlign as React.CSSProperties["textAlign"]) ??
      undefined,
    ...(border === "bottom"
      ? { borderBottom: "1px solid currentColor", paddingBottom: 3 }
      : border === "top"
        ? { borderTop: "1px solid currentColor", paddingTop: 3 }
        : {}),
  }
  const segments = bandSegments(paragraph)
  if (segments.length > 1) {
    style.textAlign = undefined
    // oltre la seconda tabulazione il testo resta nella parte a destra
    const [left, center, ...rest] = segments
    return (
      <div className="doc-band-p doc-band-tabs" style={style}>
        <span className="doc-band-seg">
          <Inline nodes={left} vars={vars} theme={theme} />
        </span>
        <span className="doc-band-seg text-center">
          <Inline nodes={center ?? []} vars={vars} theme={theme} />
        </span>
        <span className="doc-band-seg text-right">
          <Inline nodes={rest.flat()} vars={vars} theme={theme} />
        </span>
      </div>
    )
  }
  return (
    <div className="doc-band-p" style={style}>
      {paragraph.content?.length ? (
        <Inline nodes={paragraph.content} vars={vars} theme={theme} />
      ) : (
        // una riga vuota tiene il suo posto, come in Word
        <br />
      )}
    </div>
  )
}

function Inline({
  nodes,
  vars,
  theme,
}: {
  nodes: BandNode[]
  vars: BandVars
  theme: DocTheme
}) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text":
            return (
              <Marked key={i} marks={node.marks}>
                {node.text}
              </Marked>
            )
          case "bandField":
            return (
              <Marked key={i} marks={node.marks}>
                {bandFieldValue(node.attrs?.field as BandField, vars, theme)}
              </Marked>
            )
          case "hardBreak":
            return <br key={i} />
          case "bandImage":
            return (
              // eslint-disable-next-line @next/next/no-img-element -- un'immagine del documento, dentro al file
              <img
                key={i}
                src={String(node.attrs?.src ?? "")}
                alt={String(node.attrs?.alt ?? "")}
                draggable={false}
                className="doc-band-img"
                style={{ height: Number(node.attrs?.height) || 40 }}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}

/** Il testo con le sue formattazioni, un elemento per formattazione */
function Marked({
  marks,
  children,
}: {
  marks: BandNode["marks"]
  children: React.ReactNode
}) {
  let out = <>{children}</>
  for (const mark of marks ?? []) {
    const attrs = mark.attrs ?? {}
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>
        break
      case "italic":
        out = <em>{out}</em>
        break
      case "underline":
        out = <u>{out}</u>
        break
      case "strike":
        out = <s>{out}</s>
        break
      case "subscript":
        out = <sub>{out}</sub>
        break
      case "superscript":
        out = <sup>{out}</sup>
        break
      case "highlight":
        out = (
          <mark
            style={{
              background: (attrs.color as string) || "#fff3a3",
              color: "inherit",
            }}
          >
            {out}
          </mark>
        )
        break
      case "textStyle":
        out = (
          <span
            style={{
              color: (attrs.color as string) || undefined,
              fontSize: (attrs.fontSize as string) || undefined,
              fontFamily: (attrs.fontFamily as string) || undefined,
            }}
          >
            {out}
          </span>
        )
        break
    }
  }
  return out
}
