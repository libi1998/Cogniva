"use client"

import { create } from "zustand"
import { nanoid } from "nanoid"
import { newDocTheme } from "./doc-design"
import type {
  BoardData,
  BoardEdge,
  BoardNode,
  BoardTheme,
  DocComment,
  DocData,
  DocSource,
  DocTheme,
  FileKind,
  InkStroke,
  MergeData,
  WFile,
} from "./types"
import { defaultBoardTheme, normalizeBoard, normalizeDoc } from "./types"
import { baseNode } from "./items"
import { hasIcon } from "./icon-library"
import { seedFiles } from "./seed"
import { STORAGE, readStorage, writeStorage } from "./storage"
import {
  loadFiles,
  persistenceAvailable,
  requestPersistence,
  saveFiles,
} from "./persist"
import { toast } from "sonner"

import { tr } from "@/lib/i18n/client"
const STORAGE_KEY = STORAGE.workspace

/* ------------------------------- history --------------------------------- */

type Hist = { past: BoardData[]; future: BoardData[] }
const history = new Map<string, Hist>()
const HIST_LIMIT = 80

function hist(id: string): Hist {
  let h = history.get(id)
  if (!h) {
    h = { past: [], future: [] }
    history.set(id, h)
  }
  return h
}

/* -------------------------------- store ---------------------------------- */

type State = {
  hydrated: boolean
  files: WFile[]
  historyTick: number

  hydrate: () => Promise<void>
  createFile: (kind: FileKind, title?: string) => string
  /** aggiunge un file già pronto (importazioni) e ne restituisce l'id */
  addFile: (file: WFile) => string
  /** sposta nel cestino: il file si può ancora ripristinare */
  trashFile: (id: string) => void
  restoreFile: (id: string) => void
  /** elimina per sempre, senza passare dal cestino */
  deleteForever: (id: string) => void
  emptyTrash: () => void
  duplicateFile: (id: string) => string | null
  renameFile: (id: string, title: string) => void
  setIcon: (id: string, icon: string) => void
  toggleStar: (id: string) => void

  snapshot: (id: string) => void
  undo: (id: string) => void
  redo: (id: string) => void
  canUndo: (id: string) => boolean
  canRedo: (id: string) => boolean

  mutateBoard: (id: string, fn: (d: BoardData) => BoardData | void) => void
  setBoardTheme: (id: string, patch: Partial<BoardTheme>) => void
  addNode: (
    id: string,
    node: Partial<BoardNode> & { x: number; y: number }
  ) => string
  addNodes: (
    id: string,
    nodes: (Partial<BoardNode> & { x: number; y: number })[]
  ) => string[]
  reorder: (
    id: string,
    ids: string[],
    dir: "front" | "back" | "forward" | "backward"
  ) => void
  updateNode: (id: string, nodeId: string, patch: Partial<BoardNode>) => void
  updateNodes: (
    id: string,
    nodeIds: string[],
    patch: Partial<BoardNode>
  ) => void
  removeSelection: (id: string, nodeIds: string[], edgeIds: string[]) => void
  addEdge: (
    id: string,
    edge: Partial<BoardEdge> & { from: string; to: string }
  ) => string
  updateEdge: (id: string, edgeId: string, patch: Partial<BoardEdge>) => void
  updateEdges: (
    id: string,
    edgeIds: string[],
    patch: Partial<BoardEdge>
  ) => void
  setViewport: (id: string, vp: { x: number; y: number; zoom: number }) => void

  setDocContent: (id: string, content: unknown) => void
  setDocTheme: (id: string, patch: Partial<DocTheme>) => void
  /** disegni a mano (scheda Disegno) */
  updateDocInk: (id: string, fn: (ink: InkStroke[]) => InkStroke[]) => void
  /** destinatari della stampa unione (scheda Corrispondenza) */
  setDocMerge: (id: string, merge: MergeData | undefined) => void
  /** commenti e fonti: ricevono il valore attuale e restituiscono il nuovo */
  updateDocComments: (
    id: string,
    fn: (list: DocComment[]) => DocComment[]
  ) => void
  updateDocSources: (id: string, fn: (list: DocSource[]) => DocSource[]) => void
}

