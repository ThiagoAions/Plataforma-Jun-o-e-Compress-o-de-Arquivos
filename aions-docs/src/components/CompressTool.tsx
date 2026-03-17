import React, { useState } from 'react'
import { Minimize2 } from 'lucide-react'
import { DropZone, FileList, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { compressPDF, compressImage, downloadFile, downloadBlob, formatBytes } from '@/utils/pdf'
import { CompressionLevel } from '@/types'

interface CompressToolProps {
  onBack: () => void
  onSuccess: () => void
}

const LEVELS: { id: CompressionLevel; label: string; sub: string; quality: number }[] = [
  { id: 'high',   label: 'Alta qualidade',    sub: '~70% do tamanho original', quality: 0.85 },
  { id: 'medium', label: 'Balanceado',        sub: '~45% do tamanho original', quality: 0.70 },
  { id: 'low',    label: 'Máx. compressão',   sub: '~25% do tamanho original', quality: 0.40 },
]

const CompressTool: React.FC<CompressToolProps> = ({ onBack, onSuccess }) => {
  const { files, addFiles, removeFile, clearFiles } = useFileManager()
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [level, setLevel] = useState<CompressionLevel>('medium')
  const [quality, setQuality] = useState(70)
  const [resultSize, setResultSize] = useState<number | null>(null)

  const handleLevelChange = (l: CompressionLevel) => {
    setLevel(l)
    setQuality(Math.round(LEVELS.find((x) => x.id === l)!.quality * 100))
    setResultSize(null)
  }

  const handleCompress = async () => {
    if (!files.length) return
    const f = files[0]
    const isImg = f.file.type.startsWith('image/')
    setResultSize(null)
    start()
    try {
      if (isImg) {
        update(30, 'Carregando imagem...')
        const blob = await compressImage(f.data, f.file.type, quality / 100)
        update(100, 'Concluído!')
        setResultSize(blob.size)
        downloadBlob(blob, `aions-comprimido.jpg`)
      } else {
        update(40, 'Lendo PDF...')
        const bytes = await compressPDF(f.data)
        update(100, 'Concluído!')
        setResultSize(bytes.byteLength)
        downloadFile(bytes, `aions-comprimido.pdf`, 'application/pdf')
      }
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro na compressão. Verifique o arquivo e tente novamente.')
    }
  }

  const originalSize = files[0]?.size ?? 0
  const savedPct = resultSize && originalSize
    ? Math.max(0, Math.round((1 - resultSize / originalSize) * 100))
    : null

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Comprimir PDF / Imagem"
        sub="Reduza o tamanho mantendo legibilidade para portais governamentais e tribunais."
        onBack={onBack}
      />

      <SectionCard>
        <DropZone
          onFiles={(f) => {
            reset(); setResultSize(null); clearFiles(); addFiles([f[0]])
          }}
          accept=".pdf,application/pdf,image/jpeg,image/png,image/jpg"
          label="Arraste um PDF ou Imagem"
          sublabel="Suporta PDF, JPG e PNG · Um arquivo por vez"
        />
        <FileList files={files} onRemove={(id) => { removeFile(id); reset(); setResultSize(null) }} onReorder={() => {}} />

        {files.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '1.25rem 0 .5rem' }}>Nível de compressão</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.5rem' }}>
              {LEVELS.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleLevelChange(l.id)}
                  style={{
                    border: `1px solid ${level === l.id ? 'var(--accent-green)' : 'var(--border-default)'}`,
                    background: level === l.id ? '#3fb95018' : 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    padding: '.75rem', cursor: 'pointer', textAlign: 'center',
                    transition: 'all var(--transition)',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: level === l.id ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {l.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{l.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ margin: '1rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: '.4rem' }}>
                <span>Qualidade de imagem / DPI</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>{quality}%</span>
              </div>
              <input
                type="range" min="10" max="95" step="1" value={quality}
                onChange={(e) => { setQuality(Number(e.target.value)); setResultSize(null) }}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                <span>Menor tamanho</span>
                <span>Maior qualidade</span>
              </div>
            </div>

            {/* Size comparison after compress */}
            {resultSize !== null && savedPct !== null && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12,
                alignItems: 'center', margin: '1rem 0',
                padding: '1rem', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Original</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatBytes(originalSize)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>-{savedPct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>redução</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Comprimido</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{formatBytes(resultSize)}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={handleCompress} disabled={state.isProcessing} icon={<Minimize2 size={14} />}>
                {state.isProcessing ? 'Comprimindo...' : 'Comprimir'}
              </Btn>
              <Btn variant="secondary" onClick={() => { clearFiles(); reset(); setResultSize(null) }}>Limpar</Btn>
            </div>
          </>
        )}

        <ProgressBar state={state} />
        <Alert type="success" message="✓ Arquivo comprimido e baixado com sucesso!" visible={state.status === 'success'} />
        <Alert type="error" message={state.label} visible={state.status === 'error'} />
      </SectionCard>
    </div>
  )
}

export default CompressTool
