"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"
import { sentencesOf, wordsOf } from "@/lib/read-aloud/text"
import { cn } from "@/lib/utils"
import type { AddinApi } from "./api"

import { useT, tr } from "@/lib/i18n/client"
/**
 * Indici di leggibilità, ciascuno per la sua lingua: Gulpease (italiano),
 * Flesch Reading Ease (inglese), Kandel-Moles (francese), Fernández Huerta
 * (spagnolo), Amstad (tedesco), Martins (portoghese).
 */

type Report = {
  index: number
  name: string
  words: number
  sentences: number
  wordsPerSentence: number
  longWords: number
  minutes: number
  hard: { text: string; from: number; to: number; words: number }[]
}

const VOWELS: Record<string, RegExp> = {
  it: /[aeiouàèéìíòóùú]+/gi,
  en: /[aeiouy]+/gi,
  fr: /[aeiouyàâäéèêëïîôöùûü]+/gi,
  es: /[aeiouáéíóúü]+/gi,
  de: /[aeiouyäöü]+/gi,
  pt: /[aeiouáâãàéêíóôõú]+/gi,
}

function syllables(word: string, lang: string) {
  const w = word.toLocaleLowerCase()
  let count = (w.match(VOWELS[lang] ?? VOWELS.it!) ?? []).length
  if (lang === "en" && /[^aeiou]e$/.test(w) && count > 1) count -= 1
  return Math.max(1, count)
}

function analyse(api: AddinApi): Report {
  const lang = api.language.slice(0, 2).toLowerCase()
  // le frasi intere: la lettura ad alta voce spezza quelle oltre i 260
  // caratteri, e così una frase di 50 parole contava come due da 25
  const sentences = sentencesOf(api.editor.state.doc, 0, 0, api.language, {
    split: false,
  })
  let words = 0
  let letters = 0
  let syl = 0
  let longWords = 0
  const hard: Report["hard"] = []
  for (const sentence of sentences) {
    const list = wordsOf(sentence.text, api.language)
    words += list.length
    for (const w of list) {
      const token = sentence.text.slice(w.start, w.end)
      const clean = token.replace(/[^\p{L}]/gu, "")
      letters += clean.length
      const s = syllables(clean || token, lang)
      syl += s
      if (s >= 4) longWords += 1
    }
    if (list.length > 25) {
      const from = sentence.map[0]
      const last = sentence.map[sentence.map.length - 1]
      if (from !== undefined && last !== undefined) {
        hard.push({
          text: sentence.text.trim(),
          from,
          to: last + 1,
          words: list.length,
        })
      }
    }
  }
  const n = Math.max(1, sentences.length)
  const wds = Math.max(1, words)
  const asl = wds / n
  const asw = syl / wds
  const table: Record<string, { name: string; value: number }> = {
    it: {
      name: tr("Indice Gulpease"),
      value: 89 + (300 * n - 10 * letters) / wds,
    },
    en: {
      name: tr("Flesch Reading Ease"),
      value: 206.835 - 1.015 * asl - 84.6 * asw,
    },
    fr: { name: tr("Kandel e Moles"), value: 207 - 1.015 * asl - 73.6 * asw },
    es: {
      name: tr("Fernández Huerta"),
      value: 206.84 - 0.6 * (asw * 100) - 1.02 * ((n / wds) * 100),
    },
    de: { name: "Amstad", value: 180 - asl - 58.5 * asw },
    pt: {
      name: tr("Flesch (Martins)"),
      value: 248.835 - 1.015 * asl - 84.6 * asw,
    },
  }
  const chosen = table[lang] ?? table.it!
  return {
    index: Math.round(Math.max(0, Math.min(100, chosen.value))),
    name: chosen.name,
    words,
    sentences: sentences.length,
    wordsPerSentence: Math.round(asl * 10) / 10,
    longWords: Math.round((longWords / wds) * 100),
    minutes: Math.max(1, Math.round(words / 230)),
    hard: hard.sort((a, b) => b.words - a.words).slice(0, 12),
  }
}

function verdict(report: Report, lang: string) {
  const v = report.index
  if (lang === "it") {
    if (v >= 80) return tr("Facile anche per chi ha la licenza elementare")
    if (v >= 60) return tr("Facile per chi ha la licenza media")
    if (v >= 40) return tr("Facile per chi ha un diploma superiore")
    return tr("Difficile: frasi e parole da accorciare")
  }
  if (v >= 80) return tr("Molto facile")
  if (v >= 60) return tr("Abbastanza facile")
  if (v >= 40) return tr("Impegnativo")
  return tr("Difficile: frasi e parole da accorciare")
}

export function ReadabilityAddin({ api }: { api: AddinApi }) {
  const t = useT()
  const [report, setReport] = React.useState<Report>(() => analyse(api))
  const lang = api.language.slice(0, 2).toLowerCase()
  const tone =
    report.index >= 60
      ? "bg-emerald-500"
      : report.index >= 40
        ? "bg-amber-500"
        : "bg-rose-500"

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{report.name}</div>
          <div
            className="text-4xl font-semibold tabular-nums"
            data-testid="readability-index"
          >
            {report.words ? report.index : "—"}
            <span className="text-base font-normal text-muted-foreground">
              /100
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReport(analyse(api))}
          className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
        >
          <RefreshCw className="size-3.5" /> {t("Ricalcola")}
        </button>
      </div>
      {report.words ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", tone)}
              style={{ width: `${report.index}%` }}
            />
          </div>
          <p className="text-sm">{verdict(report, lang)}</p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {[
              [t("Parole"), report.words],
              [t("Frasi"), report.sentences],
              [
                t("Parole per frase"),
                String(report.wordsPerSentence).replace(".", ","),
              ],
              [t("Parole lunghe"), `${report.longWords}%`],
              [t("Tempo di lettura"), `${report.minutes} min`],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-md bg-muted/60 px-2 py-1.5"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h3 className="mb-1 text-xs font-semibold">
              {t("Frasi da semplificare")}
            </h3>
            {report.hard.length ? (
              <ul className="space-y-1">
                {report.hard.map((h) => (
                  <li key={h.from}>
                    <button
                      type="button"
                      onClick={() =>
                        api.editor
                          .chain()
                          .focus()
                          .setTextSelection({ from: h.from, to: h.to })
                          .scrollIntoView()
                          .run()
                      }
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                    >
                      <span className="line-clamp-2">{h.text}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("{count} parole", { count: h.words })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("Nessuna frase oltre le 25 parole.")}
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("Il documento è ancora vuoto.")}
        </p>
      )}
    </div>
  )
}