const TRASH_TTL = 30 * 24 * 60 * 60 * 1000
let hydrating = false

/** I file salvati possono venire da versioni precedenti: si completano */
function normalizeFile(f: WFile): WFile {
  const title = typeof f.title === "string" ? f.title : tr("Senza titolo")
  const createdAt = Number.isFinite(f.createdAt) ? f.createdAt : Date.now()
  const updatedAt = Number.isFinite(f.updatedAt) ? f.updatedAt : createdAt
  // le emoji dei file sono diventate icone Lucide
  const icon =
    f.icon && hasIcon(f.icon)
      ? f.icon
      : f.kind === "board"
        ? "shapes"
        : "file-text"
  return f.kind === "board"
    ? { ...f, title, createdAt, updatedAt, icon, data: normalizeBoard(f.data) }
    : { ...f, title, createdAt, updatedAt, icon, data: normalizeDoc(f.data) }
}

/**
 * Tiene solo i file leggibili: un record rovinato (o un .json scritto a mano)
 * non deve impedire di aprire tutti gli altri.
 */
function normalizeAll(list: unknown[]): WFile[] {
  const out: WFile[] = []
  for (const raw of list) {
    const f = raw as WFile
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.id !== "string" ||
      (f.kind !== "doc" && f.kind !== "board")
    ) {
      continue
    }
    try {
      out.push(normalizeFile(f))
    } catch (err) {
      console.warn("File ignorato perché illeggibile", f.id, err)
    }
  }
  return out
}

function touch(f: WFile): WFile {
  return { ...f, updatedAt: Date.now() }
}

