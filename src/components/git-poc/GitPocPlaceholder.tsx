/**
 * GitPocPlaceholder — T0153 POC 骨架
 *
 * 本元件為 POC 代碼骨架,未整合到 BAT 主 UI。
 * Phase 3 實作時,從此處展開為完整 SVG commit graph + CT 工單反查 UX。
 *
 * POC 代碼性質:非生產代碼,不保證型別完整、錯誤處理或效能。
 * 正式實作請參考 _ct-workorders/_report-git-gui-poc-findings.md 的 Phase 3 建議。
 */

import { useState } from 'react'

interface GitPocPlaceholderProps {
  workspaceFolderPath: string
}

// 預計在 Phase 3 擴展的元件骨架(目前僅 placeholder)
export function GitPocPlaceholder({ workspaceFolderPath }: GitPocPlaceholderProps) {
  const [status] = useState<'not-implemented'>('not-implemented')

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12 }}>
      <h3 style={{ margin: '0 0 8px' }}>Git POC Panel(未實作)</h3>
      <p style={{ margin: '4px 0', color: '#888' }}>
        Workspace: {workspaceFolderPath}
      </p>
      <p style={{ margin: '4px 0', color: '#888' }}>
        Status: {status}
      </p>
      <p style={{ margin: '12px 0 4px', color: '#d97706' }}>
        T0153 POC 僅完成紙上分析,完整 Git GUI 實作需 Phase 3 工單執行。
      </p>
      <p style={{ margin: '4px 0', color: '#888' }}>
        詳見 _ct-workorders/_report-git-gui-poc-findings.md
      </p>
    </div>
  )
}
