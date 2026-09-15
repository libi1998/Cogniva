"use client"

import * as React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { GripVertical, LoaderCircle, Rotate3d } from "lucide-react"
import {
  DEFAULT_VIEW,
  isShape3D,
  safeModelSrc,
  type View3D,
} from "@/lib/model3d/catalog"
import type { ModelSpec, Viewer } from "@/lib/model3d/viewer"
import { cn } from "@/lib/utils"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    model3d: {
      insertModel3d: (attrs: {
        src?: string
        shape?: string
        color?: string
        name?: string
      }) => ReturnType
    }
  }
}

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Crea il visualizzatore; three.js arriva solo quando un modello compare
 * sullo schermo. Senza WebGL resta l'anteprima con un messaggio.
 */
async function startViewer(
  canvas: HTMLCanvasElement,
  spec: ModelSpec,
  attrs: Record<string, unknown>,
  callbacks: {
    onViewChange: (view: View3D) => void
    onReady: () => void
    onError: (message: string) => void
  }
): Promise<Viewer | null> {
  const { createViewer } = await import("@/lib/model3d/viewer")
  try {
    const viewer = createViewer(canvas, {
      spec,
      view: {
        yaw: num(attrs.yaw, DEFAULT_VIEW.yaw),
        pitch: num(attrs.pitch, DEFAULT_VIEW.pitch),
        zoom: num(attrs.zoom, DEFAULT_VIEW.zoom),
      },
      autoRotate: attrs.autoRotate === true,
      background: String(attrs.background ?? ""),
      ...callbacks,
    })
    const rect = canvas.getBoundingClientRect()
    viewer.resize(rect.width, rect.height)
    return viewer
  } catch {
    callbacks.onError("Questo dispositivo non supporta WebGL.")
    return null
  }
}

function specOf(attrs: Record<string, unknown>): ModelSpec | null {
  const shape = String(attrs.shape ?? "")
  if (isShape3D(shape)) {
    return { kind: "shape", shape, color: String(attrs.color || "#4f7cff") }
  }
  const src = safeModelSrc(String(attrs.src ?? ""))
  return src ? { kind: "file", src } : null
}

function Model3DView({
  node,
  selected,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const attrs = node.attrs as Record<string, unknown>
  const width = Math.min(100, Math.max(20, num(attrs.width, 60)))
  const height = Math.min(900, Math.max(120, num(attrs.height, 320)))
  const align = String(attrs.align ?? "center")
  const background = String(attrs.background ?? "")
  const autoRotate = attrs.autoRotate === true
  const poster = String(attrs.poster ?? "")
  const alt = String(attrs.alt ?? "")
  const view: View3D = {
    yaw: num(attrs.yaw, DEFAULT_VIEW.yaw),
    pitch: num(attrs.pitch, DEFAULT_VIEW.pitch),
    zoom: num(attrs.zoom, DEFAULT_VIEW.zoom),
  }
  const spec = specOf(attrs)
  const specKey = spec ? JSON.stringify(spec) : ""

  const frameRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const viewer = React.useRef<Viewer | null>(null)
  const [visible, setVisible] = React.useState(false)
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [error, setError] = React.useState("")
  const posterTimer = React.useRef(0)

  // i contesti WebGL sono pochi: il visualizzatore esiste solo quando il
  // modello è sullo schermo, altrimenti resta l'anteprima
  React.useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "300px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // le impostazioni più recenti, lette dai callback del visualizzatore
  const latest = React.useRef({ attrs, updateAttributes, editor })
  React.useEffect(() => {
    latest.current = { attrs, updateAttributes, editor }
  })

  const savePoster = React.useCallback((patch: Record<string, unknown>) => {
    window.clearTimeout(posterTimer.current)
    posterTimer.current = window.setTimeout(() => {
      const { editor: ed, updateAttributes: update } = latest.current
      const snapshot = viewer.current?.snapshot()
      if (ed.isDestroyed || !ed.isEditable) return
      update({ ...patch, ...(snapshot ? { poster: snapshot } : {}) })
    }, 250)
  }, [])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!visible || !canvas || !specKey) return
    let cancelled = false
    let created: Viewer | null = null
    const initial = JSON.parse(specKey) as ModelSpec
    const a = latest.current.attrs
    void startViewer(canvas, initial, a, {
      onViewChange: (next) => savePoster(next),
      onReady: () => {
        if (cancelled) return
        setStatus("ready")
        // la prima anteprima si scrive appena il modello c'è
        if (!latest.current.attrs.poster) savePoster({})
      },
      onError: (message) => {
        if (cancelled) return
        setStatus("error")
        setError(message)
      },
    }).then((result) => {
      if (cancelled) {
        result?.dispose()
        return
      }
      created = result
      viewer.current = result
    })
    return () => {
      cancelled = true
      created?.dispose()
      if (viewer.current === created) viewer.current = null
      setStatus("loading")
    }
  }, [visible, specKey, savePoster])

  // il nodo si sposta dalla maniglia: trascinando sul modello il browser
  // inizierebbe a spostarlo (e annullerebbe la rotazione) invece di ruotarlo
  React.useEffect(() => {
    const canvas = canvasRef.current
    const draggable = frameRef.current?.closest<HTMLElement>("[draggable]")
    if (!canvas || !draggable) return
    let fromCanvas = false
    const down = () => {
      fromCanvas = true
    }
    const up = () => {
      fromCanvas = false
    }
    const dragStart = (event: DragEvent) => {
      if (!fromCanvas) return
      event.preventDefault()
      event.stopPropagation()
    }
    canvas.addEventListener("pointerdown", down)
    window.addEventListener("pointerup", up)
    draggable.addEventListener("dragstart", dragStart, true)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      window.removeEventListener("pointerup", up)
      draggable.removeEventListener("dragstart", dragStart, true)
    }
  }, [])

  // dimensioni del riquadro
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      viewer.current?.resize(rect.width, rect.height)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const { yaw, pitch, zoom } = view
  React.useEffect(() => {
    if (status === "ready") viewer.current?.setView({ yaw, pitch, zoom })
  }, [yaw, pitch, zoom, status])

  React.useEffect(() => {
    viewer.current?.setAutoRotate(autoRotate)
  }, [autoRotate, status])

  // cambiando lo sfondo cambia anche l'anteprima; aprire il documento no
  const shownBackground = React.useRef(background)
  React.useEffect(() => {
    viewer.current?.setBackground(background)
    if (status === "ready" && shownBackground.current !== background) {
      shownBackground.current = background
      savePoster({})
    }
  }, [background, status, savePoster])

  React.useEffect(() => {
    viewer.current?.setZoomable(selected)
  }, [selected, status])

  React.useEffect(() => () => window.clearTimeout(posterTimer.current), [])

  const select = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (typeof pos === "number") {
      editor.view.dispatch(
        editor.state.tr.setSelection(
          NodeSelection.create(editor.state.doc, pos)
        )
      )
    }
  }

  return (
    <NodeViewWrapper
      className={cn("doc-model3d", selected && "is-selected")}
      style={{
        width: `${width}%`,
        marginLeft: align === "left" ? 0 : "auto",
        marginRight: align === "right" ? 0 : "auto",
      }}
    >
      <div
        ref={frameRef}
        className="doc-model3d-frame"
        style={{ height, background: background || undefined }}
        role="img"
        aria-label={alt || "Modello 3D"}
        onPointerDown={select}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- anteprima generata del modello
          <img
            className={cn(
              "doc-model3d-poster",
              status === "ready" && visible && "is-hidden"
            )}
            src={poster}
            alt=""
            draggable={false}
          />
        ) : null}
        <canvas
          ref={canvasRef}
          draggable={false}
          className={cn(
            "doc-model3d-canvas",
            status !== "ready" && "is-hidden"
          )}
        />
        {!spec ? (
          <span className="doc-model3d-message">Modello non valido</span>
        ) : status === "loading" && visible && !poster ? (
          <span className="doc-model3d-message">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        ) : status === "error" ? (
          <span className="doc-model3d-message">{error}</span>
        ) : null}
        <span className="doc-model3d-badge" contentEditable={false}>
          <Rotate3d className="size-3.5" /> 3D
        </span>
        {selected && status === "ready" ? (
          <span className="doc-model3d-hint" contentEditable={false}>
            Trascina per ruotare · rotellina per lo zoom
          </span>
        ) : null}
        <span
          className="doc-model3d-grip"
          data-drag-handle=""
          title="Trascina per spostare il modello"
          contentEditable={false}
        >
          <GripVertical className="size-4" />
        </span>
      </div>
    </NodeViewWrapper>
  )
}

