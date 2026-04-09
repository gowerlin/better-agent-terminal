import { useState, useEffect, useCallback } from 'react'
import type { TerminalInstance } from '../types'
import { getAgentPreset } from '../types/agent-presets'
import type { AgentDefinition } from '../types/agent-runtime'

interface WorkerPanelProps {
  workers: TerminalInstance[]
  onSendToWorker: (targetId: string, text: string) => void
  onFocusWorker: (id: string) => void
}

interface WorkerStatus {
  id: string
  lastOutput: string
  alive: boolean
}

export function WorkerPanel({ workers, onSendToWorker, onFocusWorker }: WorkerPanelProps) {
  const [workerStatuses, setWorkerStatuses] = useState<WorkerStatus[]>([])
  const [sendInputs, setSendInputs] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(true)
  const [registryDefs, setRegistryDefs] = useState<Record<string, AgentDefinition>>({})

  // Fetch worker output periodically
  useEffect(() => {
    const fetchStatuses = async () => {
      const ids = workers.map(w => w.id)
      if (ids.length === 0) return
      try {
        const statuses = await window.electronAPI.supervisor.listWorkers(ids)
        setWorkerStatuses(statuses)
      } catch { /* ignore */ }
    }
    fetchStatuses()
    const interval = setInterval(fetchStatuses, 3000)
    return () => clearInterval(interval)
  }, [workers])

  // Fetch registry definitions for custom CLIs
  useEffect(() => {
    for (const w of workers) {
      if (w.agentPreset && !getAgentPreset(w.agentPreset) && !registryDefs[w.agentPreset]) {
        window.electronAPI.agent?.getDefinition(w.agentPreset).then((def: AgentDefinition | null) => {
          if (def) setRegistryDefs(prev => ({ ...prev, [def.id]: def }))
        }).catch(() => {})
      }
    }
  }, [workers, registryDefs])

  const handleSend = useCallback((workerId: string) => {
    const text = sendInputs[workerId]?.trim()
    if (!text) return
    onSendToWorker(workerId, text)
    setSendInputs(prev => ({ ...prev, [workerId]: '' }))
  }, [sendInputs, onSendToWorker])

  const getWorkerIcon = (worker: TerminalInstance): string => {
    const preset = worker.agentPreset ? getAgentPreset(worker.agentPreset) : null
    if (preset) return preset.icon
    if (worker.agentPreset && registryDefs[worker.agentPreset]) return registryDefs[worker.agentPreset].icon
    return '⬛'
  }

  if (workers.length === 0) return null

  return (
    <div className="worker-panel">
      <div className="worker-panel-header" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▼' : '▶'} Workers ({workers.length})</span>
      </div>
      {expanded && (
        <div className="worker-panel-list">
          {workers.map(worker => {
            const status = workerStatuses.find(s => s.id === worker.id)
            return (
              <div key={worker.id} className="worker-item">
                <div className="worker-item-header">
                  <span className="worker-icon">{getWorkerIcon(worker)}</span>
                  <span
                    className="worker-name"
                    onClick={() => onFocusWorker(worker.id)}
                    title="Click to focus"
                  >
                    {worker.title}
                  </span>
                  <span className={`worker-status ${status?.alive ? 'alive' : 'dead'}`}>
                    {status?.alive ? '●' : '○'}
                  </span>
                </div>
                {status?.lastOutput && (
                  <pre className="worker-output">{status.lastOutput}</pre>
                )}
                <div className="worker-send">
                  <input
                    type="text"
                    placeholder="Send command..."
                    value={sendInputs[worker.id] || ''}
                    onChange={e => setSendInputs(prev => ({ ...prev, [worker.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(worker.id) }}
                  />
                  <button onClick={() => handleSend(worker.id)}>⏎</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
