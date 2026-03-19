export type Tool = 'dashboard' | 'merge' | 'split' | 'compress' | 'convert' | 'organize'

export interface FileEntry {
  id: string
  name: string
  size: number
  data: ArrayBuffer
  file: File
  type: 'pdf' | 'image'
}

export interface ProcessingState {
  isProcessing: boolean
  progress: number
  label: string
  status: 'idle' | 'processing' | 'success' | 'error'
}

export type CompressionLevel = 'high' | 'medium' | 'low'
export type SplitMode = 'range' | 'each'
