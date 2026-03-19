import React, { useState, useRef } from 'react'
import { RefreshCcw, FileText, FileSpreadsheet, Image, CheckCircle, XCircle, Loader } from 'lucide-react'
import { DropZone, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { imagesToPDF, downloadFile, downloadBlob, formatBytes } from '@/utils/pdf'

// ─── Types ───────────────────────────────────────────────────────────────────

type FileType = 'image' | 'office' | 'pdf'

interface ConvertItem {
  id: string
  file: File
  data: ArrayBuffer
  fileType: FileType
  ext: string
  thumbUrl: string | null
  status: 'idle' | 'processing' | 'done' | 'error'
  errorMsg: string | null
  resultName: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() { return Math.random().toString(36).slice(2, 9) }

function getFileType(file: File): FileType {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext)) return 'image'
  if (['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp'].includes(ext)) return 'office'
  return 'pdf'
}

function getExt(file: File) {
  return '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
}

async function makeImageThumb(data: ArrayBuffer, mimeType: string): Promise<string> {
  const blob = new Blob([data], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const img  = new Image()
  img.src    = url
  await new Promise<void>((r) => { img.onload = () => r() })
  URL.revokeObjectURL(url)
  const canvas = document.createElement('canvas')
  const scale  = Math.min(1, 160 / Math.max(img.width, img.height))
  canvas.width  = Math.round(img.width  * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}

// ícone por extensão
function FileIcon({ ext, size = 20 }: { ext: string; size?: number }) {
  const s = { width: size, height: size }
  if (['.doc','.docx','.odt'].includes(ext)) return <FileText style={s} color="#2196f3" />
  if (['.xls','.xlsx','.ods'].includes(ext)) return <FileSpreadsheet style={s} color="#4caf50" />
  if (['.ppt','.pptx','.odp'].includes(ext)) return <FileText style={s} color="#ff5722" />
  return <Image style={s} color="#9c27b0" />
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ConvertToolProps {
  onBack: () => void
  onSuccess: () => void
}

const ConvertTool: React.FC<ConvertToolProps> = ({ onBack, onSuccess }) => {
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [items, setItems]   = useState<ConvertItem[]>([])
  const [busy, setBusy]     = useState(false)
  const [mode, setMode]     = useState<'individual' | 'merged'>('individual')
  const inputRef            = useRef<HTMLInputElement>(null)

  const ACCEPT = 'image/jpeg,image/png,image/jpg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp'

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      const data     = await file.arrayBuffer()
      const fileType = getFileType(file)
      const ext      = getExt(file)
      const id       = generateId()

      setItems(prev => [...prev, {
        id, file, data, fileType, ext,
        thumbUrl: null, status: 'idle',
        errorMsg: null, resultName: null,
      }])

      if (fileType === 'image') {
        makeImageThumb(data, file.type).then(thumbUrl => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, thumbUrl } : i))
        }).catch(() => {})
      }
    }
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const clearAll   = () => { setItems([]); reset() }

  // Converte imagens em um único PDF mesclado
  const convertImagesMerged = async (imgItems: ConvertItem[]) => {
    update(20, 'Gerando PDF com todas as imagens...')
    const bytes = await imagesToPDF(
      imgItems.map(i => ({ data: i.data, file: i.file })),
      (pct, label) => update(20 + Math.round(pct * 0.7), label)
    )
    downloadFile(bytes, 'aions-imagens.pdf', 'application/pdf')
    imgItems.forEach(i => {
      setItems(prev => prev.map(x =>
        x.id === i.id ? { ...x, status: 'done', resultName: 'aions-imagens.pdf' } : x
      ))
    })
  }

  // Converte cada imagem em PDF individual
  const convertImageIndividual = async (item: ConvertItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
    try {
      const bytes = await imagesToPDF([{ data: item.data, file: item.file }], () => {})
      const name  = item.file.name.replace(/\.[^.]+$/, '') + '.pdf'
      downloadFile(bytes, name, 'application/pdf')
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'done', resultName: name } : i
      ))
    } catch (e: any) {
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'error', errorMsg: e.message } : i
      ))
    }
  }

  // Converte arquivo Office via API LibreOffice
  const convertOffice = async (item: ConvertItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
    try {
      const formData = new FormData()
      formData.append('arquivo', item.file)
      const response = await fetch('http://localhost:3001/converter', {
        method: 'POST', body: formData,
      })
      if (!response.ok) {
        const msg = await response.text()
        throw new Error(msg || `API retornou ${response.status}`)
      }
      const blob = await response.blob()
      const name  = item.file.name.replace(/\.[^.]+$/, '') + '.pdf'
      downloadBlob(blob, name)
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'done', resultName: name } : i
      ))
    } catch (e: any) {
      const msg = String(e).includes('fetch') || String(e).includes('Failed')
        ? 'API offline — rode: node server.js'
        : e.message
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'error', errorMsg: msg } : i
      ))
    }
  }

  const handleConvert = async () => {
    if (!items.length || busy) return
    setBusy(true); start()

    const imgItems    = items.filter(i => i.fileType === 'image'  && i.status === 'idle')
    const officeItems = items.filter(i => i.fileType === 'office' && i.status === 'idle')
    const total       = imgItems.length + officeItems.length

    update(5, 'Iniciando conversão...')

    try {
      // Imagens
      if (imgItems.length > 0) {
        if (mode === 'merged' && imgItems.length > 1) {
          imgItems.forEach(i => setItems(prev => prev.map(x =>
            x.id === i.id ? { ...x, status: 'processing' } : x
          )))
          await convertImagesMerged(imgItems)
        } else {
          for (const item of imgItems) {
            await convertImageIndividual(item)
          }
        }
      }

      // Office (sempre individual)
      for (let i = 0; i < officeItems.length; i++) {
        update(
          Math.round(((imgItems.length + i) / total) * 90),
          `Convertendo ${officeItems[i].file.name}...`
        )
        await convertOffice(officeItems[i])
      }

      update(100, 'Concluído!')
      succeed(); onSuccess()
    } catch (e: any) {
      fail('Erro inesperado: ' + e.message)
    }

    setBusy(false)
  }

  const doneCount  = items.filter(i => i.status === 'done').length
  const errorCount = items.filter(i => i.status === 'error').length
  const imgCount   = items.filter(i => i.fileType === 'image').length
  const offCount   = items.filter(i => i.fileType === 'office').length

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Converter para PDF"
        sub="Imagens (JPG/PNG) e documentos Office (Word, Excel, PowerPoint) → PDF."
        onBack={onBack}
      />

      <SectionCard>
        {/* Drop zone */}
        <DropZone
          onFiles={addFiles}
          accept={ACCEPT}
          multiple
          label="Arraste arquivos aqui"
          sublabel="JPG · PNG · Word (.docx) · Excel (.xlsx) · PowerPoint (.pptx)"
        />

        {/* Legenda de tipos suportados */}
        <div style={{
          display: 'flex', gap: 16, marginTop: '.75rem', flexWrap: 'wrap',
          fontSize: 11.5, color: 'var(--text-secondary)',
        }}>
          {[
            { icon: <Image size={13} color="#9c27b0" />, label: 'JPG / PNG → PDF (local)' },
            { icon: <FileText size={13} color="#2196f3" />, label: 'Word .docx → PDF (LibreOffice)' },
            { icon: <FileSpreadsheet size={13} color="#4caf50" />, label: 'Excel .xlsx → PDF (LibreOffice)' },
            { icon: <FileText size={13} color="#ff5722" />, label: 'PowerPoint .pptx → PDF (LibreOffice)' },
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {t.icon} {t.label}
            </div>
          ))}
        </div>

        {/* Grid de arquivos */}
        {items.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '1rem', marginTop: '1.25rem',
            }}>
              {items.map((item) => (
                <div key={item.id} style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${
                    item.status === 'done'  ? '#3fb95044' :
                    item.status === 'error' ? '#f8514944' :
                    'var(--border-default)'
                  }`,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}>
                  {/* Preview/ícone */}
                  <div style={{
                    background: '#fff', height: 140,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {item.thumbUrl
                      ? <img src={item.thumbUrl} alt={item.file.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : (
                        <div style={{ textAlign: 'center' }}>
                          <FileIcon ext={item.ext} size={40} />
                          <div style={{ fontSize: 10, color: '#888', marginTop: 6, fontFamily: 'monospace' }}>
                            {item.ext.toUpperCase()}
                          </div>
                        </div>
                      )
                    }
                    {/* Status overlay */}
                    {item.status === 'processing' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader size={26} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={32} color="#3fb950" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px' }}>
                        <XCircle size={24} color="#f85149" />
                        <span style={{ fontSize: 10, color: '#f85149', textAlign: 'center' }}>{item.errorMsg}</span>
                      </div>
                    )}
                    {/* Remover */}
                    {item.status === 'idle' && (
                      <button onClick={() => removeItem(item.id)} style={{
                        position: 'absolute', top: 4, right: 4,
                        background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff',
                        borderRadius: '50%', width: 20, height: 20, fontSize: 13,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '7px 9px' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)', marginBottom: 2 }}>
                      {item.file.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {formatBytes(item.file.size)}
                      </span>
                      <span style={{
                        fontSize: 9.5, padding: '1px 5px', borderRadius: 3,
                        background: item.fileType === 'image' ? '#9c27b018' : item.fileType === 'office' ? '#2196f318' : 'var(--accent-cyan-dim)',
                        color: item.fileType === 'image' ? '#9c27b0' : item.fileType === 'office' ? '#2196f3' : 'var(--accent-cyan)',
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                      }}>
                        {item.ext.replace('.','').toUpperCase()}
                      </span>
                    </div>
                    {item.resultName && (
                      <div style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                        ✓ {item.resultName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Opção de mesclagem (só para imagens) */}
            {imgCount > 1 && offCount === 0 && (
              <div style={{
                marginTop: '1rem', padding: '.75rem 1rem',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                  Modo de saída para imagens
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['individual', 'merged'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${mode === m ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                      background: mode === m ? 'var(--accent-cyan-dim)' : 'var(--bg-secondary)',
                      color: mode === m ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)', fontWeight: mode === m ? 600 : 400,
                    }}>
                      {m === 'individual' ? 'Um PDF por imagem' : 'Um PDF com todas'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Office precisa da API */}
            {offCount > 0 && (
              <div style={{
                marginTop: '.75rem', padding: '8px 12px',
                background: 'var(--accent-cyan-dim)', border: '1px solid var(--accent-cyan-border)',
                borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-cyan)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>ℹ</span>
                <span>
                  Arquivos Office requerem a API local com LibreOffice instalado.
                  Certifique-se que o <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>node server.js</code> está rodando.
                </span>
              </div>
            )}

            {/* Ações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '1rem' }}>
              <Btn onClick={handleConvert} disabled={busy} icon={<RefreshCcw size={14} />}>
                {busy
                  ? 'Convertendo...'
                  : `Converter ${items.filter(i => i.status === 'idle').length} arquivo(s) para PDF`}
              </Btn>
              <Btn variant="secondary" onClick={clearAll}>Limpar tudo</Btn>
              {doneCount > 0 && (
                <span style={{ fontSize: 12, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  ✓ {doneCount} convertido(s)
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
        {!busy && doneCount > 0 && errorCount === 0 && (
          <Alert type="success" message={`✓ ${doneCount} arquivo(s) convertido(s) para PDF!`} visible />
        )}
        {!busy && errorCount > 0 && (
          <Alert type="error" message="Alguns arquivos falharam. Verifique se a API e o LibreOffice estão instalados." visible />
        )}
      </SectionCard>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default ConvertTool