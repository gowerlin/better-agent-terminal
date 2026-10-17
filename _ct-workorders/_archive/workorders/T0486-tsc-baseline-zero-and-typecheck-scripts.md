---
schema_version: 1
schema_kind: workorder
id: T0486
title: "tsc 基線清零（BUG-061 CodexAgentPanel 29 + 其他 7）+ 新增 typecheck / typecheck:electron scripts 與 electron 基線"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:17:26+08:00"
updated_at: "2026-10-13T23:24:27+08:00"
completed_at: "2026-10-13T23:24:27+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "BUG-061；L146（`typecheck:electron` script 建議）"
  - "塔台 2026-10-13 23:11 實測 `npx tsc --noEmit -p .` 36 錯：`CodexAgentPanel.tsx` 29、`src/utils/__tests__/terminal-keyboard-event.test.ts` 5、`src/types/agent-profiles.ts` 1、`src/components/setup-wizard/__tests__/integration.transitions.test.ts` 1"
affects_files:
  - "src/components/CodexAgentPanel.tsx"
  - "src/types/"
  - "src/utils/__tests__/terminal-keyboard-event.test.ts"
  - "src/components/setup-wizard/__tests__/integration.transitions.test.ts"
  - "electron/preload.ts"
  - "package.json"
  - "tsconfig.json"
  - "tsconfig.node.json"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json` 的 `scripts`（新增 typecheck 類 script）；其他欄位與 `package-lock.json` 不動"
  - "🔴 修型別不改行為：型別缺漏的 IPC 呼叫，先 trace `electron/preload.ts` / main handler 是否存在——存在則補型別；不存在即死呼叫，回報區列出並以最小改動處理（附理由），不得新增 handler"
  - "🔴 `electron/preload.ts` 只允許補型別相關宣告（T0491 稍後會改 preload）"
  - "🔴 不改 `.github/workflows/`（CI gate 是否加入由塔台決定，回報區提建議）"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0486 — tsc 基線清零（BUG-061 CodexAgentPanel 29 + 其他 7）+ 新增 typecheck / typecheck:electron scripts 與 electron 基線

## A. `tsc --noEmit -p .` 清零

- 逐檔修正 36 個錯誤（分類見 BUG-061）；unused 宣告確認無引用再移除
- 測試檔的型別錯誤以正確型別 / fixture 修正，不用 `any` / `@ts-ignore` 掩蓋（必要時 `@ts-expect-error` 附理由並列出）

## B. typecheck scripts

- `typecheck`（= `tsc --noEmit -p .`）與 `typecheck:electron`（electron 端 tsconfig，例如 `tsconfig.node.json`；T0480 回報提及 TS6307 / TS2802 / `main.ts:197` 等既有錯誤）
- electron 端：記錄目前錯誤數為基線（回報區附清單）；低成本、不改行為的順手修，其餘留基線
- CI gate 方案寫回報區（不改 workflow）

## 驗收條件

- [ ] `npx tsc --noEmit -p .` = 0（附輸出）
- [ ] `npm run typecheck` / `npm run typecheck:electron` 可執行（附數字）
- [ ] `npm run test:unit` 全綠（標註他人 WIP 影響）；`npx vite build` exit 0
- [ ] 回報區：死呼叫清單、CI gate 建議、CLAUDE.md 建議文字、BUG-061 可結案證據

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`npx tsc --noEmit -p .` 36 → **0**（HEAD + 本單改動，於乾淨 worktree 量測；主工作樹含他人 WIP 亦為 0）。新增 `typecheck` / `typecheck:electron` 兩個 script；electron 端基線 **77**（`tsconfig.node.json` 原樣跑為 185，其中 104 筆是設定雜訊，見 B 節）。修型別未改執行期行為；**無死呼叫**（所有缺型別的 IPC 在 `preload.ts` 與 main handler 皆存在）。

### Landing Zone Check

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-2：無 `branch` 欄位（`main`）。C-3：affects_files 皆存在（informational）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 改動檔案

| 檔案 | 改動 | 消除錯誤 |
|---|---|---|
| `src/types/electron.d.ts` | `claude` 介面補 preload 已有的 `setCodexSandboxMode` / `setCodexApprovalPolicy` / `authLogin` / `accountList` / `accountImportCurrent` / `accountSwitch` / `rewindToPrompt`（簽章逐字取自 `electron/preload.ts`）；`setModel` 補 `autoCompactWindow?: number`、`listSessions` 補 `agentPreset?: string`（皆同 preload） | （錯誤位置在 `CodexAgentPanel.tsx`，計入下一列：TS2339 ×7、TS2554 ×4、TS2345 `SetStateAction` 連帶、TS7006 ×3 隨 `accountList` 型別消失） |
| `src/components/CodexAgentPanel.tsx` | ① `SessionMeta` 的 `maxOutputTokens` / `contextTokens` / `cacheReadTokens` / `cacheCreationTokens` / `callCacheRead` / `callCacheWrite` / `lastQueryCalls` 改 optional（與 `ClaudeAgentPanel.tsx` 同一介面一致；持久化的 `Terminal.sessionMeta` 本來就沒有這些欄位）② `getSessionMeta` 結果改 `as unknown as SessionMeta`（同 ClaudeAgentPanel）③ `listSessions` 結果 `as SessionSummary[] \| null`（同 ClaudeAgentPanel）④ `handlePermissionModeCycle` 以 `ReadonlyArray<AgentPermissionMode>` 標註（同 ClaudeAgentPanel；TS 5.5 inferred type predicate 讓 `filter` 結果縮成 3 值）⑤ 4 處 `{unknown && <jsx>}` 改 `{!!x && <jsx>}`（同 ClaudeAgentPanel）⑥ `claudeUsage` / `usageAccount` 改 `_claudeUsage` / `_usageAccount`（setter 仍在用，同 ClaudeAgentPanel）⑦ 移除未引用的 `handleModelCycle`（全檔僅宣告處一次）⑧ `contextTokens` 改 optional 後兩處 `sessionMeta.contextTokens <= 0` 改寫為 `contextTokens !== undefined && contextTokens <= 0`（與原 `undefined <= 0 === false` 語意相同） | 29 |
| `src/types/agent-profiles.ts` | `isValidAgentParamValue` 回傳型別 `boolean` → `value is AgentParamValue`（type predicate，邏輯不變） | 1 |
| `src/utils/__tests__/terminal-keyboard-event.test.ts` | closure 內賦值的 `let seen: KeyboardEvent \| null` 被控制流縮成 `never`；改收集到 `events` 陣列，斷言 `toHaveLength(1)` 後取 `events[0]`（斷言更嚴，不用 cast） | 5 |
| `src/components/setup-wizard/__tests__/integration.transitions.test.ts` | 移除未引用的 `captureStates` helper（全檔僅宣告處） | 1 |
| `package.json` | `scripts` 新增 `typecheck`、`typecheck:electron`（其他欄位與 `package-lock.json` 未動） | — |

未動：`electron/preload.ts`（不需補任何宣告）、`tsconfig.json`、`tsconfig.node.json`、`.github/workflows/`、`CLAUDE.md`。

`@ts-expect-error` / `@ts-ignore` / `any`：**0 處新增**。

### 死呼叫清單（memory_overrides 第 2 條）

**無死呼叫。** 全部 trace 結果：

| renderer 呼叫 | preload | main handler（`electron/handlers/claude.ts`） | 備註 |
|---|---|---|---|
| `setCodexSandboxMode` / `setCodexApprovalPolicy` | :205 / :207 | :192 / :193 | 僅在有 codex manager 時註冊（headless 無 codex 為 `HEADLESS_UNSUPPORTED`，既有設計） |
| `authLogin` / `accountList` / `accountImportCurrent` / `accountSwitch` | :271-:280 | :268-:271 | handler 是 **stub**（`Auth login is not available in this build` / 空清單 / `null` / `false`）；CodexAgentPanel 的 `/login`、`/switch` 只在 `!isCodexSession` 分支觸發，UI 已處理失敗回傳 |
| `rewindToPrompt` | :291 | :493 | handler 是 **stub**，回 `{ error: 'Rewind is not available in this build' }`；UI 已處理 `'error' in result` |
| `setModel(…, autoCompactWindow)` | :209（轉送第 3 參數） | :195 只收 `(sessionId, model)` | 第 3 參數被 main 忽略（ClaudeAgentPanel 亦同樣傳入）；非死呼叫，型別依 preload 補齊，行為不變 |
| `listSessions(cwd, 'codex-agent')` | :285 | :481 依 `agentPreset` 分派到 codex | 正常 |

stub handler 是否保留 / 移除 renderer 端入口屬功能決策，不在本單範圍，建議塔台視需要另開。

### B. typecheck scripts 與 electron 基線

```json
"typecheck": "tsc --noEmit -p .",
"typecheck:electron": "tsc --noEmit -p tsconfig.node.json --composite false --target ES2022",
```

**為何用 CLI 旗標而不改 `tsconfig.node.json`**：
- `tsconfig.node.json` 原樣跑：185 筆，其中 **TS2802 ×82**（未設 `target` → TS 5.9 預設 ES5，`for…of` Map/Set 需 downlevelIteration）與 **TS6307 ×22**（`composite: true` 要求所有被 import 的 `src/` 檔列在 include）皆為設定雜訊
- 不把 `target` 寫進 `tsconfig.node.json`：vite（esbuild）以 tsconfck 解析 electron 檔時會經 root `references` 讀到 `tsconfig.node.json`，`useDefineForClassFields` 的預設值依 `target` 是否 ≥ ES2022 決定，改 tsconfig 有改變 electron 產物 class field 語意的風險；CLI 旗標只影響型別檢查
- `ES2022`：Electron 41 / Node 24 皆完整支援；`--composite false` 只關 composite 的 file-list 檢查（`noEmit` 下不產出任何檔案）

| 量測 | 錯誤數 |
|---|---|
| `tsc --noEmit -p tsconfig.node.json`（原樣，HEAD） | 185 |
| `+ --composite false` | 163 |
| `+ --target ES2022` | 99 |
| `+ --composite false --target ES2022`（= `typecheck:electron`，HEAD） | **77** |
| 同上，HEAD + 本單改動 | **77**（與 HEAD 逐行 `diff` 相同） |
| 同上，主工作樹（含 T0484 / T0485 WIP，23:22） | 77（差異僅 `claude-agent-manager.ts` 行號位移，屬 T0484 WIP） |

**electron 基線清單（77，HEAD `a7b8dc6`，`npm run typecheck:electron`；格式：行號 錯誤碼）**：

| 檔案 | 數 | 位置 |
|---|---|---|
| `electron/__tests__/git-scaffold-env.test.ts` | 1 | 101 TS2352 |
| `electron/__tests__/open-external-guard.test.ts` | 2 | 219 TS2339, 228 TS2339 |
| `electron/__tests__/pty-manager-server-exit.test.ts` | 1 | 49 TS2322 |
| `electron/__tests__/pty-replay-buffer.test.ts` | 1 | 89 TS2322 |
| `electron/__tests__/remote-tools-handlers.test.ts` | 1 | 86 TS2322 |
| `electron/claude-agent-manager.ts` | 21 | 602 TS7023, 635 TS2322, 656 TS2345, 699 TS2345, 702 TS2322, 1336 TS7023, 1359 TS2322, 1375 TS2345, 1409 TS2345, 1412 TS2322, 1454 TS2345, 1456 TS2345, 1478 TS2322, 2096 TS2339 ×2, 2111 TS2339 ×2, 2258 TS2339 ×2, 2261 TS2339, 2287 TS2339 |
| `electron/docker-lifecycle.ts` | 1 | 187 TS2322 |
| `electron/handlers/claude.ts` | 1 | 184 TS2345 |
| `electron/image-utils.ts` | 2 | 41 TS2322, 49 TS2322 |
| `electron/main.ts` | 19 | 197 TS2345, 999 TS18048, 1467 TS2339, 2100 TS2345, 2143 TS2345, 2211-2216 TS2345 ×6, 2219 TS2345, 2235 TS2345, 2236 TS2345, 2238 TS2345, 2239 TS2345, 3064 TS18048, 3323 TS2339, 3334 TS2339 |
| `electron/remote/__tests__/helper-capability.test.ts` | 3 | 222 TS2345, 239 TS2345, 240 TS2345 |
| `electron/remote/__tests__/remote-connection-registry.test.ts` | 2 | 207 TS2345, 221 TS2554 |
| `electron/remote/__tests__/server-bundle-distributor.integration.test.ts` | 2 | 137 TS2345, 151 TS2790 |
| `electron/remote/arch-detect.ts` | 2 | 61 TS2339, 62 TS2339 |
| `electron/remote/certificate.ts` | 1 | 77 TS2345 |
| `electron/remote/remote-server.ts` | 4 | 1077 TS18046 ×3, 1078 TS18046 |
| `electron/remote/server-bundle-distributor.ts` | 1 | 337 TS2345 |
| `electron/remote/server-entry.ts` | 1 | 9 TS2459 |
| `electron/remote/ssh-start-server.ts` | 4 | 381 TS2345, 397 TS2345, 423 TS2345, 577 TS2345 |
| `electron/terminal-command-handlers.ts` | 1 | 266 TS2345 |
| `electron/worktree-manager.ts` | 5 | 14 TS2322, 66 TS2339, 78 TS2339, 160 TS2339, 324 TS2322 |
| `vite.config.ts` | 1 | 30 TS2769 |

錯誤碼分布：TS2345 33、TS2339 18、TS2322 13、TS18046 4、TS7023 2、TS18048 2、TS2790 / TS2769 / TS2554 / TS2459 / TS2352 各 1。`electron/preload.ts` **0 筆**。

**順手修：0 筆**。77 筆全部落在本單 `affects_files` 之外（electron 端只授權 `preload.ts`），且 `main.ts`（T0485 / T0491）、`claude-agent-manager.ts`（T0484）正被並行工單修改，依 D139 並行規則不碰，全數留基線。

### CI gate 建議（未改 workflow）

1. **`typecheck`（src/）立即可設為硬 gate**：基線已 0。建議在 `pre-release.yml` / `release.yml` 三平台 build job 的 `npm ci` 之後、`verify-native-modules.js` 之前加一步 `npm run typecheck`（只需一個平台跑即可，型別結果與平台無關；放 Linux job 最省時，約 10-20 s）。或另開一個輕量 `typecheck` job（`ubuntu`，`npm ci --ignore-scripts` + `npm run typecheck`）並列為 build job 的 `needs`
2. **`typecheck:electron` 暫不設硬 gate**（現 exit 2）。兩條路：
   - (a) 先開清零工單把 77 筆修掉再上 gate（`main.ts` 19 + `claude-agent-manager.ts` 21 佔一半，需等 T0484 / T0485 / T0491 合併後做，避免衝突）——**推薦**
   - (b) 先上「不增加」gate：腳本跑 `typecheck:electron`，以 `file(line): TSxxxx` 去掉行號後的 `file + code` 計數與 repo 內基線檔比較，任一檔案某錯誤碼數量增加即 fail。實作成本低，但行號以外的比對會漏掉同檔同碼的替換
3. 本機開發：`AGENTS.md` / 工單驗收可直接引用 `npm run typecheck`（= 0）取代「tsc ≤ 36」這類寫法

### CLAUDE.md 建議文字（由 T0493 套用）

建議加在「Frontend unit tests」節之後，新節：

```markdown
## Type check

