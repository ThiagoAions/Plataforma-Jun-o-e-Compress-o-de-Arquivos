import React, { useState, useRef, useCallback } from 'react'
import { Layers, Trash2, Download, Plus, FilePlus } from 'lucide-react'
import { DropZone, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useProcessing } from '@/hooks/useProcessing'
import { downloadFile } from '@/utils/pdf'
import { PDFDocument } from 'pdf-lib'

interface SourceFile {
  id: string
  name: string
  data: ArrayBuffer
}

interface PageItem {
  id: string
  fileId: string
  pageIndex: number
  thumbnail: string
  deleted: boolean
  sourceName: string
}

interface MergeToolProps {
  onBack: () => void
  onSuccess: () => void
}

// Carrega o PDF.js dinamicamente
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

// Renderiza a miniatura simplificada
async function renderThumbnail(pdfDoc: any, pageIndex: number): Promise<string> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const defaultViewport = page.getViewport({ scale: 1 })
  const scale = 250 / defaultViewport.width 
  const viewport = page.getViewport({ scale })
  
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.8)
}

const MergeTool: React.FC<MergeToolProps> = ({ onBack, onSuccess }) => {
  const { state, start, update, succeed, fail, reset } = useProcessing()
  
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPDFs = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setLoading(true)
    
    try {
      const lib = await getPdfjsLib()
      const newSourceFiles: SourceFile[] = []
      const newPages: PageItem[] = []

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx]
        setLoadingMsg(`Lendo arquivo ${fIdx + 1} de ${files.length}...`)
        const arrayBuffer = await file.arrayBuffer()
        const fileId = `file-${Date.now()}-${fIdx}`

        newSourceFiles.push({ id: fileId, name: file.name, data: arrayBuffer })

        const pdfDoc = await lib.getDocument({ data: arrayBuffer.slice(0) }).promise
        const numPages = pdfDoc.numPages

        for (let i = 0; i < numPages; i++) {
          setLoadingMsg(`Gerando miniaturas: ${file.name} (${i + 1}/${numPages})`)
          const thumbnail = await renderThumbnail(pdfDoc, i)
          newPages.push({
            id: `page-${fileId}-${i}`,
            fileId,
            pageIndex: i,
            thumbnail,
            deleted: false,
            sourceName: file.name
          })
        }
      }

      setSourceFiles(prev => [...prev, ...newSourceFiles])
      setPages(prev => [...prev, ...newPages])
      reset()
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar um ou mais PDFs. Verifique se os arquivos são válidos.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
      // Limpa o input de arquivo para permitir selecionar o mesmo arquivo novamente se necessário
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [reset])

  const deletePage = (id: string) => {
    setPages(prev => {
      const activeCount = prev.filter(p => !p.deleted).length
      if (activeCount <= 1) {
        alert('O documento final deve ter pelo menos uma página.')
        return prev
      }
      return prev.map(p => p.id === id ? { ...p, deleted: true } : p)
    })
  }

  const restorePage = (id: string) => setPages(prev => prev.map(p => p.id === id ? { ...p, deleted: false } : p))

  const handleReorder = (fromIdx: number, toIdx: number) => {
    setPages(prev => {
      const active = prev.filter(p => !p.deleted)
      const [item] = active.splice(fromIdx, 1)
      active.splice(toIdx, 0, item)
      // Mantém as excluídas no final
      return active.concat(prev.filter(p => p.deleted))
    })
    setDragOver(null)
    dragIdx.current = null
  }

  const clearAll = () => {
    setSourceFiles([])
    setPages([])
    reset()
  }

  const handleMerge = async () => {
    const activePages = pages.filter(p => !p.deleted)
    if (activePages.length === 0) return
    
    start()
    try {
      update(10, 'Preparando documentos originais...')
      const loadedDocs: Record<string, PDFDocument> = {}
      const neededFileIds = new Set(activePages.map(p => p.fileId))
      
      let loadedCount = 0
      for (const fileId of neededFileIds) {
        const srcFile = sourceFiles.find(f => f.id === fileId)
        if (srcFile) {
          loadedDocs[fileId] = await PDFDocument.load(srcFile.data)
        }
        loadedCount++
        update(10 + Math.round((loadedCount / neededFileIds.size) * 20), 'Carregando arquivos...')
      }

      update(35, 'Mesclando páginas...')
      const mergedPdf = await PDFDocument.create()

      for (let i = 0; i < activePages.length; i++) {
        update(35 + Math.round((i / activePages.length) * 55), `Juntando página ${i + 1} de ${activePages.length}...`)
        const pg = activePages[i]
        const srcDoc = loadedDocs[pg.fileId]
        const [copied] = await mergedPdf.copyPages(srcDoc, [pg.pageIndex])
        mergedPdf.addPage(copied)
      }

      update(95, 'Gerando arquivo final...')
      const bytes = await mergedPdf.save()
      downloadFile(bytes, 'aions-mesclado.pdf', 'application/pdf')
      
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao juntar os PDFs.')
    }
  }

  const activePages = pages.filter(p => !p.deleted)
  const deletedPages = pages.filter(p => p.deleted)

  // Função auxiliar para pegar a "Cor/Número" do arquivo na lista original
  const getFileIndex = (fileId: string) => sourceFiles.findIndex(f => f.id === fileId) + 1

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader title="Juntar PDF" sub="Selecione múltiplos arquivos, visualize e misture as páginas em um único PDF." onBack={onBack} />

      {/* Input invisível para o botão "Adicionar mais PDFs" */}
      <input 
        type="file" 
        multiple 
        accept=".pdf,application/pdf" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            loadPDFs(Array.from(e.target.files))
          }
        }} 
      />

      {!pages.length && !loading && (
        <SectionCard>
          <DropZone
            onFiles={(f) => {
              const pdfs = f.filter(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'))
              if (pdfs.length === 0) { alert('Selecione arquivos PDF válidos.'); return }
              loadPDFs(pdfs)
            }}
            accept=".pdf,application/pdf"
            multiple
            label="Arraste os PDFs aqui"
            sublabel="Você pode selecionar vários PDFs de uma vez"
          />
        </SectionCard>
      )}

      {loading && (
        <SectionCard>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{
              width: 40, height: 40, margin: '0 auto 1rem', border: '3px solid var(--border-default)',
              borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{loadingMsg}</p>
          </div>
        </SectionCard>
      )}

      {pages.length > 0 && !loading && (
        <>
          {/* Toolbar (Botões Flutuantes) */}
          <div style={{
            position: 'sticky', top: '1rem', zIndex: 50, display: 'flex', 
            justifyContent: 'flex-end', marginBottom: '1rem', paddingRight: '1rem', pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={clearAll}>
                  Limpar Tudo
                </Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<FilePlus size={14} />}>
                  Mais PDFs
                </Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)' }}>
                <Btn onClick={handleMerge} disabled={state.isProcessing || activePages.length === 0} icon={<Layers size={14} />}>
                  {state.isProcessing ? 'Juntando...' : 'Juntar PDFs'}
                </Btn>
              </div>
            </div>
          </div>

          <SectionCard style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              Arquivos Carregados ({sourceFiles.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sourceFiles.map((f, i) => (
                <div key={f.id} style={{ fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', padding: '4px 10px', borderRadius: 20, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 14, height: 14, background: 'var(--accent-cyan)', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 9 }}>
                    {i + 1}
                  </div>
                  {f.name}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Grid de Seleção Visual e Reordenação */}
          <SectionCard style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
              {activePages.map((page, i) => {
                const fileIdx = getFileIndex(page.fileId)
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
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'grab', transition: 'all .15s',
                      position: 'relative',
                      boxShadow: dragOver === i ? '0 4px 16px rgba(0,200,255,.15)' : 'none',
                      transform: dragOver === i ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, padding: '12px', overflow: 'hidden' }}>
                      <img src={page.thumbnail} alt={`Página ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '2px' }} draggable={false} />
                      
                      {/* Badge da Ordem Global */}
                      <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                        {i + 1}
                      </div>

                      {/* Badge de Origem (De qual arquivo veio) */}
                      <div title={page.sourceName} style={{ 
                        position: 'absolute', top: 8, left: 8, background: 'var(--accent-cyan)', color: '#000', 
                        borderRadius: '6px', padding: '4px 8px', fontSize: 10, fontWeight: 800, 
                        display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}>
                        <span>PDF {fileIdx}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border-default)', background: 'var(--bg-secondary)', padding: '6px 8px' }}>
                      <button title="Remover página" onClick={() => deletePage(page.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.background = '#f8514918' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Páginas Removidas */}
          {deletedPages.length > 0 && (
            <SectionCard style={{ borderColor: '#f8514944', background: '#f8514908', marginTop: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem', color: 'var(--accent-red)' }}>
                Páginas ignoradas ({deletedPages.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deletedPages.map((page) => (
                  <div key={page.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>PDF {getFileIndex(page.fileId)} - Pág {page.pageIndex + 1}</span>
                    <button onClick={() => restorePage(page.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-green)', fontSize: 12, padding: 0, fontFamily: 'var(--font-display)' }}>
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <ProgressBar state={state} />
          <Alert type="success" message="✓ PDFs mesclados com sucesso!" visible={state.status === 'success'} />
          <Alert type="error" message={state.label} visible={state.status === 'error'} />
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default MergeTool