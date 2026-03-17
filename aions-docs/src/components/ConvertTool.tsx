import React from 'react'
import { RefreshCcw } from 'lucide-react'
import { DropZone, FileList, ProgressBar, Alert, Btn, SectionCard, PageHeader } from './ui'
import { useFileManager } from '@/hooks/useFileManager'
import { useProcessing } from '@/hooks/useProcessing'
import { imagesToPDF, downloadFile } from '@/utils/pdf'

interface ConvertToolProps {
  onBack: () => void
  onSuccess: () => void
}

const ConvertTool: React.FC<ConvertToolProps> = ({ onBack, onSuccess }) => {
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileManager()
  const { state, start, update, succeed, fail, reset } = useProcessing()

  const handleConvert = async () => {
    if (!files.length) return
    start()
    try {
      const bytes = await imagesToPDF(files, update)
      downloadFile(bytes, 'aions-imagens.pdf', 'application/pdf')
      succeed()
      onSuccess()
    } catch (err) {
      console.error(err)
      fail('Erro na conversão. Verifique se os arquivos são imagens JPG ou PNG válidas.')
    }
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
      <PageHeader
        title="Converter para PDF"
        sub="Transforme imagens JPG e PNG em um documento PDF — cada imagem vira uma página."
        onBack={onBack}
      />

      <SectionCard>
        <DropZone
          onFiles={(f) => {
            const imgs = f.filter(x => x.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(x.name))
            if (imgs.length !== f.length) alert('Atenção: apenas imagens JPG e PNG são aceitas.')
            if (imgs.length > 0) { reset(); addFiles(imgs) }
          }}
          accept="image/jpeg,image/png,image/jpg"
          multiple
          label="Arraste imagens aqui"
          sublabel="JPG e PNG · Múltiplas imagens → um único PDF"
        />
        <FileList files={files} onRemove={removeFile} onReorder={reorderFiles} />

        {files.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: '.75rem' }}>
              ↕ Cada imagem será uma página · Arraste para reordenar
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              <Btn onClick={handleConvert} disabled={state.isProcessing} icon={<RefreshCcw size={14} />}>
                {state.isProcessing ? 'Convertendo...' : `Converter ${files.length} imagem(ns) para PDF`}
              </Btn>
              <Btn variant="secondary" onClick={() => { clearFiles(); reset() }}>Limpar</Btn>
            </div>
          </>
        )}

        <ProgressBar state={state} />
        <Alert type="success" message="✓ PDF gerado com sucesso! O download iniciou automaticamente." visible={state.status === 'success'} />
        <Alert type="error" message={state.label} visible={state.status === 'error'} />
      </SectionCard>

      <SectionCard style={{ background: 'var(--bg-primary)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.4rem' }}>Dica</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
          Para fotos de documentos (contratos, certidões), use a ferramenta Comprimir logo após converter para reduzir o tamanho final.
        </div>
      </SectionCard>
    </div>
  )
}

export default ConvertTool
