import React from 'react'
import { Tool } from '@/types'

interface ToolCardData {
  id: Tool
  icon: string
  title: string
  description: string
  color: string
  colorDim: string
  badge?: string
}

const TOOLS: ToolCardData[] = [
  {
    id: 'merge', icon: '⊕', title: 'Juntar PDF',
    description: 'Una múltiplos PDFs em um único arquivo com reordenação drag-and-drop.',
    color: 'var(--accent-cyan)', colorDim: 'var(--accent-cyan-dim)',
  },
  {
    id: 'split', icon: '✂', title: 'Dividir PDF',
    description: 'Extraia páginas específicas ou separe volumes em partes menores.',
    color: '#f0a030', colorDim: '#f0a03018',
  },
  {
    id: 'compress', icon: '◈', title: 'Comprimir',
    description: 'Reduza o peso para sistemas governamentais e portais de tribunais.',
    color: 'var(--accent-green)', colorDim: '#3fb95018',
  },
  {
    id: 'organize', icon: '⊞', title: 'Organizar Páginas',
    description: 'Miniaturas, reordenação, rotação e exclusão de páginas.',
    color: 'var(--accent-magenta)', colorDim: 'var(--accent-magenta-dim)',
    
  },
  {
    id: 'convert', icon: '⟳', title: 'Converter para PDF',
    description: 'Transforme imagens JPG e PNG em documentos PDF de forma nativa.',
    color: '#a78bfa', colorDim: '#a78bfa18',
  },
]

interface DashboardProps {
  onNavigate: (t: Tool) => void
  ops: number
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, ops }) => (
  <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
    {/* Page title */}
    <div style={{ marginBottom: '1.75rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 4 }}>
        Dashboard
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Plataforma interna de manipulação de documentos — processamento 100% local
      </p>
    </div>

    {/* Stats row */}
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '.75rem', marginBottom: '1.5rem',
    }}>
      {[
        { num: ops || '0', label: 'Operações nesta sessão' },
        { num: '∞', label: 'Sem limites diários' },
        { num: '0 MB', label: 'Enviado a servidores' },
      ].map((s) => (
        <div key={s.label} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '.85rem 1rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: 'var(--accent-cyan)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: -1,
          }}>{s.num}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* LGPD info */}
    <div style={{
      background: 'var(--accent-cyan-dim)',
      border: '1px solid var(--accent-cyan-border)',
      borderRadius: 'var(--radius-md)',
      padding: '.85rem 1rem',
      fontSize: 12.5, color: 'var(--accent-cyan)',
      display: 'flex', gap: 8, marginBottom: '1.75rem',
    }}>
      <span>🔒</span>
      <span>
        Todos os arquivos são processados localmente no seu navegador. Nenhum documento é transmitido
        para servidores externos, garantindo conformidade com a <strong>LGPD</strong>.
      </span>
    </div>

    {/* Tools grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
      gap: '1rem',
    }}>
      {TOOLS.map((t) => (
        <div
          key={t.id}
          onClick={() => !t.badge && onNavigate(t.id)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem',
            cursor: t.badge ? 'default' : 'pointer',
            transition: 'all var(--transition)',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (!t.badge) {
              e.currentTarget.style.borderColor = t.color
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = `0 8px 20px ${t.colorDim}`
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)'
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {t.badge && (
            <span style={{
              position: 'absolute', top: '.75rem', right: '.75rem',
              fontSize: 9, padding: '2px 6px',
              background: 'var(--accent-magenta-dim)',
              border: '1px solid #c850c044',
              color: 'var(--accent-magenta)',
              borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}>{t.badge}</span>
          )}
          <div style={{
            width: 40, height: 40,
            background: t.colorDim,
            border: `1px solid ${t.color}33`,
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginBottom: '.85rem', color: t.color,
          }}>{t.icon}</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: '.3rem' }}>{t.title}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.description}</p>
        </div>
      ))}
    </div>
  </div>
)

export default Dashboard
