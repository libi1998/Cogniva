"use client"

import * as React from "react"
import { Extension, Node, type AnyExtension } from "@tiptap/core"
import { NodeSelection, Plugin } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Highlight } from "@tiptap/extension-highlight"
import { TextAlign } from "@tiptap/extension-text-align"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Minus,
  Plus,
  Underline,
  Braces,
} from "lucide-react"
import { FontSize } from "@/lib/tiptap-extensions"
import {
  BAND_FIELDS,
  bandFieldValue,
  sanitizeBand,
  type BandField,
  type BandVars,
} from "@/lib/header-footer"
import type { BandContent, DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/client"
import { TEXT_COLORS } from "./ribbon/shared"

/**
 * L'editor dell'intestazione e del piè di pagina: testo libero come in Word,
 * sul foglio (doppio clic nel margine) o nella finestra dei documenti senza
 * pagine. Righe con la loro formattazione, due tabulazioni (Tab porta al
 * centro della riga, poi a destra), immagini come un logo, una linea sotto o
 * sopra e i campi che si riempiono pagina per pagina.
 *
 * È un editor a sé, con i suoi comandi nella barretta: la barra del
 * documento resta sul testo, che intanto si vede attenuato.
 */

/* ------------------------------- schema ---------------------------------- */

/** i campi dell'intestazione: il valore della pagina che si sta scrivendo */
type FieldOptions = { vars: BandVars; theme: DocTheme | null }

const BandFieldNode = Node.create<FieldOptions>({
  name: "bandField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addOptions() {
    return {
      vars: { page: 1, pages: 1, title: "", author: "", date: "" },
      theme: null,
    }
  },
  addAttributes() {
    return {
      field: {
        default: "page",
        parseHTML: (el) => el.getAttribute("data-band-field"),
        renderHTML: (a) => ({ "data-band-field": a.field }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-band-field]" }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      { ...HTMLAttributes, class: "doc-band-field" },
      this.options.theme
        ? bandFieldValue(
            node.attrs.field as BandField,
            this.options.vars,
            this.options.theme
          )
        : String(node.attrs.field),
    ]
  },
  renderText({ node }) {
    return this.options.theme
      ? bandFieldValue(
          node.attrs.field as BandField,
          this.options.vars,
          this.options.theme
        )
      : ""
  },
})

/**
 * La tabulazione: la prima porta al centro della riga, la seconda a destra.
 * La sua larghezza la calcola il plugin dopo ogni modifica, misurando i
 * pezzi di riga fra una tabulazione e l'altra.
 */
const BandTab = Node.create({
  name: "bandTab",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  // senza formattazioni intorno: la riga misura le tabulazioni come figli
  marks: "",
  parseHTML() {
    return [{ tag: "span[data-band-tab]" }]
  },
  renderHTML() {
    return ["span", { "data-band-tab": "", class: "doc-band-tab" }]
  },
  renderText() {
    return "\t"
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection
        let tabs = 0
        $from.parent.forEach((n) => {
          if (n.type.name === "bandTab") tabs += 1
        })
        // al centro e a destra: una terza non porterebbe da nessuna parte,
        // ma Tab resta qui invece di uscire dall'intestazione
        if (tabs >= 2) return true
        return this.editor.commands.insertContent({ type: "bandTab" })
      },
      "Shift-Tab": () => true,
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (view) => {
          layoutTabs(view)
          // i caratteri e le immagini arrivano dopo: i pezzi di riga cambiano
          // larghezza e le tabulazioni si rimisurano
          const relayout = () => {
            if (!view.isDestroyed) layoutTabs(view)
          }
          void document.fonts?.ready.then(relayout)
          view.dom.addEventListener("load", relayout, true)
          return {
            update: relayout,
            destroy: () => view.dom.removeEventListener("load", relayout, true),
          }
        },
      }),
    ]
  },
})