export const useStore = create<State>((set, get) => {
  return {
    hydrated: false,
    files: [],
    historyTick: 0,

    hydrate: async () => {
      if (get().hydrated || hydrating) return
      hydrating = true
      let files: WFile[] | null = null
      let fromLocalStorage = false
      // la lettura è riuscita (anche se il database era vuoto): solo allora si
      // può scrivere sopra senza rischiare di coprire dati che non si sono letti
      let readOk = !persistenceAvailable()
      if (persistenceAvailable()) {
        try {
          files = await loadFiles()
          readOk = true
        } catch (err) {
          console.warn("Lettura del database fallita", err)
        }
      }
      if (!files) {
        // prima apertura con IndexedDB: si recupera quello che c'era in
        // localStorage (anche dalla vecchia app)
        try {
          const raw = readStorage(STORAGE_KEY)
          if (raw) {
            files = JSON.parse(raw) as WFile[]
            fromLocalStorage = true
          }
        } catch {
          files = null
        }
      }
      let seeded = false
      if (!Array.isArray(files) || files.length === 0) {
        if (!readOk || readStorage(STORAGE.seeded) !== "1") {
          files = seedFiles()
          seeded = readOk
        } else {
          // lo spazio di lavoro è stato svuotato di proposito: niente esempi
          files = []
        }
      }
      const now = Date.now()
      const purged: string[] = []
      files = normalizeAll(files).filter((f) => {
        // il cestino si svuota da solo dopo 30 giorni
        const expired = f.deletedAt && now - f.deletedAt > TRASH_TTL
        if (expired) purged.push(f.id)
        return !expired
      })
      set({ files, hydrated: true })
      // da qui in poi i salvataggi riguardano solo i file che cambiano
      for (const f of files) lastSaved.set(f.id, f)
      // I file d'esempio si scrivono subito. Prima restavano solo in memoria
      // finché non si modificavano: bastava salvarne uno (anche solo spostando
      // la vista di una board) perché al caricamento successivo il database non
      // fosse più vuoto e tutti gli altri sparissero.
      const pending = fromLocalStorage || purged.length > 0 || seeded
      if (persistenceAvailable() && readOk) {
        if (pending) {
          try {
            await saveFiles(files, purged)
            if (fromLocalStorage) localStorage.removeItem(STORAGE_KEY)
          } catch (err) {
            reportSaveError(err)
          }
        }
        if (files.length || seeded) writeStorage(STORAGE.seeded, "1")
        void requestPersistence()
      }
    },

    addFile: (file) => {
      set({ files: [normalizeFile(file), ...get().files] })
      return file.id
    },

    trashFile: (id) =>
      set({
        files: get().files.map((f) =>
          f.id === id ? { ...f, deletedAt: Date.now(), starred: false } : f
        ),
      }),

    restoreFile: (id) =>
      set({
        files: get().files.map((f) => {
          if (f.id !== id) return f
          const rest = { ...f }
          delete rest.deletedAt
          return rest
        }),
      }),

    deleteForever: (id) => {
      history.delete(id)
      set({ files: get().files.filter((f) => f.id !== id) })
    },

    emptyTrash: () => {
      const files = get().files
      for (const f of files) if (f.deletedAt) history.delete(f.id)
      set({ files: files.filter((f) => !f.deletedAt) })
    },

    createFile: (kind, title) => {
      const id = nanoid(10)
      const now = Date.now()
      const base = {
        id,
        kind,
        title:
          title ??
          (kind === "board"
            ? tr("Board senza titolo")
            : tr("Doc senza titolo")),
        icon: kind === "board" ? "shapes" : "file-text",
        createdAt: now,
        updatedAt: now,
      }
      const file: WFile =
        kind === "board"
          ? {
              ...base,
              kind: "board",
              data: { nodes: [], edges: [], theme: { ...defaultBoardTheme } },
            }
          : {
              ...base,
              kind: "doc",
              data: { content: null, theme: newDocTheme() },
            }
      set({ files: [file, ...get().files] })
      return id
    },

    duplicateFile: (id) => {
      const f = get().files.find((x) => x.id === id)
      if (!f) return null
      const newId = nanoid(10)
      const copy = {
        ...structuredClone(f),
        id: newId,
        title: tr("{title} (copia)", { title: f.title }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as WFile
      const idx = get().files.findIndex((x) => x.id === id)
      const files = [...get().files]
      files.splice(idx + 1, 0, copy)
      set({ files })
      return newId
    },

    renameFile: (id, title) =>
      set({
        files: get().files.map((f) =>
          f.id === id ? touch({ ...f, title }) : f
        ),
      }),

    setIcon: (id, icon) =>
      set({
        files: get().files.map((f) =>
          f.id === id ? touch({ ...f, icon }) : f
        ),
      }),

    toggleStar: (id) =>
      set({
        files: get().files.map((f) =>
          f.id === id ? { ...f, starred: !f.starred } : f
        ),
      }),

    /* ------------------------------ history ------------------------------- */

    snapshot: (id) => {
      const f = get().files.find((x) => x.id === id)
      if (!f || f.kind !== "board") return
      const h = hist(id)
      h.past.push(structuredClone(f.data))
      if (h.past.length > HIST_LIMIT) h.past.shift()
      h.future = []
      set({ historyTick: get().historyTick + 1 })
    },

    undo: (id) => {
      const h = hist(id)
      const prev = h.past.pop()
      if (!prev) return
      const files = get().files.map((f) => {
        if (f.id !== id || f.kind !== "board") return f
        h.future.push(structuredClone(f.data))
        return touch({ ...f, data: prev })
      })
      set({ files, historyTick: get().historyTick + 1 })
    },

    redo: (id) => {
      const h = hist(id)
      const next = h.future.pop()
      if (!next) return
      const files = get().files.map((f) => {
        if (f.id !== id || f.kind !== "board") return f
        h.past.push(structuredClone(f.data))
        return touch({ ...f, data: next })
      })
      set({ files, historyTick: get().historyTick + 1 })
    },

    canUndo: (id) => hist(id).past.length > 0,
    canRedo: (id) => hist(id).future.length > 0,

    /* ------------------------------- board -------------------------------- */

    mutateBoard: (id, fn) => {
      set({
        files: get().files.map((f) => {
          if (f.id !== id || f.kind !== "board") return f
          const draft = {
            ...f.data,
            nodes: [...f.data.nodes],
            edges: [...f.data.edges],
          }
          const res = fn(draft)
          return touch({ ...f, data: (res ?? draft) as BoardData })
        }),
      })
    },

    setBoardTheme: (id, patch) =>
      get().mutateBoard(id, (d) => {
        d.theme = {
          ...d.theme,
          ...patch,
          arrows: { ...d.theme.arrows, ...(patch.arrows ?? {}) },
        }
      }),

    addNode: (id, node) => {
      const nodeId = nanoid(8)
      get().mutateBoard(id, (d) => {
        // l'id generato va DOPO lo spread: `node` può contenere l'id di origine
        // (duplica, incolla) e sovrascriverebbe quello nuovo, creando doppioni
        d.nodes.push({ ...baseNode(d.theme), ...node, id: nodeId } as BoardNode)
      })
      return nodeId
    },

    addNodes: (id, nodes) => {
      const ids: string[] = []
      get().mutateBoard(id, (d) => {
        for (const n of nodes) {
          const nid = nanoid(8)
          ids.push(nid)
          d.nodes.push({ ...baseNode(d.theme), ...n, id: nid } as BoardNode)
        }
      })
      return ids
    },

    reorder: (id, ids, dir) =>
      get().mutateBoard(id, (d) => {
        const sel = new Set(ids)
        const picked = d.nodes.filter((n) => sel.has(n.id))
        const rest = d.nodes.filter((n) => !sel.has(n.id))
        if (dir === "front") d.nodes = [...rest, ...picked]
        else if (dir === "back") d.nodes = [...picked, ...rest]
        else {
          const arr = [...d.nodes]
          const idxs = arr
            .map((n, i) => (sel.has(n.id) ? i : -1))
            .filter((i) => i >= 0)
          if (dir === "forward") {
            for (let k = idxs.length - 1; k >= 0; k--) {
              const i = idxs[k]
              if (i < arr.length - 1 && !sel.has(arr[i + 1].id)) {
                ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
              }
            }
          } else {
            for (const i of idxs) {
              if (i > 0 && !sel.has(arr[i - 1].id)) {
                ;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
              }
            }
          }
          d.nodes = arr
        }
      }),

    updateNode: (id, nodeId, patch) =>
      get().mutateBoard(id, (d) => {
        d.nodes = d.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n))
      }),

    updateNodes: (id, nodeIds, patch) =>
      get().mutateBoard(id, (d) => {
        const s = new Set(nodeIds)
        d.nodes = d.nodes.map((n) => (s.has(n.id) ? { ...n, ...patch } : n))
      }),

    removeSelection: (id, nodeIds, edgeIds) =>
      get().mutateBoard(id, (d) => {
        const ns = new Set(nodeIds)
        const es = new Set(edgeIds)
        d.nodes = d.nodes.filter((n) => !ns.has(n.id))
        d.edges = d.edges.filter(
          (e) => !es.has(e.id) && !ns.has(e.from) && !ns.has(e.to)
        )
      }),

    addEdge: (id, edge) => {
      const edgeId = nanoid(8)
      get().mutateBoard(id, (d) => {
        const exists = d.edges.some(
          (e) => e.from === edge.from && e.to === edge.to
        )
        if (exists && !edge.fromSide) return
        d.edges.push({
          fromSide: "auto",
          toSide: "auto",
          label: "",
          routing: null,
          head: null,
          tail: null,
          style: null,
          color: null,
          width: null,
          ...edge,
          id: edgeId,
        } as BoardEdge)
      })
      return edgeId
    },

    updateEdge: (id, edgeId, patch) =>
      get().mutateBoard(id, (d) => {
        d.edges = d.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e))
      }),

    updateEdges: (id, edgeIds, patch) =>
      get().mutateBoard(id, (d) => {
        const s = new Set(edgeIds)
        d.edges = d.edges.map((e) => (s.has(e.id) ? { ...e, ...patch } : e))
      }),

    setViewport: (id, vp) => {
      // non marca il file come modificato
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "board"
            ? { ...f, data: { ...f.data, viewport: vp } }
            : f
        ),
      })
    },

    /* -------------------------------- doc --------------------------------- */

    setDocContent: (id, content) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({ ...f, data: { ...f.data, content } as DocData })
            : f
        ),
      }),

    updateDocComments: (id, fn) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({
                ...f,
                data: { ...f.data, comments: fn(f.data.comments ?? []) },
              })
            : f
        ),
      }),

    updateDocSources: (id, fn) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({
                ...f,
                data: { ...f.data, sources: fn(f.data.sources ?? []) },
              })
            : f
        ),
      }),

    updateDocInk: (id, fn) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({ ...f, data: { ...f.data, ink: fn(f.data.ink ?? []) } })
            : f
        ),
      }),

    setDocMerge: (id, merge) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({ ...f, data: { ...f.data, merge } })
            : f
        ),
      }),

    setDocTheme: (id, patch) =>
      set({
        files: get().files.map((f) =>
          f.id === id && f.kind === "doc"
            ? touch({
                ...f,
                data: { ...f.data, theme: { ...f.data.theme, ...patch } },
              })
            : f
        ),
      }),
  }
})

