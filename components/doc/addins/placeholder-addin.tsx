"use client"

import * as React from "react"
import type { JSONContent } from "@tiptap/core"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AddinApi } from "./api"

import { useT, tr, useLocale } from "@/lib/i18n/client"
import { LOCALE_NAMES, N_ } from "@/lib/i18n/config"
/**
 * Testo di prova, come =lorem() e =rand() in Word. Le frasi italiane sono
 * scritte per Cogniva e parlano di impaginazione, così il segnaposto è anche
 * un piccolo promemoria.
 */

/** frasi scritte per Cogniva, tradotte nella lingua dell'interfaccia */
const NATIVE = [
  N_(
    "Un buon documento comincia da una struttura chiara: titoli brevi, paragrafi compatti e un'idea per ogni blocco."
  ),
  N_(
    "Gli stili tengono insieme l'aspetto del testo, così basta cambiarne uno per aggiornare tutte le parti che lo usano."
  ),
  N_(
    "Prima di rifinire i dettagli conviene scrivere di getto, lasciando a dopo la scelta delle parole migliori."
  ),
  N_(
    "Le immagini aiutano quando spiegano qualcosa che il testo farebbe fatica a dire, non quando riempiono spazio."
  ),
  N_(
    "Un elenco puntato rende evidenti i passaggi, ma troppi elenchi di fila spezzano il ritmo della lettura."
  ),
  N_(
    "Il margine bianco non è spazio sprecato: dà respiro alla pagina e guida l'occhio verso ciò che conta."
  ),
  N_(
    "Le note a piè di pagina ospitano i dettagli che interessano a pochi, senza interrompere tutti gli altri."
  ),
  N_(
    "Rileggere ad alta voce fa scoprire le frasi troppo lunghe e le ripetizioni che sfuggono a una lettura silenziosa."
  ),
  N_(
    "Un sommario aggiornato permette di muoversi in un documento lungo come in un libro ben rilegato."
  ),
  N_(
    "Le revisioni tengono traccia di chi ha cambiato cosa, così le decisioni si prendono guardando le modifiche."
  ),
  N_(
    "Una tabella funziona quando i dati si confrontano per righe e colonne; per un solo numero basta una frase."
  ),
  N_(
    "Il titolo del documento dovrebbe dire in poche parole che cosa troverà chi lo apre."
  ),
  N_(
    "I colori del tema danno coerenza a grafici, forme e intestazioni senza doverli scegliere ogni volta."
  ),
  N_(
    "Quando il contenuto è pronto, l'esportazione in PDF o in Word conserva l'impaginazione così com'è."
  ),
]

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Curabitur pretium tincidunt lacus, nulla gravida orci a odio.",
  "Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
  "Integer in mauris eu nibh euismod gravida.",
  "Duis ac tellus et risus vulputate vehicula.",
  "Donec lobortis risus a elit, etiam tempor.",
  "Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam.",
  "Maecenas fermentum consequat mi, donec fermentum pellentesque malesuada.",
]

export function placeholderContent(
  kind: "native" | "lorem",
  paragraphs: number,
  sentences: number,
  structured: boolean
): JSONContent[] {
  const pool = kind === "native" ? NATIVE.map((line) => tr(line)) : LOREM
  let cursor = 0
  const sentence = () => pool[cursor++ % pool.length]!
  const para = (): JSONContent => ({
    type: "paragraph",
    content: [
      {
        type: "text",
        text: Array.from({ length: sentences }, sentence).join(" "),
      },
    ],
  })
  const out: JSONContent[] = []
  for (let i = 0; i < paragraphs; i += 1) {
    if (structured && i % 2 === 0) {
      out.push({
        type: "heading",
        attrs: { level: 2 },
        content: [
          {
            type: "text",
            text:
              kind === "native"
                ? tr("Sezione {number}", { number: i / 2 + 1 })
                : tr("Lorem ipsum {number}", { number: i / 2 + 1 }),
          },
        ],
      })
    }
    out.push(para())
    if (structured && i % 2 === 1) {
      out.push({
        type: "bulletList",
        content: Array.from({ length: 3 }, () => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: sentence().replace(/[.,;].*$/, "") },
              ],
            },
          ],
        })),
      })
    }
  }
  return out
}

export function PlaceholderAddin({ api }: { api: AddinApi }) {
  const t = useT()
  const locale = useLocale()
  const [kind, setKind] = React.useState<"native" | "lorem">("native")
  const [paragraphs, setParagraphs] = React.useState(3)
  const [sentences, setSentences] = React.useState(4)
  const [structured, setStructured] = React.useState(false)
  const preview = placeholderContent(kind, 1, Math.min(2, sentences), false)[0]
    ?.content?.[0]?.text

  const number = (
    label: string,
    value: number,
    set: (n: number) => void,
    max: number
  ) => (
    <label className="block space-y-1">
      <span className="flex justify-between text-xs font-medium text-muted-foreground">
        {label} <span className="text-foreground tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
        {(
          [
            ["native", LOCALE_NAMES[locale]],
            ["lorem", "Lorem ipsum"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={cn(
              "h-7 rounded text-xs",
              kind === value
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {number(t("Paragrafi"), paragraphs, setParagraphs, 12)}
      {number(t("Frasi per paragrafo"), sentences, setSentences, 8)}
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={structured}
          onChange={(e) => setStructured(e.target.checked)}
        />
        {t("Con titoli ed elenchi puntati")}
      </label>
      <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        {preview}…
      </p>
      <Button
        type="button"
        className="w-full"
        onClick={() =>
          api.insertContent(
            placeholderContent(kind, paragraphs, sentences, structured)
          )
        }
      >
        {t("Inserisci testo segnaposto")}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Suggerimento: in Word si ottiene lo stesso con =lorem() e =rand()."
        )}
      </p>
    </div>
  )
}
