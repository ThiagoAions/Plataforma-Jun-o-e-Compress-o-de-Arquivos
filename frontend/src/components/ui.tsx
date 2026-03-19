import React, { useRef } from 'react'
import { Upload } from 'lucide-react'
import { FileEntry, ProcessingState } from '@/types'
import { formatBytes } from '@/utils/pdf'

// ─── DropZone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  label?: string
  sublabel?: string
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFiles, accept, multiple = false, label, sublabel
}) => {
  const [dragging, setDragging] = React.useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = (files: FileList | null) => {
    if (files) onFiles(Array.from(files))
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent-cyan)' : 'var(--border-emphasis)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'var(--accent-cyan-dim)' : 'var(--bg-secondary)',
        transition: 'all var(--transition)',
        position: 'relative',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files)}
      />
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem',
      }}>
        <Upload size={20} color="var(--accent-cyan)" />
      </div>
      <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>
        {label ?? 'Arraste arquivos aqui'}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {sublabel ?? 'ou clique para selecionar'}
      </p>
    </div>
  )
}

// ─── FileList ───────────────────────────────────────────────────────────────

interface FileListProps {
  files: FileEntry[]
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
}

export const FileList: React.FC<FileListProps> = ({ files, onRemove, onReorder }) => {
  const dragIdx = useRef<number | null>(null)

  if (!files.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      {files.map((f, i) => (
        <div
          key={f.id}
          draggable
          onDragStart={() => { dragIdx.current = i }}
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={() => {
            if (dragIdx.current !== null && dragIdx.current !== i) {
              onReorder(dragIdx.current, i)
              dragIdx.current = null
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            cursor: 'grab',
            transition: 'border-color var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-emphasis)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        >
          <span style={{ color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1 }}>⠿</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)'
            }}>{f.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {formatBytes(f.size)}
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 'var(--radius-sm)',
            background: f.type === 'pdf' ? 'var(--accent-cyan-dim)' : 'var(--accent-magenta-dim)',
            color: f.type === 'pdf' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
            border: `1px solid ${f.type === 'pdf' ? 'var(--accent-cyan-border)' : '#c850c044'}`,
            fontWeight: 600, fontFamily: 'var(--font-mono)'
          }}>
            {f.name.split('.').pop()?.toUpperCase()}
          </span>
          <button
            onClick={() => onRemove(f.id)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 18, lineHeight: 1, padding: '0 4px', borderRadius: 4,
              cursor: 'pointer', transition: 'color var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >×</button>
        </div>
      ))}
    </div>
  )
}

// ─── ProgressBar ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  state: ProcessingState
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ state }) => {
  if (state.status === 'idle') return null

  const colors: Record<string, string> = {
    processing: 'var(--accent-cyan)',
    success: 'var(--accent-green)',
    error: 'var(--accent-red)',
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 99, height: 4, overflow: 'hidden',
        border: '1px solid var(--border-default)',
      }}>
        <div style={{
          height: '100%',
          width: `${state.progress}%`,
          background: colors[state.status] ?? 'var(--accent-cyan)',
          borderRadius: 99,
          transition: 'width .3s ease, background .3s ease',
          boxShadow: state.status === 'processing' ? '0 0 8px var(--accent-cyan)' : 'none',
        }} />
      </div>
      <p style={{
        fontSize: 12, marginTop: 6, fontFamily: 'var(--font-mono)',
        color: colors[state.status] ?? 'var(--text-secondary)',
      }}>
        {state.label}
      </p>
    </div>
  )
}

// ─── Alert ──────────────────────────────────────────────────────────────────

interface AlertProps {
  type: 'success' | 'error' | 'info'
  message: string
  visible: boolean
}

export const Alert: React.FC<AlertProps> = ({ type, message, visible }) => {
  if (!visible) return null
  const cfg = {
    success: { bg: '#3fb95018', border: '#3fb95044', color: 'var(--accent-green)', icon: '✓' },
    error:   { bg: '#f8514918', border: '#f8514944', color: 'var(--accent-red)',   icon: '✕' },
    info:    { bg: 'var(--accent-cyan-dim)', border: 'var(--accent-cyan-border)', color: 'var(--accent-cyan)', icon: 'ℹ' },
  }[type]
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 13, color: cfg.color, fontWeight: 500,
    }}>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{cfg.icon}</span>
      {message}
    </div>
  )
}

// ─── Button ─────────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  icon?: React.ReactNode
}

export const Btn: React.FC<BtnProps> = ({ variant = 'primary', icon, children, style, ...rest }) => {
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent-blue)',    color: '#fff',                    border: '1px solid #1a6fd4' },
    secondary: { background: 'var(--bg-elevated)',    color: 'var(--text-primary)',     border: '1px solid var(--border-default)' },
    danger:    { background: '#f8514918',             color: 'var(--accent-red)',       border: '1px solid #f8514944' },
    ghost:     { background: 'transparent',           color: 'var(--text-secondary)',   border: '1px solid transparent' },
  }
  return (
    <button
      style={{
        ...variants[variant],
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        fontSize: 13, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'all var(--transition)',
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (variant === 'primary')   e.currentTarget.style.background = '#1557a8'
        if (variant === 'secondary') e.currentTarget.style.borderColor = 'var(--border-emphasis)'
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary')   e.currentTarget.style.background = 'var(--accent-blue)'
        if (variant === 'secondary') e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── SectionCard ────────────────────────────────────────────────────────────

export const SectionCard: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ children, style }) => (
  <div style={{
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: '1.5rem',
    marginBottom: '1rem',
    ...style,
  }}>
    {children}
  </div>
)

// ─── PageHeader ─────────────────────────────────────────────────────────────

export const PageHeader: React.FC<{
  title: string
  sub: string
  onBack?: () => void
}> = ({ title, sub, onBack }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    {onBack && (
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 4, marginBottom: 12, padding: 0, transition: 'color var(--transition)',
          fontFamily: 'var(--font-display)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        ← Voltar ao Dashboard
      </button>
    )}
    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>{title}</h1>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub}</p>
  </div>
)

// ─── ImagePreview ────────────────────────────────────────────────────────────

export const ImagePreview: React.FC<{ file: File }> = ({ file }) => {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  if (!url) return null
  return (
    <div style={{
      marginTop: 12, borderRadius: 'var(--radius-md)',
      overflow: 'hidden', border: '1px solid var(--border-default)',
      background: '#fff', maxHeight: 240, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <img src={url} alt="preview"
        style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }} />
    </div>
  )
}