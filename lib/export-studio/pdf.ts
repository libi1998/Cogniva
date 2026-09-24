/**
 * Un PDF scritto a mano, senza librerie e senza la stampa del browser.
 *
 * Ogni pagina è un'immagine (JPEG, oppure pixel compressi senza perdita) e,
 * sopra, un livello di testo invisibile nella posizione delle parole: il PDF
 * si vede esattamente come il documento e il testo resta selezionabile e
 * ricercabile. Il testo usa Helvetica, uno dei caratteri che ogni lettore PDF
 * ha già, con la codifica WinAnsi: copre le sei lingue dell'app. Ogni parola
 * viene allungata o stretta (Tz) fino alla larghezza che ha sulla pagina.
 */

export type PdfImage =
  | { kind: "jpeg"; data: Uint8Array; width: number; height: number }
  | {
      kind: "flate"
      data: Uint8Array
      width: number
      height: number
      /** un solo canale invece di tre: le pagine in bianco e nero pesano meno */
      gray: boolean
    }

/** Una parola, in punti tipografici; `y` è la linea di base dall'alto */
export type PdfWord = {
  text: string
  x: number
  y: number
  width: number
  size: number
}

const encoder = new TextEncoder()

export class PdfWriter {
  private parts: Uint8Array[] = []
  private length = 0
  private offsets: number[] = []
  private pageRefs: number[] = []
  /** 1 catalogo, 2 albero delle pagine, 3 carattere, 4 informazioni */
  private next = 5

  constructor() {
    // il commento con byte alti dice ai programmi che il file è binario
    this.write("%PDF-1.7\n%âãÏÓ\n", true)
  }

  private write(chunk: string | Uint8Array, latin1 = false) {
    const bytes =
      typeof chunk !== "string"
        ? chunk
        : latin1
          ? Uint8Array.from(chunk, (c) => c.charCodeAt(0) & 0xff)
          : encoder.encode(chunk)
    this.parts.push(bytes)
    this.length += bytes.length
  }

  private object(id: number, body: string, stream?: Uint8Array) {
    this.offsets[id] = this.length
    this.write(`${id} 0 obj\n${body}\n`)
    if (stream) {
      this.write("stream\n")
      this.write(stream)
      this.write("\nendstream\n")
    }
    this.write("endobj\n")
  }

  /** Aggiunge una pagina; misure in punti (1 pt = 1/72 di pollice) */
  async addPage(page: {
    width: number
    height: number
    image: PdfImage
    words?: PdfWord[]
  }) {
    const pageId = this.next++
    const contentId = this.next++
    const imageId = this.next++
    const { width: w, height: h, image } = page

    const imageDict =
      image.kind === "jpeg"
        ? `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`
        : `/ColorSpace /${image.gray ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8 /Filter /FlateDecode`
    this.object(
      imageId,
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ${imageDict} /Length ${image.data.length} >>`,
      image.data
    )

    let content = `q ${n(w)} 0 0 ${n(h)} 0 0 cm /Im0 Do Q\n`
    if (page.words?.length) content += textLayer(page.words, h)
    const raw = Uint8Array.from(content, (c) => c.charCodeAt(0) & 0xff)
    const packed = await deflate(raw)
    this.object(
      contentId,
      packed
        ? `<< /Length ${packed.length} /Filter /FlateDecode >>`
        : `<< /Length ${raw.length} >>`,
      packed ?? raw
    )

    this.object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(w)} ${n(h)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    )
    this.pageRefs.push(pageId)
  }

  /** Chiude il file: albero delle pagine, informazioni e indice degli oggetti */
  finish(meta: { title: string; language?: string }): Blob {
    this.object(
      1,
      `<< /Type /Catalog /Pages 2 0 R${meta.language ? ` /Lang (${ascii(meta.language)})` : ""} /ViewerPreferences << /DisplayDocTitle true >> >>`
    )
    this.object(
      2,
      `<< /Type /Pages /Kids [${this.pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pageRefs.length} >>`
    )
    this.object(
      3,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )
    this.object(
      4,
      `<< /Title ${utf16(meta.title)} /Producer (Cogniva) /Creator (Cogniva) /CreationDate (${pdfDate(new Date())}) >>`
    )

    const xref = this.length
    const count = this.next
    let table = `xref\n0 ${count}\n0000000000 65535 f \n`
    for (let id = 1; id < count; id++) {
      table += `${String(this.offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`
    }
    this.write(table)
    this.write(
      `trailer\n<< /Size ${count} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    )
    return new Blob(this.parts as BlobPart[], { type: "application/pdf" })
  }
}

/* ------------------------------- testo --------------------------------- */

export function textLayer(words: PdfWord[], pageHeight: number) {
  let out = "BT 3 Tr\n"
  for (const word of words) {
    const text = winAnsi(word.text)
    if (!text.trim()) continue
    const natural = (textWidth(text.trimEnd()) / 1000) * word.size
    if (natural <= 0 || word.width <= 0) continue
    const squeeze = Math.max(1, Math.min(1000, (word.width / natural) * 100))
    out += `/F1 ${n(word.size)} Tf ${n(squeeze)} Tz 1 0 0 1 ${n(word.x)} ${n(pageHeight - word.y)} Tm (${escape(text)}) Tj\n`
  }
  return `${out}ET\n`
}

/** I caratteri 0x80–0x9f di WinAnsi che non coincidono con Latin-1 */
const CP1252: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
}

/** Il testo come byte WinAnsi (una stringa di codici 0–255) */
function winAnsi(text: string) {
  let out = ""
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 0x09 || code === 0x0a || code === 0x0d) out += " "
    else if (code >= 0x20 && code < 0x7f) out += ch
    else if (code >= 0xa0 && code <= 0xff) out += String.fromCharCode(code)
    else if (CP1252[ch]) out += String.fromCharCode(CP1252[ch])
    else if (code === 0x2009 || code === 0x202f || code === 0x200a) out += " "
    else {
      // lettere con accenti che WinAnsi non ha: resta la lettera base
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "")
      if (base && base.charCodeAt(0) < 0x7f) out += base
    }
  }
  return out
}

