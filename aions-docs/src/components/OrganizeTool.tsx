import React, { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCw, Trash2, Download, RotateCcw } from 'lucide-react'
import { DropZone, Btn, SectionCard, PageHeader, ProgressBar, Alert } from './ui'
import { useProcessing } from '@/hooks/useProcessing'
import { downloadFile } from '@/utils/pdf'
import { PDFDocument, degrees } from 'pdf-lib'

interface PageItem {
  id: string
  pageIndex: number   // original index
  rotation: number    // 0, 90, 180, 270
  deleted: boolean
  thumbnail: string   // base64 data URL
}

interface OrganizeToolProps {
  onBack: () => void
  onSuccess: () => void
}

// Render one PDF page to canvas using pdf.js via CDN
async function renderPage(
  pdfDoc: any,
  pageIndex: number,
  rotation: number,
  width = 140
): Promise<string> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation })
  const scale = width / viewport.width
  const scaledViewport = page.getViewport({ scale, rotation })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scaledViewport.width)
  canvas.height = Math.round(scaledViewport.height)
  const ctx = canvas.getContext('2d')!

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Load pdf.js from CDN
function getPdfjsLib(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib)
      return
    }
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

const OrganizeTool: React.FC<OrganizeToolProps> = ({ onBack, onSuccess }) => {
  const [pages, setPages] = useState<PageItem[]>([])
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true)
    setLoadingMsg('Carregando pdf.js...')
    setPdfData(null)
    setPages([])
    reset()

    try {
      const lib = await getPdfjsLib()
      const arrayBuffer = await file.arrayBuffer()
      setPdfData(arrayBuffer)

      setLoadingMsg('Lendo PDF...')
      const loadingTask = lib.getDocument({ data: arrayBuffer.slice(0) })
      const pdfDoc = await loadingTask.promise
      const numPages = pdfDoc.numPages

      const items: PageItem[] = []
      for (let i = 0; i < numPages; i++) {
        setLoadingMsg(`Gerando miniaturas... ${i + 1}/${numPages}`)
        const thumbnail = await renderPage(pdfDoc, i, 0)
        items.push({
          id: `page-${i}`,
          pageIndex: i,
          rotation: 0,
          deleted: false,
          thumbnail,
        })
      }
      setPages(items)
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar PDF. Verifique se o arquivo é válido.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [reset])

  const rotatePage = useCallback(async (id: string, dir: 1 | -1) => {
    if (!pdfData) return
    setPages(prev => prev.map(p => {
      if (p.id !== id) return p
      const newRot = ((p.rotation + dir * 90) + 360) % 360
      return { ...p, rotation: newRot }
    }))

    // Re-render thumbnail with new rotation
    try {
      const lib = await getPdfjsLib()
      const loadingTask = lib.getDocument({ data: pdfData.slice(0) })
      const pdfDoc = await loadingTask.promise

      setPages(prev => {
        const page = prev.find(p => p.id === id)
        if (!page) return prev
        // async update thumbnail
        renderPage(pdfDoc, page.pageIndex, page.rotation).then(thumb => {
          setPages(prev2 => prev2.map(p => p.id === id ? { ...p, thumbnail: thumb } : p))
        })
        return prev
      })
    } catch (_) {}
  }, [pdfData])

  const deletePage = (id: string) => {
    setPages(prev => {
      const active = prev.filter(p => !p.deleted)
      if (active.length <= 1) {
        alert('Não é possível remover todas as páginas.')
        return prev
      }
      return prev.map(p => p.id === id ? { ...p, deleted: true } : p)
    })
  }

  const restorePage = (id: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, deleted: false } : p))
  }

  const handleReorder = (fromIdx: number, toIdx: number) => {
    setPages(prev => {
      const active = prev.filter(p => !p.deleted)
      const [item] = active.splice(fromIdx, 1)
      active.splice(toIdx, 0, item)
      return active.concat(prev.filter(p => p.deleted))
    })
    setDragOver(null)
    dragIdx.current = null
  }

  const handleSave = async () => {
    if (!pdfData) return
    start()
    try {
      update(20, 'Lendo PDF original...')
      const srcDoc = await PDFDocument.load(pdfData)
      const newDoc = await PDFDocument.create()

      const activePages = pages.filter(p => !p.deleted)
      for (let i = 0; i < activePages.length; i++) {
        update(
          20 + Math.round((i / activePages.length) * 70),
          `Processando página ${i + 1} de ${activePages.length}...`
        )
        const pg = activePages[i]
        const [copied] = await newDoc.copyPages(srcDoc, [pg.pageIndex])
        if (pg.rotation !== 0) {
          copied.setRotation(degrees(pg.rotation))
        }
        newDoc.addPage(copied)
      }

      update(95, 'Gerando arquivo...')
      const bytes = await newDoc.save()
      update(100, 'Concluído!')
      downloadFile(bytes, 'aions-organizado.pdf', 'application/pdf')
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao gerar PDF. Tente novamente.')
    }
  }

  const activePages = pages.filter(p => !p.deleted)
  const deletedPages = pages.filter(p => p.deleted)

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Organizar Páginas"
        sub="Visualize miniaturas, reordene arrastando, gire ou exclua páginas individualmente."
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
            sublabel="As páginas serão exibidas como miniaturas para organizar"
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
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {loadingMsg}
            </p>
          </div>
        </SectionCard>
      )}

      {pages.length > 0 && !loading && (
        <>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1rem', padding: '.75rem 1rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{activePages.length}</span> página(s) ativa(s)
              {deletedPages.length > 0 && (
                <span style={{ color: 'var(--accent-red)', marginLeft: 12 }}>
                  · {deletedPages.length} removida(s)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                variant="secondary"
                onClick={() => { setPdfData(null); setPages([]); reset() }}
              >
                Carregar outro PDF
              </Btn>
              <Btn
                onClick={handleSave}
                disabled={state.isProcessing || activePages.length === 0}
                icon={<Download size={14} />}
              >
                {state.isProcessing ? 'Salvando...' : 'Salvar PDF'}
              </Btn>
            </div>
          </div>

          {/* Thumbnails grid */}
          <SectionCard style={{ padding: '1.25rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '1rem',
            }}>
              {activePages.map((page, i) => (
                <div
                  key={page.id}
                  draggable
                  onDragStart={() => { dragIdx.current = i }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => {
                    if (dragIdx.current !== null && dragIdx.current !== i) {
                      handleReorder(dragIdx.current, i)
                    }
                    setDragOver(null)
                  }}
                  onDragEnd={() => { dragIdx.current = null; setDragOver(null) }}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: `2px solid ${dragOver === i ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    cursor: 'grab',
                    transition: 'border-color var(--transition)',
                    transform: dragOver === i ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    position: 'relative', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 180, overflow: 'hidden',
                  }}>
                    <img
                      src={page.thumbnail}
                      alt={`Página ${i + 1}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        transform: `rotate(${page.rotation}deg)`,
                        transition: 'transform .2s ease',
                      }}
                      draggable={false}
                    />
                    {/* Page number badge */}
                    <div style={{
                      position: 'absolute', bottom: 4, right: 4,
                      background: 'rgba(0,0,0,.65)',
                      color: '#fff', fontSize: 10,
                      padding: '1px 6px', borderRadius: 3,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {i + 1}
                    </div>
                    {page.rotation !== 0 && (
                      <div style={{
                        position: 'absolute', top: 4, left: 4,
                        background: 'var(--accent-cyan)',
                        color: '#000', fontSize: 9,
                        padding: '1px 5px', borderRadius: 3,
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                      }}>
                        {page.rotation}°
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '6px 8px',
                    borderTop: '1px solid var(--border-default)',
                    background: 'var(--bg-secondary)',
                  }}>
                    <button
                      title="Girar esquerda"
                      onClick={() => rotatePage(page.id, -1)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px',
                        borderRadius: 4, display: 'flex', transition: 'color var(--transition)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      title="Girar direita"
                      onClick={() => rotatePage(page.id, 1)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px',
                        borderRadius: 4, display: 'flex', transition: 'color var(--transition)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      <RotateCw size={14} />
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      title="Remover página"
                      onClick={() => deletePage(page.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary)', padding: '4px',
                        borderRadius: 4, display: 'flex', transition: 'color var(--transition)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Deleted pages */}
          {deletedPages.length > 0 && (
            <SectionCard style={{ borderColor: '#f8514944', background: '#f8514908' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem', color: 'var(--accent-red)' }}>
                Páginas removidas ({deletedPages.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deletedPages.map((page) => (
                  <div key={page.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      Pág. {page.pageIndex + 1}
                    </span>
                    <button
                      onClick={() => restorePage(page.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-green)', fontSize: 12, padding: 0,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <ProgressBar state={state} />
          <Alert type="success" message="✓ PDF reorganizado salvo com sucesso!" visible={state.status === 'success'} />
          <Alert type="error" message={state.label} visible={state.status === 'error'} />
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

export default OrganizeTool
