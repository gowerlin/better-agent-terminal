---
schema_version: 1
schema_kind: workorder
id: T0724
title: "pre.5 後續清理：`queryOptions` 改用 SDK `Options` 型別＋單行 `Usage limit has reset · Press enter to continue` 刻意不辨識的負向測試（皆不改執行期行為）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T10:03:57+0800"
started_at: "2026-11-01T10:06:00+08:00"
updated_at: "2026-11-01T10:09:30+08:00"
completed_at: "2026-11-01T10:09:30+08:00"
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

**DONE**。① – ④ 完成，四項驗收皆通過，偵測力截錄附在下面。執行期行為不變：句型 regex、決策表、排程、傳給 SDK 的選項值都沒改。

**落點檢查：PASS**
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS。`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下，PASS。
- C-3：前 4 項 `affects_files` 都存在，僅供參考（C-0 已 PASS）。
- C-2：工單沒有 `branch` 欄位，不適用（目前在 `main`）。
- 沒有設 `CT_HOME`，不在 worktree。觀察到的 `BAT_WORKSPACE_ID` 已設定（只當證據，不拿來比對）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 改動摘要

產品 commit `886bd987`（`git commit --only` 4 個檔，沒有 push）。

1. **① `electron/claude-agent-manager.ts`**
   - `:6` 加上 `import type { …, Options }`。
   - `:826-853`：`queryOptions: Record<string, unknown>` 改成 `queryOptions: Options`，上方加註解說明為什麼型別化，以及為什麼條件 spread 要加 `satisfies`。
   - 6 處條件 spread 加 `satisfies Partial<Options>`：`allowDangerouslySkipPermissions`、`model`、`plugins`、`pathToClaudeCodeExecutable`、`sdkSpawnEnv(...)`、`executable`。
   - `executable` 改成 `nodeExecutable as Options['executable']`，並加註解：SDK 宣告的是 runtime 名稱；執行期只有 CLI 路徑是 `.js` 時才拿它當 spawn command，原生 binary 時忽略，所以傳路徑是現況，這裡只收窄型別。
   - `runQuery` 的 `options: queryOptions as Parameters<typeof query>[0]['options']` 拿掉轉型，改成 `options: queryOptions`（`:899` 一帶）。
   - forkSession（`:2220-2233`）：結尾的 `as Parameters<typeof query>[0]['options']` 改成 `satisfies Options`；裡面 3 處條件 spread 同樣加 `satisfies Partial<Options>`，`executable` 同樣收窄，並加一行註解指回主註解。
   - `queryOptions.resume` / `.continue` 照舊在後面指定，兩者都是 `Options` 的欄位，不用改。
2. **② `src/lib/__tests__/usage-limit.test.ts`**：在 stale 測試後面新增 `it.each`，涵蓋大寫 `Press` 與 2.1.306 小寫 `press` 兩種寫法。每種寫法檢查：
   - 單獨出現：`classify` 結果是 `none`，加 `  ⎿  ` 前綴也是 `none`；後面接提示框時 `decide` 回 `{ action: 'none' }`。
   - 與兩行 footer 同時出現：`claude-stale`，`line` 指向 footer 的 `Press enter` 那一行（index 3），結果是 `send-enter`。
   - stale 結束後（footer 消失，通知還留在對話紀錄）：不是 `send-enter`。
   - renderer 送 `enter` 前再確認：回 `screen shows none`。
3. **③ `src/lib/usage-limit.ts`** 檔頭註記：這行是同一個 stale 事件 append 進對話紀錄的通知，stale 結束後仍留在畫面上，刻意不辨識（T0721 R1 / T0724）。
4. **④ `docs/agent-guide/usage-limit-continue.md`**：claude 規格段在「只送 Enter」後面補一句，驗證清單補一項。
- 沒有改 CLAUDE.md。這次沒有新契約或新規則，docs 已經同步。
- 沒有改 CHANGELOG，也沒有發版。

### 驗證結果

驗收當時的產品檔內容與 `886bd987` 完全相同。驗收跑在 `0f1da218` 的工作樹上；中間塔台 commit 了 `ca68ec81`（T0720 回報），只動工單檔，沒碰產品檔。

| 驗收項目 | 結果 |
|---|---|
| `npm run typecheck:electron` | **PASS**，exit 0 |
| `npm run typecheck` | **PASS**，exit 0 |
| `npm run test:unit` | **PASS**：347 個檔案通過；6216 通過、3 跳過（6219） |
| 指定 3 檔：`usage-limit.test.ts` / `usage-limit-continue.test.ts` / `claude-sdk03-task-tools.test.ts` | **PASS**，81/81 |
| `npx vite build` | **PASS**，4 段都 `built in`，exit 0 |

**偵測力截錄**：暫時改 3 個錯字，跑 `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`，exit 2；跑完用 scratchpad 備份複製回去，前後 sha1 相同（`0094676e…`），沒有 commit 錯字版。
- 直接屬性 `promptSuggestions` → `promptSuggestionz`
- 條件 spread `plugins` → `pluginz`
- fork 選項 `forkSession` → `forkSessionz`

```
electron/claude-agent-manager.ts(838,9): error TS2561: Object literal may only specify known properties, but 'promptSuggestionz' does not exist in type 'Options'. Did you mean to write 'promptSuggestions'?
electron/claude-agent-manager.ts(845,45): error TS2561: Object literal may only specify known properties, but 'pluginz' does not exist in type 'Partial<Options>'. Did you mean to write 'plugins'?
electron/claude-agent-manager.ts(2227,11): error TS2561: Object literal may only specify known properties, but 'forkSessionz' does not exist in type 'Options'. Did you mean to write 'forkSession'?
```

T0721 v3 試驗時，條件 spread 的錯字抓不到。加了 `satisfies Partial<Options>` 之後抓得到了。

### 遭遇問題

無。型別化不需要改任何值或選項，所以沒有問塔台。

### 互動紀錄

無。

### 回報時間

2026-11-01T10:09:30+08:00
