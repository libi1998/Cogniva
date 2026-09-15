"use client"

import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import { ListTree } from "lucide-react"
import { cn } from "@/lib/utils"

type Entry = { level: number; text: string; pos: number }

/** Riquadro di spostamento: i titoli del documento, cliccabili */
export function DocOutline({ editor }: { editor: Editor | null }) {
  const data = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { entries: [] as Entry[], active: -1 }
      const entries: Entry[] = []
      e.state.doc.forEach((node, offset) => {
        if (node.type.name === "docTitle") {
          entries.push({ level: 0, text: node.textContent, pos: offset })
        } else if (node.type.name === "heading") {
          entries.push({
            level: Number(node.attrs.level ?? 1),
            text: node.textContent,
            pos: offset,
          })
        }
      })
      const caret = e.state.selection.from
      let active = -1
      entries.forEach((entry, i) => {
        if (entry.pos <= caret) active = i
      })
      return { entries, active }
    },
  }) ?? { entries: [] as Entry[], active: -1 }

  if (!editor) return null

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <ListTree className="size-3.5" /> Struttura
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {data.entries.length ? (
          data.entries.map((entry, i) => (
            <button
              key={`${entry.pos}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor
                  .chain()
                  .focus(entry.pos + 1)
                  .scrollIntoView()
                  .run()
              }
              className={cn(
                "block w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors",
                i === data.active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                entry.level === 0 && "font-semibold text-foreground"
              )}
              style={{ paddingLeft: 8 + Math.max(0, entry.level - 1) * 12 }}
            >
              {entry.text || <span className="opacity-40">Senza titolo</span>}
            </button>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Usa i titoli per creare la struttura del documento.
          </p>
        )}
      </div>
    </div>
  )
}