/** Le tabulazioni di ogni riga, alle loro posizioni: centro e destra */
function layoutTabs(view: EditorView) {
  const rows = view.dom.querySelectorAll<HTMLElement>(":scope > p")
  for (const row of rows) {
    const tabs = Array.from(
      row.querySelectorAll<HTMLElement>(":scope > .doc-band-tab")
    )
    if (!tabs.length) continue
    for (const tab of tabs) tab.style.width = "0px"
    const box = row.getBoundingClientRect()
    const scale = box.width / (row.clientWidth || 1) || 1
    const width = row.clientWidth
    // la larghezza dei pezzi di riga, fra una tabulazione e l'altra
    const segment = (
      from: globalThis.Node | null,
      to: globalThis.Node | null
    ) => {
      const range = document.createRange()
      if (from) range.setStartAfter(from)
      else range.setStart(row, 0)
      if (to) range.setEndBefore(to)
      else range.setEnd(row, row.childNodes.length)
      return range.getBoundingClientRect().width / scale
    }
    const first = segment(null, tabs[0])
    const second = segment(tabs[0], tabs[1] ?? null)
    // la prima: il pezzo che la segue ha il centro al centro della riga
    const toCenter = Math.max(4, width / 2 - second / 2 - first - 1)
    tabs[0].style.width = `${toCenter}px`
    if (tabs[1]) {
      const third = segment(tabs[1], null)
      // la seconda: il pezzo che la segue finisce sul bordo destro
      // due pixel di scorta: una riga piena al pixel andava a capo per un
      // arrotondamento, e il numero di pagina finiva sotto
      const toRight = Math.max(
        4,
        width - third - (first + toCenter + second) - 2
      )
      tabs[1].style.width = `${toRight}px`
    }
  }
}

/** Un'immagine nella riga, come un logo: alta quanto si sceglie */
const BandImage = Node.create({
  name: "bandImage",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  marks: "",
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      height: {
        default: 40,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || 40,
      },
    }
  },
  parseHTML() {
    // solo immagini dentro al file: un indirizzo esterno non entra
    return [{ tag: 'img[src^="data:image/"]' }]
  },
  renderHTML({ node }) {
    return [
      "img",
      {
        src: node.attrs.src,
        alt: node.attrs.alt,
        "data-height": node.attrs.height,
        class: "doc-band-img",
        draggable: "false",
        style: `height:${Number(node.attrs.height) || 40}px`,
      },
    ]
  },
})

/** La linea sotto (intestazione) o sopra (piè di pagina) una riga */
const BandParagraphBorder = Extension.create({
  name: "bandParagraphBorder",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          border: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-border"),
            renderHTML: (a) =>
              a.border === "top" || a.border === "bottom"
                ? { "data-border": a.border }
                : {},
          },
        },
      },
    ]
  },
})

export function createBandExtensions(options: FieldOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      listKeymap: false,
      link: false,
      orderedList: false,
      trailingNode: false,
    }),
    TextStyle,
    Color,
    FontSize,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ["paragraph"],
      alignments: ["left", "center", "right", "justify"],
    }),
    BandParagraphBorder,
    BandTab,
    BandImage,
    BandFieldNode.configure(options),
  ]
}

const EMPTY_BAND: BandContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

/* ------------------------------- immagini -------------------------------- */

/** lato più lungo di un'immagine salvata nell'intestazione */
const IMAGE_MAX = 900

/**
 * Un'immagine scelta dal computer come data URI, rimpicciolita se enorme:
 * resta dentro al documento, che viaggia con lei, e si salva a ogni modifica
 */
async function imageData(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null
  // i formati che il documento tiene così come sono (vedi sanitizeBand)
  const kept = /^image\/(?:png|jpeg|gif|webp)$/.test(file.type)
  const read = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  if (file.type === "image/svg+xml") return read()
  try {
    const bitmap = await createImageBitmap(file)
    const long = Math.max(bitmap.width, bitmap.height)
    if (long <= IMAGE_MAX && kept) {
      bitmap.close()
      return read()
    }
    // troppo grande, o in un formato che il documento non tiene: diventa PNG
    const k = Math.min(1, IMAGE_MAX / long)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * k)
    canvas.height = Math.round(bitmap.height * k)
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL(
      file.type === "image/jpeg" ? "image/jpeg" : "image/png",
      0.9
    )
  } catch {
    // un'immagine che il browser non sa aprire non entra
    return kept ? read() : null
  }
}