- `npm run typecheck`（= `tsc --noEmit -p .`）：只涵蓋 `src/`（`tsconfig.json` 的 `include`），基線 **0**（T0486 清零 BUG-061）。改 `src/**` 的工單驗收寫「`npm run typecheck` = 0」。
- `npm run typecheck:electron`（= `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`）：涵蓋 `electron/**` + `vite.config.ts`，基線 **77**（T0486，HEAD `a7b8dc6`；清單見 T0486 回報區）。旗標只用於型別檢查：`--target ES2022` 消除未設 target 造成的 TS2802、`--composite false` 消除 composite file-list 的 TS6307；**不要**把 `target` 寫進 `tsconfig.node.json`（vite / esbuild 會經 root `references` 讀它，`useDefineForClassFields` 預設值隨 target 變動，可能改變 electron 產物語意）。改 `electron/**` 的工單驗收寫「`typecheck:electron` 本單觸及檔案 0 個新錯誤」（L146）。
- vite build（esbuild）與 vitest 只轉譯、不做型別檢查；兩個 typecheck 都要另外跑。
```

### BUG-061 可結案證據

- BUG-061 列的類別全部消除：`SessionMeta` schema mismatch（L160 / L634 / L1132-1134）、IPC 型別缺漏（`rewindToPrompt` / `authLogin` / `accountImportCurrent` / `accountList` / `accountSwitch` / `setCodexSandboxMode` / `setCodexApprovalPolicy` / `setModel` 與 `listSessions` arity）、unused（`claudeUsage` / `usageAccount` / `handleModelCycle`）、`SetStateAction<SessionSummary[]>`（L1544 / L4402）、implicit any（L1673 / L1688，隨 `accountList` 型別補齊消失）、`unknown` 作 ReactNode ×4、permission mode 縮型
- 原 BUG-061 提到的 Promise/Resolver（L1109/L1133 `ModelInfo[]`）在 HEAD 已不存在（行號與內容已變），本次量測 `CodexAgentPanel.tsx` 為 29 筆、無此類
- `npx tsc --noEmit -p .` = 0，輸出（HEAD + 本單改動，乾淨 worktree）：

  ```
  npm notice run better-agent-terminal@0.6.0-pre.4 npx
  npm notice run tsc --noEmit -p .
  ```
  exit 0，無任何 `error TS`。主工作樹 `npm run typecheck` 亦 exit 0（23:22）
- 建議 BUG-061 → CLOSED（或依 _local-rules 先 VERIFY，待塔台聯合複驗）

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| `npx tsc --noEmit -p .` = 0 | **PASS** | 乾淨 worktree（HEAD `a7b8dc6` + 本單 6 檔）exit 0；主工作樹（含他人 WIP）`npm run typecheck` exit 0。開工時 36（`CodexAgentPanel.tsx` 29、`terminal-keyboard-event.test.ts` 5、`agent-profiles.ts` 1、`integration.transitions.test.ts` 1，與塔台實測一致） |
| `npm run typecheck` / `npm run typecheck:electron` 可執行 | **PASS** | `typecheck` exit 0 / 0 錯；`typecheck:electron` exit 2 / 77 錯（= 基線，與 HEAD 逐行相同） |
| `npm run test:unit` 全綠 | **PASS** | 主工作樹（含本單 + T0484 / T0485 / T0487 WIP）：`Test Files 177 passed (177)`、`Tests 3054 passed \| 1 skipped (3055)`，exit 0。乾淨 worktree 另跑一次為 175/176 files（2 failed），失敗為 `electron/__tests__/remote-connect-plan.test.ts` 兩個 `main.ts` source-guard regex：`git worktree add` 依 `core.autocrlf=true` 檢出 CRLF，regex 不匹配；主工作樹檔案為 LF，同測試通過。與本單無關（本單未動 `main.ts`） |
| `npx vite build` exit 0 | **PASS** | 主工作樹 exit 0（renderer 4.64 s、electron 1.28 s，preload 等皆 ✓ built） |
| 回報區四項 | **PASS** | 死呼叫清單（無）、CI gate 建議、CLAUDE.md 建議文字、BUG-061 證據皆在上方 |
| 本單改動檔不新增 tsc 錯誤 | **PASS** | 6 檔 tsc 錯誤 0；`typecheck:electron` 77 與 HEAD 相同 |

### 量測方法 / 偏差

- 為排除並行 WIP（開工時 `ClaudeAgentPanel.tsx` 有 T0484 中途編輯，曾短暫出現 3 筆 `getModelPricing` / `estimateCallCost` 錯誤，23:22 已消失），於 scratchpad 建 detached worktree（`git worktree add --detach <scratchpad>/wt-t0486 HEAD`），以 junction 連到主 repo `node_modules`，複製本單 6 檔後量測。結束時先刪 junction（確認主 repo `node_modules/typescript/package.json` 仍在）再 `git worktree remove --force` + `git worktree prune`，`git worktree list` 僅剩主工作樹
- 工單 status 開工時為 `TODO`（skill 預期 `PENDING`），視同未開始處理
- 未啟動 app（不需 runtime smoke；本單只動型別與 scripts）

### Commit

- `git commit --only` 本單 7 檔（6 個產品 / 測試檔 + 本工單）；不 push。hash 見 `git log`（本回報寫於 commit 前）

### 後續建議

- 開 electron 端清零工單（建議排在 T0484 / T0485 / T0491 合併後），清完再把 `typecheck:electron` 加入 CI gate
- `typecheck`（src/）加入 CI：建議由 T0492 或後續 CI 工單處理（T0487 正在改 workflows）
- stub handler（auth / account / rewind）是否保留 renderer 入口：功能決策，另案
