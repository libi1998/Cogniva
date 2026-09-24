"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import type { JSONContent } from "@tiptap/core"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import type { EditorProps } from "@tiptap/pm/view"
import {
  Download,
  BookMarked,
  ChartColumn,
  FileCode2,
  FileImage,
  FileText,
  FileType2,
  Grid3x3,
  History,
  Image as ImageIcon,
  ListTree,
  MessageSquarePlus,
  Pilcrow,
  Redo2,
  Replace,
  Ruler as Ruler2,
  Search,
  SeparatorHorizontal,
  Sigma,
  Superscript,
  Table,
  Undo2,
  ZoomIn,
  Minus,
  Plus,
  Printer,
} from "lucide-react"
import { toast } from "sonner"

import { Ribbon, openRibbonTab } from "./ribbon/ribbon"
import { insertPlainText } from "./plain-paste"
import { FindBar } from "./find-bar"
import { ReadAloudBar } from "./read-aloud"
import { ResumeReading } from "./resume-reading"
import { TaskPaneHost } from "./task-pane"
import { useAutoVersions } from "./versions-pane"
import type { TaskPane } from "./ribbon/shared"
import { wordAtSelection } from "@/lib/word-at"
import { DocOutline } from "./outline"
import { RULER_SIZE, Ruler } from "./ruler"
import { LineNumbers } from "./line-numbers"
import { setCitationData } from "./citation-node"
import { SourcesDialog, useDocSources } from "./sources-dialog"
import {
  CommentsColumn,
  pruneComments,
  useComments,
  type CommentsController,
} from "./comments"
import { BlockHandle } from "./block-handle"
import { InkLayer, useInk } from "./ink-layer"
import {
  DEFAULT_IMMERSIVE,
  IMMERSIVE_PAPERS,
  IMMERSIVE_WIDTHS,
  LineFocus,
  ModeBar,
  type DocMode,
  type ImmersiveSettings,
} from "./view-modes"
import {
  bandAt,
  GridOverlay,
  PageDecor,
  PageGuides,
  PageLayer,
  usePagination,
  type BandEditing,
} from "./page-layer"
import { StyleDialog, type StyleDialogRequest } from "./style-dialog"
import { StylesPane } from "./styles-panel"
import { applyDocStyle, dropDirectFormatting } from "./style-actions"
import { atBody } from "./ribbon/shared"
import { useCommandSource } from "@/components/shared/command-palette"
import { createDocExtensions, repairDocContent } from "./extensions"
import { DocBubbleMenu } from "./bubble"
import { DocContextMenu } from "./doc-context-menu"
import {
  DocContentWidthContext,
  DocPageContext,
  ForceLightContext,
  PaperDarkContext,
} from "./render-theme"
import { useDocCounts, useDocState } from "./use-doc-state"
import { useFormatPainter } from "./use-format-painter"
import { useDictation } from "./use-dictation"
import { TopBar } from "@/components/shared/top-bar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  docTitleText,
  isFreeWrap,
  setNextStyleResolver,
  withDocTitle,
} from "@/lib/tiptap-extensions"
import { resolveStyle, stylesCss } from "@/lib/doc-styles"
import { fieldsOf, setFieldSettings } from "@/lib/doc-fields"
import {
  ExportStudio,
  type StudioFormat,
} from "@/components/shared/export-studio"
import { takeDocSnapshot, visiblePage } from "./export-snapshot"
import { setMergeSettings } from "@/lib/doc-merge"
import { setTrackSettings } from "@/lib/track-changes"
import { setAutoCorrectSettings, useAutoCorrect } from "@/lib/autocorrect"
import { useAuthor } from "@/lib/author"
import { PROOFING_LANGUAGES } from "@/lib/review-tools"
import { fontStack } from "@/lib/fonts"
import { docAccent, isDark as isDarkColor, rgba, whim } from "@/lib/palette"
import { parseClip } from "@/lib/clipboard"
import { download, safeName } from "@/lib/export"
import { flushWorkspace, getWorkspace, useStore } from "@/lib/store"
import {
  exportDoc,
  pageSizeExact,
  pageSizePx,
  type DocExportFormat,
} from "@/lib/export-doc"
import {
  AUTO_DOC_BG,
  AUTO_PAPER,
  resolveColor,
  useIsDark,
} from "@/lib/use-theme"
import { useNarrow } from "@/lib/use-media"
import {
  PAGE_FORMATS,
  clampZoom,
  type DocMargins,
  type DocTheme,
  type MarginSide,
  type MergeData,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import type { RibbonCtx } from "./ribbon/shared"

import { useT, tr, useRegion } from "@/lib/i18n/client"
/** Lo stacco fra un foglio e l'altro a schermo; in stampa vale zero */
const PAGE_GAP = 28

const WIDTHS: Record<string, number> = {
  narrow: 620,
  regular: 760,
  wide: 920,
  full: 0,
}

/** Margini a video sui telefoni, per i documenti senza formato di carta */
const COMPACT_MARGINS: DocMargins = { top: 28, right: 20, bottom: 48, left: 20 }

export function DocEditor({
  fileId,
  textRef,
}: {
  fileId: string
  /** dove torna il cursore chiudendo una finestra o un menu: il testo */
  textRef?: React.RefObject<HTMLElement | null>
}) {
  const region = useRegion()
  const t = useT()
  // selettori stretti: salvare il contenuto non deve ridisegnare barra e
  // pannello, che dipendono solo dal titolo e dal tema
  const title = useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc" ? f.title : null
  })
  const theme = useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc" ? f.data.theme : null
  })
  const setDocTheme = useStore((s) => s.setDocTheme)
  // il foglio esiste solo quando il file è caricato: gli osservatori delle
  // misure si agganciano in quel momento
  const ready = theme !== null
  // «Modalità focus», «Modalità lettura» e «Lettura immersiva»: solo il foglio
  const [mode, setMode] = React.useState<DocMode>("normal")
  const [immersive, setImmersive] =
    React.useState<ImmersiveSettings>(DEFAULT_IMMERSIVE)
  // visualizzazione Struttura: fino a che livello di titolo si vede (0 = tutto)
  const [outlineLevel, setOutlineLevel] = React.useState(0)

  const appDark = useIsDark()
  // ≥ 1180 pannello in colonna · 640–1180 galleggia · < 640 telefono: foglio
  // adattato allo schermo, niente righelli, pannello dal basso
  const narrow = useNarrow(1180)
  const compact = useNarrow(639)
  const [outline, setOutline] = React.useState(false)
  // intestazione o piè di pagina che si sta scrivendo sul foglio
  const [band, setBand] = React.useState<BandEditing | null>(null)
  const [find, setFind] = React.useState<"find" | "replace" | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [available, setAvailable] = React.useState(0)
  const [sheetHeight, setSheetHeight] = React.useState(0)
  // stampa ed esportazioni disegnano il foglio automatico in chiaro
  const [forceLight, setForceLight] = React.useState(false)
  // la sezione Esporta fotografa il foglio come in stampa, anche da «Layout Web»
  const [printLayout, setPrintLayout] = React.useState(false)
  const setPrintMode = React.useCallback((on: boolean) => {
    setForceLight(on)
    setPrintLayout(on)
  }, [])
  const [studio, setStudio] = React.useState<{
    format: StudioFormat
    page: number
  } | null>(null)
  const dark = appDark && !forceLight
  const plainPaste = React.useRef(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // l'editor per i gestori di ProseMirror, che nascono prima di lui
  const editorRef = React.useRef<Editor | null>(null)
  const [initialContent] = React.useState(() => latestContent(fileId))
  // estensioni e proprietà nascono una volta sola. Ricrearle a ogni ridisegno
  // faceva chiamare a Tiptap `setOptions`, che aggiorna tutta la vista (e le
  // viste React dei nodi) anche solo aprendo un menu
  const [extensions] = React.useState(createDocExtensions)
  const [editorProps] = React.useState<EditorProps>(() => ({
    attributes: { class: "doc-prose focus:outline-none" },
    handleKeyDown: (_view, event) => {
      // ⇧⌘V: il prossimo incolla perde la formattazione
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        (event.key === "v" || event.key === "V")
      ) {
        plainPaste.current = true
        // vale per l'incolla che segue, non per quello di mezz'ora dopo
        window.setTimeout(() => {
          plainPaste.current = false
        }, 1000)
      }
      return false
    },
    handlePaste: (_view, event) => {
      const ed = editorRef.current
      if (!ed) return false
      if (plainPaste.current) {
        plainPaste.current = false
        event.preventDefault()
        insertPlainText(ed, event.clipboardData?.getData("text/plain") ?? "")
        return true
      }
      // elementi copiati da una board diventano un'anteprima incorporata
      const text = event.clipboardData?.getData("text/plain") ?? ""
      const clip = parseClip(text)
      if (clip) {
        event.preventDefault()
        ed.chain()
          .focus()
          .insertContent({
            type: "boardEmbed",
            attrs: {
              boardId: null,
              snapshot: JSON.stringify(clip),
              caption: clip.source
                ? t("Da “{source}”", { source: clip.source })
                : "",
              height: 320,
            },
          })
          .run()
        return true
      }
      // immagini dagli appunti
      const img = Array.from(event.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/")
      )
      if (img) {
        event.preventDefault()
        readImage(img, (src) => ed.chain().focus().setImage({ src }).run())
        return true
      }
      return false
    },
    handleDrop: (_view, event) => {
      const ed = editorRef.current
      const dt = (event as DragEvent).dataTransfer
      const img = Array.from(dt?.files ?? []).find((f) =>
        f.type.startsWith("image/")
      )
      if (!ed || !img) return false
      event.preventDefault()
      readImage(img, (src) => ed.chain().focus().setImage({ src }).run())
      return true
    },
  }))

  const editorCreated = React.useRef(false)
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: (initialContent as never) ?? "",
    editorProps,
    onCreate: ({ editor }) => {
      if (!editorCreated.current) {
        editorCreated.current = true
        return
      }
      // Tiptap distrugge l'editor quando la pagina viene nascosta (Cache
      // Components la tiene viva per tornarci al volo) e lo ricrea quando
      // torna visibile, con il contenuto dell'apertura: si rimette l'ultima
      // versione salvata, fuori dalla cronologia degli annullamenti
      replaceContentQuietly(editor, latestContent(fileId))
    },
    onUpdate: ({ editor }) => {
      // il nome del file segue il titolo scritto nel documento
      const title = docTitleText(editor.state.doc)
      const store = getWorkspace()
      const current = store.files.find((x) => x.id === fileId)
      if (title !== null && current && current.title !== title) {
        store.renameFile(fileId, title)
      }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        getWorkspace().setDocContent(fileId, editor.getJSON())
      }, 400)
    },
  })

  React.useEffect(() => {
    editorRef.current = editor
  })

  // il testo, per chi deve rimetterci il cursore: finestre, menu, riquadri
  React.useEffect(() => {
    if (!textRef) return
    textRef.current = editor && !editor.isDestroyed ? editor.view.dom : null
  })

  // commenti rimasti senza testo: si tolgono all'apertura
  React.useEffect(() => {
    if (editor) pruneComments(editor, fileId)
  }, [editor, fileId])

  // un documento appena creato è pronto per scrivere: il cursore aspetta
  // nella riga del titolo, come in Word. Prima le prime battute dopo «Nuovo
  // documento» andavano perse finché non si cliccava nel foglio. Una volta
  // sola: tornando alla pagina il fuoco resta dove lo si lascia
  const [brandNew] = React.useState(() => {
    const f = getWorkspace().files.find((x) => x.id === fileId)
    return f?.kind === "doc" && f.data.content == null
  })
  const focusedNew = React.useRef(false)
  React.useEffect(() => {
    if (!brandNew || focusedNew.current || !editor || editor.isDestroyed) return
    focusedNew.current = true
    editor.commands.focus("start")
  }, [brandNew, editor])

  // «Cronologia versioni»: il documento si fotografa da solo ogni tanto
  useAutoVersions(fileId)

  // controllo ortografico del browser, dalla scheda Revisione
  const spellcheck = theme?.spellcheck ?? true
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // l'attributo si mette sul DOM: ProseMirror non lo gestisce e non lo
    // toglie, e cambiare le opzioni ridisegnerebbe tutte le viste dei nodi
    editor.view.dom.setAttribute("spellcheck", spellcheck ? "true" : "false")
  }, [editor, spellcheck])
  const st = useDocState(editor)
  const painter = useFormatPainter(editor)
  const comments = useComments(editor, fileId)
  const ink = useInk(fileId)
  const merge = useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc" ? f.data.merge : undefined
  })
  const setMerge = React.useCallback(
    (next: MergeData | undefined) => getWorkspace().setDocMerge(fileId, next),
    [fileId]
  )
  // l'anteprima dei risultati mostra i valori del record scelto nei campi
  const previewRow =
    merge && merge.preview >= 0 ? (merge.rows[merge.preview] ?? null) : null
  const mergeHighlight = Boolean(merge?.highlight)
  // revisioni: rilevamento acceso (o imposto da «Limita modifica») e autore
  const author = useAuthor()
  const protection = theme?.protection ?? "none"
  const tracking = Boolean(theme?.trackChanges) || protection === "tracked"
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    setTrackSettings(editor, { enabled: tracking, author })
  }, [editor, tracking, author])
  // correzione automatica: le opzioni sono di chi scrive, la lingua del
  // documento (decide virgolette, ordinali e abbreviazioni)
  const autoCorrect = useAutoCorrect()
  const docLanguage = theme?.language || region
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    setAutoCorrectSettings(editor, { ...autoCorrect, language: docLanguage })
  }, [editor, autoCorrect, docLanguage])
  // sola lettura e «solo commenti»: il testo non si modifica
  const editable =
    protection !== "readonly" && protection !== "comments" && mode !== "reading"
  React.useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isEditable === editable) return
    editor.setEditable(editable, false)
  }, [editor, editable])
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    setMergeSettings(editor, { row: previewRow, highlight: mergeHighlight })
  }, [editor, previewRow, mergeHighlight])
  const sources = useDocSources(fileId)
  const citationStyle = theme?.citationStyle ?? "apa"
  const [sourcesDialog, setSourcesDialog] = React.useState<{
    id: string | null
    cite: boolean
  } | null>(null)
  const [styleDialog, setStyleDialog] =
    React.useState<StyleDialogRequest | null>(null)
  const [stylesPane, setStylesPaneOpen] = React.useState(false)
  // i riquadri attività (Thesaurus, componenti aggiuntivi) prendono la
  // colonna di destra al posto del pannello Stile, come in Word
  const [taskPane, setTaskPane] = React.useState<TaskPane | null>(null)
  const setStylesPane = (open: boolean) => {
    setStylesPaneOpen(open)
    if (open) setTaskPane(null)
  }
  const openTaskPane = (pane: TaskPane) => {
    setStylesPaneOpen(false)
    setTaskPane(pane)
  }
  // la colonna di destra c'è solo per i riquadri: le opzioni degli oggetti
  // stanno nella loro scheda della barra
  const paneOpen = stylesPane || taskPane !== null
  // Invio usa lo «stile successivo»: l'estensione lo chiede agli stili del
  // documento, che cambiano senza ricreare l'editor
  React.useEffect(() => {
    if (!editor || editor.isDestroyed || !theme) return
    setNextStyleResolver(editor, (id) => {
      const style = resolveStyle(theme, id)
      if (!style.next) return null
      return { next: style.next, kind: style.kind, level: style.level }
    })
  }, [editor, theme])
  React.useEffect(() => {
    if (mode === "normal") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        setMode("normal")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode])

  // i campi «numero di pagina» usano formato e inizio del documento
  const pageNumberFormat = theme?.pageNumberFormat ?? "arabic"
  const pageNumberStart = theme?.pageNumberStart ?? 1
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    setFieldSettings(editor, {
      pageFormat: pageNumberFormat,
      pageStart: pageNumberStart,
    })
  }, [editor, pageNumberFormat, pageNumberStart])
  // citazioni e bibliografia leggono fonti e stile dalla memoria dell'editor
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) {
      setCitationData(editor, sources, citationStyle)
    }
  }, [editor, sources, citationStyle])
  const dictation = useDictation(
    editor,
    (message) => toast.error(message),
    (message) => toast.info(message),
    theme?.language || region
  )

  // rinominare dalla barra in alto riscrive il titolo dentro al documento
  const fileTitle = title ?? ""
  React.useEffect(() => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || ed.isFocused) return
    const first = ed.state.doc.firstChild
    if (!first || first.type.name !== "docTitle") return
    if (first.textContent === fileTitle) return
    const tr = ed.state.tr
    tr.replaceWith(
      1,
      1 + first.content.size,
      fileTitle ? ed.schema.text(fileTitle) : []
    )
    tr.setMeta("addToHistory", false)
    tr.setMeta("preventUpdate", true)
    ed.view.dispatch(tr)
  }, [fileTitle])

  // salva subito quando si lascia la pagina o si chiude la scheda
  React.useEffect(() => {
    const save = () => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = null
      getWorkspace().setDocContent(fileId, ed.getJSON())
    }
    const flush = () => {
      save()
      flushWorkspace()
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      save()
    }
  }, [fileId])

  // in stampa il foglio automatico diventa chiaro, poi torna com'era
  React.useEffect(() => {
    const before = () => flushSync(() => setForceLight(true))
    const after = () => setForceLight(false)
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    return () => {
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
    }
  }, [])

  // larghezza utile per il righello: misurata fuori dalla zona ingrandita,
  // così il valore resta in pixel CSS reali
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setAvailable(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  // il righello di fianco è alto quanto il foglio: offsetHeight ignora lo zoom
  React.useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const update = () => setSheetHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  const setTheme = React.useCallback(
    (patch: Partial<DocTheme>) => setDocTheme(fileId, patch),
    [fileId, setDocTheme]
  )

  const setMargin = React.useCallback(
    (side: MarginSide, value: number) => {
      const current = getWorkspace().files.find((x) => x.id === fileId)
      if (!current || current.kind !== "doc") return
      setDocTheme(fileId, {
        margins: { ...current.data.theme.margins, [side]: value },
      })
    },
    [fileId, setDocTheme]
  )

  // «Layout Web», «Struttura», «Bozza» e le modalità di lettura mostrano il
  // testo senza pagine: il tema salvato (stampa ed esportazioni) non cambia
  const view = theme?.view ?? "print"
  const flowing =
    !printLayout &&
    (view !== "print" || mode === "reading" || mode === "immersive")
  const screenTheme: DocTheme | null =
    theme && flowing
      ? {
          ...theme,
          format: "screen",
          width: view === "web" ? "full" : theme.width,
          header: "",
          footer: "",
          pageNumbers: "none",
          pageBorder: "none",
          watermark: view === "web" ? theme.watermark : null,
        }
      : theme

  // le pagine vere: formato di carta e una colonna sola (con più colonne il
  // testo scorre fra le colonne e le pagine si vedono solo come guide)
  const exact = screenTheme ? pageSizeExact(screenTheme) : null
  const paginated = Boolean(exact) && screenTheme?.columns === 1
  const layoutHeight = paginated && exact ? exact.h : 0
  const layoutTop = theme?.margins.top ?? 0
  const layoutBottom = theme?.margins.bottom ?? 0
  React.useEffect(() => {
    if (!editor) return
    // fuori dal ciclo di React: la transazione aggiorna viste dei nodi che a
    // loro volta chiedono a React di disegnare subito
    queueMicrotask(() => {
      if (editor.isDestroyed) return
      editor.commands.setPageLayout({
        pageHeight: layoutHeight,
        marginTop: layoutTop,
        marginBottom: layoutBottom,
      })
    })
  }, [editor, layoutHeight, layoutTop, layoutBottom])
  const pagination = usePagination(editor)

  // segni di formattazione (¶): decorazioni dell'editor, accese dal tema
  const marksVisible = Boolean(theme?.marks)
  React.useEffect(() => {
    if (!editor) return
    queueMicrotask(() => {
      if (!editor.isDestroyed) editor.commands.setFormattingMarks(marksVisible)
    })
  }, [editor, marksVisible])

  const zoom = theme?.zoom ?? 1
  const setZoom = React.useCallback(
    (value: number) => setDocTheme(fileId, { zoom: clampZoom(value) }),
    [fileId, setDocTheme]
  )

  // nuovo commento: mostra la colonna se era nascosta. Sta in un ref perché
  // lo usano la scorciatoia globale e la barretta sul testo
  const newComment = React.useRef(() => {})
  const showComments = theme?.comments ?? true
  React.useEffect(() => {
    newComment.current = () => {
      if (!showComments) setTheme({ comments: true })
      comments.add()
    }
  })

  // Maiusc+F7 apre il Thesaurus sulla parola del cursore
  const openThesaurus = React.useRef(() => {})
  React.useEffect(() => {
    openThesaurus.current = () => {
      if (!editor) return
      setStylesPaneOpen(false)
      setTaskPane({
        kind: "thesaurus",
        word: wordAtSelection(editor)?.text ?? "",
        nonce: Date.now(),
      })
    }
  })

  // scorciatoie di Word: ⌘F per cercare, ⌘+ / ⌘- / ⌘0 per lo zoom
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F7" && e.shiftKey) {
        e.preventDefault()
        openThesaurus.current()
        return
      }
      if (!(e.metaKey || e.ctrlKey)) return
      // ⌥⌘M: nuovo commento, come in Word (con ⌥ il tasto cambia lettera)
      if (e.altKey && e.code === "KeyM") {
        e.preventDefault()
        newComment.current()
        return
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        setFind("find")
        return
      }
      // Ctrl+H apre Sostituisci, come in Word per Windows. Non sul Mac, dove
      // ⌃H cancella il carattere prima del cursore; ⇧Ctrl+H è Evidenzia
      if (
        e.code === "KeyH" &&
        e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !/Mac|iP(hone|ad|od)/.test(navigator.platform)
      ) {
        e.preventDefault()
        setFind("replace")
        return
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        setZoom(zoom + 0.1)
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        setZoom(zoom - 0.1)
      } else if (e.key === "0") {
        e.preventDefault()
        setZoom(1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [zoom, setZoom])

  // ctrl + rotellina ingrandisce il foglio invece della pagina
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(zoom - e.deltaY * 0.002)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom, setZoom, ready])

  const insertBoard = (boardId: string) => {
    const f = getWorkspace().files.find((x) => x.id === boardId)
    if (!editor) return
    // da un titolo l'inserimento scivola al blocco successivo
    atBody(editor)
      .insertContent({
        type: "boardEmbed",
        attrs: {
          boardId,
          snapshot: null,
          caption: f?.title ?? "",
          height: 320,
        },
      })
      .run()
  }

  const openStudio = (format: StudioFormat) => {
    if (!theme || title === null) return
    setBand(null)
    if (mode !== "normal") setMode("normal")
    setStudio({
      format,
      page: visiblePage(
        sheetRef.current,
        scrollRef.current,
        paginated ? pagination.pages : 1
      ),
    })
  }

  const doExport = (format: DocExportFormat, filename?: string) => {
    if (!theme || title === null) return
    return runDocExport({
      format,
      title,
      filename,
      theme,
      sheet: sheetRef.current,
      setBusy,
      setForceLight,
    })
  }

  const exportFile = (
    format: "docx" | "md",
    options: { filename?: string; comments?: boolean } = {}
  ) => {
    if (!editor || !theme || title === null) return
    return runFileExport({
      format,
      editor,
      fileId,
      title,
      theme,
      setBusy,
      setForceLight,
      ...options,
    })
  }

  // i comandi del documento nella palette (⌘K); si leggono solo quando si apre
  useCommandSource("doc", () => {
    if (!editor) return []
    const current = getWorkspace().files.find((f) => f.id === fileId)
    const docTheme = current?.kind === "doc" ? current.data.theme : null
    const body = () => atBody(editor, st)
    const group = t("Documento")
    const insert = t("Inserisci")
    const view = t("Visualizza")
    const exportGroup = t("Esporta")
    return [
      {
        id: "doc.find",
        group,
        label: t("Trova"),
        shortcut: "⌘F",
        icon: <Search />,
        run: () => setFind("find"),
      },
      {
        id: "doc.replace",
        group,
        label: t("Trova e sostituisci"),
        icon: <Replace />,
        keywords: [t("cambia")],
        run: () => setFind("replace"),
      },
      {
        id: "doc.comment",
        group,
        label: t("Nuovo commento"),
        icon: <MessageSquarePlus />,
        keywords: [t("revisione"), t("nota")],
        run: () => comments.add(),
      },
      {
        id: "doc.sources",
        group,
        label: t("Gestisci fonti"),
        icon: <BookMarked />,
        keywords: [t("bibliografia"), t("citazione")],
        run: () => setSourcesDialog({ id: null, cite: false }),
      },
      {
        id: "doc.versions",
        group,
        label: t("Cronologia versioni"),
        icon: <History />,
        keywords: [t("versione"), t("ripristina"), t("salvataggio")],
        run: () => openTaskPane({ kind: "versions" }),
      },
      {
        id: "doc.undo",
        group,
        label: t("Annulla||annulla l'ultima modifica"),
        shortcut: "⌘Z",
        icon: <Undo2 />,
        run: () => editor.chain().focus().undo().run(),
      },
      {
        id: "doc.redo",
        group,
        label: t("Ripristina"),
        shortcut: "⇧⌘Z",
        icon: <Redo2 />,
        run: () => editor.chain().focus().redo().run(),
      },
      {
        id: "doc.insert.table",
        group: insert,
        label: t("Tabella 3 × 3"),
        icon: <Table />,
        run: () =>
          body().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: "doc.insert.image",
        group: insert,
        label: t("Immagine dal computer…"),
        icon: <ImageIcon />,
        run: () => fileInput.current?.click(),
      },
      {
        id: "doc.insert.chart",
        group: insert,
        label: t("Grafico a colonne"),
        icon: <ChartColumn />,
        keywords: [t("istogramma"), t("dati")],
        run: () => body().insertChart("column").run(),
      },
      {
        id: "doc.insert.math",
        group: insert,
        label: t("Equazione"),
        icon: <Sigma />,
        keywords: [t("formula"), t("latex"), t("matematica")],
        run: () => body().insertMath("", true).run(),
      },
      {
        id: "doc.insert.footnote",
        group: insert,
        label: t("Nota a piè di pagina"),
        shortcut: "⌥⌘F",
        icon: <Superscript />,
        run: () => editor.chain().focus().insertFootnote("", "footnote").run(),
      },
      {
        id: "doc.insert.toc",
        group: insert,
        label: t("Sommario"),
        icon: <ListTree />,
        keywords: [t("indice")],
        run: () => body().insertContent({ type: "toc" }).run(),
      },
      {
        id: "doc.insert.pagebreak",
        group: insert,
        label: t("Interruzione di pagina"),
        icon: <SeparatorHorizontal />,
        run: () => body().setPageBreak().run(),
      },
      {
        id: "doc.insert.rule",
        group: insert,
        label: t("Linea orizzontale"),
        icon: <Minus />,
        run: () => body().setHorizontalRule().run(),
      },
      {
        id: "doc.view.ruler",
        group: view,
        label: docTheme?.ruler
          ? t("Nascondi il righello")
          : t("Mostra il righello"),
        icon: <Ruler2 />,
        run: () => setTheme({ ruler: !docTheme?.ruler }),
      },
      {
        id: "doc.view.grid",
        group: view,
        label: docTheme?.grid
          ? t("Nascondi la griglia")
          : t("Mostra la griglia"),
        icon: <Grid3x3 />,
        run: () => setTheme({ grid: !docTheme?.grid }),
      },
      {
        id: "doc.view.marks",
        group: view,
        label: docTheme?.marks
          ? t("Nascondi i segni di formattazione")
          : t("Mostra i segni di formattazione"),
        icon: <Pilcrow />,
        run: () => setTheme({ marks: !docTheme?.marks }),
      },
      {
        id: "doc.view.outline",
        group: view,
        label: outline
          ? t("Chiudi il riquadro di spostamento")
          : t("Riquadro di spostamento"),
        icon: <ListTree />,
        keywords: [t("struttura"), t("titoli")],
        run: () => setOutline(!outline),
      },
      {
        id: "doc.view.zoom100",
        group: view,
        label: t("Zoom al 100%"),
        shortcut: "⌘0",
        icon: <ZoomIn />,
        run: () => setZoom(1),
      },
      {
        id: "doc.export.pdf",
        group: exportGroup,
        label: t("Esporta in PDF"),
        icon: <FileText />,
        run: () => openStudio("pdf"),
      },
      {
        id: "doc.export.docx",
        group: exportGroup,
        label: t("Esporta in Word (.docx)"),
        icon: <FileType2 />,
        keywords: [t("word"), t("office")],
        run: () => openStudio("docx"),
      },
      {
        id: "doc.export.md",
        group: exportGroup,
        label: t("Esporta in Markdown (.md)"),
        icon: <FileCode2 />,
        run: () => openStudio("md"),
      },
      {
        id: "doc.export.png",
        group: exportGroup,
        label: t("Esporta in PNG"),
        icon: <FileImage />,
        run: () => openStudio("png"),
      },
      {
        id: "doc.export.svg",
        group: exportGroup,
        label: t("Esporta in SVG"),
        icon: <FileImage />,
        run: () => openStudio("svg"),
      },
      {
        id: "doc.print",
        group: exportGroup,
        label: t("Stampa…"),
        shortcut: "⌘P",
        icon: <Printer />,
        run: () => void doExport("print"),
      },
    ]
  })

  if (!theme) return null
  const accent = docAccent(theme.accent)
  const immersivePaper =
    mode === "immersive" ? IMMERSIVE_PAPERS[immersive.paper] : null
  const paper = immersivePaper ?? resolveColor(theme.paper, dark, AUTO_PAPER)
  const background = resolveColor(theme.background, appDark, AUTO_DOC_BG)
  const paperDark = isDarkColor(paper)
  const sheetShadow = `0 1px 2px ${rgba(whim.base[900], 0.06)}, 0 12px 32px -12px ${rgba(whim.base[900], 0.12)}`
  const viewTheme: DocTheme = screenTheme ?? theme
  const page = pageSizePx(viewTheme)
  // sul telefono un documento senza formato di carta segue lo schermo, con
  // margini stretti (solo a video: il tema salvato non cambia); uno con la
  // carta si rimpicciolisce finché il foglio ci sta
  const fluid = compact && !page
  const layout: DocTheme = fluid
    ? { ...viewTheme, margins: COMPACT_MARGINS }
    : viewTheme
  const sheetWidth =
    mode === "immersive"
      ? IMMERSIVE_WIDTHS[immersive.width]
      : mode === "reading"
        ? WIDTHS.regular
        : page
          ? page.w
          : fluid
            ? 0
            : WIDTHS[viewTheme.width] || 0
  const showRuler = theme.ruler && !compact && mode === "normal"
  const mm = PAGE_FORMATS[theme.format].mm
  const pageCss = mm
    ? `@page { size: ${theme.orientation === "landscape" ? `${mm[1]}mm ${mm[0]}mm` : `${mm[0]}mm ${mm[1]}mm`}; margin: 0; }`
    : "@page { margin: 12mm; }"

  // spazio davvero libero: il pannello galleggiante è padding, non larghezza
  const usable = Math.max(
    0,
    available - (narrow && !compact && paneOpen ? 280 : 0)
  )
  // margine intorno al foglio (px-4 o px-2) e colonne accanto: righello
  // verticale e commenti. Prima a larghezza piena non si contavano, e il
  // foglio sforava in orizzontale
  const gutter = compact ? 16 : 32
  const commentsBeside = theme.comments && !compact && comments.list.length > 0
  const sideSpace =
    (showRuler ? RULER_SIZE + 8 : 0) + (commentsBeside ? 256 : 0)
  // sul telefono lo zoom al 100% vuol dire «adatta alla larghezza»
  const fitScale =
    compact && sheetWidth
      ? Math.min(1, Math.max(0.2, (usable - gutter) / sheetWidth))
      : 1
  // la modalità lettura ingrandisce il testo, come in Word
  const scale = zoom * fitScale * (mode === "reading" ? 1.15 : 1)
  // il righello segue il foglio; a larghezza piena si misura lo spazio
  const rulerWidth =
    sheetWidth || Math.max(0, usable / scale - gutter - sideSpace)
  const contentWidth = Math.max(
    120,
    (sheetWidth || rulerWidth) - layout.margins.left - layout.margins.right
  )

  const ctx: RibbonCtx | null = editor
    ? {
        editor,
        st,
        theme,
        setTheme,
        onFind: setFind,
        onInsertBoard: insertBoard,
        pickImage: () => fileInput.current?.click(),
        outline,
        setOutline,
        zoom,
        setZoom,
        fitWidth: () => {
          if (compact) return setZoom(1)
          const w = sheetWidth || rulerWidth
          if (w && usable) setZoom((usable - 40 - RULER_SIZE) / w)
        },
        fitPage: (count = 1) => {
          const el = scrollRef.current
          if (!page || !el) return
          // «Più pagine»: l'altezza di tutte, stacchi compresi
          const height = page.h * count + PAGE_GAP * (count - 1)
          if (compact) {
            return setZoom(
              Math.min(1, (el.clientHeight - 32) / (height * fitScale))
            )
          }
          setZoom(
            Math.min(
              (usable - 40 - RULER_SIZE) / page.w,
              (el.clientHeight - 80) / height
            )
          )
        },
        painter,
        dictation,
        comments,
        pages: paginated ? pagination.pages : 1,
        // la scheda dell'oggetto appena inserito, come in Word
        openPanel: () => openRibbonTab("format"),
        pageHeight: paginated && exact ? exact.h : 0,
        editBand: (where) => {
          if (!paginated) return false
          if (mode !== "normal") setMode("normal")
          setBand({
            where,
            part: 0,
            page: visiblePage(
              sheetRef.current,
              scrollRef.current,
              pagination.pages
            ),
          })
          return true
        },
        sources,
        openSources: (id = null, cite = false) =>
          setSourcesDialog({ id, cite }),
        openStyleDialog: setStyleDialog,
        stylesPane,
        setStylesPane,
        taskPane,
        openTaskPane,
        closeTaskPane: () => setTaskPane(null),
        ink,
        fileId,
        mode,
        setMode,
        outlineLevel,
        setOutlineLevel,
        title: title ?? "",
        merge,
        setMerge,
      }
    : null

  const inspector =
    taskPane && editor && !stylesPane ? (
      <TaskPaneHost
        key={
          taskPane.kind === "thesaurus"
            ? taskPane.nonce
            : taskPane.kind === "versions"
              ? "versions"
              : taskPane.id
        }
        pane={taskPane}
        editor={editor}
        theme={theme}
        fileId={fileId}
        onClose={() => setTaskPane(null)}
      />
    ) : stylesPane && editor ? (
      <StylesPane
        tools={{
          editor,
          theme,
          setTheme,
          current: st.styleId,
          openDialog: setStyleDialog,
        }}
        onClose={() => setStylesPaneOpen(false)}
      />
    ) : null
  const sidePanel = paneOpen

  return (
    <div className="flex h-dvh flex-col bg-muted">
      <style
        // le regole di stampa valgono solo mentre il documento è visibile: una
        // pagina nascosta (Cache Components la tiene montata) nasconderebbe
        // in stampa tutto il resto, board comprese
        ref={(el) => {
          if (!el) return
          el.media = "all"
          return () => {
            el.media = "not all"
          }
        }}
      >{`${pageCss}
@media print {
  #doc-sheet { box-shadow: none !important; border-radius: 0 !important; }
  #doc-sheet, #doc-sheet * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body *:not(:has(#doc-sheet)):not(#doc-sheet):not(#doc-sheet *) { display: none !important; }
  body *:has(#doc-sheet) { display: block !important; position: static !important; overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; width: auto !important; padding: 0 !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; background: transparent !important; zoom: 1 !important; transform: none !important; }
  #doc-sheet { position: relative !important; margin: 0 !important; --page-gap: 0px !important; }
  #doc-sheet.doc-paginated { height: calc(var(--pages) * var(--page-h) - 1px) !important; min-height: 0 !important; overflow: hidden !important; }
  #doc-sheet:not(.doc-paginated) { width: 100% !important; }
  #doc-sheet:not(.doc-paginated) .doc-page-break { break-after: page; }
  [data-guide] { display: none !important; }
}`}</style>

      <style>{stylesCss(theme, `[data-doc-styles="${fileId}"]`)}</style>

      <CommentHighlights ctl={comments} />

      {studio && editor && title !== null ? (
        <ExportStudio
          initialFormat={studio.format}
          onClose={() => setStudio(null)}
          source={{
            kind: "doc",
            title,
            language: theme.language || region,
            currentPage: studio.page,
            paperFormat: PAGE_FORMATS[theme.format].mm ? theme.format : null,
            orientation: theme.orientation,
            hasComments: comments.list.length > 0,
            snapshot: () =>
              takeDocSnapshot({
                sheet: sheetRef.current,
                theme,
                setPrintMode,
              }),
            markdown: () => markdownOf(editor, fileId, theme),
            exportDocx: async (filename, withComments) => {
              await exportFile("docx", { filename, comments: withComments })
            },
            exportSvg: async (filename) => {
              await doExport("svg", filename)
            },
            print: () => void doExport("print"),
          }}
        />
      ) : null}

      {mode === "normal" ? (
        <>
          <TopBar
            fileId={fileId}
            right={
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title={t("Esporta")}
                  aria-label={t("Esporta")}
                  disabled={busy}
                  onClick={() => openStudio("pdf")}
                >
                  <Download className="size-4" />
                </Button>

                <ThemeToggle className="hidden sm:flex" />
              </>
            }
          />

          <Ribbon ctx={ctx} />
        </>
      ) : (
        <ModeBar
          mode={mode}
          onExit={() => setMode("normal")}
          immersive={immersive}
          setImmersive={setImmersive}
        />
      )}
      {mode === "immersive" ? (
        <LineFocus editor={editor} lines={immersive.lineFocus} />
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f || !editor) return
          readImage(f, (src) => atBody(editor).setImage({ src }).run())
        }}
      />

      {find ? (
        <FindBar editor={editor} mode={find} onClose={() => setFind(null)} />
      ) : null}
      <ReadAloudBar />
      <ResumeReading editor={editor} fileId={fileId} />

      <div className="relative flex min-h-0 flex-1">
        {outline && mode === "normal" ? (
          <aside
            className={cn(
              "w-[228px] shrink-0 border-r border-border bg-card",
              // si ferma sopra la barra di stato: lo zoom deve restare a vista
              narrow && "absolute top-0 bottom-7 left-0 z-20 shadow-xl"
            )}
          >
            <DocOutline editor={editor} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col" style={{ background }}>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto"
            // il pannello galleggiante non deve coprire il bordo del foglio
            style={{
              paddingRight: narrow && !compact && paneOpen ? 280 : undefined,
            }}
          >
            <div
              id="doc-zoom"
              className={cn(
                "mx-auto",
                compact ? "my-3 px-2" : "my-8 px-4",
                // a larghezza fissa il blocco si stringe sul foglio e si
                // centra; a larghezza piena prende tutto lo spazio
                sheetWidth ? "w-fit" : "w-full"
              )}
              style={
                {
                  zoom: scale,
                  // il righello vive fuori dal foglio: gli servono i suoi colori
                  "--doc-accent": accent.solid,
                  "--doc-muted": whim.base[500],
                  "--doc-border": rgba(whim.base[500], 0.35),
                  "--doc-ruler-on": paper,
                  "--doc-ruler-off": rgba(whim.base[500], 0.22),
                } as React.CSSProperties
              }
            >
              {showRuler ? (
                <div
                  className="mb-2 flex gap-2"
                  style={{ paddingLeft: RULER_SIZE + 8 }}
                >
                  <Ruler
                    axis="horizontal"
                    length={rulerWidth}
                    start={theme.margins.left}
                    end={theme.margins.right}
                    onMargin={setMargin}
                  />
                </div>
              ) : null}

              <div className={cn("flex gap-2", compact && "flex-col gap-3")}>
                {showRuler ? (
                  <Ruler
                    axis="vertical"
                    length={sheetHeight}
                    start={theme.margins.top}
                    end={theme.margins.bottom}
                    onMargin={setMargin}
                  />
                ) : null}
                <ForceLightContext.Provider value={forceLight}>
                  <DocPageContext.Provider
                    value={paginated && exact ? exact.h : 0}
                  >
                    <PaperDarkContext.Provider value={paperDark}>
                      <DocContentWidthContext.Provider value={contentWidth}>
                        <div
                          id="doc-sheet"
                          data-doc-styles={fileId}
                          lang={theme.language || region}
                          data-outline-level={
                            view === "outline" && outlineLevel
                              ? outlineLevel
                              : undefined
                          }
                          ref={sheetRef}
                          className={cn(
                            "doc-sheet relative isolate",
                            theme.marks && "doc-marks",
                            band && "doc-band-editing",
                            !theme.comments && "doc-comments-hidden",
                            paginated && "doc-paginated",
                            theme.hyphenation && "doc-hyphens",
                            view !== "print" && `doc-view-${view}`,
                            mode === "immersive" &&
                              immersive.spacing &&
                              "doc-imm-spacing",
                            `doc-markup-${theme.markup ?? "all"}`
                          )}
                          onContextMenu={(e) => {
                            // le finestre degli oggetti (grafici, formule…)
                            // vivono in un portale ma i loro eventi risalgono
                            // fin qui: nei loro campi resta il menu del browser
                            if (!e.currentTarget.contains(e.target as Node))
                              return
                            e.preventDefault()
                            setMenu({ x: e.clientX, y: e.clientY })
                          }}
                          onMouseDownCapture={(e) => {
                            if (e.altKey && editor) selectBehind(editor, e)
                            // un clic nel testo chiude intestazione e piè di
                            // pagina, come in Word
                            const target = e.target as HTMLElement
                            if (
                              band &&
                              editor?.view.dom.contains(target) &&
                              !target.closest("[data-page-gap]")
                            ) {
                              setBand(null)
                            }
                          }}
                          onDoubleClick={(e) => {
                            // doppio clic nel margine alto o basso di una
                            // pagina: si scrive l'intestazione o il piè
                            if (!editor?.isEditable || !paginated || !exact)
                              return
                            const target = e.target as HTMLElement
                            if (
                              target.closest(
                                "[data-band-editor], .doc-page-notes, button, input, textarea"
                              ) ||
                              (editor.view.dom.contains(target) &&
                                !target.closest("[data-page-gap]"))
                            ) {
                              return
                            }
                            const el = e.currentTarget
                            const box = el.getBoundingClientRect()
                            const scale = box.width / (el.offsetWidth || 1) || 1
                            const hit = bandAt(
                              (e.clientX - box.left) / scale,
                              (e.clientY - box.top) / scale,
                              el.offsetWidth,
                              exact.h,
                              forceLight ? 0 : PAGE_GAP,
                              theme.margins
                            )
                            if (!hit) return
                            e.preventDefault()
                            setBand(hit)
                          }}
                          style={
                            {
                              // con le pagine vere il foglio è trasparente: la carta
                              // la disegnano i singoli fogli, e fra uno e l'altro si
                              // vede la scrivania
                              background: paginated ? "transparent" : paper,
                              borderRadius: theme.cornerRadius,
                              fontFamily: fontStack(theme.font),
                              fontSize: theme.fontSize,
                              color: paperDark ? "#ffffff" : whim.base[800],
                              padding: `${layout.margins.top}px ${layout.margins.right}px ${layout.margins.bottom}px ${layout.margins.left}px`,
                              columnCount:
                                theme.columns > 1 ? theme.columns : undefined,
                              columnGap:
                                theme.columns > 1 ? "2.2em" : undefined,
                              minHeight:
                                paginated && exact
                                  ? `calc(${pagination.pages} * ${exact.h}px + ${pagination.pages - 1} * var(--page-gap))`
                                  : page
                                    ? page.h
                                    : undefined,
                              width: sheetWidth
                                ? sheetWidth
                                : rulerWidth || "100%",
                              marginInline: "auto",
                              // niente transizione: la stampa catturerebbe il foglio
                              // a metà fra scuro e chiaro
                              transition: forceLight ? "none" : undefined,
                              boxShadow:
                                forceLight || paginated ? "none" : sheetShadow,
                              "--page-gap": forceLight
                                ? "0px"
                                : `${PAGE_GAP}px`,
                              "--page-h": exact ? `${exact.h}px` : undefined,
                              "--pages": pagination.pages,
                              "--doc-desk": background,
                              "--doc-paper": paper,
                              "--doc-content-w": `${contentWidth}px`,
                              "--doc-accent": accent.solid,
                              "--doc-accent-soft": paperDark
                                ? rgba(accent.solid, 0.24)
                                : accent.fill,
                              "--doc-radius": `${theme.cornerRadius}px`,
                              "--doc-muted": paperDark
                                ? rgba("#ffffff", 0.55)
                                : whim.base[600],
                              "--doc-border": paperDark
                                ? rgba("#ffffff", 0.16)
                                : whim.base[200],
                            } as React.CSSProperties
                          }
                        >
                          {paginated && exact ? (
                            <PageLayer
                              editor={editor}
                              theme={theme}
                              title={title ?? ""}
                              pageHeight={exact.h}
                              pages={pagination.pages}
                              paper={paper}
                              shadow={forceLight ? "none" : sheetShadow}
                              band={band}
                              onBandChange={(where, text) =>
                                setTheme({ [where]: text })
                              }
                              onBandClose={() => {
                                setBand(null)
                                editor?.commands.focus()
                              }}
                            />
                          ) : (
                            <>
                              {page ? <PageGuides pageHeight={page.h} /> : null}
                              <PageDecor
                                theme={layout}
                                title={title ?? ""}
                                pageHeight={page?.h ?? 0}
                                sheetHeight={sheetHeight}
                              />
                            </>
                          )}
                          {theme.grid ? <GridOverlay /> : null}
                          <LineNumbers
                            editor={editor}
                            mode={theme.lineNumbers}
                            marginLeft={layout.margins.left}
                          />
                          <EditorContent editor={editor} />
                          <InkLayer
                            ink={ink}
                            visible={theme.inkVisible ?? true}
                            paperDark={paperDark}
                          />
                          <BlockHandle editor={editor} sheet={sheetRef} />
                          {/* tippy sposta la barretta fuori da qui: senza un involucro
                      fisso, aggiungere un fratello prima di lei fa fallire
                      l'inserimento nel DOM e la pagina si pianta */}
                          <div className="contents">
                            <DocBubbleMenu
                              editor={editor}
                              st={st}
                              onComment={() => newComment.current()}
                            />
                          </div>
                        </div>
                      </DocContentWidthContext.Provider>
                    </PaperDarkContext.Provider>
                  </DocPageContext.Provider>
                </ForceLightContext.Provider>
                {theme.comments ? (
                  <CommentsColumn
                    editor={editor}
                    ctl={comments}
                    sheet={sheetRef}
                    stacked={compact}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div
            hidden={mode !== "normal"}
            className="flex h-[calc(1.75rem+env(safe-area-inset-bottom))] shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-card safe-x pb-[env(safe-area-inset-bottom)] text-[11px] whitespace-nowrap text-muted-foreground"
          >
            <PageIndicator
              editor={editor}
              sheet={sheetRef}
              step={paginated && exact ? exact.h + PAGE_GAP : (page?.h ?? 0)}
              total={
                paginated
                  ? pagination.pages
                  : page
                    ? Math.max(1, Math.ceil(sheetHeight / page.h))
                    : 1
              }
            />
            <DocCounts editor={editor} />
            {dictation.listening ? (
              <span
                className="flex min-w-0 items-center gap-1.5 text-rose-500"
                title={
                  dictation.local
                    ? t("Riconoscimento sul dispositivo, senza internet")
                    : t("Riconoscimento vocale del browser")
                }
              >
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
                <span className="shrink-0">{t("In ascolto")}</span>
                {dictation.interim ? (
                  <span className="truncate text-muted-foreground italic">
                    «{dictation.interim}»
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="hidden whitespace-nowrap md:inline">
              {PROOFING_LANGUAGES.find((l) => l.code === theme.language)
                ?.label ?? theme.language}
            </span>
            <span className="ml-auto hidden whitespace-nowrap lg:inline">
              {page
                ? `${PAGE_FORMATS[theme.format].label} · ${
                    theme.orientation === "landscape"
                      ? t("orizzontale")
                      : t("verticale")
                  }`
                : t("Formato libero")}
            </span>
            <ZoomControl
              zoom={zoom}
              compact={compact}
              onZoom={setZoom}
              onFit={() => ctx?.fitWidth()}
            />
          </div>
        </div>

        {mode !== "normal" ? null : compact ? (
          sidePanel ? (
            <aside
              aria-label={stylesPane ? t("Stili") : t("Riquadro attività")}
              className="fixed inset-x-0 bottom-0 z-40 flex h-[min(70dvh,560px)] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]"
            >
              <div className="min-h-0 flex-1">{inspector}</div>
            </aside>
          ) : null
        ) : (
          <aside
            className={cn(
              "shrink-0 border-l border-border bg-card",
              narrow
                ? sidePanel
                  ? "absolute top-0 right-0 bottom-7 z-20 w-[280px] shadow-xl"
                  : "hidden"
                : cn(
                    "transition-[width] duration-200",
                    sidePanel ? "w-[280px]" : "w-0 overflow-hidden"
                  )
            )}
          >
            {sidePanel ? inspector : null}
          </aside>
        )}
      </div>

      <StyleDialog
        request={styleDialog}
        onClose={() => setStyleDialog(null)}
        editor={editor}
        theme={theme}
        setTheme={setTheme}
        onCreated={(id, next) => {
          if (!editor) return
          applyDocStyle(editor, next, id)
          // lo stile nuovo contiene già la formattazione della selezione
          dropDirectFormatting(editor, next.styles?.[id] ?? {})
        }}
      />

      <SourcesDialog
        open={sourcesDialog !== null}
        onOpenChange={(open) => !open && setSourcesDialog(null)}
        fileId={fileId}
        style={theme.citationStyle}
        initialId={sourcesDialog?.id}
        onCite={
          sourcesDialog?.cite && editor
            ? (id) => editor.chain().focus().insertCitation(id).run()
            : undefined
        }
      />

      <DocContextMenu
        editor={editor}
        point={menu}
        onClose={() => setMenu(null)}
        onInsertBoard={insertBoard}
        onComment={() => newComment.current()}
        language={theme?.language || region}
        onThesaurus={(word) =>
          openTaskPane({ kind: "thesaurus", word, nonce: Date.now() })
        }
      />
    </div>
  )
}

/** Il contenuto salvato di un documento, con il titolo come primo nodo */
function latestContent(fileId: string) {
  const f = getWorkspace().files.find((x) => x.id === fileId)
  const content = f && f.kind === "doc" ? f.data.content : null
  // un file salvato da un'altra versione (o scritto a mano) può avere pezzi
  // che lo schema non conosce: si tiene tutto il resto
  const doc = withDocTitle(repairDocContent(content), f?.title ?? "")
  // Il nome del file comanda: rinominato dalla home il documento teneva il
  // titolo vecchio nella prima riga, e alla prima battuta (o già
  // all'apertura) il file tornava a chiamarsi come prima. Come quando si
  // rinomina dalla barra in alto a documento aperto, il titolo si allinea
  const name = f?.title ?? ""
  const blocks = (doc as JSONContent).content ?? []
  const first = blocks[0]
  if (
    name.trim() &&
    first?.type === "docTitle" &&
    (first.content ?? []).map((n) => n.text ?? "").join("") !== name
  ) {
    return {
      ...doc,
      content: [
        { ...first, content: [{ type: "text", text: name }] },
        ...blocks.slice(1),
      ],
    }
  }
  return doc
}

/**
 * Sostituisce tutto il documento senza lasciare traccia: niente passo nella
 * cronologia (annullare non deve riportare il testo vecchio) e niente
 * `update`, che lo risalverebbe.
 */
function replaceContentQuietly(editor: Editor, json: unknown) {
  if (editor.isDestroyed) return
  try {
    const next = editor.schema.nodeFromJSON(json)
    if (next.eq(editor.state.doc)) return
    const tr = editor.state.tr
      .replaceWith(0, editor.state.doc.content.size, next.content)
      .setMeta("addToHistory", false)
      .setMeta("preventUpdate", true)
    editor.view.dispatch(tr)
  } catch (err) {
    console.warn("Contenuto del documento non ripristinato", err)
  }
}

/**
 * Le esportazioni stanno fuori dal componente: il React Compiler non gestisce
 * ancora `try … finally` né `import()`, e trovarli dentro all'editor gli
 * faceva saltare l'ottimizzazione di tutto il documento.
 */
async function runDocExport({
  format,
  title,
  filename,
  theme,
  sheet,
  setBusy,
  setForceLight,
}: {
  format: DocExportFormat
  title: string
  filename?: string
  theme: DocTheme
  sheet: HTMLElement | null
  setBusy: (busy: boolean) => void
  setForceLight: (light: boolean) => void
}) {
  setBusy(true)
  const id =
    format === "print"
      ? undefined
      : toast.loading(
          tr("Esporto in {format}…", { format: format.toUpperCase() })
        )
  // come in stampa: il foglio automatico si esporta chiaro
  flushSync(() => setForceLight(true))
  try {
    await new Promise((r) => setTimeout(r, 60))
    await exportDoc({
      title,
      filename,
      theme,
      format,
      sheet,
      paper: resolveColor(theme.paper, false, AUTO_PAPER),
    })
    if (id) {
      toast.success(
        tr("Esportato in {format}", { format: format.toUpperCase() }),
        { id }
      )
    }
  } catch (err) {
    console.error(err)
    toast.error(tr("Esportazione non riuscita"), {
      id,
      description: err instanceof Error ? err.message : undefined,
    })
  } finally {
    setForceLight(false)
    setBusy(false)
  }
}

/** Word e Markdown: si costruiscono dal contenuto, non dall'aspetto */
async function runFileExport({
  format,
  editor,
  fileId,
  title,
  theme,
  setBusy,
  setForceLight,
  filename,
  comments = true,
}: {
  format: "docx" | "md"
  editor: Editor
  fileId: string
  title: string
  theme: DocTheme
  setBusy: (busy: boolean) => void
  setForceLight: (light: boolean) => void
  filename?: string
  comments?: boolean
}) {
  const label = format === "docx" ? ".docx" : "Markdown"
  const id = toast.loading(tr("Esporto in {label}…", { label }))
  setBusy(true)
  // grafici e formule si fotografano chiari, come in stampa
  flushSync(() => setForceLight(true))
  try {
    await new Promise((r) => setTimeout(r, 60))
    const file = getWorkspace().files.find((f) => f.id === fileId)
    const data = file?.kind === "doc" ? file.data : null
    const name = filename || safeName(title)
    if (format === "docx") {
      const { buildDocx } = await import("@/lib/export-docx")
      const blob = await buildDocx({
        editor,
        title,
        theme,
        comments: comments ? (data?.comments ?? []) : [],
        sources: data?.sources ?? [],
      })
      download(blob, `${name}.docx`)
    } else {
      const text = await markdownOf(editor, fileId, theme)
      download(
        new Blob([text], { type: "text/markdown;charset=utf-8" }),
        `${name}.md`
      )
    }
    toast.success(tr("Esportato in {label}", { label }), { id })
  } catch (err) {
    console.error(err)
    toast.error(tr("Esportazione non riuscita"), {
      id,
      description: err instanceof Error ? err.message : undefined,
    })
  } finally {
    setForceLight(false)
    setBusy(false)
  }
}

/** Il documento in Markdown, come lo scarica la sezione Esporta */
async function markdownOf(editor: Editor, fileId: string, theme: DocTheme) {
  const file = getWorkspace().files.find((f) => f.id === fileId)
  const data = file?.kind === "doc" ? file.data : null
  const { docToMarkdown } = await import("@/lib/export-markdown")
  return docToMarkdown(
    editor.state.doc,
    data?.sources ?? [],
    theme.citationStyle,
    fieldsOf(editor)
  )
}

function readImage(file: File, done: (src: string) => void) {
  const reader = new FileReader()
  reader.onload = () => done(String(reader.result))
  reader.readAsDataURL(file)
}

/**
 * ⌥ + clic seleziona un'immagine «dietro al testo»: lì sopra ci sono i
 * paragrafi, che altrimenti si prendono ogni clic.
 */
function selectBehind(editor: Editor, e: React.MouseEvent) {
  const hit = document
    .elementsFromPoint(e.clientX, e.clientY)
    .find((el) => el.closest(".doc-image-free"))
  if (!hit) return
  const target = hit.closest(".doc-image-free")
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === "image" && isFreeWrap(String(node.attrs.wrap))) {
      const dom = editor.view.nodeDOM(pos)
      if (dom instanceof Node && target && dom.contains(target)) found = pos
    }
    return true
  })
  if (found === null) return
  e.preventDefault()
  e.stopPropagation()
  editor.chain().focus().setNodeSelection(found).run()
}

/**
 * Evidenziato dei commenti: più intenso per quello attivo, tratteggiato per i
 * risolti. Sono regole CSS sugli id: l'editor non deve ridisegnare niente.
 */
function CommentHighlights({ ctl }: { ctl: CommentsController }) {
  const safe = (id: string) => id.replace(/[^\w-]/g, "")
  const resolved = ctl.list.filter((c) => c.resolved).map((c) => safe(c.id))
  const known = ctl.list.map((c) => safe(c.id))
  const rules: string[] = []
  if (known.length) {
    rules.push(
      `${known.map((id) => `.doc-prose .doc-comment[data-comment="${id}"]`).join(",")}{background:var(--doc-comment-bg);border-bottom:2px solid var(--doc-comment-line)}`
    )
  }
  if (resolved.length) {
    rules.push(
      `${resolved.map((id) => `.doc-prose .doc-comment[data-comment="${id}"]`).join(",")}{background:transparent;border-bottom:1px dashed var(--doc-comment-line)}`
    )
  }
  if (ctl.active) {
    rules.push(
      `.doc-prose .doc-comment[data-comment="${safe(ctl.active)}"]{background:var(--doc-comment-active)}`
    )
  }
  if (!rules.length) return null
  return <style>{rules.join("\n")}</style>
}

/** Parole e caratteri: cambiano a ogni tasto, quindi vivono per conto loro */
function DocCounts({ editor }: { editor: Editor | null }) {
  const t = useT()
  const { words, characters } = useDocCounts(editor)
  return (
    <>
      <span className="whitespace-nowrap">
        {words === 1 ? t("1 parola") : t("{count} parole", { count: words })}
      </span>
      <span className="hidden whitespace-nowrap sm:inline">
        {characters === 1
          ? t("1 carattere")
          : t("{count} caratteri", { count: characters })}
      </span>
    </>
  )
}

/**
 * «Pagina 2 di 5» come nella barra di stato di Word. La pagina del cursore si
 * ricalcola al massimo una volta per fotogramma, e solo se cambia davvero.
 */
function PageIndicator({
  editor,
  sheet,
  step,
  total,
}: {
  editor: Editor | null
  sheet: React.RefObject<HTMLDivElement | null>
  /** distanza fra l'inizio di una pagina e quello della successiva */
  step: number
  total: number
}) {
  const t = useT()
  const [current, setCurrent] = React.useState(1)

  React.useEffect(() => {
    if (!editor || !step) return
    let frame = 0
    const measure = () => {
      frame = 0
      const el = sheet.current
      if (!el || editor.isDestroyed) return
      const box = el.getBoundingClientRect()
      const scale = box.height / (el.offsetHeight || 1)
      const top =
        (editor.view.coordsAtPos(editor.state.selection.from).top - box.top) /
        (scale || 1)
      const next = Math.max(1, Math.floor(top / step) + 1)
      setCurrent((prev) => (prev === next ? prev : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    editor.on("selectionUpdate", schedule)
    editor.on("update", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      editor.off("selectionUpdate", schedule)
      editor.off("update", schedule)
    }
  }, [editor, sheet, step])

  return (
    <span className="whitespace-nowrap">
      {t("Pagina {page} di {total}", {
        page: step ? Math.min(current, total) : 1,
        total,
      })}
    </span>
  )
}

/** Cursore dello zoom in basso a destra, come in Word */
function ZoomControl({
  zoom,
  compact,
  onZoom,
  onFit,
}: {
  zoom: number
  /** sul telefono niente cursore: pulsanti più grandi, facili da toccare */
  compact: boolean
  onZoom: (value: number) => void
  onFit: () => void
}) {
  const t = useT()
  const step = compact
    ? "flex size-7 items-center justify-center rounded transition-colors hover:bg-muted hover:text-foreground"
    : "flex size-5 items-center justify-center rounded transition-colors hover:bg-muted hover:text-foreground"
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
      <button
        type="button"
        title={t("Riduci ⌘−")}
        aria-label={t("Riduci")}
        onClick={() => onZoom(zoom - 0.1)}
        className={step}
      >
        <Minus className="size-3" />
      </button>
      {compact ? null : (
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={Math.round(zoom * 100)}
          aria-label={t("Ingrandimento")}
          onChange={(e) => onZoom(Number(e.target.value) / 100)}
          className="doc-zoom-range h-1 w-20 cursor-pointer appearance-none rounded-full bg-border"
        />
      )}
      <button
        type="button"
        title={t("Ingrandisci ⌘+")}
        aria-label={t("Ingrandisci")}
        onClick={() => onZoom(zoom + 0.1)}
        className={step}
      >
        <Plus className="size-3" />
      </button>
      <button
        type="button"
        title={t("Torna al 100% ⌘0")}
        onClick={() => onZoom(1)}
        className="w-10 rounded px-1 text-right tabular-nums transition-colors hover:bg-muted hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        title={t("Adatta alla larghezza")}
        onClick={onFit}
        className="hidden rounded px-1.5 transition-colors hover:bg-muted hover:text-foreground sm:inline"
      >
        {t("Adatta")}
      </button>
    </div>
  )
}