/* -------------------------------- editor --------------------------------- */

/**
 * L'area dell'intestazione che si scrive, con la barretta. `at` è il punto
 * del doppio clic, in coordinate dello schermo: il cursore va lì.
 */
export function BandEditor({
  where,
  initial,
  vars,
  theme,
  onChange,
  onClose,
  at,
  className,
  style,
  toolbarClassName,
  toolbarStyle,
  showClose = true,
}: {
  where: "header" | "footer"
  initial: BandContent | null
  vars: BandVars
  theme: DocTheme
  onChange: (content: BandContent) => void
  onClose?: () => void
  at?: { x: number; y: number } | null
  className?: string
  style?: React.CSSProperties
  toolbarClassName?: string
  toolbarStyle?: React.CSSProperties
  showClose?: boolean
}) {
  const t = useT()
  const latest = React.useRef(onChange)
  React.useEffect(() => {
    latest.current = onChange
  })
  const label = where === "header" ? t("Intestazione") : t("Piè di pagina")
  // estensioni, contenuto di partenza e proprietà una volta sola: mentre si
  // scrive il tema cambia a ogni tasto e questo componente si ridisegna. Con
  // un oggetto nuovo a ogni giro useEditor rifaceva le opzioni dell'editor,
  // che rimetteva il suo stato: una battuta non ancora letta si perdeva
  // (sulla CI, più lenta, spariva uno spazio)
  const [setup] = React.useState(() => ({
    extensions: createBandExtensions({ vars, theme }),
    content: sanitizeBand(initial) ?? EMPTY_BAND,
    editorProps: {
      attributes: {
        class: "doc-band-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        spellcheck: "false",
      },
    },
  }))
  const editor = useEditor({
    immediatelyRender: false,
    extensions: setup.extensions,
    content: setup.content as never,
    editorProps: setup.editorProps,
    onUpdate: ({ editor: e }) => {
      latest.current(e.getJSON() as BandContent)
    },
  })

  // il cursore dove si è fatto doppio clic, altrimenti in fondo
  React.useEffect(() => {
    if (!editor) return
    const place = () => {
      if (editor.isDestroyed) return
      const hit = at ? editor.view.posAtCoords({ left: at.x, top: at.y }) : null
      if (hit) editor.chain().focus().setTextSelection(hit.pos).run()
      else editor.commands.focus("end")
    }
    place()
    // aperta da un menu della barra: il menu che si chiude rimette il fuoco
    // nel testo un attimo dopo, e per mezzo secondo il fuoco torna qui
    const until = Date.now() + 500
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (Date.now() > until || editor.isDestroyed) return
      if (
        target?.closest(".ProseMirror") &&
        !target.closest(".doc-band-editor")
      )
        editor.commands.focus()
    }
    document.addEventListener("focusin", onFocus)
    const stop = window.setTimeout(
      () => document.removeEventListener("focusin", onFocus),
      600
    )
    return () => {
      window.clearTimeout(stop)
      document.removeEventListener("focusin", onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura
  }, [editor])

  return (
    <>
      <div
        className={className}
        style={style}
        data-band-kind={where}
        onKeyDown={(e) => {
          // sul foglio Esc torna al documento; nella finestra la chiude
          if (e.key === "Escape" && onClose) {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {editor ? (
        <BandToolbar
          editor={editor}
          where={where}
          className={toolbarClassName}
          style={toolbarStyle}
          onClose={showClose ? onClose : undefined}
        />
      ) : null}
    </>
  )
}

/** i corpi del carattere dei pulsanti A− e A+, in punti */
const SIZES = [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36]
const PX_PER_PT = 96 / 72

function BandToolbar({
  editor,
  where,
  className,
  style,
  onClose,
}: {
  editor: Editor
  where: "header" | "footer"
  className?: string
  style?: React.CSSProperties
  onClose?: () => void
}) {
  const t = useT()
  const [open, setOpen] = React.useState<"fields" | "color" | null>(null)
  const file = React.useRef<HTMLInputElement>(null)
  const bar = React.useRef<HTMLDivElement>(null)
  // un clic fuori dalla barretta chiude il menu aperto
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as globalThis.Node)) setOpen(null)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [open])
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const picked = (
        e.state.selection as {
          node?: { type: { name: string }; attrs: Record<string, unknown> }
        }
      ).node
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        align: (e.getAttributes("paragraph").textAlign as string) || "left",
        border: (e.getAttributes("paragraph").border as string) || "",
        color: (e.getAttributes("textStyle").color as string) || "",
        size: (e.getAttributes("textStyle").fontSize as string) || "",
        image:
          picked?.type.name === "bandImage"
            ? Number(picked.attrs.height) || 40
            : 0,
      }
    },
  })

  const chain = () => editor.chain().focus()
  /** il corpo attuale in punti: quello scelto, o quello del foglio */
  const currentPt = () => {
    const px = parseFloat(st?.size ?? "")
    if (px) return Math.round((px / PX_PER_PT) * 2) / 2
    const dom = editor.view.dom
    const computed = parseFloat(getComputedStyle(dom).fontSize) || 12
    return Math.round((computed / PX_PER_PT) * 2) / 2
  }
  const resize = (dir: 1 | -1) => {
    const now = currentPt()
    const next =
      dir > 0
        ? (SIZES.find((s) => s > now) ?? SIZES[SIZES.length - 1])
        : ([...SIZES].reverse().find((s) => s < now) ?? SIZES[0])
    chain()
      .setFontSize(`${Math.round(next * PX_PER_PT * 100) / 100}px`)
      .run()
  }
  const imageHeight = (dir: 1 | -1) => {
    const h = st?.image ?? 0
    if (!h) return
    const next = Math.min(
      400,
      Math.max(8, h + dir * Math.max(4, Math.round(h * 0.15)))
    )
    const at = editor.state.selection.from
    editor
      .chain()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(at)
        if (node?.type.name !== "bandImage") return false
        tr.setNodeMarkup(at, undefined, { ...node.attrs, height: next })
        // l'immagine resta selezionata, per ingrandirla ancora
        tr.setSelection(NodeSelection.create(tr.doc, at))
        return true
      })
      .run()
  }
  const button = (
    title: string,
    icon: React.ReactNode,
    onClick: () => void,
    active?: boolean
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-6 items-center justify-center rounded hover:bg-muted",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {icon}
    </button>
  )

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={
        where === "header"
          ? t("Strumenti dell'intestazione")
          : t("Strumenti del piè di pagina")
      }
      className={cn(
        "doc-band-tools absolute flex items-center gap-0.5",
        className
      )}
      style={style}
      // i pulsanti non tolgono il fuoco al testo: il comando va lì
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("input")) return
        e.preventDefault()
      }}
    >
      {button(
        t("Grassetto"),
        <Bold className="size-3.5" />,
        () => chain().toggleBold().run(),
        st?.bold
      )}
      {button(
        t("Corsivo"),
        <Italic className="size-3.5" />,
        () => chain().toggleItalic().run(),
        st?.italic
      )}
      {button(
        t("Sottolineato"),
        <Underline className="size-3.5" />,
        () => chain().toggleUnderline().run(),
        st?.underline
      )}
      {button(
        t("Riduci carattere"),
        <span className="text-[10px] font-semibold">A−</span>,
        () => resize(-1)
      )}
      {button(
        t("Aumenta carattere"),
        <span className="text-[12px] font-semibold">A+</span>,
        () => resize(1)
      )}
      <span className="relative">
        {button(
          t("Colore carattere"),
          <span className="flex flex-col items-center">
            <Baseline className="size-3.5" />
            <span
              className="-mt-0.5 h-[3px] w-3.5 rounded-full"
              style={{ background: st?.color || "currentColor" }}
            />
          </span>,
          () => setOpen(open === "color" ? null : "color")
        )}
        {open === "color" ? (
          <span className="doc-band-pop grid grid-cols-6 gap-1 p-1.5">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                aria-label={c.label}
                onClick={() => {
                  if (c.value) chain().setColor(c.value).run()
                  else chain().unsetColor().run()
                  setOpen(null)
                }}
                className="size-5 rounded"
                style={{
                  background:
                    c.value ||
                    "linear-gradient(135deg, transparent 45%, #e03177 45% 55%, transparent 55%)",
                  boxShadow: "inset 0 0 0 1px rgba(15,1,26,0.16)",
                }}
              />
            ))}
          </span>
        ) : null}
      </span>
      <span className="mx-0.5 h-4 w-px bg-border" />
      {button(
        t("Allinea a sinistra"),
        <AlignLeft className="size-3.5" />,
        () => chain().setTextAlign("left").run(),
        st?.align === "left"
      )}
      {button(
        t("Centra"),
        <AlignCenter className="size-3.5" />,
        () => chain().setTextAlign("center").run(),
        st?.align === "center"
      )}
      {button(
        t("Allinea a destra"),
        <AlignRight className="size-3.5" />,
        () => chain().setTextAlign("right").run(),
        st?.align === "right"
      )}
      <span className="mx-0.5 h-4 w-px bg-border" />
      <span className="relative">
        <button
          type="button"
          title={t(
            "Inserisci un campo: numero di pagina, titolo, autore, data"
          )}
          aria-expanded={open === "fields"}
          onClick={() => setOpen(open === "fields" ? null : "fields")}
          className="flex h-6 items-center gap-0.5 rounded px-1.5 text-[11px] hover:bg-muted"
        >
          <Braces className="size-3.5" /> {t("Campi")}
          <ChevronDown className="size-3 opacity-60" />
        </button>
        {open === "fields" ? (
          <span className="doc-band-pop flex w-max flex-col p-1">
            {BAND_FIELDS.map((field, i) => (
              <button
                key={field.token}
                type="button"
                onClick={() => {
                  chain()
                    .insertContent({
                      type: "bandField",
                      attrs: {
                        field: (
                          ["page", "pages", "title", "author", "date"] as const
                        )[i],
                      },
                    })
                    .run()
                  setOpen(null)
                }}
                className="rounded px-2 py-1 text-left text-[12px] hover:bg-muted"
              >
                {field.label}
              </button>
            ))}
          </span>
        ) : null}
      </span>
      {button(t("Immagine"), <ImagePlus className="size-3.5" />, () =>
        file.current?.click()
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const picked = e.target.files?.[0]
          e.target.value = ""
          if (!picked) return
          const src = await imageData(picked)
          if (!src || editor.isDestroyed) return
          editor
            .chain()
            .focus()
            .insertContent({
              type: "bandImage",
              attrs: {
                src,
                alt: picked.name.replace(/\.[^.]+$/, ""),
                height: 40,
              },
            })
            .run()
        }}
      />
      {st?.image ? (
        <>
          {button(
            t("Immagine più piccola"),
            <Minus className="size-3.5" />,
            () => imageHeight(-1)
          )}
          {button(t("Immagine più grande"), <Plus className="size-3.5" />, () =>
            imageHeight(1)
          )}
        </>
      ) : null}
      {button(
        where === "header" ? t("Linea sotto") : t("Linea sopra"),
        <span
          className="block h-3 w-3.5"
          style={
            where === "header"
              ? { borderBottom: "2px solid currentColor" }
              : { borderTop: "2px solid currentColor" }
          }
        />,
        () =>
          chain()
            .updateAttributes("paragraph", {
              border: st?.border ? null : where === "header" ? "bottom" : "top",
            })
            .run(),
        Boolean(st?.border)
      )}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          {where === "header"
            ? t("Chiudi intestazione")
            : t("Chiudi piè di pagina")}
        </button>
      ) : null}
    </div>
  )
}
