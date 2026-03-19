import React, { useState, useRef, useCallback } from 'react'
import { RotateCw, Trash2, Download, RotateCcw, ZoomIn, X, FlipHorizontal, FlipVertical } from 'lucide-react'
import { DropZone, Btn, SectionCard, PageHeader, ProgressBar, Alert } from './ui'
import { useProcessing } from '@/hooks/useProcessing'
import { downloadFile } from '@/utils/pdf'
import { PDFDocument, degrees } from 'pdf-lib'

interface PageItem {
  id: string
  pageIndex: number
  rotation: number      // 0, 90, 180, 270 (rotação adicional feita pelo usuário)
  flipH: boolean        // espelhar horizontalmente
  flipV: boolean        // espelhar verticalmente
  deleted: boolean
  thumbnail: string
  preview: string
}

interface OrganizeToolProps {
  onBack: () => void
  onSuccess: () => void
}

function getPdfjsLib(): Promise<any> {
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

// Renderiza página com rotação e flip via canvas
async function renderPage(
  pdfDoc: any,
  pageIndex: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  width: number
): Promise<string> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  
  // Obtém a rotação original que a página já possui no PDF
  const defaultViewport = page.getViewport({ scale: 1 })
  const originalRotation = defaultViewport.rotation
  
  // A rotação final na tela é a rotação original somada com a rotação extra do usuário
  const finalRotation = (originalRotation + rotation) % 360

  const viewport = page.getViewport({ scale: 1, rotation: finalRotation })
  const scale = width / viewport.width
  const scaledViewport = page.getViewport({ scale, rotation: finalRotation })

  // Canvas base com a página renderizada
  const base = document.createElement('canvas')
  base.width  = Math.round(scaledViewport.width)
  base.height = Math.round(scaledViewport.height)
  await page.render({ canvasContext: base.getContext('2d')!, viewport: scaledViewport }).promise

  // Aplica flip se necessário
  if (!flipH && !flipV) return base.toDataURL('image/jpeg', 0.92)

  const out = document.createElement('canvas')
  out.width  = base.width
  out.height = base.height
  const ctx  = out.getContext('2d')!
  ctx.save()
  ctx.translate(flipH ? base.width : 0, flipV ? base.height : 0)
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.drawImage(base, 0, 0)
  ctx.restore()
  return out.toDataURL('image/jpeg', 0.92)
}

// Rasteriza página para embed no PDF (necessário quando há flip)
async function rasterizePage(
  pdfDoc: any,
  pageIndex: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): Promise<{ jpgBytes: Uint8Array; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  
  // Mesma lógica: respeitar a rotação original do PDF para rasterizar
  const defaultViewport = page.getViewport({ scale: 1 })
  const originalRotation = defaultViewport.rotation
  const finalRotation = (originalRotation + rotation) % 360

  const viewport = page.getViewport({ scale: 2, rotation: finalRotation }) // 2x para qualidade
  const base = document.createElement('canvas')
  base.width  = Math.round(viewport.width)
  base.height = Math.round(viewport.height)
  await page.render({ canvasContext: base.getContext('2d')!, viewport }).promise

  let finalCanvas = base
  if (flipH || flipV) {
    const out = document.createElement('canvas')
    out.width  = base.width
    out.height = base.height
    const ctx  = out.getContext('2d')!
    ctx.save()
    ctx.translate(flipH ? base.width : 0, flipV ? base.height : 0)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.drawImage(base, 0, 0)
    ctx.restore()
    finalCanvas = out
  }

  const dataUrl  = finalCanvas.toDataURL('image/jpeg', 0.92)
  const response = await fetch(dataUrl)
  const buffer   = await response.arrayBuffer()
  return { jpgBytes: new Uint8Array(buffer), width: finalCanvas.width, height: finalCanvas.height }
}

// Rótulo legível da transformação atual
function transformLabel(rotation: number, flipH: boolean, flipV: boolean): string {
  const parts: string[] = []
  if (rotation !== 0)  parts.push(`${rotation}°`)
  if (flipH)           parts.push('H')
  if (flipV)           parts.push('V')
  return parts.length ? parts.join(' · ') : ''
}

