import React from 'react'
import { FilePlus2 } from 'lucide-react'
import { DropZone, FileList, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { mergePDFs, downloadFile } from '@/utils/pdf'

interface MergeToolProps {
  onBack: () => void
  onSuccess: () => void
}

const MergeTool: React.FC<MergeToolProps> = ({ onBack, onSuccess }) => {
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileManager()
  const { state, start, update, succeed, fail, reset } = useProcessing()

  const handleMerge = async () => {
    if (files.length < 2) return
    start()
    try {
      const bytes = await mergePDFs(files, update)
      downloadFile(bytes, 'aions-merged.pdf', 'application/pdf')
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro ao processar. Verifique se todos os arquivos são PDFs válidos e não estão corrompidos.')
    }
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Juntar PDF"
        sub="Selecione múltiplos arquivos, reordene arrastando e una em um único PDF."
        onBack={onBack}
      />

      <SectionCard>
        <DropZone
          onFiles={(f) => {
            // Filter only PDFs
            const pdfs = f.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
            if (pdfs.length !== f.length) {
              alert('Atenção: apenas arquivos PDF são aceitos nesta ferramenta.')
            }
            if (pdfs.length > 0) { reset(); addFiles(pdfs) }
          }}
          accept=".pdf,application/pdf"
          multiple
          label="Arraste os PDFs aqui"
          sublabel="ou clique para selecionar · Múltiplos PDFs suportados"
        />

        <FileList files={files} onRemove={removeFile} onReorder={reorderFiles} />

        {files.length === 1 && (
          <p style={{ fontSize: 12, color: 'var(--accent-yellow)', marginTop: '.75rem' }}>
            ⚠ Adicione pelo menos mais 1 PDF para poder juntar.
          </p>
        )}
        {files.length >= 2 && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: '.75rem' }}>
            ↕ Arraste os itens para reordenar · A ordem aqui será a ordem final do PDF
          </p>
        )}

        {files.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1rem' }}>
            <Btn
              onClick={handleMerge}
              disabled={files.length < 2 || state.isProcessing}
              icon={<FilePlus2 size={14} />}
              style={{ opacity: files.length < 2 ? 0.5 : 1 }}
            >
              {state.isProcessing ? 'Processando...' : 'Juntar PDFs'}
            </Btn>
            <Btn variant="secondary" onClick={() => { clearFiles(); reset() }}>
              Limpar tudo
            </Btn>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {files.length} arquivo(s)
            </span>
          </div>
        )}

        <ProgressBar state={state} />
        <Alert type="success" message="✓ PDF gerado com sucesso! O download iniciou automaticamente." visible={state.status === 'success'} />
        <Alert type="error" message={state.label} visible={state.status === 'error'} />
      </SectionCard>

      <SectionCard style={{ background: 'var(--bg-primary)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.4rem' }}>Como funciona</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
          1. Selecione ou arraste os PDFs &nbsp;→&nbsp;
          2. Reordene na lista arrastando &nbsp;→&nbsp;
          3. Clique em "Juntar PDFs" &nbsp;→&nbsp;
          4. Download automático — nenhum dado sai do seu computador.
        </div>
      </SectionCard>
    </div>
  )
}

export default MergeTool
