/**
 * I pezzi di fontkit che usa l'esportazione vettoriale: la libreria non ha
 * i suoi tipi.
 */
declare module "fontkit" {
  export type PathCommand = {
    command:
      "moveTo" | "lineTo" | "quadraticCurveTo" | "bezierCurveTo" | "closePath"
    args: number[]
  }
  export type BBox = { minX: number; minY: number; maxX: number; maxY: number }
  export type Path = { commands: PathCommand[]; bbox: BBox }
  export type Glyph = {
    id: number
    path: Path
    advanceWidth: number
    codePoints: number[]
  }
  export type GlyphPosition = {
    xAdvance: number
    yAdvance: number
    xOffset: number
    yOffset: number
  }
  export type GlyphRun = { glyphs: Glyph[]; positions: GlyphPosition[] }
  export type Font = {
    unitsPerEm: number
    ascent: number
    descent: number
    underlinePosition: number
    underlineThickness: number
    xHeight: number
    variationAxes: Record<string, { min: number; default: number; max: number }>
    variationCoords: number[] | null
    layout: (
      text: string,
      features?: string[] | Record<string, boolean>
    ) => GlyphRun
    getGlyph: (id: number) => Glyph
    hasGlyphForCodePoint: (codePoint: number) => boolean
  }
  export function create(buffer: Uint8Array): Font
}
