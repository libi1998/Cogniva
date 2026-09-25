"use client"

import { useT, currentRegion } from "@/lib/i18n/client"
import * as React from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { watermarkFontSize } from "@/lib/doc-design"
import { fontStack } from "@/lib/fonts"
import { getPagination } from "@/lib/pagination"
import { useAuthor } from "@/lib/author"
import { bandContent, bandForPage, type BandVars } from "@/lib/header-footer"
import { cn } from "@/lib/utils"
import type {
  BandContent,
  DocMargins,
  DocTheme,
  DocWatermark,
} from "@/lib/types"
import { useNotes } from "./footnote-node"
import { BandEditor } from "./band-editor"
import { BandView } from "./band-view"

/** Numero di pagine e note di ogni pagina, dal motore di impaginazione */
export function usePagination(editor: Editor | null) {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => (e ? getPagination(e.state) : null),
    }) ?? { pages: 1, notes: [[]], noteHeights: [0] }
  )
}

/**
 * I fogli di un documento impaginato: la carta di ogni pagina, dietro al
 * testo, e sopra intestazione, piè di pagina, numero, bordo e note a piè di
 * pagina. Le altezze usano lo stesso stacco degli spaziatori, così in stampa
 * (stacco zero) i fogli si toccano esattamente come la carta.
 */
