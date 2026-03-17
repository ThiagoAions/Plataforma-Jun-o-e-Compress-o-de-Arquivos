import { PDFDocument, PDFPage } from 'pdf-lib'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function downloadFile(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function mergePDFs(
  files: { data: ArrayBuffer; name: string }[],
  onProgress: (pct: number, label: string) => void
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    onProgress(Math.round((i / files.length) * 85), `Processando ${files[i].name}...`)
    const pdf = await PDFDocument.load(files[i].data)
    const pages = await merged.copyPages(pdf, pdf.getPageIndices())
    pages.forEach((p) => merged.addPage(p))
  }
  onProgress(95, 'Gerando arquivo final...')
  const bytes = await merged.save()
  onProgress(100, 'Concluído!')
  return bytes
}

export function parsePageRange(str: string, total: number): number[] {
  const pages = new Set<number>()
  str.split(',').forEach((part) => {
    part = part.trim()
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) pages.add(i)
    } else {
      const n = Number(part)
      if (n >= 1 && n <= total) pages.add(n)
    }
  })
  return Array.from(pages).sort((a, b) => a - b)
}

export async function splitPDF(
  data: ArrayBuffer,
  mode: 'range' | 'each',
  rangeStr: string,
  onProgress: (pct: number, label: string) => void
): Promise<void> {
  const src = await PDFDocument.load(data)
  const total = src.getPageCount()

  if (mode === 'each') {
    for (let i = 0; i < total; i++) {
      onProgress(Math.round((i / total) * 100), `Extraindo página ${i + 1} de ${total}...`)
      const doc = await PDFDocument.create()
      const [pg] = await doc.copyPages(src, [i])
      doc.addPage(pg)
      const bytes = await doc.save()
      downloadFile(bytes, `pagina-${i + 1}.pdf`, 'application/pdf')
    }
  } else {
    const pages = parsePageRange(rangeStr, total)
    onProgress(50, 'Extraindo páginas...')
    const doc = await PDFDocument.create()
    const copied = await doc.copyPages(src, pages.map((p) => p - 1))
    copied.forEach((p: PDFPage) => doc.addPage(p))
    const bytes = await doc.save()
    downloadFile(bytes, 'aions-split.pdf', 'application/pdf')
  }
  onProgress(100, 'Concluído!')
}

export async function compressPDF(data: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data)
  return doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 })
}

export async function compressImage(
  data: ArrayBuffer,
  mimeType: string,
  quality: number
): Promise<Blob> {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  await new Promise<void>((r) => { img.onload = () => r() })
  const scale = quality < 0.4 ? 0.6 : quality < 0.7 ? 0.8 : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality))
}

export async function imagesToPDF(
  files: { data: ArrayBuffer; file: File }[],
  onProgress: (pct: number, label: string) => void
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    onProgress(Math.round((i / files.length) * 85), `Adicionando ${files[i].file.name}...`)
    const blob = new Blob([files[i].data], { type: files[i].file.type })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    await new Promise<void>((r) => { img.onload = () => r() })
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer())
    const jpgImg = await doc.embedJpg(jpgBytes)
    const pg = doc.addPage([jpgImg.width, jpgImg.height])
    pg.drawImage(jpgImg, { x: 0, y: 0, width: jpgImg.width, height: jpgImg.height })
    URL.revokeObjectURL(url)
  }
  onProgress(100, 'Gerando PDF...')
  return doc.save()
}
