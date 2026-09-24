"use client"

import * as React from "react"
import {
  ChartArea,
  ChartBarBig,
  ChartColumnBig,
  ChartLine,
  ChartPie,
  ChartScatter,
  ClipboardCopy,
  ClipboardPaste,
  Donut,
  Plus,
  Radar,
  Table2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  CHART_PALETTES,
  CHART_TYPES,
  parseNumber,
  parseTable,
  seriesColor,
  sliceColor,
  toTable,
  type ChartPalette,
  type ChartSpec,
  type ChartType,
} from "@/lib/chart"
import { decimalMark } from "@/lib/numbers"
import { useIsDark } from "@/lib/use-theme"
import { cn } from "@/lib/utils"
import { Row, Segmented } from "./inspector-ui"
import { ChartSvg } from "./chart-graphic"

import { useT } from "@/lib/i18n/client"
export const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  column: <ChartColumnBig className="size-4" />,
  bar: <ChartBarBig className="size-4" />,
  line: <ChartLine className="size-4" />,
  area: <ChartArea className="size-4" />,
  pie: <ChartPie className="size-4" />,
  doughnut: <Donut className="size-4" />,
  radar: <Radar className="size-4" />,
  scatter: <ChartScatter className="size-4" />,
}

/**
 * Tipo, titolo e aspetto del grafico: il pannello a destra di documenti e
 * board. I dati si modificano nel foglio che apre «Modifica dati».
 */
export function ChartOptions({
  spec,
  onChange,
}: {
  spec: ChartSpec
  onChange: (next: ChartSpec) => void
}) {
  const t = useT()
  const [editing, setEditing] = React.useState(false)
  const set = (patch: Partial<ChartSpec>) => onChange({ ...spec, ...patch })
  const radial = spec.type === "pie" || spec.type === "doughnut"
  const stackable =
    spec.type === "column" || spec.type === "bar" || spec.type === "area"

  return (
    <div className="space-y-3">
      <Row label={t("Tipo di grafico")} stacked>
        <div className="grid grid-cols-4 gap-1">
          {CHART_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={spec.type === t.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set({ type: t.value })}
              className={cn(
                "flex h-11 flex-col items-center justify-center gap-0.5 rounded-md border text-[9px] leading-none transition",
                spec.type === t.value
                  ? "border-primary/50 bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {CHART_ICONS[t.value]}
              <span className="max-w-full truncate px-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row label={t("Titolo")} stacked>
        <Input
          className="h-8 text-xs"
          value={spec.title}
          placeholder={t("Senza titolo")}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Row>

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setEditing(true)}
      >
        <Table2 className="size-3.5" /> {t("Modifica dati…")}
      </Button>

      <Row label={t("Legenda")} stacked>
        <Segmented<ChartSpec["legend"]>
          size="sm"
          value={spec.legend}
          onChange={(legend) => set({ legend })}
          items={[
            { value: "none", label: t("No") },
            { value: "top", label: t("Sopra") },
            { value: "bottom", label: t("Sotto") },
            { value: "right", label: t("Destra") },
          ]}
        />
      </Row>

      <Row label={t("Colori")} stacked>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(CHART_PALETTES) as ChartPalette[]).map((key) => (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                set({
                  palette: key,
                  series: spec.series.map((s) => ({ ...s, color: null })),
                })
              }
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md border px-1.5 text-[10px]",
                spec.palette === key
                  ? "border-primary/50 bg-accent"
                  : "border-border hover:bg-muted"
              )}
            >
              <span className="flex">
                {CHART_PALETTES[key].colors.slice(0, 4).map((color) => (
                  <span
                    key={color}
                    className="-mr-0.5 size-2.5 rounded-full ring-1 ring-background"
                    style={{ background: color }}
                  />
                ))}
              </span>
              {CHART_PALETTES[key].label}
            </button>
          ))}
        </div>
      </Row>

      <div className="space-y-2 text-xs">
        {stackable ? (
          <Toggle
            label={t("In pila")}
            checked={spec.stacked}
            onChange={(stacked) => set({ stacked })}
          />
        ) : null}
        <Toggle
          label={
            radial
              ? t("Valori al posto delle percentuali")
              : t("Etichette dati")
          }
          checked={spec.labels}
          onChange={(labels) => set({ labels })}
        />
        {!radial && spec.type !== "radar" ? (
          <Toggle
            label={t("Griglia")}
            checked={spec.grid}
            onChange={(grid) => set({ grid })}
          />
        ) : null}
        {spec.type === "line" || spec.type === "area" ? (
          <Toggle
            label={t("Linee morbide")}
            checked={spec.smooth}
            onChange={(smooth) => set({ smooth })}
          />
        ) : null}
      </div>

      {!radial && spec.type !== "radar" ? (
        <div className="grid grid-cols-2 gap-2">
          <Row label={t("Asse X")} stacked>
            <Input
              className="h-8 text-xs"
              value={spec.xTitle}
              placeholder={t("Titolo")}
              onChange={(e) => set({ xTitle: e.target.value })}
            />
          </Row>
          <Row label={t("Asse Y")} stacked>
            <Input
              className="h-8 text-xs"
              value={spec.yTitle}
              placeholder={t("Titolo")}
              onChange={(e) => set({ yTitle: e.target.value })}
            />
          </Row>
        </div>
      ) : null}

      <ChartDataDialog
        open={editing}
        onOpenChange={setEditing}
        spec={spec}
        onChange={onChange}
      />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * Il foglio dati, come la finestra di Excel che apre Word: categorie nelle
 * righe, serie nelle colonne. Si può incollare direttamente da Excel.
 */
