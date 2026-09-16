"use client"

import type { Route } from "next"
import * as React from "react"
import Link from "next/link"
import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { ExternalLink, Minus, Plus, Trash2 } from "lucide-react"
import { BoardPreview } from "@/components/board/board-preview"
import { useStore } from "@/lib/store"
import { parseClip } from "@/lib/clipboard"
import { defaultBoardTheme, type BoardData } from "@/lib/types"
import { AUTO_CANVAS, resolveColor } from "@/lib/use-theme"
import { useDocDark } from "./render-theme"
import { cn } from "@/lib/utils"

import { useT, hrefFor } from "@/lib/i18n/client"
function BoardEmbedView({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) {
  const t = useT()
  const boardId = node.attrs.boardId as string | null
  const snapshot = node.attrs.snapshot as string | null
  const caption = (node.attrs.caption as string) ?? ""
  const height = (node.attrs.height as number) ?? 320
  const dark = useDocDark()

  const file = useStore((s) =>
    boardId ? s.files.find((f) => f.id === boardId) : undefined
  )

  const data: BoardData | null = React.useMemo(() => {
    if (file && file.kind === "board") return file.data
    if (snapshot) {
      const clip =
        parseClip(snapshot) ??
        (() => {
          try {
            return JSON.parse(snapshot)
          } catch {
            return null
          }
        })()
      if (clip?.nodes) {
        return {
          nodes: clip.nodes,
          edges: clip.edges ?? [],
          theme: clip.theme ?? defaultBoardTheme,
        } as BoardData
      }
    }
    return null
  }, [file, snapshot])

  const background = data
    ? resolveColor(data.theme.background, dark, AUTO_CANVAS)
    : "transparent"
  const editable = editor.isEditable

  return (
    <NodeViewWrapper
      className="doc-embed group relative my-4"
      data-drag-handle
      contentEditable={false}
    >
      <div
        className="relative overflow-hidden rounded-[var(--doc-radius)] border"
        style={{ borderColor: "var(--doc-border)", background }}
      >
        {data ? (
          <BoardPreview
            data={data}
            background={background}
            style={{ width: "100%", height }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-xs"
            style={{ height, color: "var(--doc-muted)" }}
          >
            {t("Board non disponibile")}
          </div>
        )}

        {editable ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border border-black/5 bg-card/95 p-0.5 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 dark:border-white/10">
            <button
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={() =>
                updateAttributes({ height: Math.max(140, height - 60) })
              }
              title={t("Riduci")}
            >
              <Minus className="size-3.5" />
            </button>
            <button
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={() =>
                updateAttributes({ height: Math.min(900, height + 60) })
              }
              title={t("Ingrandisci")}
            >
              <Plus className="size-3.5" />
            </button>
            {boardId ? (
              <Link
                href={hrefFor(`/board/${boardId}`) as Route}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                title={t("Apri la board")}
              >
                <ExternalLink className="size-3.5" />
              </Link>
            ) : null}
            <button
              className="flex size-6 items-center justify-center rounded-md text-destructive hover:bg-muted"
              onClick={() => deleteNode()}
              title={t("Rimuovi")}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {editable || caption ? (
        <input
          value={caption}
          readOnly={!editable}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t("Didascalia…")}
          className={cn(
            "mt-1.5 w-full bg-transparent text-center text-[0.82em] outline-none",
            "placeholder:opacity-40"
          )}
          style={{ color: "var(--doc-muted)" }}
        />
      ) : null}
    </NodeViewWrapper>
  )
}

export const BoardEmbed = Node.create({
  name: "boardEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      boardId: { default: null },
      snapshot: { default: null },
      caption: { default: "" },
      height: { default: 320 },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-board-embed]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-board-embed": "" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BoardEmbedView)
  },
})
