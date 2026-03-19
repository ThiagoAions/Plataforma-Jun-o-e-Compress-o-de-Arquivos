import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Scissors, CheckCircle2, Download, Plus, X } from 'lucide-react'
import { DropZone, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { downloadFile } from '@/utils/pdf'
import { PDFDocument } from 'pdf-lib'
import { SplitMode } from '@/types'

type ExtendedSplitMode = SplitMode | 'groups'

interface PageItem {
  id: string
  pageIndex: number
  thumbnail: string
}

interface GroupItem {
  id: string
  name: string
  pages: number[] // Guarda a ordem exata dos cliques
}

interface SplitToolProps {
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

// Converte Array de índices (0-based) para String Visual (1-based)
const getFormatRange = (indices: number[]) => {
  if (!indices || indices.length === 0) return ''
  const idxs = indices.map(i => i + 1)
  const ranges: string[] = []
  let startIdx = idxs[0]
  let endIdx = startIdx
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] === endIdx + 1) {
      endIdx = idxs[i]
    } else {
      ranges.push(startIdx === endIdx ? `${startIdx}` : `${startIdx}-${endIdx}`)
      startIdx = idxs[i]
      endIdx = startIdx
    }
  }
  ranges.push(startIdx === endIdx ? `${startIdx}` : `${startIdx}-${endIdx}`)
  return ranges.join(', ')
}

// Converte String digitada (1-based) para Array de índices (0-based)
const parseRangeStr = (str: string, maxPages: number): number[] => {
  const result: number[] = []
  const parts = str.split(',')
  for (const part of parts) {
    const p = part.trim()
    if (!p) continue
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-')
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      if (!isNaN(start) && start > 0 && start <= maxPages) {
        if (!isNaN(end) && end > 0 && end <= maxPages) {
          if (start <= end) {
            for (let i = start; i <= end; i++) result.push(i - 1)
          } else {
            for (let i = start; i >= end; i--) result.push(i - 1)
          }
        } else if (endStr === '') {
          result.push(start - 1) // Se digitou "1-", pega o 1 provisoriamente
        }
      }
    } else {
      const num = parseInt(p)
      if (!isNaN(num) && num > 0 && num <= maxPages) {
        result.push(num - 1)
      }
    }
  }
  return Array.from(new Set(result)) // Remove duplicatas garantindo a ordem
}

