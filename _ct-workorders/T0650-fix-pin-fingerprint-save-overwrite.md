---
schema_version: 1
schema_kind: workorder
id: T0650
title: "BUG-157：「編輯連線」釘選新指紋後按「儲存」不再寫回舊指紋；釘選失敗要顯示錯誤"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-157
priority: P2
sizing: S
created_at: "2026-10-18T18:33:43+0800"
depends_on: [T0646]
related:
  - "BUG-157（T0646 程式碼追蹤）；T0182 / CLAUDE.md「Remote 資安」節（TOFU 指紋）；`docs/agent-guide/remote-security.md`"
  - "網站 `site/remote/index.md` 指紋段落目前建議「重跑精靈」（T0646）；修正後是否改回由塔台另案決定，本單不改 `site/**`"
affects_files:
  - "src/components/EditRemoteProfileModal.tsx"
  - "src/components/ProfilePanel.tsx"
  - "electron/** 中釘選指紋的 IPC handler（只在根因在主行程時）"
  - "src/**/__tests__/**、electron/__tests__/**（新增 / 更新測試）"
  - "docs/agent-guide/remote-security.md（只在行為說明需要時補一句）"
  - _ct-workorders/T0650-fix-pin-fingerprint-save-overwrite.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認根因再修：讀程式碼確認「Pin expected fingerprint」寫入路徑與 `handleSaveRemote` 寫入的欄位；用 vitest + RTL 重現「釘選 → 儲存」後指紋回退（先寫失敗測試）。確認不是 bug → 不改程式碼，回報 `FAILED` 並附證據。"
  - "🔴 安全不變式：指紋只能由使用者明確動作（精靈 / 釘選）更新；修正不得讓連線流程自動接受新指紋，也不得在指紋不符時送出權杖（`remote-client.ts` 的既有順序不變）。"
  - "🔴 不改 i18n 字串（「Pin expected fingerprint」等英文由 BUG-158 處理）；釘選失敗的錯誤訊息先用既有 key，沒有合適的 key 就在回報列出需要的 key 與建議文案，交給 BUG-158。"
  - "🔴 非隔離工單。T0649（BUG-156，Docker 精靈）與 T0648（唯讀探針）可能同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0650 — 釘選的指紋不被「儲存」蓋回

## 背景

T0646 依程式碼改寫 `/remote/` 時發現：`EditRemoteProfileModal` 的「Pin expected fingerprint」立即寫入新指紋，但對話框 state `editRemoteFingerprint` 仍是舊值；按「儲存」時 `ProfilePanel.tsx` `handleSaveRemote` 以對話框 state 寫回 → 新指紋被覆蓋。釘選失敗也沒有提示。詳見 BUG-157。

## 要做的事

1. 確認根因並先寫重現測試（失敗）。
2. 修正：釘選成功後對話框顯示並持有新指紋（或「儲存」不再覆寫指紋欄位，擇一，回報說明理由）；釘選失敗顯示錯誤，不關閉對話框。
3. 檢查同一對話框其他「立即寫入」的欄位是否有同樣的覆寫問題，有就一併修、沒有就寫明。
4. 測試：釘選 → 儲存後指紋為新值；釘選失敗有錯誤提示；只改其他欄位時指紋不變。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5384 / 311）
- `npx vite build` 成功

## 驗收

- 「釘選 → 儲存」後保留新指紋；釘選失敗有提示；安全不變式不變
- 三項驗證通過；回報區附根因確認、修正說明、測試清單、commit，以及網站 `/remote/` 指紋段落是否可改回「在編輯連線裡重新釘選」（給塔台）
- 只改 `affects_files`；未 push
