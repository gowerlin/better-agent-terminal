---
schema_version: 1
schema_kind: workorder
id: T0722
title: "「Claude Agent V1」改名「Claude Agent」（V2 已下架、不再分版本）：顯示名稱、預設標題判斷與舊存檔遷移"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T09:49:34+0800"
started_at: "2026-11-01T09:52:55+0800"
updated_at: "2026-11-01T09:58:34+0800"
completed_at: "2026-11-01T09:58:34+0800"
depends_on: []
related:
  - "D194（使用者：「Claude Agent V1 拿掉 V1 因為已無分版本」）；D123 Phase 2 / T0718（V2 下架、舊 V2 分頁自動遷移成 `claude-code`，預設標題改成 `Claude Agent V1`，唯一實作 `src/lib/retired-agent-presets.ts`）"
  - "T0718 回報區「後續候選」：改名牽涉預設標題判斷（`isDefaultTerminalTitle`）"
  - "CLAUDE.md「塔台分頁標題（T0562，D147）」（標題唯一實作 `src/lib/tower-terminal-title.ts`、`isDefaultTerminalTitle`、BAT 命名一律 `setAutoTitle`）、「Claude Agent SDK / CLI」（retired preset 遷移）"
  - "T0720 / T0721（同時進行的研究單，只讀，不跑 build）"
affects_files:
  - src/types/agent-presets.ts
  - electron/agent-runtime/agent-registry.ts
  - src/components/ThumbnailBar.tsx
  - src/lib/tower-terminal-title.ts
  - src/lib/retired-agent-presets.ts
  - "src/locales/（若有含 `V1` 的顯示字串）"
  - "src/**/__tests__/ 與 electron/__tests__/ 中斷言 `Claude Agent V1` / `V2` 的測試（目前約 7 檔）"
  - CLAUDE.md
  - docs/agent-guide/tower-tab-title.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - site/features.md
  - _ct-workorders/T0722-rename-claude-agent-v1.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先全面盤點再改：`grep` 整個 repo（排除 `_ct-workorders/`、`node_modules/`、`dist*/`、`release/`、`CHANGELOG.md`、`release-note.md`）找 `Claude Agent V1`、`Claude Agent V2`、`Agent V1`、i18n key 與 e2e；塔台初步計數 16 檔 38 處（見 `affects_files`），以你的盤點為準。不在 `affects_files` 但必須改的檔案，先用 BAT 通道問塔台。"
  - "🔴 行為規格：① 新分頁、「+」選單、縮圖、預設標題一律顯示「Claude Agent」；② 預設標題判斷（`isDefaultTerminalTitle` 等）把 `Claude Agent`、舊的 `Claude Agent V1`、`Claude Agent V2` 都當成預設標題（之後 BAT 仍可自動改名，例如塔台標題）；③ 舊存檔遷移：分頁的 `title` / `autoTitle` 等於舊預設標題（`Claude Agent V1` / `Claude Agent V2`）時改成 `Claude Agent`，使用者自訂的標題、`sdkSessionId`、`model` 不動；遷移邏輯集中在 `src/lib/retired-agent-presets.ts`（或同層唯一實作），不要在 consumer 內聯；④ preset id（`claude-code`）、helper `--agent` 別名、IPC / remote 協定一律不變；舊 client ↔ 新 server 相容性寫進回報。"
  - "🔴 驗收：`npm run test:unit` 全過（新增：遷移 V1 / V2 預設標題 → `Claude Agent`、自訂標題不動、`isDefaultTerminalTitle` 認得三種舊新值）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。CLAUDE.md 只改必要的一兩句（遵守檔頭「CLAUDE.md 撰寫規則」），細節寫 docs。"
  - "🔴 不發版、不改版號、不改 `CHANGELOG.md` / `release-note.md` / README（發版時塔台處理）。"
  - "🔴 同時有 T0720 / T0721 研究 Worker 在本 repo 只讀；它們不跑 build，你可以照常跑 build / 測試。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 commit 不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0722 — 「Claude Agent V1」改名「Claude Agent」

## 元資料

- **工單編號**：T0722
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：S

## 目標

T0718（D123 Phase 2）下架 Claude Agent V2 後，SDK 面板只剩一種，「V1」已沒有對照意義。使用者決定（D194）拿掉「V1」，顯示名稱改為「Claude Agent」。

## 範圍

