/**
 * Modelli 3D: le forme pronte, le visualizzazioni predefinite (come la
 * raccolta «Visualizzazioni modello 3D» di Word) e i controlli sui file.
 * Nessuna dipendenza da three.js: lo usano anche barra e pannello.
 */

export type Shape3D =
  | "cube"
  | "sphere"
  | "cylinder"
  | "cone"
  | "pyramid"
  | "torus"
  | "knot"
  | "capsule"
  | "gem"
  | "dodecahedron"
  | "octahedron"
  | "ring"

export const SHAPES_3D: { value: Shape3D; label: string }[] = [
  { value: "cube", label: "Cubo" },
  { value: "sphere", label: "Sfera" },
  { value: "cylinder", label: "Cilindro" },
  { value: "cone", label: "Cono" },
  { value: "pyramid", label: "Piramide" },
  { value: "torus", label: "Ciambella" },
  { value: "knot", label: "Nodo" },
  { value: "capsule", label: "Capsula" },
  { value: "gem", label: "Gemma" },
  { value: "dodecahedron", label: "Dodecaedro" },
  { value: "octahedron", label: "Ottaedro" },
  { value: "ring", label: "Anello" },
]

export const isShape3D = (value: string): value is Shape3D =>
  SHAPES_3D.some((s) => s.value === value)

export type View3D = { yaw: number; pitch: number; zoom: number }

export const DEFAULT_VIEW: View3D = { yaw: 35, pitch: 22, zoom: 1 }

export const VIEW_PRESETS: { label: string; title?: string; view: View3D }[] = [
  { label: "Frontale", view: { yaw: 0, pitch: 0, zoom: 1 } },
  { label: "Posteriore", view: { yaw: 180, pitch: 0, zoom: 1 } },
  { label: "Sinistra", view: { yaw: -90, pitch: 0, zoom: 1 } },
  { label: "Destra", view: { yaw: 90, pitch: 0, zoom: 1 } },
  { label: "Dall'alto", view: { yaw: 0, pitch: 89, zoom: 1 } },
  { label: "Dal basso", view: { yaw: 0, pitch: -89, zoom: 1 } },
  {
    label: "Alto a sinistra",
    title: "Isometrica in alto a sinistra",
    view: { yaw: -45, pitch: 35, zoom: 1 },
  },
  {
    label: "Alto a destra",
    title: "Isometrica in alto a destra",
    view: { yaw: 45, pitch: 35, zoom: 1 },
  },
  {
    label: "Basso a sinistra",
    title: "Isometrica in basso a sinistra",
    view: { yaw: -45, pitch: -30, zoom: 1 },
  },
  {
    label: "Basso a destra",
    title: "Isometrica in basso a destra",
    view: { yaw: 45, pitch: -30, zoom: 1 },
  },
]

/** Solo modelli glTF autonomi: binari (.glb) o JSON con i dati incorporati */
export const MODEL_ACCEPT = ".glb,.gltf,model/gltf-binary,model/gltf+json"
export const MAX_MODEL_BYTES = 40 * 1024 * 1024

/** Indirizzi ammessi per un modello: file incorporati o https */
export function safeModelSrc(src: string) {
  const value = src.trim()
  if (
    /^data:(model\/gltf-binary|model\/gltf\+json|application\/octet-stream|application\/json);base64,/i.test(
      value
    )
  )
    return value
  if (/^https:\/\//i.test(value)) return value
  return ""
}

export function readModelFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      reject(new Error("Scegli un modello glTF (.glb o .gltf)."))
      return
    }
    if (file.size > MAX_MODEL_BYTES) {
      reject(
        new Error("Il modello supera i 40 MB: riducilo prima di inserirlo.")
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result)
      const type = /\.glb$/i.test(file.name)
        ? "model/gltf-binary"
        : "model/gltf+json"
      resolve(raw.replace(/^data:[^;,]*/, `data:${type}`))
    }
    reader.onerror = () => reject(new Error("Non riesco a leggere il file."))
    reader.readAsDataURL(file)
  })
}
