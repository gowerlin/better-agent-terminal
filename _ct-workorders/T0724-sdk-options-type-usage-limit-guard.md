---
schema_version: 1
schema_kind: workorder
id: T0724
title: "pre.5 後續清理：`queryOptions` 改用 SDK `Options` 型別＋單行 `Usage limit has reset · Press enter to continue` 刻意不辨識的負向測試（皆不改執行期行為）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T10:03:57+0800"
started_at: ""
updated_at: "2026-11-01T10:03:57+0800"
completed_at: ""
depends_on: [T0721]
related:
  - "T0721 研究（DONE，`8b2037b5`）回報區「建議下一步」實作單草案 1：R3 做、R1 不加句型只補負向測試與註記（塔台依建議採用，屬研究範圍內的後續）"
  - "T0718（`queryOptions` 為 `Record<string, unknown>` 再轉型）、T0717 / D192（claude 2.1.316 句型）、D148（claude 絕不送文字；`claude-stale` 送 Enter 是唯一補位）"
  - "CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」、「Claude Agent SDK / CLI」；`docs/agent-guide/usage-limit-continue.md`"
affects_files:
  - electron/claude-agent-manager.ts
  - src/lib/usage-limit.ts
  - src/lib/__tests__/usage-limit.test.ts
  - docs/agent-guide/usage-limit-continue.md
  - _ct-workorders/T0724-sdk-options-type-usage-limit-guard.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍照 T0721 回報區「實作單草案 1」① – ④：① `electron/claude-agent-manager.ts`：`import type { Options }`、`queryOptions: Options`、拿掉 `runQuery` 那處轉型、另一處改 `satisfies Options`；`executable` 以 `as Options['executable']` 收窄並加註解（SDK 宣告是 runtime 名稱；執行期在 CLI 路徑是 `.js` 時才當 spawn command，原生 binary 時忽略；傳路徑是現況、行為不變）；條件 spread 加 `satisfies Partial<Options>`。② `usage-limit.test.ts`：單行 `Usage limit has reset · Press enter to continue`（含小寫 `press`）單獨出現 → `none`；與兩行 footer 同時出現 → 仍為 `send-enter` 路徑的分類。③ `usage-limit.ts` 檔頭註記：此行是 append 進對話紀錄的通知，stale 結束後仍留在畫面，刻意不辨識（T0721）。④ docs 同步一句。行號以目前 `main` 為準（T0721 的行號是研究當時的）。"
  - "🔴 不改任何執行期行為：句型 regex、決策表、排程、SDK 傳入的選項值都不變。若型別化逼你改值或改選項，先用 BAT 通道問塔台。"
  - "🔴 驗收：`npm run typecheck:electron` = 0、`npm run typecheck` = 0、`npm run test:unit` 全過、`npx vite build` 成功；回報附「故意寫錯一個直接屬性名稱 → `typecheck:electron` 失敗」的截錄（試完還原，不 commit）。CLAUDE.md 不需改（若你認為必要，只改一句並說明）。"
  - "🔴 不發版、不改 CHANGELOG（塔台發版時處理）、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0724 — pre.5 後續清理：SDK `Options` 型別＋限額單行負向測試

## 元資料

- **工單編號**：T0724
- **類型**：implementation
- **優先級**：P3
- **建立時間**：2026-11-01T10:03:57+0800
- **預估規模**：S

## 目標

依 T0721 研究結論：

1. **R3**：`runQuery` 的選項物件改用 SDK 0.3 的 `Options` 型別，日後升 SDK 時選項改名 / 移除會被 `typecheck:electron` 抓到。
2. **R1**：claude 2.1.316 的單行 `Usage limit has reset · Press enter to continue` 刻意不辨識（它會留在對話紀錄，stale 結束後仍在畫面上，拿它觸發 `claude-stale` 會誤送 Enter）；以負向測試與註記鎖住現行行為。

兩項都不改執行期行為。

## 驗收

- [ ] ① – ④ 完成
- [ ] `typecheck:electron` = 0、`typecheck` = 0、`test:unit` 全過、`vite build` 成功
- [ ] 偵測力截錄（直接屬性寫錯 → typecheck 失敗）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 改動摘要

### 驗證結果

### 遭遇問題

### 回報時間
