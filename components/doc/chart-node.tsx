"use client"

import * as React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { ChartSvg } from "@/components/shared/chart-graphic"
import { defaultChart, parseChartAttr, type ChartType } from "@/lib/chart"
import { cn } from "@/lib/utils"
import { DocContentWidthContext, PaperDarkContext } from "./render-theme"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chart: {
      insertChart: (type: ChartType) => ReturnType
    }
  }
}

/**
 * Grafico nel documento. Si disegna alla larghezza vera del foglio, così i
 * testi restano nitidi a ogni zoom; l'altezza si trascina dal bordo inferiore.
 */
function ChartView({
  node,
  selected,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const spec = React.useMemo(
    () => parseChartAttr(node.attrs.spec),
    [node.attrs.spec]
  )
  const dark = React.useContext(PaperDarkContext)
  const contentWidth = React.useContext(DocContentWidthContext)
  const box = React.useRef<HTMLDivElement>(null)
  const height = Math.max(160, Math.min(900, Number(node.attrs.height) || 320))
  const pct = Math.min(100, Math.max(25, Number(node.attrs.width) || 100))
  const align = String(node.attrs.align ?? "center")
  // la misura viene dal foglio, non dal DOM: niente attese e niente salti
  const width = Math.round((contentWidth * pct) / 100)

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = box.current
    if (!el) return
    const scale =
      el.getBoundingClientRect().height / (el.offsetHeight || 1) || 1
    const ratio = el.offsetWidth / width || 1
    const startY = e.clientY
    const h0 = height
    let frame = 0
    let next = h0
    const move = (ev: PointerEvent) => {
      next = Math.round(
        Math.max(160, Math.min(900, h0 + (ev.clientY - startY) / scale / ratio))
      )
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          el.style.aspectRatio = `${width} / ${next}`
        })
      }
    }
    const up = () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      el.style.aspectRatio = ""
      if (next !== h0) updateAttributes({ height: next })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <NodeViewWrapper
      className={cn("doc-chart", selected && "is-selected")}
      data-drag-handle=""
      style={{
        width: `${pct}%`,
        marginLeft: align === "left" ? 0 : "auto",
        marginRight: align === "right" ? 0 : "auto",
      }}
    >
      <div
        ref={box}
        className="doc-chart-box"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <ChartSvg spec={spec} width={width} height={height} dark={dark} fluid />
        {selected && editor.isEditable ? (
          <span
            role="presentation"
            className="doc-chart-resize"
            title="Trascina per cambiare l'altezza"
            onPointerDown={startResize}
          />
        ) : null}
      </div>
    </NodeViewWrapper>
  )
}

/** Grafico, come «Inserisci › Grafico» di Word */
export const DocChart = Node.create({
  name: "chart",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      spec: {
        default: JSON.stringify(defaultChart()),
        parseHTML: (el) =>
          el.getAttribute("data-spec") ?? JSON.stringify(defaultChart()),
        renderHTML: (attrs) => ({ "data-spec": attrs.spec }),
      },
      width: {
        default: 100,
        parseHTML: (el) => Number(el.getAttribute("data-width") ?? 100),
        renderHTML: (attrs) => ({ "data-width": String(attrs.width) }),
      },
      height: {
        default: 320,
        parseHTML: (el) => Number(el.getAttribute("data-height") ?? 320),
        renderHTML: (attrs) => ({ "data-height": String(attrs.height) }),
      },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") ?? "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-chart]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-chart": "" })]
  },
  renderText({ node }) {
    return parseChartAttr(node.attrs.spec).title
  },
  addCommands() {
    return {
      insertChart:
        (type) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { spec: JSON.stringify(defaultChart(type)) },
            })
            .command(({ tr }) => {
              const $from = tr.selection.$from
              if (!$from.depth) return true
              const start = $from.before(1)
              const prev = tr.doc.resolve(start).nodeBefore
              if (prev?.type.name === this.name) {
                tr.setSelection(
                  NodeSelection.create(tr.doc, start - prev.nodeSize)
                )
              }
              return true
            })
            .run(),
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChartView)
  },
})
