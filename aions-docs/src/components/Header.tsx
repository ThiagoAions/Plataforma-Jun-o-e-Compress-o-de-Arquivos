import React from 'react'
import { Shield } from 'lucide-react'

interface HeaderProps {
  ops: number
}

// Logo CONTATO inline SVG (esquadro + compasso maçônico estilizado para o tema escuro)
const ContatoLogo: React.FC = () => (
  <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer square border */}
    <rect x="4" y="4" width="112" height="112" rx="8" fill="#0d1421" stroke="#1e5fa8" strokeWidth="2"/>
    {/* Square tool (esquadro) - left arm */}
    <path d="M30 85 L30 35 L38 35 L38 78 L82 78 L82 85 Z" fill="#1a6fd4" opacity="0.9"/>
    {/* Compass (compasso) */}
    <line x1="60" y1="28" x2="38" y2="72" stroke="#00c8ff" strokeWidth="4" strokeLinecap="round"/>
    <line x1="60" y1="28" x2="82" y2="72" stroke="#00c8ff" strokeWidth="4" strokeLinecap="round"/>
    {/* Compass pivot circle */}
    <circle cx="60" cy="28" r="5" fill="#00c8ff"/>
    {/* G letter in center */}
    <text x="60" y="62" textAnchor="middle" fontSize="18" fontWeight="700"
      fill="#00c8ff" fontFamily="serif">C</text>
    {/* Horizontal bar of compass */}
    <line x1="44" y1="58" x2="76" y2="58" stroke="#1a6fd4" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

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
    {/* Logo area */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ContatoLogo />
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

    {/* Right info */}
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