/** «Modelli 3D» di Word: un modello glTF o una forma pronta, da ruotare */
export const Model3D = Node.create({
  name: "model3d",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    const data = (
      name: string,
      fallback: unknown,
      parse?: (v: string) => unknown
    ) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => {
        const value = el.getAttribute(`data-${name}`)
        return value === null ? fallback : parse ? parse(value) : value
      },
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs[name] === fallback || attrs[name] === ""
          ? {}
          : { [`data-${name}`]: String(attrs[name]) },
    })
    return {
      src: data("src", "", (v) => safeModelSrc(v)),
      shape: data("shape", ""),
      color: data("color", "#4f7cff"),
      name: data("name", ""),
      alt: data("alt", ""),
      width: data("width", 60, Number),
      height: data("height", 320, Number),
      align: data("align", "center"),
      yaw: data("yaw", DEFAULT_VIEW.yaw, Number),
      pitch: data("pitch", DEFAULT_VIEW.pitch, Number),
      zoom: data("zoom", DEFAULT_VIEW.zoom, Number),
      autoRotate: data("auto-rotate", false, (v) => v === "true"),
      background: data("background", ""),
      // l'anteprima va nel tag <img>, non in un attributo
      poster: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el
            .querySelector("img")
            ?.getAttribute("src")
            ?.startsWith("data:image/")
            ? el.querySelector("img")!.getAttribute("src")
            : "",
        renderHTML: () => ({}),
      },
    }
  },
  parseHTML() {
    return [{ tag: "figure[data-model3d]" }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const poster = String(node.attrs.poster ?? "")
    const alt = String(node.attrs.alt || node.attrs.name || "Modello 3D")
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-model3d": "" }),
      poster
        ? [
            "img",
            { src: poster, alt, style: `width:${num(node.attrs.width, 60)}%` },
          ]
        : ["span", {}, `[${alt}]`],
    ]
  },
  renderText({ node }) {
    return `[${String(node.attrs.alt || node.attrs.name || "Modello 3D")}]`
  },
  addCommands() {
    return {
      insertModel3d:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .command(({ tr }) => {
              const start = tr.selection.$from.depth
                ? tr.selection.$from.before(1)
                : tr.selection.from
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
    return ReactNodeViewRenderer(Model3DView, {
      // trascinare sul modello lo ruota: l'editor non deve iniziare una selezione
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null
        return Boolean(target?.closest?.(".doc-model3d-canvas"))
      },
    })
  },
})