export function escape(bytes: string) {
  let out = ""
  for (const ch of bytes) {
    const code = ch.charCodeAt(0)
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`
    else if (code < 0x20 || code > 0x7e)
      out += `\\${code.toString(8).padStart(3, "0")}`
    else out += ch
  }
  return out
}

/** Larghezze di Helvetica in millesimi di em (metriche AFM standard) */
const WIDTHS: Record<string, number> = (() => {
  const table: Record<string, number> = {}
  const set = (chars: string, width: number) => {
    for (const ch of chars) table[ch] = width
  }
  set(" !,./:;I[\\]ft", 278)
  set('"', 355)
  set("#$0123456789?L_abdeghnopqu", 556)
  set("%", 889)
  set("&ABEKPSVXY", 667)
  set("'", 191)
  set("()-`r", 333)
  set("*", 389)
  set("+<=>~", 584)
  set("@", 1015)
  set("CDHNRUw", 722)
  set("FTZ", 611)
  set("GOQ", 778)
  set("J", 500)
  set("M", 833)
  set("W", 944)
  set("^", 469)
  set("ckmsvxyz", 500)
  set("ijl", 222)
  set("m", 833)
  set("{}", 334)
  set("|", 260)
  table[String.fromCharCode(0x85)] = 1000 // …
  table[String.fromCharCode(0x97)] = 1000 // —
  table[String.fromCharCode(0x96)] = 556 // –
  table[String.fromCharCode(0x91)] = 222 // ‘
  table[String.fromCharCode(0x92)] = 222 // ’
  table[String.fromCharCode(0x93)] = 333 // “
  table[String.fromCharCode(0x94)] = 333 // ”
  table[String.fromCharCode(0x95)] = 350 // •
  table[String.fromCharCode(0x80)] = 556 // €
  table[String.fromCharCode(0x99)] = 1000 // ™
  table[String.fromCharCode(0xab)] = 556 // «
  table[String.fromCharCode(0xbb)] = 556 // »
  table[String.fromCharCode(0xb0)] = 400 // °
  return table
})()

function textWidth(bytes: string) {
  let total = 0
  for (const ch of bytes) {
    let width = WIDTHS[ch]
    if (width === undefined) {
      // le lettere accentate misurano come la lettera base
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "")
      width = WIDTHS[base] ?? 556
    }
    total += width
  }
  return total
}

/* ------------------------------ supporto ------------------------------- */

export const n = (value: number) => {
  const fixed = value.toFixed(2)
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
}

export const ascii = (text: string) => escape(text.replace(/[^\x20-\x7e]/g, ""))

/** Stringa Unicode per il dizionario delle informazioni: UTF-16BE con BOM */
export function utf16(text: string) {
  let hex = "FEFF"
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).padStart(4, "0")
  }
  return `<${hex.toUpperCase()}>`
}

export function pdfDate(date: Date) {
  const p = (v: number) => String(v).padStart(2, "0")
  return `D:${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

/**
 * Comprime con zlib (il formato che il PDF chiama FlateDecode). Dove il
 * browser non ha CompressionStream restituisce null.
 */
export async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
