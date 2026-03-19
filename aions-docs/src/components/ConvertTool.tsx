import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Image as ImageIcon, Trash2, FileDown, Layers, FileImage, FilePlus, CheckCircle2, Plus, X } from 'lucide-react'
import { DropZone, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useProcessing } from '@/hooks/useProcessing'
import { downloadFile } from '@/utils/pdf'
import { PDFDocument } from 'pdf-lib'

type ConvertMode = 'single' | 'groups' | 'multiple'

interface ImageItem {
  id: string
  file: File
  preview: string
  extension: string // Mostraremos a extensão real (WEBP, BMP, etc)
}

interface GroupItem {
  id: string
  name: string
  images: string[] 
}

interface ConvertToolProps {
  onBack: () => void
  onSuccess: () => void
}

// ── Conversor Automático de Imagens Incompatíveis ─────────────────
// O pdf-lib só aceita JPG e PNG. Esta função converte WEBP, BMP, GIF para PNG via Canvas
async function getEmbeddableImage(file: File): Promise<{ bytes: ArrayBuffer, type: 'jpg' | 'png' }> {
  const type = file.type.toLowerCase()
  
  // Se já for JPG ou PNG, retorna os bytes puros originais (sem perda de qualidade)
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return { bytes: await file.arrayBuffer(), type: 'jpg' }
  }
  if (type === 'image/png') {
    return { bytes: await file.arrayBuffer(), type: 'png' }
  }

  // Se for outro formato (WEBP, GIF, BMP...), converte para PNG
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Falha no canvas'))
      
      ctx.drawImage(img, 0, 0)
      
      // Converte para PNG em alta qualidade
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl)
        if (!blob) return reject(new Error('Falha ao gerar blob'))
        blob.arrayBuffer().then(buffer => resolve({ bytes: buffer, type: 'png' }))
      }, 'image/png')
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao carregar a imagem para conversão'))
    }
    
    img.src = objectUrl
  })
}
// ─────────────────────────────────────────────────────────────────

