"use client"

import * as React from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { watermarkFontSize } from "@/lib/doc-design"
import { fontStack } from "@/lib/fonts"
import { getPagination } from "@/lib/pagination"
import { useAuthor } from "@/lib/author"
import { bandForPage } from "@/lib/header-footer"
import type { DocMargins, DocTheme, DocWatermark } from "@/lib/types"
import { useNotes } from "./footnote-node"

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
}: {
  editor: Editor | null
  theme: DocTheme
  title: string
  pageHeight: number
  pages: number
  paper: string
  shadow: string
}) {
  const info = usePagination(editor)
  const notes = useNotes(editor)
  const byPos = new Map(notes.map((n) => [n.pos, n]))
  const border = pageBorderCss(theme)
  const { margins } = theme

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
                top={0}
                span={pageHeight}
                theme={theme}
                title={title}
                border={border}
                margins={margins}
              />
              {pageNotes.length && editor ? (
                <div
                  className="doc-page-notes pointer-events-auto absolute overflow-hidden"
                  style={{
                    left: margins.left,
                    right: margins.right,
                    top: pageHeight - margins.bottom - notesHeight,
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
  const { header, footer, pageNumbers, pageBorder, margins, watermark } = theme
  if (
    !header &&
    !footer &&
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
          <PageBand
            key={i}
            index={i}
            pages={pages}
            top={i * span}
            span={span}
            theme={theme}
            title={title}
            border={border}
            margins={margins}
          />
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

function PageBand({
  index,
  pages,
  top,
  span,
  theme,
  title,
  border,
  margins,
}: {
  index: number
  pages: number
  top: number
  span: number
  theme: DocTheme
  title: string
  border: string
  margins: DocMargins
}) {
  const author = useAuthor()
  const start = theme.pageNumberStart ?? 1
  const vars = {
    page: start + index,
    pages: start + pages - 1,
    title,
    author,
    date: new Date().toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }
  const header = bandForPage("header", theme, vars)
  const footer = bandForPage("footer", theme, vars)
  const headTop = top + Math.max(10, margins.top / 2 - 6)
  const footTop = top + span - Math.max(16, margins.bottom / 2)

  return (
    <>
      {border ? (
        <div
          className="absolute rounded-[2px]"
          style={{
            top: top + 22,
            height: span - 44,
            left: 22,
            right: 22,
            border,
          }}
        />
      ) : null}
      {header ? (
        <BandRow parts={header} top={headTop} margins={margins} />
      ) : null}
      {footer ? (
        <BandRow parts={footer} top={footTop} margins={margins} />
      ) : null}
    </>
  )
}

/** Una riga di intestazione o piè di pagina, in tre colonne */
function BandRow({
  parts,
  top,
  margins,
}: {
  parts: [string, string, string]
  top: number
  margins: DocMargins
}) {
  return (
    <div
      data-band=""
      className="absolute grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[0.72em] leading-none tabular-nums"
      style={{
        top,
        left: margins.left,
        right: margins.right,
        color: "var(--doc-muted)",
      }}
    >
      <span className="min-w-0 truncate">{parts[0]}</span>
      <span className="min-w-0 truncate text-center">{parts[1]}</span>
      <span className="min-w-0 truncate text-right">{parts[2]}</span>
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
            pagina {i + 2}
          </span>
        </div>
      ))}
    </div>
  )
}
