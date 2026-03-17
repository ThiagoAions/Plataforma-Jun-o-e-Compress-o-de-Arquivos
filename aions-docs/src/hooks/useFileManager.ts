import { useState, useCallback } from 'react'
import { FileEntry } from '@/types'
import { generateId } from '@/utils/pdf'

export function useFileManager() {
  const [files, setFiles] = useState<FileEntry[]>([])

  const addFiles = useCallback((newFiles: File[]) => {
    newFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const data = e.target!.result as ArrayBuffer
        const isImage = file.type.startsWith('image/')
        setFiles((prev) => [
          ...prev,
          {
            id: generateId(),
            name: file.name,
            size: file.size,
            data,
            file,
            type: isImage ? 'image' : 'pdf',
          } as FileEntry,
        ])
      }
      reader.readAsArrayBuffer(file)
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearFiles = useCallback(() => setFiles([]), [])

  const reorderFiles = useCallback((fromIdx: number, toIdx: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }, [])

  return { files, addFiles, removeFile, clearFiles, reorderFiles }
}
