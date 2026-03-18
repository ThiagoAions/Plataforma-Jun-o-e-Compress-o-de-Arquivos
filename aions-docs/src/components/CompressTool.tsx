import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Minimize2, CheckCircle, XCircle, Loader } from 'lucide-react'
import { DropZone, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { compressImage, downloadBlob, formatBytes } from '@/utils/pdf'

// ─── pdf.js loader ───────────────────────────────────────────────────────────

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

async function renderPDFThumb(data: ArrayBuffer): Promise<string> {
  const lib = await getPdfjsLib()
  const pdf = await lib.getDocument({ data: data.slice(0) }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.6 })
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}

async function generateImageThumb(data: ArrayBuffer, mimeType: string): Promise<string> {
  const blob = new Blob([data], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const img  = new Image()
  img.src = url
  await new Promise<void>((r) => { img.onload = () => r() })
  URL.revokeObjectURL(url)
  const canvas = document.createElement('canvas')
  const scale  = Math.min(1, 200 / img.width)
  canvas.width  = Math.round(img.width  * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileItem {
  id: string
  file: File
  data: ArrayBuffer
  type: 'pdf' | 'image'
  thumb: string | null
  status: 'idle' | 'processing' | 'done' | 'error'
  resultSize: number | null
  errorMsg: string | null
}

// ─── Levels ──────────────────────────────────────────────────────────────────

const LEVELS = [
  { id: 'max',    label: 'Máxima', sub: 'Menor arquivo possível', quality: 10, dpiLabel: '72 DPI',  color: 'var(--accent-red)',    colorDim: '#f8514918' },
  { id: 'medium', label: 'Média',  sub: 'Equilíbrio tamanho/qualidade', quality: 50, dpiLabel: '150 DPI', color: 'var(--accent-yellow)', colorDim: '#d2992218' },
  { id: 'low',    label: 'Leve',   sub: 'Alta qualidade, menor redução', quality: 85, dpiLabel: '300 DPI', color: 'var(--accent-green)',  colorDim: '#3fb95018' },
] as const

type LevelId = typeof LEVELS[number]['id']

// ─── Component ───────────────────────────────────────────────────────────────

interface CompressToolProps {
  onBack: () => void
  onSuccess: () => void
}

const CompressTool: React.FC<CompressToolProps> = ({ onBack, onSuccess }) => {
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [levelId, setLevelId] = useState<LevelId>('medium')
  const [items, setItems]     = useState<FileItem[]>([])
  const [isProcessingAll, setIsProcessingAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const level = LEVELS.find(l => l.id === levelId)!

  const generateId = () => Math.random().toString(36).slice(2, 9)

  const addFiles = async (files: File[]) => {
    const valid = files.filter(f =>
      f.type === 'application/pdf' ||
      f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/')
    )
    for (const file of valid) {
      const data = await file.arrayBuffer()
      const type = file.type.startsWith('image/') ? 'image' : 'pdf'
      const id   = generateId()
      setItems(prev => [...prev, {
        id, file, data, type,
        thumb: null, status: 'idle',
        resultSize: null, errorMsg: null,
      }])
      // gera thumbnail em background
      const thumbFn = type === 'pdf'
        ? renderPDFThumb(data)
        : generateImageThumb(data, file.type)
      thumbFn.then(thumb => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, thumb } : i))
      }).catch(() => {})
    }
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const clearAll = () => { setItems([]); reset() }

  const compressAll = async () => {
    if (!items.length || isProcessingAll) return
    setIsProcessingAll(true)
    start()
    let done = 0
    for (const item of items) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
      try {
        let resultSize: number
        if (item.type === 'image') {
          const blob = await compressImage(item.data, item.file.type, level.quality / 100)
          resultSize = blob.size
          downloadBlob(blob, `aions-${item.file.name.replace(/\.[^.]+$/, '')}.jpg`)
        } else {
          const formData = new FormData()
          formData.append('pdf', item.file)
          formData.append('quality', String(level.quality))
          const response = await fetch('http://localhost:3001/comprimir', {
            method: 'POST', body: formData,
          })
          if (!response.ok) throw new Error(`API retornou ${response.status}`)
          const blob = await response.blob()
          resultSize = blob.size
          downloadBlob(blob, `aions-${item.file.name}`)
        }
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done', resultSize } : i
        ))
        done++
      } catch (err: any) {
        const msg = String(err).includes('fetch') || String(err).includes('Failed')
          ? 'API offline'
          : err.message
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', errorMsg: msg } : i
        ))
      }
      update(Math.round(((done) / items.length) * 100), `${done}/${items.length} arquivos processados`)
    }
    succeed()
    onSuccess()
    setIsProcessingAll(false)
  }

  const doneCount  = items.filter(i => i.status === 'done').length
  const errorCount = items.filter(i => i.status === 'error').length

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Comprimir PDF / Imagem"
        sub="Adicione múltiplos arquivos, escolha o nível e comprima todos de uma vez."
        onBack={onBack}
      />

      <SectionCard>
        {/* Drop zone */}
        <DropZone
          onFiles={addFiles}
          accept=".pdf,application/pdf,image/jpeg,image/png,image/jpg"
          multiple
          label="Arraste PDFs ou Imagens aqui"
          sublabel="Múltiplos arquivos suportados · PDF, JPG e PNG"
        />

        {/* Grade de arquivos com preview individual */}
        {items.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
          }}>
            {items.map((item) => {
              const savedPct = item.resultSize && item.file.size
                ? Math.max(0, Math.round((1 - item.resultSize / item.file.size) * 100))
                : null
              return (
                <div key={item.id} style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${
                    item.status === 'done'  ? '#3fb95044' :
                    item.status === 'error' ? '#f8514944' :
                    'var(--border-default)'
                  }`,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    background: '#fff', height: 160,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {item.thumb
                      ? <img src={item.thumb} alt={item.file.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <div style={{ color: '#ccc', fontSize: 13 }}>Carregando...</div>
                    }
                    {/* Status overlay */}
                    {item.status === 'processing' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Loader size={28} color="var(--accent-cyan)"
                          style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckCircle size={32} color="#3fb950" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,.5)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                        <XCircle size={28} color="var(--accent-red)" />
                        <span style={{ fontSize: 10, color: '#f85149', textAlign: 'center', padding: '0 8px' }}>
                          {item.errorMsg}
                        </span>
                      </div>
                    )}
                    {/* Remover */}
                    {item.status === 'idle' && (
                      <button onClick={() => removeItem(item.id)} style={{
                        position: 'absolute', top: 4, right: 4,
                        background: 'rgba(0,0,0,.6)', border: 'none',
                        color: '#fff', borderRadius: '50%',
                        width: 22, height: 22, fontSize: 14,
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}>×</button>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 500,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      color: 'var(--text-primary)', marginBottom: 3,
                    }}>
                      {item.file.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {formatBytes(item.file.size)}
                      </span>
                      {item.resultSize !== null && savedPct !== null && (
                        <span style={{
                          fontSize: 10, padding: '1px 6px',
                          background: '#3fb95018', border: '1px solid #3fb95044',
                          color: 'var(--accent-green)', borderRadius: 4,
                          fontFamily: 'var(--font-mono)', fontWeight: 700,
                        }}>
                          {formatBytes(item.resultSize)} · -{savedPct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Nível de compressão */}
            <div style={{ margin: '1.5rem 0 1rem' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '.75rem', fontWeight: 500 }}>
                Nível de compressão — aplicado a todos os arquivos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem' }}>
                {LEVELS.map((l) => {
                  const active = levelId === l.id
                  return (
                    <div
                      key={l.id}
                      onClick={() => setLevelId(l.id)}
                      style={{
                        border: `2px solid ${active ? l.color : 'var(--border-default)'}`,
                        background: active ? l.colorDim : 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem', cursor: 'pointer',
                        transition: 'all var(--transition)', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? l.color : 'var(--text-primary)', marginBottom: 4 }}>
                        {l.label}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: active ? l.color : 'var(--text-tertiary)', marginBottom: 6 }}>
                        {l.dpiLabel}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                        {l.sub}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumo + botões */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Btn
                onClick={compressAll}
                disabled={isProcessingAll}
                icon={<Minimize2 size={14} />}
              >
                {isProcessingAll
                  ? `Comprimindo ${items.filter(i => i.status === 'processing').length > 0 ? '...' : ''}`
                  : `Comprimir ${items.length} arquivo(s) — ${level.label}`}
              </Btn>
              <Btn variant="secondary" onClick={clearAll}>Limpar tudo</Btn>
              {doneCount > 0 && (
                <span style={{ fontSize: 12, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  ✓ {doneCount} concluído(s)
                </span>
              )}
              {errorCount > 0 && (
                <span style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                  ✕ {errorCount} erro(s)
                </span>
              )}
            </div>
          </>
        )}

        <ProgressBar state={state} />
        {!isProcessingAll && doneCount > 0 && errorCount === 0 && (
          <Alert type="success" message={`✓ ${doneCount} arquivo(s) comprimido(s) e baixado(s)!`} visible />
        )}
        {!isProcessingAll && errorCount > 0 && (
          <Alert type="error" message={`${errorCount} arquivo(s) com erro. Verifique se a API está rodando.`} visible />
        )}
      </SectionCard>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default CompressTool