1. 顯示名稱：preset 名稱（renderer `src/types/agent-presets.ts`、main `electron/agent-runtime/agent-registry.ts`）、縮圖列 / 「+」選單（`ThumbnailBar.tsx`）、i18n。
2. 預設標題判斷：`src/lib/tower-terminal-title.ts`（`isDefaultTerminalTitle`）認得新名稱與兩個舊名稱。
3. 舊存檔遷移：`src/lib/retired-agent-presets.ts` 把舊預設標題遷移成新名稱（T0718 會把 V2 預設標題改成 `Claude Agent V1`，本單改成直接遷移到 `Claude Agent`）。
4. 測試、CLAUDE.md（必要句）、`docs/agent-guide/`、`site/features.md`。

## 不做

- 不改 preset id、helper 參數、IPC / remote 協定。
- 不處理 T0721 的三項候選。
- 不發版。

## 驗收

- [x] 盤點清單（檔案 / 處數）與實際改動對照
- [x] 行為規格 ①–④ 各有測試或證據
- [x] `npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功
- [x] 舊 client ↔ 新 server 相容性說明

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 行為規格 ①–④ 都已實作並有測試；四個驗收閘門全過。產品 commit `35b2bac3`（未 push）。

### 落點檢查

- **PASS**。C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單位於 REPO_ROOT 底下。C-3：affects_files 的前 5 項都存在（以 C-0 為準，只供參考）。C-2：工單沒有 `branch` 欄位（目前在 `main`）。
- 沒有 `CT_HOME`（不是 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 盤點清單（排除 `_ct-workorders/`、`CHANGELOG.md`、`release-note.md`、node_modules、dist、release）

搜尋的寫法：`Claude Agent V1` / `V2`、`Agent V1` / `V2`、`Claude Agent (V1)`，以及 src / electron / e2e / site / docs / scripts 裡單獨出現的 `V1`。

| 檔案 | 處數 | 處置 |
|---|---|---|
| `src/types/agent-presets.ts` | 2 | 改名：`Claude Agent`、`Claude Agent (Worktree)` |
| `electron/agent-runtime/agent-registry.ts` | 2 | 同上 |
| `src/components/ThumbnailBar.tsx` | 2 | 同上（沒有 agent 定義時用的備用選單） |
| `src/locales/en.json` / `zh-CN.json` / `zh-TW.json` | 各 1 | `v1Model1mWarning` 文字裡的 `Claude Agent (V1)` 改成 `Claude Agent`（key 名稱不動） |
| `src/lib/retired-agent-presets.ts` | 2 | 遷移表加入舊名稱，見改動摘要 |
| `src/lib/tower-terminal-title.ts` | 1 | 檔頭註解，並在 `isDefaultTerminalTitle` 加上判斷 |
| `CLAUDE.md` | 1 | 「Claude Agent SDK / CLI」節原本的那一條補一句 |
| `docs/agent-guide/tower-tab-title.md` | 1 | 預設標題清單 |
| `docs/agent-guide/claude-agent-sdk-cli.md` | 1 | SDK 0.3 那一條補 T0722 說明與相容性 |
| `site/features.md` | 1 | 「+」選單截圖的 alt 文字 |
| 測試 7 檔：`retired-agent-presets.test.ts`、`tower-terminal-title.test.ts`、`workspace-store.retiredPreset.test.ts`、`terminal-handlers.test.ts`（3）、`open-claude-as-tower-menu.test.tsx`（3）、`remote-codex-degrade.test.tsx`（2） | 約 20 | 斷言改成新名稱，並補新的測試 |
| 不改：`electron/__tests__/dispatch-cwd-check.test.ts:133` | 1 | 註解講的是已下架的 V2 preset id，屬於歷史說明，照舊保留 |
| 不屬本單：e2e 驗收規格的 `V1`–`V6`（驗收項目編號）、`profile-manager.ts` snapshot V1→V2、`claude-cache-history-last-call.test.ts` 的情境 V1、`.agents/` 範本 | — | 跟 Agent 名稱無關 |

實際改動 18 檔，與塔台初估的 16 檔 38 處大致一致。沒有 affects_files 以外的檔案需要改，所以沒有問塔台。

### 改動摘要

- **① 顯示名稱**：renderer preset、main registry、ThumbnailBar 備用選單一律顯示 `Claude Agent` / `Claude Agent (Worktree)`。i18n 的 1M 警告文字拿掉 `(V1)`。
- **② 預設標題判斷**：新增 `isRetiredPresetTitle`（`src/lib/retired-agent-presets.ts`），`isDefaultTerminalTitle` 經它認得 `Claude Agent V1`、`Claude Agent V2`、`Claude Agent V1 (Worktree)`。新名稱本來就是 preset 名稱，所以也算預設。
- **③ 舊存檔遷移**（唯一實作仍是 `src/lib/retired-agent-presets.ts`）：
  - `RETIRED_AGENT_PRESET_TITLES` 改為三筆對照：`V2` → `Claude Agent`、`V1` → `Claude Agent`、`V1 (Worktree)` → `Claude Agent (Worktree)`。
  - `migrateTerminalAgentPreset` 原本只處理已下架的 preset，現在不論 preset 為何，`title` / `autoTitle` 跟舊預設標題完全相同時就改成新名稱。原因：標題本身就能證明是 BAT 給的，例如 `claude-code` 分頁存的 `Claude Agent V1`，或 helper 建立、沒有 `agentPreset` 的分頁。
  - 使用者標題、`sdkSessionId`、`model`、`alias` 都不動。沒有東西要改時回傳同一個 reference。
  - consumer 不用改：`workspace-store.ts` 的 `toTerminalInstance`（load 與 detached adopt 共用）本來就經過這個函式。
- **④ 不變的部分**：preset id（`claude-code` / `claude-code-worktree`）、helper `--agent` 別名、IPC / remote 協定都沒改。
- **自行判斷的範圍**：`Claude Agent V1 (Worktree)` 不在行為規格點名的字串裡。但 worktree preset 的名稱也帶 V1，不一起改就會留下一個 V1，所以一併遷移與判斷。

### 舊 client ↔ 新 server 相容性

顯示名稱都由 client（桌面版）自己決定：
- 「+」選單用的 `agent:list-definitions` 不經 proxy，由本機 main registry 回答（`electron/main.ts`）。
- 分頁標題（`externalTerminalTitle`、`towerAgentLabel`）優先用 renderer 的 preset 名稱。server 帶來的 `agentName` 只在 renderer 不認得該 preset 時才用。

結果：
- 舊 client 連新 bat-server：照舊顯示 `Claude Agent V1`。
- 新 client 連舊 bat-server：顯示 `Claude Agent`。舊版留下的 `Claude Agent V1` 標題仍會被當成預設標題，下次還原時遷移。

兩個方向都沒有協定欄位變動，也不需要版本協商。

### 驗證結果

- 行為規格對應的測試：
  - ① `retired-agent-presets.test.ts`「T0722 / D194…」：preset 名稱裡不再有 `V1` / `V2`，worktree 名稱也已改。
  - ② `tower-terminal-title.test.ts`「default titles BAT no longer generates…」：三個舊名稱都回 true，前後有空白也算；`Claude Agent V3` / `my Claude Agent V1` 回 false。
  - ③ `retired-agent-presets.test.ts`「tab (T0722)…」：V1 / V2 / V1 (Worktree) 的 `title` / `autoTitle` 都遷移；自訂標題、`sdkSessionId`、`model` 不動；不會多出原本沒有的欄位；沒有變動時回傳同一個 reference。
  - ③ store 層 `workspace-store.retiredPreset.test.ts`：load 時 t3 / t5 / t6 都遷移；重新存檔後不含 `Claude Agent V1`；detached adopt 也會遷移。
  - ④ 測試沒有改動任何 id 或 `--agent` 的斷言，`terminal-handlers.test.ts` 的 payload 只有 `agentName` 跟著改。
- `npm run test:unit`：exit 0，347 個檔案全過，6214 passed / 3 skipped。
- `npm run typecheck`（`tsc --noEmit -p .`）：exit 0，錯誤數 0。
- `npm run typecheck:electron`：exit 0，錯誤數 0。
- `npx vite build`：exit 0。
- 公開 repo 去識別化：diff 裡沒有家目錄路徑、金鑰樣式或真名。

### 遭遇問題

- 無阻擋。
- 有一處沒處理：`site/public/media/agents-menu.png`（以及 overview 等截圖）畫面上仍是舊的「Claude Agent V1 / V2」。alt 文字已改成新選單內容，但圖片需要重新截圖，不在本單範圍。
- 工作樹裡 `T0720` / `T0721` 兩張工單有其他 Worker 的未提交變更，本單沒有碰，也沒有 commit 它們。

### 後續候選

- 下次更新網站截圖時，重拍 `agents-menu.png` 等含「+」選單或分頁標題的截圖。
- 發版時在更版重點寫一句「Claude Agent V1 改名 Claude Agent，舊分頁標題自動更新」（塔台處理）。

### Commit

- 產品：`35b2bac3`（18 檔，`git commit --only`）。
- 工單：本次回報另外 commit。
- 都沒有 push。

### 回報時間

2026-11-01T09:57:54+0800
