import {
  FileText,
  Gauge,
  Images,
  Library,
  QrCode,
  Signature,
} from "lucide-react"
import type { AddinId } from "@/lib/addins"

export const ADDIN_ICONS: Record<
  AddinId,
  (className: string) => React.ReactNode
> = {
  qr: (c) => <QrCode className={c} />,
  readability: (c) => <Gauge className={c} />,
  placeholder: (c) => <FileText className={c} />,
  signature: (c) => <Signature className={c} />,
  wikipedia: (c) => <Library className={c} />,
  openverse: (c) => <Images className={c} />,
}

/** Colori delle tessere nella raccolta: riconoscibili a colpo d'occhio */
export const ADDIN_TINTS: Record<AddinId, string> = {
  qr: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  readability: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  placeholder: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  signature: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  wikipedia: "bg-stone-500/15 text-stone-800 dark:text-stone-200",
  openverse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
}
