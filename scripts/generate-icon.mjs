// Generates build/icon.png - the Windows app icon for electron-builder.
// No image dependencies: it rasterizes a simple brand mark (green rounded
// tile with a white ring, echoing the in-app headset badge's color) straight
// to RGBA pixels and encodes a valid PNG with Node's built-in zlib.
//
// Run via `npm run icon` (build:desktop does this automatically). The output
// is a build artifact and is gitignored; it regenerates deterministically.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const GREEN = [34, 91, 70]
const WHITE = [255, 255, 255]

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

// Coverage of a pixel by a shape, sampled 2x2 for cheap anti-aliasing.
function coverage(px, py, test) {
  let hits = 0
  for (const ox of [0.25, 0.75]) {
    for (const oy of [0.25, 0.75]) {
      if (test(px + ox, py + oy)) hits++
    }
  }
  return hits / 4
}

const c = SIZE / 2
const tileRadius = 96 // rounded-corner radius of the tile
const inset = 40 // margin from canvas edge to tile
const ringOuter = 150
const ringInner = 92

function insideRoundedTile(x, y) {
  const min = inset
  const max = SIZE - inset
  if (x < min || x > max || y < min || y > max) return false
  // corner circles
  const cx = Math.min(Math.max(x, min + tileRadius), max - tileRadius)
  const cy = Math.min(Math.max(y, min + tileRadius), max - tileRadius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= tileRadius ** 2
}

function insideRing(x, y) {
  const d2 = (x - c) ** 2 + (y - c) ** 2
  return d2 <= ringOuter ** 2 && d2 >= ringInner ** 2
}

// Raw image: one filter byte (0 = none) per row, then RGBA pixels.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4)
  raw[rowStart] = 0
  for (let x = 0; x < SIZE; x++) {
    const tileCov = coverage(x, y, insideRoundedTile)
    const ringCov = coverage(x, y, insideRing)
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    if (tileCov > 0) {
      // base tile is indigo; the ring paints white over it
      r = lerp(GREEN[0], WHITE[0], ringCov)
      g = lerp(GREEN[1], WHITE[1], ringCov)
      b = lerp(GREEN[2], WHITE[2], ringCov)
      a = Math.round(255 * tileCov)
    }
    const p = rowStart + 1 + x * 4
    raw[p] = r
    raw[p + 1] = g
    raw[p + 2] = b
    raw[p + 3] = a
  }
}

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c2 = n
    for (let k = 0; k < 8; k++) c2 = c2 & 1 ? 0xedb88320 ^ (c2 >>> 1) : c2 >>> 1
    t[n] = c2 >>> 0
  }
  return t
})()

function crc32(buf) {
  let c2 = 0xffffffff
  for (let i = 0; i < buf.length; i++) c2 = CRC_TABLE[(c2 ^ buf[i]) & 0xff] ^ (c2 >>> 8)
  return (c2 ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'build')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'icon.png'), png)
console.log(`Wrote build/icon.png (${SIZE}x${SIZE}, ${png.length} bytes)`)
