---
schema_version: 1
schema_kind: workorder
id: T0876
title: "mermaid 11 → 12 評估升級（修 katex low ×2），不破壞才升"
type: implementation
status: PENDING
created_at: "2026-11-17T10:27:04+0800"
started_at: ""
updated_at: "2026-11-17T10:27:04+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P3
sizing: M
depends_on: [T0875]
related:
  - "D298（T0873〈建議後續〉3）；D297；T0873〈npm audit 剩餘項目〉"
affects_files:
  - _ct-workorders/T0876-mermaid-12-upgrade.md
  - package.json
  - package-lock.json
  - src/components/FileTreeMarkdown.tsx（只限 mermaid 12 需要的 API 調整）
  - src/**/__tests__/**（只限相關測試）
  - e2e/**（只限新增 mermaid 渲染驗證時）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不破壞才升：任何關卡比 T0873 最終差、或 mermaid 圖在 BAT 內的渲染結果變差（圖不出來、錯誤、主題顏色不對、深淺色切換失效），就退回並寫明原因。"
  - "🔴 只升 `mermaid`（與它自己帶的依賴）；不動其他套件版本。既有 `overrides`（`lodash-es`、`langium` 等是為 mermaid 依賴加的）升級後逐一確認是否仍需要、是否與 mermaid 12 衝突；要改 `overrides` 先寫在回報區說明理由。"
  - "🔴 renderer 的 bundle 大小：記錄升級前後 `dist` 中 mermaid 相關 chunk 的大小；明顯變大（> 20%）寫在回報區由塔台判斷。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0876 — mermaid 11 → 12 評估升級

## 元資料
- **工單編號**：T0876｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0875（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 後 `npm audit` 剩的 2 項 low 是 `katex`（GHSA-238p-pmpm-9mq7）經 `mermaid`，要升 mermaid 12（major）才修。目前 `mermaid` `^11.14.0`（T0873 後裝 11.17.2），npm 最新 12.3.0。BAT 只在 `src/components/FileTreeMarkdown.tsx` 動態 `import('mermaid')`（約 L55–59，檔案樹的 Markdown 預覽）。

## 任務
1. 讀 mermaid 12 的 release notes／migration（官方 repo），列出與 BAT 用法相關的破壞性變更（`initialize` 選項、`render` 回傳、主題、安全等級、ESM 匯出、瀏覽器支援）。
2. 升級並做必要調整。
3. 渲染驗證：用 BAT 實際的預覽路徑（或與它相同的設定）渲染幾種常見圖（flowchart、sequence、class、state、gantt、含中文字的圖、有語法錯誤的圖）於深淺色，比較升級前後；方式不限（既有測試、e2e、或 scratch 腳本＋截圖），回報區寫方式與結論，截圖不 commit。
4. `npm audit`：確認 katex 那 2 項消失、沒有新增項目。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0873 最終比較）
- `npx vite build`（記錄 mermaid chunk 大小）
- `npm ci` 在最終 lock 上 exit 0，install-scripts 警告與前一張相同

## 驗收條件
- [ ] 破壞性變更清單與對 BAT 的影響判斷
- [ ] 結論：升（版本、改了什麼、渲染比較結果）或不升（理由）
- [ ] 關卡不比 T0873 最終差；`npm audit` 前後
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
