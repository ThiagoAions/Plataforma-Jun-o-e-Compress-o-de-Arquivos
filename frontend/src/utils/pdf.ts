import { PDFDocument, PDFPage, PDFName, PDFRawStream } from 'pdf-lib'

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

async function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const lib = (window as any).pdfjsLib
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(lib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Recomprime uma imagem (JPEG ou PNG) via Canvas → JPEG com quality reduzido
async function recompressImageStream(
  contents: Uint8Array,
  mimeType: string,
  w: number,
  h: number,
  quality: number
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    const blob = new Blob([contents], { type: mimeType })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.src    = url
    await new Promise<void>((res, rej) => {
      img.onload  = () => res()
      img.onerror = () => rej(new Error('load failed'))
    })
    URL.revokeObjectURL(url)

    const scale  = quality < 0.3 ? 0.4 : quality < 0.5 ? 0.6 : quality < 0.7 ? 0.8 : 0.95
    const canvas = document.createElement('canvas')
    canvas.width  = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const newBlob  = await new Promise<Blob>((r) =>
      canvas.toBlob((b) => r(b!), 'image/jpeg', quality)
    )
    const newBytes = new Uint8Array(await newBlob.arrayBuffer())
    return { bytes: newBytes, width: canvas.width, height: canvas.height }
  } catch (_) {
    return null
  }
}

export async function compressPDF(
  data: ArrayBuffer,
  quality: number
): Promise<Uint8Array> {
  const doc     = await PDFDocument.load(data, { ignoreEncryption: true })
  const context = doc.context
  let compressed = 0

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue

    const dict    = obj.dict
    const subtype = dict.get(PDFName.of('Subtype'))
    if (!subtype || subtype.toString() !== '/Image') continue

    const filter  = dict.get(PDFName.of('Filter'))
    if (!filter) continue

    const filterStr = filter.toString()
    // Processa tanto JPEG (DCTDecode) quanto PNG/FlateDecode
    const isJpeg = filterStr === '/DCTDecode'
    const isFlate = filterStr === '/FlateDecode'
    if (!isJpeg && !isFlate) continue

    const w = (dict.get(PDFName.of('Width'))  as any)?.value?.()
    const h = (dict.get(PDFName.of('Height')) as any)?.value?.()
    if (!w || !h) continue

    // Imagens muito pequenas (ícones, decorações) não vale recomprimir
    if (w < 32 || h < 32) continue

    const mimeType = isJpeg ? 'image/jpeg' : 'image/png'

    // FlateDecode: os bytes estão comprimidos com zlib, precisamos decodificar via DecompressionStream
    let rawContents = obj.contents
    if (isFlate) {
      try {
        const ds      = new DecompressionStream('deflate-raw')
        const writer  = ds.writable.getWriter()
        const reader  = ds.readable.getReader()
        writer.write(rawContents)
        writer.close()
        const chunks: Uint8Array[] = []
        let done = false
        while (!done) {
          const { value, done: d } = await reader.read()
          if (value) chunks.push(value)
          done = d
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) { merged.set(c, offset); offset += c.length }
        rawContents = merged
      } catch (_) {
        continue // não conseguiu descomprimir, pula
      }
    }

    const result = await recompressImageStream(rawContents, mimeType, w, h, quality)
    if (!result) continue

    // Só substitui se realmente ficou menor
    if (result.bytes.length >= obj.contents.length) continue

    obj.contents = result.bytes
    dict.set(PDFName.of('Filter'),        PDFName.of('DCTDecode'))
    dict.set(PDFName.of('Length'),        context.obj(result.bytes.length))
    dict.set(PDFName.of('Width'),         context.obj(result.width))
    dict.set(PDFName.of('Height'),        context.obj(result.height))
    dict.delete(PDFName.of('DecodeParms'))
    compressed++
  }

  console.log(`[compressPDF] Imagens recomprimidas: ${compressed}`)

  // Se comprimiu pelo menos algumas imagens, salva normalmente
  if (compressed > 0) {
    return doc.save({ useObjectStreams: true, addDefaultPage: false })
  }

  // Fallback: rasteriza o PDF inteiro via pdf.js (para PDFs só-texto)
  console.log('[compressPDF] Nenhuma imagem comprimível, rasterizando via pdf.js...')
  const lib      = await loadPdfJs()
  const pdfJs    = await lib.getDocument({ data: data.slice(0) }).promise
  const numPages = pdfJs.numPages
  const newDoc   = await PDFDocument.create()
  const scale    = 0.5 + quality * 1.3

  for (let i = 1; i <= numPages; i++) {
    const page     = await pdfJs.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas   = document.createElement('canvas')
    canvas.width   = Math.round(viewport.width)
    canvas.height  = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    const blob     = await new Promise<Blob>((r) =>
      canvas.toBlob((b) => r(b!), 'image/jpeg', quality)
    )
    const jpgBytes = new Uint8Array(await blob.arrayBuffer())
    const jpgImg   = await newDoc.embedJpg(jpgBytes)
    const newPage  = newDoc.addPage([viewport.width, viewport.height])
    newPage.drawImage(jpgImg, { x: 0, y: 0, width: viewport.width, height: viewport.height })
  }

  return newDoc.save()
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