export function PageLayer({
  editor,
  theme,
  title,
  pageHeight,
  pages,
  paper,
  shadow,
  band = null,
  onBandChange,
  onBandClose,
  body,
  focusRef,
}: {
  editor: Editor | null
  theme: DocTheme
  title: string
  pageHeight: number
  pages: number
  paper: string
  shadow: string
  /** intestazione o piè di pagina che si sta scrivendo, e su che pagina */
  band?: BandEditing | null
  onBandChange?: (where: "header" | "footer", content: BandContent) => void
  onBandClose?: () => void
  /**
   * dove comincia e finisce il testo: i margini, allargati quando
   * intestazione o piè di pagina non ci stanno (come in Word)
   */
  body?: { top: number; bottom: number }
  /** dove torna il fuoco chiudendo menu e finestre (vedi BandEditor) */
  focusRef?: React.RefObject<HTMLElement | null>
}) {
  const info = usePagination(editor)
  const notes = useNotes(editor)
  const byPos = new Map(notes.map((n) => [n.pos, n]))
  const border = pageBorderCss(theme)
  const { margins } = theme
  const bodyTop = body?.top ?? margins.top
  const bodyBottom = body?.bottom ?? margins.bottom

  return (
    <>
      {Array.from({ length: pages }).map((_, i) => {
        const top = `calc(${i} * (${pageHeight}px + var(--page-gap)))`
        const pageNotes = (info.notes[i] ?? [])
          .map((pos) => byPos.get(pos))
          .filter((n): n is NonNullable<typeof n> => Boolean(n))
        const notesHeight = info.noteHeights[i] ?? 0
        return (
          <React.Fragment key={i}>
            <div
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top,
                height: pageHeight,
                zIndex: -2,
                background: paper,
                borderRadius: theme.cornerRadius,
                boxShadow: shadow,
              }}
            />
            {theme.watermark ? (
              <Watermark
                watermark={theme.watermark}
                theme={theme}
                top={top}
                height={pageHeight}
              />
            ) : null}
            {/* sopra alle fasce degli spaziatori, che coprono i margini */}
            <div
              className="pointer-events-none absolute inset-x-0"
              style={{ top, height: pageHeight, zIndex: 4 }}
            >
              <PageBand
                index={i}
                pages={pages}
                span={pageHeight}
                theme={theme}
                title={title}
                border={border}
                margins={margins}
                hide={band && band.page === i ? band.where : null}
              />
              {band && band.page === i && onBandChange && onBandClose ? (
                <EditableBand
                  band={band}
                  theme={theme}
                  title={title}
                  pages={pages}
                  pageHeight={pageHeight}
                  bodyTop={bodyTop}
                  bodyBottom={bodyBottom}
                  focusRef={focusRef}
                  onChange={onBandChange}
                  onClose={onBandClose}
                />
              ) : null}
              {pageNotes.length && editor ? (
                <div
                  className="doc-page-notes pointer-events-auto absolute overflow-hidden"
                  style={{
                    left: margins.left,
                    right: margins.right,
                    top: pageHeight - bodyBottom - notesHeight,
                    height: notesHeight,
                  }}
                >
                  <span aria-hidden className="doc-page-notes-rule" />
                  {pageNotes.map((note) => (
                    <p
                      key={note.pos}
                      className="doc-page-note"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .setNodeSelection(note.pos)
                          .scrollIntoView()
                          .run()
                      }
                    >
                      <span className="doc-page-note-n">{note.label}</span>
                      {note.text || " "}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        )
      })}
    </>
  )
}

/** Il bordo della pagina in CSS: tratto e colore */
export function pageBorderCss(theme: DocTheme) {
  const width =
    theme.pageBorder === "thin"
      ? "1px solid"
      : theme.pageBorder === "thick"
        ? "3px solid"
        : theme.pageBorder === "double"
          ? "4px double"
          : theme.pageBorder === "dashed"
            ? "1.5px dashed"
            : theme.pageBorder === "dotted"
              ? "2px dotted"
              : ""
  if (!width) return ""
  return `${width} ${theme.pageBorderColor || "var(--doc-muted)"}`
}

/**
 * Intestazione, piè di pagina, numero, bordo e filigrana di ogni pagina.
 *
 * Sono posizionati alle stesse altezze dove il browser spezza la stampa, così
 * finiscono al posto giusto sia a video sia sulla carta sia nelle esportazioni.
 */
export function PageDecor({
  theme,
  title,
  pageHeight,
  sheetHeight,
}: {
  theme: DocTheme
  title: string
  pageHeight: number
  sheetHeight: number
}) {
  const { pageNumbers, pageBorder, margins, watermark } = theme
  if (
    !bandContent(theme, "header") &&
    !bandContent(theme, "footer") &&
    pageNumbers === "none" &&
    pageBorder === "none" &&
    !watermark
  ) {
    return null
  }
  // senza formato di carta la filigrana si ripete a ogni «schermata» di testo
  const span = pageHeight > 0 ? pageHeight : sheetHeight
  const pages = pageHeight > 0 ? Math.max(1, Math.ceil(sheetHeight / span)) : 1
  const border = pageBorderCss(theme)
  const marks =
    watermark && pageHeight <= 0
      ? Math.max(1, Math.round(sheetHeight / 1000))
      : pages

  return (
    <>
      {watermark
        ? Array.from({ length: marks }).map((_, i) => (
            <Watermark
              key={`w${i}`}
              watermark={watermark}
              theme={theme}
              top={`${(i * sheetHeight) / marks}px`}
              height={
                pageHeight > 0 ? pageHeight : Math.max(1, sheetHeight / marks)
              }
            />
          ))
        : null}
      <div className="pointer-events-none absolute inset-0 z-0">
        {Array.from({ length: pages }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-x-0"
            style={{ top: i * span, height: span }}
          >
            <PageBand
              index={i}
              pages={pages}
              span={span}
              theme={theme}
              title={title}
              border={border}
              margins={margins}
            />
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * La filigrana di una pagina: sotto al testo (z-index negativo dentro al
 * foglio isolato) e sopra alla carta. Il testo si adatta alla pagina.
 */
function Watermark({
  watermark,
  theme,
  top,
  height,
}: {
  watermark: DocWatermark
  theme: DocTheme
  top: string
  height: number
}) {
  const diagonal = watermark.layout === "diagonal"
  const text = watermark.text.trim()
  return (
    <div
      aria-hidden
      data-watermark=""
      className="pointer-events-none absolute inset-x-0 flex items-center justify-center overflow-hidden select-none"
      style={{ top, height, zIndex: -1, containerType: "size" }}
    >
      {watermark.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine scelta da chi scrive, un data URI
        <img
          src={watermark.image}
          alt=""
          draggable={false}
          style={{
            width: `${Math.round(watermark.scale * 100)}cqw`,
            maxHeight: "90cqh",
            objectFit: "contain",
            opacity: watermark.opacity,
          }}
        />
      ) : text ? (
        <span
          style={{
            fontFamily: fontStack(
              watermark.font ?? theme.headingFont ?? theme.font
            ),
            fontWeight: 700,
            color: watermark.color,
            opacity: watermark.opacity,
            whiteSpace: "nowrap",
            lineHeight: 1,
            letterSpacing: "0.04em",
            // la diagonale di una pagina A4 è circa 1,22 volte l'altezza: il
            // testo occupa i tre quarti della linea su cui sta
            fontSize: watermarkFontSize(text, watermark.layout),
            transform: diagonal ? "rotate(-45deg)" : undefined,
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  )
}

/** I campi di una pagina: numero, pagine, titolo, autore e data di oggi */
function useBandVars(
  index: number,
  pages: number,
  title: string,
  theme: DocTheme
): BandVars {
  const author = useAuthor()
  const start = theme.pageNumberStart ?? 1
  return {
    page: start + index,
    pages: start + pages - 1,
    title,
    author,
    date: new Date().toLocaleDateString(currentRegion(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }
}

/**
 * Dove stanno intestazione e piè di pagina in una pagina, come la distanza
 * dal bordo di Word: l'intestazione scende dalla sua riga, il piè sale
 */
export function bandPlaces(margins: DocMargins) {
  const place = (margin: number) =>
    Math.round(Math.min(48, Math.max(6, margin / 2 - 8)))
  return { headTop: place(margins.top), footBottom: place(margins.bottom) }
}

/**
 * Bordo, intestazione e piè di una pagina, dentro al riquadro della pagina
 * (alto `span`)
 */
function PageBand({
  index,
  pages,
  span,
  theme,
  title,
  border,
  margins,
  hide = null,
}: {
  index: number
  pages: number
  span: number
  theme: DocTheme
  title: string
  border: string
  margins: DocMargins
  /** la riga che si sta scrivendo: al suo posto c'è quella modificabile */
  hide?: "header" | "footer" | null
}) {
  const vars = useBandVars(index, pages, title, theme)
  const header = bandForPage("header", theme, vars.page)
  const footer = bandForPage("footer", theme, vars.page)
  const { headTop, footBottom } = bandPlaces(margins)

  return (
    <>
      {border ? (
        <div
          className="absolute rounded-[2px]"
          style={{
            top: 22,
            height: span - 44,
            left: 22,
            right: 22,
            border,
          }}
        />
      ) : null}
      {/* quella che si sta scrivendo resta sotto, nascosta: un'esportazione
          fatta a metà la ritrova (vedi prepareSheet) */}
      {header ? (
        <BandView
          content={header}
          vars={vars}
          theme={theme}
          kind="header"
          className={cn("absolute", hide === "header" && "doc-band-hidden")}
          style={{ top: headTop, left: margins.left, right: margins.right }}
        />
      ) : null}
      {footer ? (
        <BandView
          content={footer}
          vars={vars}
          theme={theme}
          kind="footer"
          className={cn("absolute", hide === "footer" && "doc-band-hidden")}
          style={{
            bottom: footBottom,
            left: margins.left,
            right: margins.right,
          }}
        />
      ) : null}
    </>
  )
}

export type BandEditing = {
  where: "header" | "footer"
  /** la pagina (da 0) su cui si scrive */
  page: number
  /** il punto del doppio clic, in coordinate dello schermo: il cursore va lì */
  at?: { x: number; y: number } | null
}

/**
 * Da dove si fa doppio clic sul foglio a cosa si modifica: il margine alto è
 * l'intestazione, quello basso il piè di pagina, come in Word. `x` e `y` sono
 * in pixel del foglio, senza zoom.
 */
export function bandAt(
  y: number,
  pageHeight: number,
  gap: number,
  margins: DocMargins
): Omit<BandEditing, "at"> | null {
  if (pageHeight <= 0) return null
  const page = Math.max(0, Math.floor(y / (pageHeight + gap)))
  const inPage = y - page * (pageHeight + gap)
  if (inPage < 0 || inPage > pageHeight) return null
  const where =
    inPage < margins.top
      ? "header"
      : inPage > pageHeight - margins.bottom
        ? "footer"
        : null
  return where ? { where, page } : null
}

/**
 * L'intestazione o il piè che si scrive, al posto di quello disegnato: testo
 * libero con la sua barretta, una linea tratteggiata con il nome come in
 * Word. Vale per tutte le pagine.
 */
function EditableBand({
  band,
  theme,
  title,
  pages,
  pageHeight,
  bodyTop,
  bodyBottom,
  focusRef,
  onChange,
  onClose,
}: {
  band: BandEditing
  theme: DocTheme
  title: string
  pages: number
  pageHeight: number
  bodyTop: number
  bodyBottom: number
  focusRef?: React.RefObject<HTMLElement | null>
  onChange: (where: "header" | "footer", content: BandContent) => void
  onClose: () => void
}) {
  const t = useT()
  const { margins } = theme
  const vars = useBandVars(band.page, pages, title, theme)
  const { headTop, footBottom } = bandPlaces(margins)
  const header = band.where === "header"
  const label = header ? t("Intestazione") : t("Piè di pagina")
  const lineTop = header ? bodyTop - 4 : pageHeight - bodyBottom + 4
  // la barretta non copre mai il testo: sta nel margine, sopra l'intestazione
  // o sotto il piè di pagina, e se il margine è troppo stretto appena fuori
  // dal foglio, oltre il suo bordo
  const TOOLS_H = 26
  const toolsStyle: React.CSSProperties = header
    ? { top: headTop - TOOLS_H - 4 >= 2 ? headTop - TOOLS_H - 4 : -TOOLS_H - 6 }
    : {
        bottom:
          footBottom - TOOLS_H - 4 >= 2
            ? footBottom - TOOLS_H - 4
            : -TOOLS_H - 6,
      }

  return (
    <div className="pointer-events-auto" data-band-editor="">
      <div
        aria-hidden
        className="doc-band-line"
        style={{ top: lineTop, left: 0, right: 0 }}
      >
        <span
          className={cn("doc-band-tag", header ? "top-full" : "bottom-full")}
        >
          {label}
        </span>
      </div>
      <BandEditor
        // una pagina o una fascia diversa: si riparte dal contenuto salvato
        key={`${band.where}-${band.page}`}
        where={band.where}
        initial={bandContent(theme, band.where)}
        vars={vars}
        theme={theme}
        at={band.at}
        focusRef={focusRef}
        onChange={(content) => onChange(band.where, content)}
        onClose={onClose}
        className="doc-band doc-band-writing absolute"
        style={{
          left: margins.left,
          right: margins.right,
          ...(header ? { top: headTop } : { bottom: footBottom }),
        }}
        toolbarStyle={{ right: margins.right, ...toolsStyle }}
      />
    </div>
  )
}

/** Griglia di riferimento, mezzo centimetro, mai stampata né esportata */
export function GridOverlay() {
  return (
    <div
      data-guide
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--doc-border) 1px, transparent 1px), linear-gradient(to bottom, var(--doc-border) 1px, transparent 1px)",
        backgroundSize: "18.9px 18.9px",
        opacity: 0.6,
      }}
    />
  )
}

/** Linee tratteggiate che mostrano dove cadono i salti pagina */
export function PageGuides({ pageHeight }: { pageHeight: number }) {
  const t = useT()
  const ref = React.useRef<HTMLDivElement>(null)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const update = () =>
      setCount(Math.max(0, Math.ceil(el.scrollHeight / pageHeight) - 1))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageHeight])

  return (
    <div
      ref={ref}
      data-guide
      className="pointer-events-none absolute inset-0 z-0"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute right-0 left-0 border-t border-dashed"
          style={{
            top: (i + 1) * pageHeight,
            borderColor: "var(--doc-border)",
          }}
        >
          <span
            className="absolute top-1 right-1 text-[9px]"
            style={{ color: "var(--doc-muted)" }}
          >
            {t("pagina {page}", { page: i + 2 })}
          </span>
        </div>
      ))}
    </div>
  )
}