const ConvertTool: React.FC<ConvertToolProps> = ({ onBack, onSuccess }) => {
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [images, setImages] = useState<ImageItem[]>([])
  const [mode, setMode] = useState<ConvertMode>('single')

  const [groups, setGroups] = useState<GroupItem[]>([{ id: 'g1', name: 'Documento 1', images: [] }])
  const [activeGroup, setActiveGroup] = useState<string>('g1')

  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const revokePreviews = (imgs: ImageItem[]) => {
    imgs.forEach(img => URL.revokeObjectURL(img.preview))
  }

  useEffect(() => {
    return () => revokePreviews(images)
  }, [])

  const loadImages = useCallback((files: File[]) => {
    // Aceita qualquer arquivo que comece com "image/"
    const validFiles = files.filter(f => f.type.startsWith('image/'))
    
    if (validFiles.length === 0) {
      alert('Selecione apenas arquivos de imagem válidos.')
      return
    }

    const newImages: ImageItem[] = validFiles.map(file => {
      const ext = file.type.split('/')[1]?.toUpperCase() || file.name.split('.').pop()?.toUpperCase() || 'IMG'
      return {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
        extension: ext === 'JPEG' ? 'JPG' : ext
      }
    })

    setImages(prev => [...prev, ...newImages])
    reset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [reset])

  const removeImage = (id: string) => {
    setImages(prev => {
      const imgToRemove = prev.find(img => img.id === id)
      if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview)
      return prev.filter(img => img.id !== id)
    })
    setGroups(prev => prev.map(g => ({ ...g, images: g.images.filter(imgId => imgId !== id) })))
  }

  const handleReorder = (fromIdx: number, toIdx: number) => {
    setImages(prev => {
      const clone = [...prev]
      const [item] = clone.splice(fromIdx, 1)
      clone.splice(toIdx, 0, item)
      return clone
    })
    setDragOver(null)
    dragIdx.current = null
  }

  const clearAll = () => {
    revokePreviews(images)
    setImages([])
    setGroups([{ id: 'g1', name: 'Documento 1', images: [] }])
    setActiveGroup('g1')
    reset()
  }

  const currentSelection = mode === 'groups' ? (groups.find(g => g.id === activeGroup)?.images || []) : []
  const isAllSelected = currentSelection.length === images.length && images.length > 0

  const toggleImageSelection = (id: string) => {
    if (mode !== 'groups') return
    setGroups(prev => prev.map(g => {
      if (g.id === activeGroup) {
        return { ...g, images: g.images.includes(id) ? g.images.filter(i => i !== id) : [...g.images, id] }
      }
      return g
    }))
  }

  const handleToggleAll = () => {
    const allIds = images.map(img => img.id)
    setGroups(prev => prev.map(g => {
      if (g.id === activeGroup) return { ...g, images: isAllSelected ? [] : allIds }
      return g
    }))
  }

  const handleAddGroup = () => {
    const newId = `g${Date.now()}`
    setGroups(prev => [...prev, { id: newId, name: `Documento ${prev.length + 1}`, images: [] }])
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

  const handleConvert = async () => {
    if (images.length === 0) return
    
    const validGroups = groups.filter(g => g.images.length > 0)
    if (mode === 'groups' && validGroups.length === 0) {
      fail('Adicione imagens a pelo menos um grupo.')
      return
    }

    start()

    try {
      if (mode === 'single') {
        update(10, 'Criando documento PDF...')
        const pdfDoc = await PDFDocument.create()

        for (let i = 0; i < images.length; i++) {
          update(10 + Math.round((i / images.length) * 70), `Processando imagem ${i + 1} de ${images.length}...`)
          const imgItem = images[i]
          
          // Chama a função mágica que resolve os WEBP, BMP, etc.
          const { bytes, type } = await getEmbeddableImage(imgItem.file)
          let pdfImage = type === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
          
          const page = pdfDoc.addPage([pdfImage.width, pdfImage.height])
          page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height })
        }

        update(90, 'Gerando arquivo final...')
        const pdfBytes = await pdfDoc.save()
        downloadFile(pdfBytes, 'aions-imagens-convertidas.pdf', 'application/pdf')

      } else if (mode === 'groups') {
        for (let i = 0; i < validGroups.length; i++) {
          const group = validGroups[i]
          update(Math.round((i / validGroups.length) * 90), `Gerando ${group.name}...`)
          const pdfDoc = await PDFDocument.create()
          
          for (const imgId of group.images) {
            const imgItem = images.find(img => img.id === imgId)
            if (imgItem) {
              const { bytes, type } = await getEmbeddableImage(imgItem.file)
              let pdfImage = type === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
              const page = pdfDoc.addPage([pdfImage.width, pdfImage.height])
              page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height })
            }
          }
          
          const pdfBytes = await pdfDoc.save()
          const safeName = group.name.trim() ? `${group.name.trim()}.pdf` : `grupo-${i+1}.pdf`
          downloadFile(pdfBytes, safeName, 'application/pdf')
          await new Promise(r => setTimeout(r, 400))
        }

      } else {
        for (let i = 0; i < images.length; i++) {
          update(Math.round((i / images.length) * 90), `Convertendo imagem ${i + 1} de ${images.length}...`)
          const imgItem = images[i]
          const pdfDoc = await PDFDocument.create()
          
          const { bytes, type } = await getEmbeddableImage(imgItem.file)
          let pdfImage = type === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
          
          const page = pdfDoc.addPage([pdfImage.width, pdfImage.height])
          page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height })
          
          const pdfBytes = await pdfDoc.save()
          const baseName = imgItem.file.name.replace(/\.[^/.]+$/, "") 
          downloadFile(pdfBytes, `${baseName}.pdf`, 'application/pdf')
          await new Promise(r => setTimeout(r, 300))
        }
      }

      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao converter imagens. Verifique se os arquivos são válidos.')
    }
  }

  const ModeCard: React.FC<{ id: ConvertMode; title: string; sub: string; icon: React.ReactNode }> = ({ id, title, sub, icon }) => (
    <div
      onClick={() => setMode(id)}
      style={{
        border: `1px solid ${mode === id ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
        background: mode === id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)', padding: '1rem', cursor: 'pointer', transition: 'all var(--transition)',
        display: 'flex', alignItems: 'center', gap: '1rem'
      }}
    >
      <div style={{ color: mode === id ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: mode === id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader title="Converter para PDF" sub="Transforme qualquer imagem em documentos PDF com facilidade." onBack={onBack} />

      <input 
        type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} 
        onChange={(e) => { if (e.target.files && e.target.files.length > 0) loadImages(Array.from(e.target.files)) }} 
      />

      {images.length === 0 && (
        <SectionCard>
          <DropZone
            onFiles={(f) => loadImages(f)}
            accept="image/*"
            multiple
            label="Arraste imagens aqui"
            sublabel="JPG, PNG, WEBP, GIF, BMP · Múltiplas imagens suportadas"
          />
        </SectionCard>
      )}

      {images.length > 0 && (
        <>
          <div style={{ position: 'sticky', top: '1rem', zIndex: 50, display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', paddingRight: '1rem', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={clearAll}>Limpar Tudo</Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<FilePlus size={14} />}>Mais Imagens</Btn>
              </div>
              <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)' }}>
                <Btn onClick={handleConvert} disabled={state.isProcessing} icon={<FileDown size={14} />}>
                  {state.isProcessing ? 'Convertendo...' : 'Converter Imagens'}
                </Btn>
              </div>
            </div>
          </div>

          <SectionCard style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '0 0 .75rem' }}>Opções de Conversão</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '.75rem' }}>
              <ModeCard id="single" title="Juntar em 1 PDF" sub="Gera um único PDF ordenado pelas imagens abaixo." icon={<Layers size={24} />} />
              <ModeCard id="groups" title="Agrupar em vários PDFs" sub="Crie grupos e escolha a ordem das imagens." icon={<FilePlus size={24} />} />
              <ModeCard id="multiple" title="PDFs Separados" sub="Cada imagem vira um arquivo independente." icon={<FileImage size={24} />} />
            </div>

            {mode === 'groups' && (
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gerencie os grupos e clique nas imagens abaixo para preenchê-los.</label>
                  
                  <button 
                    onClick={handleToggleAll} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: isAllSelected ? 'var(--accent-cyan)' : '#1a1d24', 
                      border: `1px solid ${isAllSelected ? 'var(--accent-cyan)' : 'var(--border-default)'}`, 
                      color: isAllSelected ? '#000' : 'var(--text-secondary)', 
                      padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' 
                    }}
                  >
                    {isAllSelected ? <><X size={14} strokeWidth={2.5} /> Limpar Seleção</> : 'Selecionar Todas'}
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {groups.map((g) => (
                    <div 
                      key={g.id} onClick={() => setActiveGroup(g.id)}
                      style={{ 
                        minWidth: '220px', padding: '12px', cursor: 'pointer',
                        background: activeGroup === g.id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)', 
                        border: `1px solid ${activeGroup === g.id ? 'var(--accent-cyan)' : 'var(--border-default)'}`, 
                        borderRadius: 'var(--radius-md)', transition: 'all .2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <input 
                          value={g.name} onChange={(e) => updateGroupName(g.id, e.target.value)} onClick={e => e.stopPropagation()} 
                          placeholder="Nome do arquivo"
                          style={{ background: 'transparent', border: 'none', color: activeGroup === g.id ? 'var(--accent-cyan)' : 'var(--text-primary)', fontWeight: 600, fontSize: 14, outline: 'none', width: '100%' }} 
                        />
                        {groups.length > 1 && (
                          <button onClick={(e) => handleRemoveGroup(g.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {g.images.length} imagem(ns) selecionada(s)
                      </div>
                    </div>
                  ))}
                  
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

          <SectionCard style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              Imagens Carregadas ({images.length})
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
              {images.map((img, i) => {
                const isSelected = currentSelection.includes(img.id);
                const clickOrderIndex = currentSelection.indexOf(img.id) + 1;

                return (
                  <div
                    key={img.id}
                    onClick={() => toggleImageSelection(img.id)}
                    draggable={mode === 'single'}
                    onDragStart={() => { if(mode==='single') dragIdx.current = i }}
                    onDragOver={(e) => { if(mode==='single') { e.preventDefault(); setDragOver(i) } }}
                    onDragLeave={() => { if(mode==='single') setDragOver(null) }}
                    onDrop={() => { if (mode==='single' && dragIdx.current !== null && dragIdx.current !== i) handleReorder(dragIdx.current, i); setDragOver(null) }}
                    onDragEnd={() => { dragIdx.current = null; setDragOver(null) }}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `2px solid ${isSelected && mode === 'groups' ? 'var(--accent-cyan)' : dragOver === i ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden', 
                      cursor: mode === 'groups' ? 'pointer' : mode === 'single' ? 'grab' : 'default', 
                      transition: 'all .15s', position: 'relative',
                      boxShadow: (isSelected && mode === 'groups') || dragOver === i ? '0 4px 16px rgba(0,200,255,.15)' : 'none',
                      transform: (isSelected && mode === 'groups') || dragOver === i ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, padding: '12px', overflow: 'hidden', background: '#fff' }}>
                      <img src={img.preview} alt={`Imagem ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
                      
                      {mode === 'single' && (
                        <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                          {i + 1}
                        </div>
                      )}

                      {isSelected && mode === 'groups' && (
                        <div style={{ 
                          position: 'absolute', top: 8, left: 8, background: 'var(--accent-cyan)', color: '#000', 
                          borderRadius: '6px', padding: '4px 8px', fontSize: 12, fontWeight: 800, 
                          display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          <CheckCircle2 size={16} />
                          <span style={{fontFamily: 'var(--font-mono)'}}>{clickOrderIndex}º</span>
                        </div>
                      )}

                      {mode !== 'groups' && (
                        <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '2px 6px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>
                          {img.extension}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', background: mode === 'groups' && isSelected ? 'var(--accent-cyan)' : 'var(--bg-secondary)', padding: '6px 8px', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: 10, color: mode === 'groups' && isSelected ? '#000' : 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', fontWeight: mode === 'groups' && isSelected ? 700 : 400 }}>
                        {img.file.name}
                      </span>
                      <button title="Remover imagem" onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: mode === 'groups' && isSelected ? 'rgba(0,0,0,0.5)' : 'var(--text-tertiary)', padding: '4px 5px', borderRadius: 4, display: 'flex', transition: 'all .12s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.background = '#f8514918' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = mode === 'groups' && isSelected ? 'rgba(0,0,0,0.5)' : 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <ProgressBar state={state} />
          <Alert type="success" message="✓ Conversão concluída!" visible={state.status === 'success'} />
          <Alert type="error" message={state.label} visible={state.status === 'error'} />
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default ConvertTool