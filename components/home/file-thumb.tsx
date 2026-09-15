"use client"

import * as React from "react"
import { BoardPreview } from "@/components/board/board-preview"
import { fontStack } from "@/lib/fonts"
import { docAccent, isDark, rgba, whim } from "@/lib/palette"
import {
  AUTO_CANVAS,
  AUTO_DOC_BG,
  AUTO_PAPER,
  resolveColor,
  useIsDark,
} from "@/lib/use-theme"
import type { BoardData, DocData } from "@/lib/types"

export function BoardThumb({ data }: { data: BoardData }) {
  const dark = useIsDark()
  const background = resolveColor(data.theme.background, dark, AUTO_CANVAS)

  if (!data.nodes.length) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-xs"
        style={{ background, color: whim.base[500] }}
      >
        Board vuota
      </div>
    )
  }

  return (
    <BoardPreview
      data={data}
      background={background}
      className="h-full w-full"
      padding={30}
      fit="slice"
    />
  )
}

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] }

function flatten(nodes: TiptapNode[] | undefined, limit: number): string {
  const out: string[] = []
  let size = 0
  const walk = (n: TiptapNode | undefined) => {
    // si conta la lunghezza man mano: unire il testo a ogni nodo era quadratico
    if (!n || size > limit) return
    if (n.text) {
      out.push(n.text)
      size += n.text.length + 1
    }
    n.content?.forEach(walk)
  }
  nodes?.forEach(walk)
  return out.join(" ").slice(0, limit)
}

/** Il titolo è il primo nodo del documento, non fa parte del corpo */
function docTitle(content: unknown): string {
  const doc = content as TiptapNode | null
  const first = doc?.content?.[0]
  return first?.type === "docTitle" ? flatten(first.content, 80) : ""
}

function docText(content: unknown, limit = 240): string {
  const doc = content as TiptapNode | null
  const nodes = doc?.content ?? []
  const body = nodes[0]?.type === "docTitle" ? nodes.slice(1) : nodes
  return flatten(body, limit)
}

export function DocThumb({ data }: { data: DocData }) {
  const dark = useIsDark()
  const text = docText(data.content)
  const title = docTitle(data.content)
  const paper = resolveColor(data.theme.paper, dark, AUTO_PAPER)
  const background = resolveColor(data.theme.background, dark, AUTO_DOC_BG)
  const paperDark = isDark(paper)

  return (
    <div
      className="h-full w-full overflow-hidden px-5 pt-5"
      style={{ background }}
    >
      <div
        className="h-full w-full overflow-hidden px-4 pt-4"
        style={{
          background: paper,
          borderRadius: data.theme.cornerRadius,
          fontFamily: fontStack(data.theme.font),
          color: paperDark ? "#fff" : whim.base[800],
          boxShadow: `0 2px 10px -4px ${rgba(whim.base[900], 0.18)}`,
        }}
      >
        {title ? (
          <p className="mb-1.5 truncate text-[12px] font-bold tracking-[-0.01em]">
            {title}
          </p>
        ) : (
          <div
            className="mb-2 h-2 w-2/3 rounded-full"
            style={{
              background: docAccent(data.theme.accent).solid,
              opacity: 0.85,
            }}
          />
        )}
        <p className="text-[9px] leading-[1.5] opacity-70">
          {text || "Documento vuoto"}
        </p>
      </div>
    </div>
  )
}
