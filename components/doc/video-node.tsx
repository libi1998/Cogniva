"use client"

import * as React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"

import { useT } from "@/lib/i18n/client"
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      insertVideo: (src: string) => ReturnType
    }
  }
}

export type VideoInfo = {
  provider: "YouTube" | "Vimeo" | "Loom" | "Dailymotion" | "File"
  /** indirizzo da mettere nell'iframe o nel tag video */
  embed: string
  /** anteprima, quando il servizio ne offre una senza chiavi */
  poster: string | null
}

/** Riconosce i servizi supportati, come «Video online» di Word */
/**
 * Il punto di partenza di un video di YouTube in secondi: «90», «90s» e anche
 * «1m30s» o «1h2m3s», come li scrive il pulsante «Condividi» (prima questi
 * ultimi si perdevano e il video partiva dall'inizio)
 */
function youtubeStart(value: string | null) {
  const m = value?.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

export function parseVideo(raw: string): VideoInfo | null {
  let url: URL
  try {
    url = new URL(
      /^[a-z]+:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`
    )
  } catch {
    return null
  }
  // solo indirizzi web: un «javascript:» o un «data:» incollato (o arrivato da
  // un documento importato) non deve finire nel lettore
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = url.hostname.replace(/^www\.|^m\./, "")
  const path = url.pathname

  if (
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com"
  ) {
    const id =
      host === "youtu.be"
        ? path.slice(1)
        : (url.searchParams.get("v") ??
          path.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1] ??
          null)
    if (!id || !/^[\w-]{6,}$/.test(id)) return null
    const start = youtubeStart(
      url.searchParams.get("t") ?? url.searchParams.get("start")
    )
    return {
      provider: "YouTube",
      embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ""}`,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = path.match(/(\d{5,})/)?.[1]
    return id
      ? {
          provider: "Vimeo",
          embed: `https://player.vimeo.com/video/${id}`,
          poster: null,
        }
      : null
  }
  if (host === "loom.com") {
    const id = path.match(/\/(?:share|embed)\/([\da-f]{16,})/i)?.[1]
    return id
      ? {
          provider: "Loom",
          embed: `https://www.loom.com/embed/${id}`,
          poster: null,
        }
      : null
  }
  if (host === "dailymotion.com" || host === "dai.ly") {
    const id =
      host === "dai.ly" ? path.slice(1) : path.match(/\/video\/([\w]+)/)?.[1]
    return id
      ? {
          provider: "Dailymotion",
          embed: `https://www.dailymotion.com/embed/video/${id}`,
          poster: `https://www.dailymotion.com/thumbnail/video/${id}`,
        }
      : null
  }
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(path)) {
    return { provider: "File", embed: url.href, poster: null }
  }
  return null
}

function VideoView({ node, selected, editor, getPos }: NodeViewProps) {
  const t = useT()
  const src = String(node.attrs.src ?? "")
  const info = parseVideo(src)
  // il collegamento sotto al video porta solo a indirizzi web
  const href = /^https?:\/\//i.test(src.trim()) ? src.trim() : undefined
  const width = Math.min(100, Math.max(20, Number(node.attrs.width) || 100))
  const align = String(node.attrs.align ?? "center")
  // il lettore si carica solo quando si preme play: un documento con dieci
  // video non deve aprire dieci lettori
  const [playing, setPlaying] = React.useState(false)
  const [vimeoPoster, setVimeoPoster] = React.useState<string | null>(null)

  // Vimeo dà l'anteprima solo tramite oEmbed, che risponde senza chiavi
  React.useEffect(() => {
    if (info?.provider !== "Vimeo") return
    let alive = true
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(src)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { thumbnail_url?: string } | null) => {
        if (alive && data?.thumbnail_url) setVimeoPoster(data.thumbnail_url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [info?.provider, src])
  const poster = info?.poster ?? vimeoPoster

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
      className={cn("doc-video", selected && "is-selected")}
      data-drag-handle=""
      style={{
        width: `${width}%`,
        marginLeft: align === "left" ? 0 : "auto",
        marginRight: align === "right" ? 0 : "auto",
      }}
    >
      <div className="doc-video-frame" onMouseDown={() => !playing && select()}>
        {/* l'anteprima resta sotto al lettore: è quella che va in stampa */}
        <div className="doc-video-poster">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- anteprima remota del servizio video
            <img src={poster} alt="" draggable={false} />
          ) : null}
          <span className="doc-video-badge">
            {info?.provider ?? t("Video")}
          </span>
          <button
            type="button"
            className="doc-video-play"
            aria-label={t("Riproduci il video")}
            disabled={!info}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault()
              setPlaying(true)
            }}
          >
            <Play className="size-6 fill-current" />
          </button>
        </div>
        {playing && info ? (
          info.provider === "File" ? (
            <video
              src={info.embed}
              controls
              autoPlay
              className="doc-video-player"
            />
          ) : (
            <iframe
              src={`${info.embed}${info.embed.includes("?") ? "&" : "?"}autoplay=1`}
              title={t("Video {provider}", { provider: info.provider })}
              className="doc-video-player"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )
        ) : null}
      </div>
      <a
        className="doc-video-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
      >
        {src}
      </a>
    </NodeViewWrapper>
  )
}

/** Video online, come «Inserisci › Video online» di Word */
export const DocVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-src") ?? "",
        renderHTML: (attrs) => ({ "data-src": attrs.src }),
      },
      width: {
        default: 100,
        parseHTML: (el) => Number(el.getAttribute("data-width") ?? 100),
        renderHTML: (attrs) => ({ "data-width": String(attrs.width) }),
      },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") ?? "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-video]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-video": "" })]
  },
  renderText({ node }) {
    return String(node.attrs.src ?? "")
  },
  addCommands() {
    return {
      insertVideo:
        (src) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { src } })
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
    return ReactNodeViewRenderer(VideoView)
  },
})
