"use client"

import * as React from "react"
import { Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  defaultReplacements,
  quoteSet,
  setAutoCorrect,
  useAutoCorrect,
  type AutoCorrectSettings,
} from "@/lib/autocorrect"

import { useT } from "@/lib/i18n/client"

/**
 * «Opzioni correzione automatica», come in Word: gli interruttori di quello
 * che l'app sistema da sola mentre si scrive e la tabella «sostituisci → con».
 * Le impostazioni sono di chi scrive e valgono per tutti i documenti; la
 * lingua che decide virgolette, ordinali e abbreviazioni è quella del
 * documento aperto (scheda Revisione › Lingua).
 */
export function AutoCorrectDialog({
  open,
  onClose,
  language,
}: {
  open: boolean
  onClose: () => void
  language: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        {open ? <Form language={language} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

type Toggle = {
  key: keyof AutoCorrectSettings
  label: string
  hint: string
}

function Form({
  language,
  onClose,
}: {
  language: string
  onClose: () => void
}) {
  const t = useT()
  const settings = useAutoCorrect()
  const quotes = quoteSet(language)
  const [pair, setPair] = React.useState({ from: "", to: "" })

  const toggles: Toggle[] = [
    {
      key: "quotes",
      label: t("Virgolette tipografiche"),
      hint: t("«{straight}» diventa {open}…{close}", {
        straight: '"',
        open: quotes.open.trim(),
        close: quotes.close.trim(),
      }),
    },
    {
      key: "dashes",
      label: t("Lineette"),
      hint: t("«--» diventa – e «---» diventa —"),
    },
    {
      key: "ellipsis",
      label: t("Puntini di sospensione"),
      hint: t("«...» diventa …"),
    },
    {
      key: "symbols",
      label: t("Simboli e faccine"),
      hint: t("«(c)» diventa ©, «-->» diventa →, «:)» diventa 🙂"),
    },
    {
      key: "fractions",
      label: t("Frazioni"),
      hint: t("«1/2» diventa ½"),
    },
    {
      key: "ordinals",
      label: t("Ordinali"),
      hint: t("«1o» diventa 1º; in inglese «1st» va in apice"),
    },
    {
      key: "sentenceCase",
      label: t("Maiuscola a inizio frase"),
      hint: t("Dopo un'abbreviazione nota la frase non ricomincia"),
    },
    {
      key: "twoInitials",
      label: t("Correggi le prime due maiuscole"),
      hint: t("«NOme» diventa «Nome»"),
    },
  ]

  const list = Object.entries(settings.replacements).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  const addPair = () => {
    const from = pair.from.trim()
    const to = pair.to.trim()
    if (!from || !to || from === to) return
    setAutoCorrect({
      replacements: { ...settings.replacements, [from]: to },
    })
    setPair({ from: "", to: "" })
  }

  const remove = (key: string) => {
    const next = { ...settings.replacements }
    delete next[key]
    setAutoCorrect({ replacements: next })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("Correzione automatica")}</DialogTitle>
        <DialogDescription>
          {t(
            "Quello che l'app sistema da sola mentre scrivi. Vale per tutti i documenti."
          )}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="text-sm">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
          <span>
            <span className="font-medium">{t("Correggi mentre scrivo")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("Spegnendola il testo resta esattamente come lo batti")}
            </span>
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setAutoCorrect({ enabled: v })}
          />
        </label>

        <div
          className={
            settings.enabled ? "mt-3 space-y-1" : "mt-3 space-y-1 opacity-50"
          }
        >
          {toggles.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-md px-3 py-1.5 hover:bg-muted/60"
            >
              <span>
                <span>{item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.hint}
                </span>
              </span>
              <Switch
                disabled={!settings.enabled}
                checked={Boolean(settings[item.key])}
                onCheckedChange={(v) => setAutoCorrect({ [item.key]: v })}
              />
            </label>
          ))}
        </div>

        <div
          className={
            settings.enabled ? "mt-4" : "pointer-events-none mt-4 opacity-50"
          }
        >
          <label className="flex items-center justify-between gap-4 rounded-md px-3 py-1.5">
            <span className="font-medium">{t("Sostituisci il testo")}</span>
            <Switch
              disabled={!settings.enabled}
              checked={settings.replaceText}
              onCheckedChange={(v) => setAutoCorrect({ replaceText: v })}
            />
          </label>
          <div className="mt-2 flex items-end gap-2 px-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t("Sostituisci")}
              </span>
              <Input
                value={pair.from}
                onChange={(e) =>
                  setPair((p) => ({ ...p, from: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addPair()
                  }
                }}
                className="h-8"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t("Con")}
              </span>
              <Input
                value={pair.to}
                onChange={(e) => setPair((p) => ({ ...p, to: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addPair()
                  }
                }}
                className="h-8"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addPair}
              disabled={!pair.from.trim() || !pair.to.trim()}
            >
              <Plus className="size-4" /> {t("Aggiungi")}
            </Button>
          </div>
          <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border">
            {list.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("Nessuna sostituzione")}
              </li>
            ) : (
              list.map(([from, to]) => (
                <li
                  key={from}
                  className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
                >
                  <span className="w-2/5 truncate font-mono text-xs">
                    {from}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="flex-1 truncate">{to}</span>
                  <button
                    type="button"
                    onClick={() => remove(from)}
                    aria-label={t("Togli «{word}»", { word: from })}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </DialogBody>

      <DialogFooter className="justify-between sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setAutoCorrect({ replacements: defaultReplacements(language) })
          }
        >
          <RotateCcw className="size-4" /> {t("Elenco predefinito")}
        </Button>
        <Button type="button" onClick={onClose}>
          {t("Chiudi")}
        </Button>
      </DialogFooter>
    </>
  )
}