/* ----------------------------- persistenza ------------------------------- */

/** L'ultima versione scritta di ogni file: si riscrive solo quello che cambia */
const lastSaved = new Map<string, WFile>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> = Promise.resolve()
let errorShown = false

function reportSaveError(err: unknown) {
  console.error("Salvataggio fallito", err)
  if (errorShown) return
  errorShown = true
  toast.error(tr("Non riesco a salvare le modifiche"), {
    description: tr(
      "Lo spazio del browser potrebbe essere pieno: esporta lo spazio di lavoro dalla home per non perdere il lavoro."
    ),
    duration: 12000,
  })
}

function writeNow() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const { hydrated, files } = useStore.getState()
  if (!hydrated || !persistenceAvailable()) return saving
  const changed = files.filter((f) => lastSaved.get(f.id) !== f)
  const ids = new Set(files.map((f) => f.id))
  const removed = [...lastSaved.keys()].filter((id) => !ids.has(id))
  if (!changed.length && !removed.length) return saving
  // si segna subito come salvato: una modifica che arriva durante la scrittura
  // produce un oggetto nuovo e verrà riscritta al giro dopo
  for (const f of changed) lastSaved.set(f.id, f)
  for (const id of removed) lastSaved.delete(id)
  saving = saving
    .then(() => saveFiles(changed, removed))
    .then(() => {
      errorShown = false
    })
    .catch((err) => {
      for (const f of changed) lastSaved.delete(f.id)
      reportSaveError(err)
    })
  return saving
}

