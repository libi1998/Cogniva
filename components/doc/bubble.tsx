"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { NodeSelection } from "@tiptap/pm/state"
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  MessageSquarePlus,
  Strikethrough,
  Underline,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { guardClicks, typingOutside } from "./focus-guard"
import type { DocState } from "./use-doc-state"

function B({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-white/20 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

export function DocBubbleMenu({
  editor,
  st,
  onComment,
}: {
  editor: Editor | null
  st: DocState
  onComment: () => void
}) {
  if (!editor) return null
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, from, to, state }) =>
        // niente barretta mentre si scrive in un altro campo, né sopra a
        // immagini, note e board selezionate: hanno il loro pannello
        from !== to &&
        e.isEditable &&
        !(state.selection instanceof NodeSelection) &&
        !typingOutside(e)
      }
      options={{ placement: "top", offset: 8 }}
      className="flex items-center gap-0.5 rounded-xl bg-zinc-900 p-1 shadow-[0_10px_30px_-10px_rgba(9,9,11,0.6)] ring-1 ring-white/10"
    >
      <div className="contents" onClickCapture={guardClicks(editor)}>
        <B
          title="Titolo 1"
          active={st.heading1}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="size-4" />
        </B>
        <B
          title="Titolo 2"
          active={st.heading2}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="size-4" />
        </B>
        <div className="mx-0.5 h-4 w-px bg-white/15" />
        <B
          title="Grassetto"
          active={st.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </B>
        <B
          title="Corsivo"
          active={st.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </B>
        <B
          title="Sottolineato"
          active={st.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-3.5" />
        </B>
        <B
          title="Barrato"
          active={st.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-3.5" />
        </B>
        <B
          title="Evidenzia"
          active={st.highlight}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="size-3.5" />
        </B>
        <B
          title="Codice"
          active={st.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="size-3.5" />
        </B>
        <B
          title="Link"
          active={st.link}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined
            const url = window.prompt("Indirizzo del link", prev ?? "https://")
            if (url === null) return
            if (url === "")
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            else
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run()
          }}
        >
          <Link2 className="size-3.5" />
        </B>
        <div className="mx-0.5 h-4 w-px bg-white/15" />
        <B title="Nuovo commento (⌥⌘M)" onClick={onComment}>
          <MessageSquarePlus className="size-3.5" />
        </B>
      </div>
    </BubbleMenu>
  )
}
