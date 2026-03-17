import { useState, useCallback } from 'react'
import { ProcessingState } from '@/types'

const IDLE: ProcessingState = { isProcessing: false, progress: 0, label: '', status: 'idle' }

export function useProcessing() {
  const [state, setState] = useState<ProcessingState>(IDLE)

  const start = useCallback(() => {
    setState({ isProcessing: true, progress: 0, label: 'Iniciando...', status: 'processing' })
  }, [])

  const update = useCallback((progress: number, label: string) => {
    setState((prev) => ({ ...prev, progress, label }))
  }, [])

  const succeed = useCallback(() => {
    setState({ isProcessing: false, progress: 100, label: 'Concluído!', status: 'success' })
  }, [])

  const fail = useCallback((label = 'Erro no processamento.') => {
    setState({ isProcessing: false, progress: 0, label, status: 'error' })
  }, [])

  const reset = useCallback(() => setState(IDLE), [])

  return { state, start, update, succeed, fail, reset }
}
