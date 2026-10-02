// Gera os PNGs do PWA a partir dos SVGs desta pasta: node icons/build-icons.mjs
import sharp from 'sharp'

const out = [
  ['icons/icon.svg', 'public/icon-192.png', 192],
  ['icons/icon.svg', 'public/icon-512.png', 512],
  ['icons/icon-maskable.svg', 'public/icon-maskable-512.png', 512],
  ['icons/icon.svg', 'app/icon.png', 64],
  ['icons/icon-maskable.svg', 'app/apple-icon.png', 180],
]
for (const [src, dst, size] of out) await sharp(src, { density: 300 }).resize(size, size).png().toFile(dst)
console.log('ok')