if (typeof window !== "undefined") {
  // la lettura parte appena il modulo arriva nel browser, senza aspettare
  // che React finisca di idratare la pagina
  void useStore.getState().hydrate()
  useStore.subscribe((state, prev) => {
    if (!state.hydrated || state.files === prev.files) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(writeNow, 250)
  })
  // chiudere la scheda o cambiare pagina non deve mangiarsi l'ultima modifica
  const flush = () => void flushWorkspace()
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
}

/* -------------------------------- helper --------------------------------- */

/**
 * Lo stato attuale fuori dal ciclo di React (gestori di eventi, comandi).
 * Ha un nome che non comincia per «use»: il React Compiler scambierebbe
 * `useStore.getState()` per un hook usato come valore e salterebbe il
 * componente.
 */
export function getWorkspace() {
  return useStore.getState()
}

export function exportWorkspace() {
  return JSON.stringify(useStore.getState().files, null, 2)
}

/**
 * Aggiunge i file di un'esportazione allo spazio di lavoro. Non sostituisce
 * niente: un file con lo stesso id riceve un id nuovo e resta accanto
 * all'originale.
 */
export function importWorkspace(json: string): number {
  const raw: unknown = JSON.parse(json)
  if (!Array.isArray(raw)) throw new Error(tr("Formato non valido"))
  const current = useStore.getState().files
  const ids = new Set(current.map((f) => f.id))
  const incoming = normalizeAll(raw).map((f) => {
    if (!ids.has(f.id)) {
      ids.add(f.id)
      return f
    }
    const id = nanoid(10)
    ids.add(id)
    return { ...f, id }
  })
  useStore.setState({ files: [...incoming, ...current] })
  return incoming.length
}

/** Scrive subito le modifiche in attesa */
export function flushWorkspace() {
  return writeNow()
}
