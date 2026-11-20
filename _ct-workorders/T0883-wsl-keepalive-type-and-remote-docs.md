---
schema_version: 1
schema_kind: workorder
id: T0883
title: "`ProfileEntry` 補 `wslKeepAlive` 型別（T0830 後續）＋ WSL keep-alive／精靈中止與 `ws-limits`／`FRAME_TOO_LARGE` 文件（T0830、BUG-211 後續）"
type: implementation
status: PENDING
updated_at: "2026-11-20T16:40:41+0800"
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-11-20T16:40:41+0800"
depends_on: []
related:
  - "D303；T0830 回報區〈遭遇問題〉末段後續候選；BUG-211〈修復紀錄〉（`electron/remote/ws-limits.ts`、`RemoteClient.invoke` 的 `FRAME_TOO_LARGE`）；CLAUDE.md 撰寫規則（T0595）、「多 remote profile 同時連線（PLAN-039）」節；`docs/agent-guide/multi-remote-profiles.md`（已有 keep-alive 開關一段）"
affects_files:
  - _ct-workorders/T0883-wsl-keepalive-type-and-remote-docs.md
  - src/components/profiles/types.ts
  - src/components/profiles/details/WslDetails.tsx
  - src/components/profiles/
  - CLAUDE.md
  - docs/agent-guide/multi-remote-profiles.md
  - docs/agent-guide/remote-security.md
  - docs/agent-guide/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 D 項只整理型別、行為不變：`src/components/profiles/types.ts` 的 `ProfileEntry` 加 `wslKeepAlive?: boolean`（與 `src/types/electron.d.ts` 既有欄位、`electron/profile-manager.ts` 的定義一致），`WslDetails.tsx` 拿掉本地的 `WslProfileEntry` 交集型別改用 `ProfileEntry`。執行期邏輯、UI、IPC 參數都不改；`WslDetails.test.tsx` 照舊通過。若發現 renderer 端還有其他地方手寫同一個交集型別，一併列出並改。"
  - "🔴 E、F 項只改文件：不改任何程式碼與測試（D 項除外）。"
  - "E 項：`docs/agent-guide/multi-remote-profiles.md` 已有 keep-alive 開關一段；先盤點 T0830 的精靈中止規則（runner 層 abort、install-bundle 子程序收到中止後終止、不可中斷的呼叫照舊等它結束、關閉精靈視窗觸發的背景 rollback 與已知限制）是否已在 docs，沒有就補進合適的 docs 檔（自選、寫明）。CLAUDE.md 只在「多 remote profile 同時連線（PLAN-039）」節加 1～2 行必守規則＋連結（例：要持有的 distro 唯一由 `keepAliveProfileDistros` 決定、精靈的 `pin()` 與開關無關；精靈中止的唯一實作位置）；🔴 遵守 CLAUDE.md 撰寫規則（T0595）：不新增 `##` 標題、不改既有標題、該節維持 3～12 行原則，細節放 docs。規則要從程式碼查證，不得只抄 T0830 回報。"
  - "F 項：在合適的 docs 檔（建議 `docs/agent-guide/remote-security.md` 或 `multi-remote-profiles.md`，自選、寫明）補一段：`electron/remote/ws-limits.ts` `WS_MAX_PAYLOAD_BYTES`（32 MiB，server 與 client 共用、server `maxPayload` 不變）、`RemoteClient.invoke`（與 auth frame）送出前算 UTF-8 bytes，超過就本機 reject `FRAME_TOO_LARGE`（不送出、連線不斷、其他 invoke 不受影響）、面板送出前的 `checkRemoteImageBudget`（`src/lib/remote-image-budget.ts`）、已知缺口（fork 後自動送出的待送圖片沒有面板檢查，由 T0884 處理，寫「T0884 處理中」即可）。數值與行為從程式碼查證。CLAUDE.md 不加（BUG-211 沒有必守規則需要放在每個 session 都載入的檔）。"
  - "驗證只用可自動化的方式：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過（含讀 CLAUDE.md 的 source guard 測試）、`npx vite build` 成功。不需要人工驗收。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區與文件不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0883 — `ProfileEntry.wslKeepAlive` 型別＋遠端相關文件補齊

## 元資料
- **工單編號**：T0883｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-20 16:40 (UTC+8)
- **規模**：S｜**依賴**：無（與 T0882 / T0884 依序派工）｜**決策**：D303

## 背景
- **D（T0830 後續）**：`wslKeepAlive` 在 `src/types/electron.d.ts` 與主行程都有，但 renderer 的 `src/components/profiles/types.ts` `ProfileEntry` 沒有，`WslDetails.tsx` 只好自己定義 `ProfileEntry & { wslKeepAlive?: boolean }`。
- **E（T0830 後續）**：T0830 回報「CLAUDE.md 若要列 keep-alive 開關／精靈中止的必守規則需另開單」。
- **F（BUG-211 後續）**：BUG-211 加了 `ws-limits.ts` 與 `FRAME_TOO_LARGE`，docs 沒有說明。

## 任務
1. D：型別整理（見 frontmatter）。
2. E：盤點並補 docs、CLAUDE.md 1～2 行。
3. F：補 docs 一段。
4. 驗證（見 frontmatter）。

## 驗收條件
- [ ] `ProfileEntry` 有 `wslKeepAlive?: boolean`，`WslDetails.tsx` 不再有本地交集型別；行為不變
- [ ] E：docs 盤點結果（哪些規則原本就有、補了哪些、寫在哪個檔）；CLAUDE.md 改動行數與位置
- [ ] F：補在哪個檔、內容與程式碼查證的位置（`檔案:行`）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過（附 passed / files 數）、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
