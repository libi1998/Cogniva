"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  ArrowUpDown,
  BringToFront,
  Columns3,
  Copy,
  CornerUpLeft,
  Lock,
  LockOpen,
  Pencil,
  Rows3,
  Scissors,
  SendToBack,
  SquarePlus,
  Table2,
  Trash2,
  Group,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getWorkspace } from "@/lib/store"
import {
  makeItem,
  tableAddCol,
  tableAddRow,
  tableRemoveCol,
  tableRemoveRow,
} from "@/lib/items"
import type { BoardData } from "@/lib/types"
import type { Selection } from "./board-canvas"

export type MenuState = {
  type: "canvas" | "node" | "edge"
  id?: string
  x: number
  y: number
}

export function BoardContextMenu({
  state,
  onClose,
  fileId,
  data,
  selection,
  setSelection,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onEditText,
  worldAt,
}: {
  state: MenuState | null
  onClose: () => void
  fileId: string
  data: BoardData
  selection: Selection
  setSelection: React.Dispatch<React.SetStateAction<Selection>>
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDuplicate: () => void
  onEditText: (id: string) => void
  worldAt: (cx: number, cy: number) => { x: number; y: number }
}) {
  const store = getWorkspace()
  if (!state) return null

  const node =
    state.type === "node"
      ? data.nodes.find((n) => n.id === state.id)
      : undefined
  const edge =
    state.type === "edge"
      ? data.edges.find((e) => e.id === state.id)
      : undefined
  const targets =
    selection.nodes.length && node && selection.nodes.includes(node.id)
      ? selection.nodes
      : node
        ? [node.id]
        : []

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const addAt = (spec: Parameters<typeof makeItem>[0]) =>
    run(() => {
      const w = worldAt(state.x, state.y)
      const item = makeItem(spec, data.theme)
      store.snapshot(fileId)
      const id = store.addNode(fileId, {
        ...item,
        x: Math.round(w.x - item.w / 2),
        y: Math.round(w.y - item.h / 2),
      })
      setSelection({ nodes: [id], edges: [] })
    })

  const reorder = (dir: "front" | "back" | "forward" | "backward") =>
    run(() => {
      store.snapshot(fileId)
      store.reorder(fileId, targets, dir)
    })

  const patchTable = (fn: (t: NonNullable<typeof node>["table"]) => unknown) =>
    run(() => {
      if (!node?.table) return
      store.snapshot(fileId)
      store.updateNode(fileId, node.id, { table: fn(node.table) as never })
    })

  return (
    <DropdownMenu open onOpenChange={(o) => !o && onClose()}>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span
            aria-hidden
            style={{
              position: "fixed",
              left: state.x,
              top: state.y,
              width: 1,
              height: 1,
            }}
          />
        }
      />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        className="w-56"
      >
        {state.type === "canvas" ? (
          <>
            <DropdownMenuItem onClick={run(onPaste)}>
              <CornerUpLeft className="size-4" /> Incolla
              <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() =>
                setSelection({
                  nodes: data.nodes.map((n) => n.id),
                  edges: data.edges.map((e) => e.id),
                })
              )}
            >
              <Group className="size-4" /> Seleziona tutto
              <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SquarePlus className="size-4" /> Aggiungi qui
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={addAt({ kind: "shape", shape: "rounded" })}
                >
                  Card
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addAt({ kind: "shape", shape: "note" })}
                >
                  Post-it
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addAt({ kind: "shape", shape: "text" })}
                >
                  Testo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addAt({ kind: "section" })}>
                  Sezione
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addAt({ kind: "frame", frame: "plain" })}
                >
                  Frame
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addAt({ kind: "table" })}>
                  Tabella
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addAt({ kind: "chart" })}>
                  Grafico
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}

        {node ? (
          <>
            {node.kind !== "icon" && node.kind !== "draw" ? (
              <DropdownMenuItem onClick={run(() => onEditText(node.id))}>
                <Pencil className="size-4" /> Modifica testo
                <DropdownMenuShortcut>⏎</DropdownMenuShortcut>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={run(onCopy)}>
              <Copy className="size-4" /> Copia
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={run(onCut)}>
              <Scissors className="size-4" /> Taglia
              <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={run(onDuplicate)}>
              <Copy className="size-4" /> Duplica
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <BringToFront className="size-4" /> Ordina
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={reorder("front")}>
                  <BringToFront className="size-4" /> Porta davanti
                </DropdownMenuItem>
                <DropdownMenuItem onClick={reorder("forward")}>
                  Porta avanti
                </DropdownMenuItem>
                <DropdownMenuItem onClick={reorder("backward")}>
                  Porta indietro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={reorder("back")}>
                  <SendToBack className="size-4" /> Porta in fondo
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {node.kind === "table" ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Table2 className="size-4" /> Tabella
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={patchTable((t) => tableAddRow(t!))}
                  >
                    <Rows3 className="size-4" /> Aggiungi riga
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={patchTable((t) => tableAddCol(t!))}
                  >
                    <Columns3 className="size-4" /> Aggiungi colonna
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={patchTable((t) => tableRemoveRow(t!, t!.rows - 1))}
                  >
                    Rimuovi ultima riga
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={patchTable((t) => tableRemoveCol(t!, t!.cols - 1))}
                  >
                    Rimuovi ultima colonna
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={patchTable((t) => ({ ...t!, header: !t!.header }))}
                  >
                    {node.table?.header
                      ? "Togli intestazione"
                      : "Aggiungi intestazione"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={patchTable((t) => ({
                      ...t!,
                      striped: !t!.striped,
                    }))}
                  >
                    {node.table?.striped ? "Righe uniformi" : "Righe alternate"}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}

            <DropdownMenuItem
              onClick={run(() => {
                store.snapshot(fileId)
                store.updateNodes(fileId, targets, { locked: !node.locked })
              })}
            >
              {node.locked ? (
                <LockOpen className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
              {node.locked ? "Sblocca" : "Blocca"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={run(() => {
                store.snapshot(fileId)
                store.removeSelection(fileId, targets, [])
                setSelection({ nodes: [], edges: [] })
              })}
            >
              <Trash2 className="size-4" /> Elimina
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}

        {edge ? (
          <>
            <DropdownMenuItem
              onClick={run(() => {
                store.snapshot(fileId)
                store.updateEdge(fileId, edge.id, {
                  from: edge.to,
                  to: edge.from,
                  fromSide: edge.toSide,
                  toSide: edge.fromSide,
                })
              })}
            >
              <ArrowLeftRight className="size-4" /> Inverti direzione
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() => {
                store.snapshot(fileId)
                store.updateEdge(fileId, edge.id, {
                  head: edge.head === "none" ? "arrow" : "none",
                  tail: edge.tail === "none" ? "arrow" : "none",
                })
              })}
            >
              <ArrowUpDown className="size-4" /> Inverti le punte
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() => {
                store.snapshot(fileId)
                store.updateEdge(fileId, edge.id, {
                  routing: null,
                  head: null,
                  tail: null,
                  style: null,
                  color: null,
                  width: null,
                })
              })}
            >
              <CornerUpLeft className="size-4" /> Usa lo stile della board
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={run(() => {
                store.snapshot(fileId)
                store.removeSelection(fileId, [], [edge.id])
                setSelection({ nodes: [], edges: [] })
              })}
            >
              <Trash2 className="size-4" /> Elimina
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
