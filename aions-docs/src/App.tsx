import React, { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import MergeTool from './components/MergeTool'
import SplitTool from './components/SplitTool'
import CompressTool from './components/CompressTool'
import ConvertTool from './components/ConvertTool'
import OrganizeTool from './components/OrganizeTool'
import { Tool } from './types'

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>('dashboard')
  const [ops, setOps] = useState<number>(0)

  const incOps = () => setOps((n) => n + 1)
  const goBack = () => setActiveTool('dashboard')

  const renderTool = () => {
    switch (activeTool) {
      case 'merge':    return <MergeTool    onBack={goBack} onSuccess={incOps} />
      case 'split':    return <SplitTool    onBack={goBack} onSuccess={incOps} />
      case 'compress': return <CompressTool onBack={goBack} onSuccess={incOps} />
      case 'convert':  return <ConvertTool  onBack={goBack} onSuccess={incOps} />
      case 'organize': return <OrganizeTool onBack={goBack} onSuccess={incOps} />
      default:         return <Dashboard    onNavigate={setActiveTool} ops={ops} />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header ops={ops} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={activeTool} onChange={setActiveTool} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTool()}
        </main>
      </div>
    </div>
  )
}

export default App