const SplitTool: React.FC<SplitToolProps> = ({ onBack, onSuccess }) => {
  const { files, addFiles, clearFiles } = useFileManager()
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [mode, setMode] = useState<ExtendedSplitMode>('range')
  const [rangeStr, setRangeStr] = useState('')
  
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [selectionOrder, setSelectionOrder] = useState<number[]>([]) 
  const [groups, setGroups] = useState<GroupItem[]>([{ id: 'g1', name: 'Documento 1', pages: [] }])
  const [activeGroup, setActiveGroup] = useState<string>('g1')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  const currentSelection = mode === 'groups' ? (groups.find(g => g.id === activeGroup)?.pages || []) : selectionOrder

  // Sincroniza o Input Text quando o usuário troca de aba/grupo
  useEffect(() => {
    setRangeStr(getFormatRange(currentSelection))
  }, [activeGroup, mode]) // Não incluimos currentSelection para não apagar vírgulas enquanto ele digita

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true); setLoadingMsg('Carregando pré-visualização...')
    setPages([]); setSelectionOrder([]); setGroups([{ id: 'g1', name: 'Documento 1', pages: [] }]); setActiveGroup('g1'); setRangeStr(''); setPdfData(null); reset(); clearFiles(); addFiles([file])
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      setPdfData(arrayBuffer)
      
      const lib = await getPdfjsLib()
      const pdfDoc = await lib.getDocument({ data: arrayBuffer.slice(0) }).promise
      const numPages = pdfDoc.numPages
      const items: PageItem[] = []
      
      for (let i = 0; i < numPages; i++) {
        setLoadingMsg(`Gerando miniaturas... ${i + 1}/${numPages}`)
        const thumbnail = await renderThumbnail(pdfDoc, i)
        items.push({ id: `page-${i}`, pageIndex: i, thumbnail })
      }
      setPages(items)
    } catch (err) {
      console.error(err)
      alert('Erro ao gerar visualização do PDF.')
    } finally {
      setLoading(false); setLoadingMsg('')
    }
  }, [addFiles, clearFiles, reset])

  // Função principal para alterar a seleção (seja via Click ou Input)
  const updateSelection = (newSelection: number[]) => {
    if (mode === 'range' || mode === 'each') {
      setSelectionOrder(newSelection)
    } else if (mode === 'groups') {
      setGroups(prev => prev.map(g => g.id === activeGroup ? { ...g, pages: newSelection } : g))
    }
  }

  // Quando o usuário CLICA na miniatura
  const togglePage = (pageIndex: number) => {
    if (mode === 'each') setMode('range')
    const sel = currentSelection.includes(pageIndex) ? currentSelection.filter(i => i !== pageIndex) : [...currentSelection, pageIndex]
    updateSelection(sel)
    setRangeStr(getFormatRange(sel)) // Atualiza o texto na tela
  }

  // Quando o usuário DIGITA no campo de texto
  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setRangeStr(val) // Permite que ele digite vírgulas e espaços livremente
    const parsed = parseRangeStr(val, pages.length)
    updateSelection(parsed) // Atualiza as miniaturas por trás dos panos
  }

  const isAllSelected = currentSelection.length === pages.length && pages.length > 0

  const handleToggleAll = () => {
    if (isAllSelected) {
      updateSelection([])
      setRangeStr('')
    } else {
      const all = pages.map(p => p.pageIndex)
      updateSelection(all)
      setRangeStr(getFormatRange(all))
    }
  }

  const handleAddGroup = () => {
    const newId = `g${Date.now()}`
    setGroups(prev => [...prev, { id: newId, name: `Documento ${prev.length + 1}`, pages: [] }])
    setActiveGroup(newId)
  }

  const handleRemoveGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setGroups(prev => {
      const updated = prev.filter(g => g.id !== id)
      if (activeGroup === id) setActiveGroup(updated[0]?.id || '')
      return updated
    })
  }

  const updateGroupName = (id: string, newName: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name: newName } : g))
  }

  const handleSplit = async () => {
    if (!pdfData) return
    
    if (mode === 'range' && selectionOrder.length === 0) {
      fail('Selecione as páginas que deseja extrair.')
      return
    }
    
    const validGroups = groups.filter(g => g.pages.length > 0)
    if (mode === 'groups' && validGroups.length === 0) {
      fail('Adicione páginas a pelo menos um grupo.')
      return
    }

    start()
    try {
      const srcDoc = await PDFDocument.load(pdfData)

      if (mode === 'range') {
        update(20, 'Criando novo PDF...')
        const newDoc = await PDFDocument.create()
        for (let i = 0; i < selectionOrder.length; i++) {
          update(20 + Math.round((i / selectionOrder.length) * 70), `Extraindo página ${i + 1}...`)
          const [copied] = await newDoc.copyPages(srcDoc, [selectionOrder[i]])
          newDoc.addPage(copied)
        }
        update(95, 'Baixando...')
        const bytes = await newDoc.save()
        downloadFile(bytes, 'aions-extraido.pdf', 'application/pdf')
        
      } else if (mode === 'groups') {
        for (let i = 0; i < validGroups.length; i++) {
          const group = validGroups[i]
          update(Math.round((i / validGroups.length) * 90), `Gerando ${group.name}...`)
          const newDoc = await PDFDocument.create()
          for (const pageIndex of group.pages) {
            const [copied] = await newDoc.copyPages(srcDoc, [pageIndex])
            newDoc.addPage(copied)
          }
          const bytes = await newDoc.save()
          const safeName = group.name.trim() ? `${group.name.trim()}.pdf` : `grupo-${i+1}.pdf`
          downloadFile(bytes, safeName, 'application/pdf')
          await new Promise(r => setTimeout(r, 400))
        }

      } else if (mode === 'each') {
        const totalPages = srcDoc.getPageCount()
        for (let i = 0; i < totalPages; i++) {
           update(Math.round((i / totalPages) * 90), `Separando página ${i + 1}...`)
           const newDoc = await PDFDocument.create()
           const [copied] = await newDoc.copyPages(srcDoc, [i])
           newDoc.addPage(copied)
           const bytes = await newDoc.save()
           downloadFile(bytes, `pagina-${i + 1}.pdf`, 'application/pdf')
           await new Promise(r => setTimeout(r, 300)) 
        }
      }

      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao processar o PDF. Verifique se o arquivo é válido.')
    }
  }

  const ModeCard: React.FC<{ id: ExtendedSplitMode; title: string; sub: string }> = ({ id, title, sub }) => (
    <div
      onClick={() => setMode(id)}
      style={{
        border: `1px solid ${mode === id ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
        background: mode === id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)', padding: '1rem', cursor: 'pointer', transition: 'all var(--transition)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: mode === id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
        {mode === id ? '● ' : '○ '}{title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader title="Dividir PDF" sub="Extraia páginas visualmente ou separe o documento em grupos." onBack={onBack} />

      {!pages.length && !loading && (
        <SectionCard>
          <DropZone
            onFiles={(f) => {
              const pdf = f.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'))
              if (!pdf) { alert('Selecione um arquivo PDF.'); return }
              loadPDF(pdf)
            }}
            accept=".pdf,application/pdf"
            label="Arraste um PDF aqui para visualizá-lo"
            sublabel="Apenas um arquivo por vez"
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
          <div style={{ position: 'sticky', top: '1rem', zIndex: 50, display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', paddingRight: '1rem', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={() => { clearFiles(); setPages([]); setSelectionOrder([]); setPdfData(null); reset() }}>
                  Carregar outro PDF
                </Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)' }}>
                <Btn onClick={handleSplit} disabled={state.isProcessing} icon={<Scissors size={14} />}>
                  {state.isProcessing ? 'Processando...' : 'Dividir PDF'}
                </Btn>
              </div>
            </div>
          </div>

          <SectionCard style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '0 0 .75rem' }}>Opções de Divisão</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
              <ModeCard id="range" title="Extrair páginas" sub="Gera 1 arquivo com a ordem escolhida." />
              <ModeCard id="groups" title="Dividir em Grupos" sub="Cria múltiplos PDFs separados." />
              <ModeCard id="each" title="Página por arquivo" sub="Separa cada página individualmente." />
            </div>

            {/* Input de Seleção (Aparece em Range e em Groups) */}
            {(mode === 'range' || mode === 'groups') && (
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Páginas a extrair {mode === 'groups' ? 'neste grupo' : ''} (digite ou clique):
                  </label>
                  <input
                    type="text"
                    value={rangeStr}
                    onChange={handleManualInputChange}
                    placeholder="Ex: 1-5, 8, 11"
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: rangeStr ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-mono)', outline: 'none'
                    }}
                  />
                </div>
                
                {/* Botão Mesclado Inteligente (Toggle) */}
                <button 
                  onClick={handleToggleAll} 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: isAllSelected ? 'var(--accent-cyan)' : '#1a1d24', 
                    border: `1px solid ${isAllSelected ? 'var(--accent-cyan)' : 'var(--border-default)'}`, 
                    color: isAllSelected ? '#000' : 'var(--text-secondary)', 
                    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' 
                  }}
                >
                  {isAllSelected ? (
                    <><X size={15} strokeWidth={2.5} /> Limpar Seleção</>
                  ) : (
                    'Selecionar Todas'
                  )}
                </button>
              </div>
            )}

            {/* Gerenciador de Abas de Grupos */}
            {mode === 'groups' && (
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {groups.map((g, i) => (
                    <div 
                      key={g.id} 
                      onClick={() => setActiveGroup(g.id)}
                      style={{ 
                        minWidth: '220px', padding: '12px', cursor: 'pointer',
                        background: activeGroup === g.id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)', 
                        border: `1px solid ${activeGroup === g.id ? 'var(--accent-cyan)' : 'var(--border-default)'}`, 
                        borderRadius: 'var(--radius-md)', transition: 'all .2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <input 
                          value={g.name} 
                          onChange={(e) => updateGroupName(g.id, e.target.value)} 
                          onClick={e => e.stopPropagation()} 
                          placeholder="Nome do arquivo"
                          style={{ 
                            background: 'transparent', border: 'none', color: activeGroup === g.id ? 'var(--accent-cyan)' : 'var(--text-primary)', 
                            fontWeight: 600, fontSize: 14, outline: 'none', width: '100%' 
                          }} 
                        />
                        {groups.length > 1 && (
                          <button onClick={(e) => handleRemoveGroup(g.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {g.pages.length} página(s) selecionada(s)
                      </div>
                    </div>
                  ))}
                  
                  {/* Botão Add Grupo */}
                  <div 
                    onClick={handleAddGroup}
                    style={{ 
                      minWidth: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      color: 'var(--text-secondary)', transition: 'all .2s', background: 'var(--bg-elevated)'
                    }}
                  >
                    <Plus size={20} style={{ marginBottom: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Novo Grupo</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Grid de Seleção Visual */}
          <SectionCard style={{ padding: '1.25rem', opacity: mode === 'each' ? 0.5 : 1, pointerEvents: mode === 'each' ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
              {pages.map((page, i) => {
                const isSelected = currentSelection.includes(page.pageIndex);
                const clickOrderIndex = currentSelection.indexOf(page.pageIndex) + 1;

                return (
                  <div
                    key={page.id}
                    onClick={() => togglePage(page.pageIndex)}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer', transition: 'all .15s',
                      position: 'relative',
                      boxShadow: isSelected ? '0 4px 16px rgba(0,200,255,.15)' : 'none',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, padding: '12px', overflow: 'hidden' }}>
                      <img src={page.thumbnail} alt={`Página ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '2px' }} draggable={false} />
                      
                      <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                        {i + 1}
                      </div>

                      {isSelected && (
                        <div style={{ 
                          position: 'absolute', top: 8, left: 8, background: 'var(--accent-cyan)', color: '#000', 
                          borderRadius: '6px', padding: '4px 8px', fontSize: 12, fontWeight: 800, 
                          display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          <CheckCircle2 size={16} />
                          <span style={{fontFamily: 'var(--font-mono)'}}>{clickOrderIndex}º</span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 600, background: isSelected ? 'var(--accent-cyan)' : 'var(--bg-secondary)', color: isSelected ? '#000' : 'var(--text-secondary)', transition: 'all .15s' }}>
                      {isSelected ? 'Selecionada' : 'Ignorar'}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <ProgressBar state={state} />
          <Alert type="success" message="✓ Divisão concluída! Os arquivos foram baixados." visible={state.status === 'success'} />
          <Alert type="error" message={state.label} visible={state.status === 'error'} />
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default SplitTool