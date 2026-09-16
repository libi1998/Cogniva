"use client"

import * as React from "react"
import { Check, Globe, Search, ShieldCheck, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  ADDINS,
  CATEGORY_LABELS,
  setAddinEnabled,
  useEnabledAddins,
  type AddinId,
} from "@/lib/addins"
import { cn } from "@/lib/utils"
import { ADDIN_ICONS, ADDIN_TINTS } from "./addin-icons"

import { useT } from "@/lib/i18n/client"
const FILTERS = ["all", "active", "content", "writing", "research"] as const

/** «Componenti aggiuntivi» di Word: la raccolta da cui si aggiungono e rimuovono */
export function AddinsDialog({
  open,
  onClose,
  onOpenAddin,
}: {
  open: boolean
  onClose: () => void
  onOpenAddin: (id: AddinId) => void
}) {
  const t = useT()
  const enabled = useEnabledAddins()
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all")
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLocaleLowerCase()
  const list = ADDINS.filter(
    (a) =>
      (filter === "all" ||
        (filter === "active"
          ? enabled.includes(a.id)
          : a.category === filter)) &&
      (!q ||
        `${a.name} ${a.tagline} ${a.description}`
          .toLocaleLowerCase()
          .includes(q))
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{t("Componenti aggiuntivi")}</DialogTitle>
          <DialogDescription>
            {t(
              "Strumenti in più per i documenti, scritti e verificati da Cogniva: nessun codice di terzi gira nella pagina."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t("Cerca componenti aggiuntivi")}
              className="h-8 pl-7"
              placeholder={t("Cerca")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label={t("Filtra")}
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-xs",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all"
                  ? t("Tutti")
                  : f === "active"
                    ? t("Attivi")
                    : CATEGORY_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid max-h-[min(60dvh,520px)] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {list.map((addin) => {
            const active = enabled.includes(addin.id)
            return (
              <article
                key={addin.id}
                aria-label={addin.name}
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      ADDIN_TINTS[addin.id]
                    )}
                  >
                    {ADDIN_ICONS[addin.id]("size-5")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{addin.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {addin.tagline}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed">{addin.description}</p>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {addin.network.length ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                      <Globe className="size-3" />{" "}
                      {t("Usa internet: {services}", {
                        services: addin.network.join(", "),
                      })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                      <WifiOff className="size-3" /> {t("Funziona offline")}
                    </span>
                  )}
                  {addin.permissions.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      <ShieldCheck className="size-3" /> {p}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={active ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => setAddinEnabled(addin.id, !active)}
                  >
                    {active ? (
                      <>
                        <Check className="size-3.5" /> {t("Aggiunto")}
                      </>
                    ) : (
                      t("Aggiungi")
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setAddinEnabled(addin.id, true)
                      onOpenAddin(addin.id)
                      onClose()
                    }}
                  >
                    {t("Apri")}
                  </Button>
                </div>
              </article>
            )
          })}
          {!list.length ? (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              {t("Nessun componente aggiuntivo trovato.")}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
