import { FileText, Shapes } from "lucide-react"

/** Le card dei file mentre lo spazio di lavoro si carica */
export function FileGridSkeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,228px),1fr))] gap-3 sm:gap-4"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="aspect-[4/3] w-full skeleton rounded-none" />
          <div className="flex items-start gap-2 p-3">
            {i % 2 ? (
              <Shapes className="mt-px size-4 shrink-0 text-muted-foreground/40" />
            ) : (
              <FileText className="mt-px size-4 shrink-0 text-muted-foreground/40" />
            )}
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <span className="block h-3.5 w-3/4 skeleton" />
              <span className="block h-2.5 w-1/3 skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
