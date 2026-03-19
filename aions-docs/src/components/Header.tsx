import React from 'react'
import { Shield } from 'lucide-react'

interface HeaderProps {
  ops: number
}

const Header: React.FC<HeaderProps> = ({ ops }) => (
  <header style={{
    height: '56px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    flexShrink: 0,
    zIndex: 10,
  }}>
    {/* Logo + nome */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Logo da AIONS sem fundo */}
      <img
        src="/aions-logo.svg"
        alt="AIONS Logo"
        style={{ width: 34, height: 34, objectFit: 'contain' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: -.3, color: 'var(--text-primary)' }}>
          AIONS <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>Docs</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: .3 }}>
          Contato Serviços
        </span>
      </div>
      <span style={{
        fontSize: 10, padding: '2px 7px',
        background: 'var(--accent-cyan-dim)',
        border: '1px solid var(--accent-cyan-border)',
        borderRadius: 4, color: 'var(--accent-cyan)',
        fontFamily: 'var(--font-mono)', fontWeight: 600,
        marginLeft: 2,
      }}>v1.0</span>
    </div>

    {/* Direita */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
      {ops > 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
          background: 'var(--bg-elevated)', padding: '3px 10px',
          borderRadius: 4, border: '1px solid var(--border-default)',
        }}>
          {ops} op{ops !== 1 ? 's' : ''} na sessão
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-green)' }}>
        <Shield size={13} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>100% Client-Side · LGPD</span>
      </div>
    </div>
  </header>
)

export default Header