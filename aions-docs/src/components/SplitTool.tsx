import React, { useState } from 'react'
import { Scissors } from 'lucide-react'
import { DropZone, FileList, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { splitPDF } from '@/utils/pdf'
import { SplitMode } from '@/types'

interface SplitToolProps {
  onBack: () => void
  onSuccess: () => void
}

const SplitTool: React.FC<SplitToolProps> = ({ onBack, onSuccess }) => {
  const { files, addFiles, removeFile, clearFiles } = useFileManager()
  const { state, start, update, succeed, fail, reset } = useProcessing()
  const [mode, setMode] = useState<SplitMode>('range')
  const [rangeStr, setRangeStr] = useState('')

  const handleSplit = async () => {
    if (!files.length) return
    if (mode === 'range' && !rangeStr.trim()) {
      fail('Informe as páginas a extrair. Ex: 1-3, 5, 8-10')
      return
    }
    start()
    try {
      await splitPDF(files[0].data, mode, rangeStr, update)
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao dividir. Verifique se o arquivo é um PDF válido e o formato das páginas.')
    }
  }

  const ModeCard: React.FC<{ id: SplitMode; title: string; sub: string }> = ({ id, title, sub }) => (
    <div
      onClick={() => setMode(id)}
      style={{
        border: `1px solid ${mode === id ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
        background: mode === id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem', cursor: 'pointer',
        transition: 'all var(--transition)',
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
      <PageHeader title="Dividir PDF" sub="Extraia páginas específicas ou separe o documento em partes." onBack={onBack} />

      <SectionCard>
        <DropZone
          onFiles={(f) => {
            const pdf = f.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'))
            if (!pdf) { alert('Selecione um arquivo PDF.'); return }
            reset(); clearFiles(); addFiles([pdf])
          }}
          accept=".pdf,application/pdf"
          label="Arraste um PDF aqui"
          sublabel="Apenas um arquivo por vez"
        />
        <FileList files={files} onRemove={(id) => { removeFile(id); reset() }} onReorder={() => {}} />

        {files.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '1.25rem 0 .5rem' }}>Modo de divisão</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <ModeCard id="range" title="Por intervalo de páginas" sub="Ex: 1-3, 5, 7-10" />
              <ModeCard id="each" title="Uma página por arquivo" sub="Separa cada página individualmente" />
            </div>

            {mode === 'range' && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: '.4rem' }}>
                  Páginas a extrair
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1-3, 5, 8-10"
                  value={rangeStr}
                  onChange={(e) => setRangeStr(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: '.3rem', fontFamily: 'var(--font-mono)' }}>
                  Use vírgulas para separar, hífens para intervalos. Exemplo: 1-5, 8, 11-15
                </div>
              </div>
            )}

            {mode === 'each' && (
              <div style={{
                marginTop: '1rem', padding: '10px 14px',
                background: 'var(--accent-cyan-dim)', border: '1px solid var(--accent-cyan-border)',
                borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--accent-cyan)',
              }}>
                ℹ Cada página do PDF será salva como um arquivo separado. Para PDFs grandes, múltiplos downloads serão iniciados.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              <Btn onClick={handleSplit} disabled={state.isProcessing} icon={<Scissors size={14} />}>
                {state.isProcessing ? 'Processando...' : 'Dividir PDF'}
              </Btn>
              <Btn variant="secondary" onClick={() => { clearFiles(); reset(); setRangeStr('') }}>Limpar</Btn>
            </div>
          </>
        )}

        <ProgressBar state={state} />
        <Alert type="success" message="✓ Divisão concluída! Os arquivos foram baixados." visible={state.status === 'success'} />
        <Alert type="error" message={state.label} visible={state.status === 'error'} />
      </SectionCard>
    </div>
  )
}

export default SplitTool
