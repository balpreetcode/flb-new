import { WorkflowProvider, useWorkflowContext } from './context/WorkflowContext'
import { WorkflowCanvas } from './components/WorkflowCanvas'
import { NodePropertiesPanel } from './components/NodePropertiesPanel'
import { ExecutionHistory } from './components/ExecutionHistory'
import React, { useState } from 'react'
import './App.css'

function AppContent() {
  const { execution, runWorkflow, stopWorkflow, workflow } = useWorkflowContext();
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">⚡</span>
          <h1>Flow Builder</h1>
        </div>
        <div className="header-actions">
          {execution.error && (
            <span className="error-badge">{execution.error}</span>
          )}
          {execution.isRunning ? (
            <button className="btn-danger" onClick={stopWorkflow}>
              ⏹ Stop
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={runWorkflow}
              disabled={workflow.nodes.length === 0}
            >
              ▶ Run Workflow
            </button>
          )}
        </div>
      </header>

      <div className="sub-header">
        <button
          className={`tab-btn ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          Flow Builder
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Execution History
        </button>
      </div>

      <main className="app-main">
        {activeTab === 'builder' ? (
          <>
            <div className="canvas-holder">
              <WorkflowCanvas />
            </div>
            <NodePropertiesPanel />
          </>
        ) : (
          <ExecutionHistory />
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <WorkflowProvider>
      <AppContent />
    </WorkflowProvider>
  )
}

export default App