function ChartDataDialog({
  open,
  onOpenChange,
  spec,
  onChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  spec: ChartSpec
  onChange: (next: ChartSpec) => void
}) {
  const t = useT()
  // mentre si scrive un numero resta il testo («3,»): si converte uscendo
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const radial = spec.type === "pie" || spec.type === "doughnut"
  const dark = useIsDark()

  const setCell = (si: number, ci: number, text: string) => {
    const key = `${si}:${ci}`
    setDrafts((d) => ({ ...d, [key]: text }))
    const series = spec.series.map((s, i) =>
      i === si
        ? {
            ...s,
            values: s.values.map((v, j) => (j === ci ? parseNumber(text) : v)),
          }
        : s
    )
    onChange({ ...spec, series })
  }
  const addRow = () =>
    onChange({
      ...spec,
      categories: [
        ...spec.categories,
        t("Categoria {number}", { number: spec.categories.length + 1 }),
      ],
      series: spec.series.map((s) => ({ ...s, values: [...s.values, 0] })),
    })
  const removeRow = (ci: number) =>
    onChange({
      ...spec,
      categories: spec.categories.filter((_, i) => i !== ci),
      series: spec.series.map((s) => ({
        ...s,
        values: s.values.filter((_, i) => i !== ci),
      })),
    })
  const addSeries = () =>
    onChange({
      ...spec,
      series: [
        ...spec.series,
        {
          name: t("Serie {number}", { number: spec.series.length + 1 }),
          color: null,
          values: spec.categories.map(() => 0),
        },
      ],
    })
  const removeSeries = (si: number) =>
    onChange({ ...spec, series: spec.series.filter((_, i) => i !== si) })

  const paste = (text: string) => {
    const table = parseTable(text)
    if (!table) {
      toast.error(t("Negli appunti non c'è una tabella"), {
        description: t(
          "Copia almeno due righe e due colonne da Excel o Fogli."
        ),
      })
      return false
    }
    setDrafts({})
    onChange({ ...spec, ...table })
    toast.success(
      t("Incollate {rows} righe e {series} serie", {
        rows: table.categories.length,
        series: table.series.length,
      })
    )
    return true
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("Dati del grafico")}</DialogTitle>
          <DialogDescription>
            {t(
              "Ogni riga è una categoria, ogni colonna una serie. Puoi incollare una tabella copiata da Excel, Numbers o Google Fogli."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_320px]">
          <div
            className="max-h-[62dvh] overflow-auto p-4"
            onPaste={(e) => {
              const text = e.clipboardData.getData("text/plain")
              // una cella sola si incolla normalmente; una tabella sostituisce
              if (/\t|\n.*[,;\t]/.test(text) && paste(text)) e.preventDefault()
            }}
          >
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th className="min-w-[120px] px-1 pb-1 text-left text-[11px] font-medium text-muted-foreground">
                    {t("Categoria")}
                  </th>
                  {spec.series.map((s, si) => (
                    <th key={si} className="min-w-[96px] px-1 pb-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: seriesColor(spec, si) }}
                        />
                        <input
                          value={s.name}
                          aria-label={t("Nome della serie {number}", {
                            number: si + 1,
                          })}
                          onChange={(e) =>
                            onChange({
                              ...spec,
                              series: spec.series.map((x, i) =>
                                i === si ? { ...x, name: e.target.value } : x
                              ),
                            })
                          }
                          className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-semibold outline-none hover:border-border focus:border-ring"
                        />
                        {spec.series.length > 1 ? (
                          <button
                            type="button"
                            aria-label={t("Elimina la serie")}
                            title={t("Elimina la serie")}
                            onClick={() => removeSeries(si)}
                            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th className="w-8">
                    {radial ? null : (
                      <button
                        type="button"
                        aria-label={t("Aggiungi una serie")}
                        title={t("Aggiungi una serie")}
                        onClick={addSeries}
                        className="flex size-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {spec.categories.map((cat, ci) => (
                  <tr key={ci} className="border-t border-border/60">
                    <td className="text-center">
                      {spec.categories.length > 1 ? (
                        <button
                          type="button"
                          aria-label={t("Elimina la riga")}
                          title={t("Elimina la riga")}
                          onClick={() => removeRow(ci)}
                          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      ) : null}
                    </td>
                    <td className="px-1 py-0.5">
                      <div className="flex items-center gap-1">
                        {radial ? (
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: sliceColor(spec, ci) }}
                          />
                        ) : null}
                        <input
                          value={cat}
                          aria-label={t("Categoria {number}", {
                            number: ci + 1,
                          })}
                          onChange={(e) =>
                            onChange({
                              ...spec,
                              categories: spec.categories.map((c, i) =>
                                i === ci ? e.target.value : c
                              ),
                            })
                          }
                          className="h-7 w-full rounded border border-border bg-background px-1.5 outline-none focus:border-ring"
                        />
                      </div>
                    </td>
                    {spec.series.map((s, si) => (
                      <td key={si} className="px-1 py-0.5">
                        <input
                          inputMode="decimal"
                          aria-label={`${s.name}, ${cat}`}
                          value={
                            drafts[`${si}:${ci}`] ??
                            String(s.values[ci] ?? 0).replace(
                              ".",
                              decimalMark()
                            )
                          }
                          onChange={(e) => setCell(si, ci, e.target.value)}
                          onBlur={() =>
                            setDrafts((d) => {
                              const next = { ...d }
                              delete next[`${si}:${ci}`]
                              return next
                            })
                          }
                          className="h-7 w-full rounded border border-border bg-background px-1.5 text-right tabular-nums outline-none focus:border-ring"
                        />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={addRow}
              >
                <Plus className="size-3.5" /> {t("Riga")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={async () => {
                  try {
                    paste(await navigator.clipboard.readText())
                  } catch {
                    toast.error(
                      t("Il browser non permette di leggere gli appunti"),
                      {
                        description: t("Clicca in una cella e premi ⌘V."),
                      }
                    )
                  }
                }}
              >
                <ClipboardPaste className="size-3.5" /> {t("Incolla da Excel")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(toTable(spec))
                    toast.success(t("Dati copiati: incollali in Excel"))
                  } catch {
                    toast.error(t("Copia non riuscita"))
                  }
                }}
              >
                <ClipboardCopy className="size-3.5" /> {t("Copia i dati")}
              </Button>
            </div>
          </div>
          <div className="hidden border-l border-border bg-muted/30 p-3 md:block">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              {t("Anteprima")}
            </p>
            <div className="rounded-lg bg-background p-1 ring-1 ring-border">
              <ChartSvg spec={spec} width={290} height={230} dark={dark} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
