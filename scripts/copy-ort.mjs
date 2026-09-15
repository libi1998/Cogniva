/**
 * Copia i motori WebAssembly di onnxruntime-web in public/ort: traduzione e
 * voci neurali girano sul dispositivo e li caricano dallo stesso sito, senza
 * CDN esterni (la Content Security Policy resta chiusa).
 */
import { copyFile, mkdir, readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"

const from = await realpath(
  path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist")
)
const to = path.join(process.cwd(), "public", "ort")
await mkdir(to, { recursive: true })

const files = (await readdir(from)).filter(
  (f) => /^ort-wasm-simd-threaded(\.(jsep|asyncify))?\.(wasm|mjs)$/.test(f)
)
let copied = 0
for (const file of files) {
  const src = path.join(from, file)
  const dest = path.join(to, file)
  const [a, b] = await Promise.all([stat(src), stat(dest).catch(() => null)])
  if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue
  await copyFile(src, dest)
  copied += 1
}
console.log(`onnxruntime-web: ${files.length} file in public/ort (${copied} aggiornati)`)
