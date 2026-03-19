import React from 'react'
import {
  LayoutDashboard, FilePlus2, Scissors, Minimize2,
  GalleryVertical, RefreshCcw, History, Settings
} from 'lucide-react'
import { Tool } from '@/types'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  section?: string
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard',     icon: <LayoutDashboard size={15} />, section: 'Navegação' },
  { id: 'merge',     label: 'Juntar PDF',    icon: <FilePlus2 size={15} />,       section: 'Ferramentas' },
  { id: 'split',     label: 'Dividir PDF',   icon: <Scissors size={15} /> },
  { id: 'compress',  label: 'Comprimir',     icon: <Minimize2 size={15} /> },
  { id: 'organize',  label: 'Organizar',     icon: <GalleryVertical size={15} /> },
  { id: 'convert',   label: 'Converter',     icon: <RefreshCcw size={15} /> },
  { id: 'history',   label: 'Histórico',     icon: <History size={15} />,         section: 'Sistema', disabled: true },
  { id: 'settings',  label: 'Configurações', icon: <Settings size={15} />,        disabled: true },
]

interface SidebarProps {
  active: Tool
  onChange: (t: Tool) => void
}

const Sidebar: React.FC<SidebarProps> = ({ active, onChange }) => {
  let lastSection = ''

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-default)',
      padding: '1rem 0',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {NAV_ITEMS.map((item) => {
        const showSection = item.section && item.section !== lastSection
        if (item.section) lastSection = item.section
        const isActive = item.id === active

        return (
          <React.Fragment key={item.id}>
            {showSection && (
              <div style={{
                padding: '1rem 1rem .4rem',
                fontSize: 10, fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '.8px',
                fontFamily: 'var(--font-mono)',
              }}>
                {item.section}
              </div>
            )}
            <button
              onClick={() => { if (!item.disabled) onChange(item.id as Tool) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 1rem',
                background: isActive ? 'var(--accent-cyan-dim)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                color: isActive
                  ? 'var(--accent-cyan)'
                  : item.disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: item.disabled ? 'default' : 'pointer',
                width: '100%', textAlign: 'left',
                transition: 'all var(--transition)',
                fontFamily: 'var(--font-display)',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled && !isActive) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!item.disabled && !isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          </React.Fragment>
        )
      })}

      <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
          <div>AIONS Docs v1.0</div>
          <div style={{ color: 'var(--accent-green)', marginTop: 2 }}>● Processamento local</div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