const OrganizeTool: React.FC<OrganizeToolProps> = ({ onBack, onSuccess }) => {
  const [pages, setPages]       = useState<PageItem[]>([])
  const [pdfData, setPdfData]   = useState<ArrayBuffer | null>(null)
  const [loading, setLoading]   = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [zoomPage, setZoomPage] = useState<PageItem | null>(null)
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // ── Carregamento do PDF ──────────────────────────────────────────
  const loadPDF = useCallback(async (file: File) => {
    setLoading(true); setLoadingMsg('Carregando pdf.js...')
    setPdfData(null); setPages([]); reset()
    try {
      const lib = await getPdfjsLib()
      const arrayBuffer = await file.arrayBuffer()
      setPdfData(arrayBuffer)
      setLoadingMsg('Lendo PDF...')
      const pdfDoc = await lib.getDocument({ data: arrayBuffer.slice(0) }).promise
      const numPages = pdfDoc.numPages
      const items: PageItem[] = []
      for (let i = 0; i < numPages; i++) {
        setLoadingMsg(`Gerando miniaturas... ${i + 1}/${numPages}`)
        const thumbnail = await renderPage(pdfDoc, i, 0, false, false, 300)
        const preview   = await renderPage(pdfDoc, i, 0, false, false, 800)
        items.push({ id: `page-${i}`, pageIndex: i, rotation: 0, flipH: false, flipV: false, deleted: false, thumbnail, preview })
      }
      setPages(items)
    } catch (err) {
      console.error(err); alert('Erro ao carregar PDF.')
    } finally {
      setLoading(false); setLoadingMsg('')
    }
  }, [reset])

  // ── Re-renderiza thumbnail/preview ─────────────────────────────
  const rerender = useCallback(async (id: string, rotation: number, flipH: boolean, flipV: boolean) => {
    if (!pdfData) return
    try {
      const lib    = await getPdfjsLib()
      const pdfDoc = await lib.getDocument({ data: pdfData.slice(0) }).promise
      const page   = pages.find(p => p.id === id)
      if (!page) return
      const [thumbnail, preview] = await Promise.all([
        renderPage(pdfDoc, page.pageIndex, rotation, flipH, flipV, 300),
        renderPage(pdfDoc, page.pageIndex, rotation, flipH, flipV, 800),
      ])
      setPages(prev => prev.map(p => p.id === id ? { ...p, thumbnail, preview } : p))
      // Atualiza zoom se aberto
      setZoomPage(prev => prev?.id === id ? { ...prev, thumbnail, preview, rotation, flipH, flipV } : prev)
    } catch (_) {}
  }, [pdfData, pages])

  // ── Rotação ─────────────────────────────────────────────────────
  const rotatePage = useCallback((id: string, dir: 1 | -1) => {
    setPages(prev => prev.map(p => {
      if (p.id !== id) return p
      const newRot = ((p.rotation + dir * 90) + 360) % 360
      rerender(id, newRot, p.flipH, p.flipV)
      return { ...p, rotation: newRot }
    }))
  }, [rerender])

  // ── Flip ────────────────────────────────────────────────────────
  const flipPage = useCallback((id: string, axis: 'H' | 'V') => {
    setPages(prev => prev.map(p => {
      if (p.id !== id) return p
      const newFlipH = axis === 'H' ? !p.flipH : p.flipH
      const newFlipV = axis === 'V' ? !p.flipV : p.flipV
      rerender(id, p.rotation, newFlipH, newFlipV)
      return { ...p, flipH: newFlipH, flipV: newFlipV }
    }))
  }, [rerender])

  // ── Deletar / restaurar ─────────────────────────────────────────
  const deletePage = (id: string) => {
    setPages(prev => {
      if (prev.filter(p => !p.deleted).length <= 1) { alert('Não é possível remover todas as páginas.'); return prev }
      return prev.map(p => p.id === id ? { ...p, deleted: true } : p)
    })
  }
  const restorePage = (id: string) => setPages(prev => prev.map(p => p.id === id ? { ...p, deleted: false } : p))

  // ── Reordenar ───────────────────────────────────────────────────
  const handleReorder = (fromIdx: number, toIdx: number) => {
    setPages(prev => {
      const active = prev.filter(p => !p.deleted)
      const [item] = active.splice(fromIdx, 1)
      active.splice(toIdx, 0, item)
      return active.concat(prev.filter(p => p.deleted))
    })
    setDragOver(null); dragIdx.current = null
  }

  // ── Salvar ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pdfData) return
    start()
    try {
      update(10, 'Carregando pdf.js...')
      const lib    = await getPdfjsLib()
      const pdfJs  = await lib.getDocument({ data: pdfData.slice(0) }).promise
      const srcDoc = await PDFDocument.load(pdfData)
      const newDoc = await PDFDocument.create()
      const actives = pages.filter(p => !p.deleted)

      for (let i = 0; i < actives.length; i++) {
        update(10 + Math.round((i / actives.length) * 80), `Processando página ${i + 1} de ${actives.length}...`)
        const pg = actives[i]

        if (pg.flipH || pg.flipV) {
          // Página com flip: rasteriza e embute como imagem
          const { jpgBytes, width, height } = await rasterizePage(pdfJs, pg.pageIndex, pg.rotation, pg.flipH, pg.flipV)
          const jpgImg  = await newDoc.embedJpg(jpgBytes)
          const newPage = newDoc.addPage([width / 2, height / 2]) // /2 porque scale=2
          newPage.drawImage(jpgImg, { x: 0, y: 0, width: width / 2, height: height / 2 })
        } else {
          // Sem flip: copia a página original preservando texto/vetores
          const [copied] = await newDoc.copyPages(srcDoc, [pg.pageIndex])
          
          // Pega a rotação que a página já tinha no PDF original e SOMA com a que fizemos na tela
          const originalRotation = copied.getRotation().angle || 0
          const finalRotation = (originalRotation + pg.rotation) % 360
          
          copied.setRotation(degrees(finalRotation))
          newDoc.addPage(copied)
        }
      }

      update(95, 'Gerando arquivo...')
      const bytes = await newDoc.save()
      downloadFile(bytes, 'aions-organizado.pdf', 'application/pdf')
      succeed(); onSuccess()
    } catch (err) {
      console.error(err); fail('Erro ao gerar PDF. Tente novamente.')
    }
  }

  const activePages  = pages.filter(p => !p.deleted)
  const deletedPages = pages.filter(p => p.deleted)

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Organizar Páginas"
        sub="Reordene, gire, espelhe ou exclua páginas individualmente."
        onBack={onBack}
      />

      {!pages.length && !loading && (
        <SectionCard>
          <DropZone
            onFiles={(f) => {
              const pdf = f.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'))
              if (!pdf) { alert('Selecione um arquivo PDF.'); return }
              loadPDF(pdf)
            }}
            accept=".pdf,application/pdf"
            label="Arraste um PDF aqui"
            sublabel="As páginas serão exibidas como miniaturas"
          />
        </SectionCard>
      )}

      {loading && (
        <SectionCard>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{
              width: 40, height: 40, margin: '0 auto 1rem',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--accent-cyan)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{loadingMsg}</p>
          </div>
        </SectionCard>
      )}

      {pages.length > 0 && !loading && (
        <>
          {/* Toolbar (Botões Flutuantes) */}
          <div style={{
            position: 'sticky',
            top: '1rem', // Dá um pequeno respiro do topo para ficar elegante
            zIndex: 50,
            display: 'flex', 
            justifyContent: 'flex-end', // Joga os botões para a direita
            marginBottom: '1rem',
            paddingRight: '1rem',
            pointerEvents: 'none', // Mágica: permite que o mouse "atravesse" a parte invisível e clique nos PDFs por baixo
          }}>
            {/* Contêiner dos botões */}
            <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={() => { setPdfData(null); setPages([]); reset() }}>
                  Carregar outro PDF
                </Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)' }}>
                <Btn onClick={handleSave} disabled={state.isProcessing || activePages.length === 0} icon={<Download size={14} />}>
                  {state.isProcessing ? 'Salvando...' : 'Salvar PDF'}
                </Btn>
              </div>
            </div>
          </div>

          {/* Grid */}
          <SectionCard style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {activePages.map((page, i) => {
                const label = transformLabel(page.rotation, page.flipH, page.flipV)
                return (
                  <div
                    key={page.id}
                    draggable
                    onDragStart={() => { dragIdx.current = i }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => { if (dragIdx.current !== null && dragIdx.current !== i) handleReorder(dragIdx.current, i); setDragOver(null) }}
                    onDragEnd={() => { dragIdx.current = null; setDragOver(null) }}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `2px solid ${dragOver === i ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'grab',
                      transition: 'all .15s',
                      boxShadow: dragOver === i ? '0 4px 16px rgba(0,200,255,.15)' : 'none',
                      transform: dragOver === i ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, padding: '12px', overflow: 'hidden' }}>
                      <img
                        src={page.thumbnail}
                        alt={`Página ${i + 1}`}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%', 
                          objectFit: 'contain', 
                          display: 'block',
                          background: '#fff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          borderRadius: '2px'
                        }}
                        draggable={false}
                      />
                      {/* Overlay zoom */}
                      <div
                        className="thumb-overlay"
                        onClick={(e) => { e.stopPropagation(); setZoomPage(page) }}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s', cursor: 'zoom-in' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,.35)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                      >
                        <ZoomIn size={32} color="#fff" style={{ opacity: 0, transition: 'opacity .15s', pointerEvents: 'none' }} className="zoom-icon" />
                      </div>
                      {/* Número */}
                      <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                        {i + 1}
                      </div>
                      {/* Badge de transformação */}
                      {label && (
                        <div style={{ position: 'absolute', top: 6, left: 6, background: 'var(--accent-cyan)', color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                          {label}
                        </div>
                      )}
                    </div>

                    {/* Controles */}
                    <div style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-secondary)', padding: '6px 8px' }}>

                      {/* Linha 1: Rotação */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginRight: 4, whiteSpace: 'nowrap' }}>Girar</span>
                        {[
                          { title: 'Esquerda 90°', icon: <RotateCcw size={14} />, onClick: () => rotatePage(page.id, -1) },
                          { title: 'Direita 90°',  icon: <RotateCw  size={14} />, onClick: () => rotatePage(page.id,  1) },
                        ].map((btn, bi) => (
                          <button key={bi} title={btn.title} onClick={btn.onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}>
                            {btn.icon}
                          </button>
                        ))}
                      </div>

                      {/* Linha 2: Flip + Zoom + Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>Flip</span>
                        {[
                          { title: 'Espelhar horizontal', icon: <FlipHorizontal size={14} />, active: page.flipH, onClick: () => flipPage(page.id, 'H') },
                          { title: 'Espelhar vertical',   icon: <FlipVertical   size={14} />, active: page.flipV, onClick: () => flipPage(page.id, 'V') },
                        ].map((btn, bi) => (
                          <button key={bi} title={btn.title} onClick={btn.onClick} style={{
                            background: btn.active ? 'var(--accent-cyan-dim)' : 'none',
                            border: `1px solid ${btn.active ? 'var(--accent-cyan)' : 'transparent'}`,
                            color: btn.active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            cursor: 'pointer', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s',
                          }}
                            onMouseEnter={(e) => { if (!btn.active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent-cyan)' } }}
                            onMouseLeave={(e) => { if (!btn.active) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                          >
                            {btn.icon}
                          </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <button title="Ampliar" onClick={() => setZoomPage(page)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}>
                          <ZoomIn size={14} />
                        </button>
                        <button title="Remover página" onClick={() => deletePage(page.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.background = '#f8514918' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Páginas removidas */}
          {deletedPages.length > 0 && (
            <SectionCard style={{ borderColor: '#f8514944', background: '#f8514908' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem', color: 'var(--accent-red)' }}>
                Páginas removidas ({deletedPages.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deletedPages.map((page) => (
                  <div key={page.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Pág. {page.pageIndex + 1}</span>
                    <button onClick={() => restorePage(page.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-green)', fontSize: 12, padding: 0, fontFamily: 'var(--font-display)' }}>
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <ProgressBar state={state} />
          <Alert type="success" message="✓ PDF salvo com sucesso!" visible={state.status === 'success'} />
          <Alert type="error" message={state.label} visible={state.status === 'error'} />
        </>
      )}

      {/* Modal de zoom */}
      {zoomPage && (
        <div onClick={() => setZoomPage(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
            <img src={zoomPage.preview} alt="Preview" style={{ display: 'block', maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
              Página {activePages.findIndex(p => p.id === zoomPage.id) + 1}
              {transformLabel(zoomPage.rotation, zoomPage.flipH, zoomPage.flipV) && ` · ${transformLabel(zoomPage.rotation, zoomPage.flipH, zoomPage.flipV)}`}
            </div>
            <button onClick={() => setZoomPage(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .thumb-overlay:hover .zoom-icon { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

export default OrganizeTool