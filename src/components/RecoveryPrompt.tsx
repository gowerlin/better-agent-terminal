interface RecoveryPromptProps {
  ptyCount: number
  onRecover: () => void
  onFreshStart: () => void
}

export function RecoveryPrompt({ ptyCount, onRecover, onFreshStart }: RecoveryPromptProps) {
  return (
    <div className="recovery-prompt-overlay">
      <div className="recovery-prompt-dialog">
        <div className="recovery-prompt-header">
          <h3>🔄 偵測到上次的終端 session</h3>
        </div>
        <div className="recovery-prompt-content">
          <p>Terminal Server 仍在運行，有 <strong>{ptyCount}</strong> 個終端存活。</p>
          <p className="recovery-prompt-hint">是否要恢復上次的工作狀態？</p>
        </div>
        <div className="recovery-prompt-actions">
          <button className="btn-primary" onClick={onRecover}>
            恢復 session
          </button>
          <button className="btn-secondary" onClick={onFreshStart}>
            重新開始
          </button>
        </div>
      </div>
    </div>
  )
}
