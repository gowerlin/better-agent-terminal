---
schema_version: 1
schema_kind: workorder
id: T0572
title: "BUG-145：新分頁 PTY 有時停在建立時的尺寸，xterm 已 fit 成別的欄數；找出競態並讓第一次 fit 後的尺寸一定送達 PTY"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-145
priority: P2
sizing: S
created_at: "2026-10-16T22:12:44+0800"
started_at: "2026-10-16T22:13:36+0800"
updated_at: "2026-10-17T10:04:35+0800"
completed_at: "2026-10-16T22:27:17+0800"
target_version: "0.6.1-pre.8（與 BUG-144 / T0571 同批）"
depends_on: []
related:
  - "BUG-145；T0571 回報區「e2e 附註」（隔離實例 PTY 停在 120x30、xterm 137 欄，spec 以 `terminal-redraw` 繞過）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/**（尺寸同步相關的實際檔案，回報區列出）"
  - "electron/pty-manager.ts、electron/terminal-server/**、electron/handlers/pty.ts（若根因在 main / Terminal Server；回報區列出）"
  - "src/**/__tests__/**、electron/__tests__/** 新增或擴充的測試"
  - "e2e/t0572-*.spec.ts（若可行）"
  - "CLAUDE.md（若需記錄，簡短）"
  - _ct-workorders/T0572-new-pty-initial-size-sync.md
  - _ct-workorders/BUG-145-new-pty-stays-at-spawn-size.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 `e2e/t0571-shift-right-click-copy.spec.ts` 既有的 redraw 繞法（修好後可在回報區建議移除，由塔台決定）。"
---

# T0572 — BUG-145：新分頁 PTY 初始尺寸同步

## 背景

T0571 的 e2e 觀察到：隔離實例新建分頁後，PTY 有時停在 spawn 尺寸 120x30，而 xterm 已 fit 成 137 欄；按工具列重繪（`terminal-redraw`）重送尺寸後才一致。若真實使用者也會遇到，claude / codex 等 TUI 會用錯的欄數排版（折行錯位、狀態列跑位），只能手動重繪。

## 任務

1. **重現並找根因**（隔離實例；node 腳本在 PTY 內印出 `process.stdout.columns` / `rows` 並監聽 SIGWINCH 寫檔，不耗額度）：
   - 直接建立分頁、重複多次，統計 PTY 尺寸與 xterm `cols` / `rows` 不一致的比例；分別看 Terminal Server 模式（預設）與 direct 模式
   - 追 renderer 第一次 fit → `pty:resize` 的路徑：resize 是否在 `pty:create` 完成前送出而被丟掉、是否因尺寸「沒變」而被去重略過、Terminal Server 是否在 PTY 註冊前收到 resize 等
   - 涵蓋：一般新分頁、BAT 重開還原的分頁、⏻ 重啟、外部建立（`terminal:created-externally`，例 Worker 分頁）；做得到幾種就測幾種，回報區列出
   - 若確認只在 e2e / 隔離實例才會發生（真實路徑不會），照實回報證據，不必硬修
2. **修正**：確保 xterm 第一次 fit 後的尺寸（以及 PTY 建立期間發生的每一次 fit）最終一定送達 PTY。做法依根因決定，例如 `pty:create` 完成後補送目前尺寸、或 create 直接帶 fit 後的尺寸。不得改變既有 resize 去抖 / 節流的行為造成大量多餘 resize，也不得影響 Terminal Server 冪等重建（T0108 replay）與 restart 的既有測試。
3. **測試**：單元 / 元件測試守住根因對應的時序；若可行，e2e（隔離實例）建立數個分頁後檢查 PTY 尺寸 = xterm 尺寸，不經重繪。
4. BUG-145 狀態改 FIXED、填修正 commit（若結論是不需修，改寫為調查結論並在回報區建議 WONTFIX，由塔台決定）。

## 驗收條件

- [x] 根因有證據（或「真實路徑不會發生」的證據）
- [x] 修正後新分頁 PTY 尺寸與 xterm 一致，不需重繪；restart / 還原 / 外部建立不退化
- [x] `npm run test:unit` 全綠（基線 4626 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [x] 相關既有 e2e（至少 `t0571` / `t0568`）仍通過
- [x] BUG-145 → FIXED（或調查結論）

---

## 回報區

> 以下由 sub-session 填寫

### 落點檢查

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`src/components/TerminalPanel.tsx` 存在）；C-2 無 `branch` 欄位（main）
- 結果：PASS。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 結果摘要（FIXED）

**根因**（真實路徑會發生，不只 e2e）：
- host 一律以 120x30 spawn（`PtyManager.create` 直連 / Terminal Server 皆同）；`PtyManager.resize` 在 `instances` 沒有該 id 時直接丟棄（`electron/pty-manager.ts` `resize`）。
- 分頁先進 store → TerminalPanel 掛載，isActive effect（RAF）/ 100 ms initial 立即送 `pty:resize`；`pty:create` 則要等 `getShellFromSettings()`（還原：`initTerminals` 開頭；新分頁：`handleAddTerminal`；claude-cli：CLI 路徑 / worktree 等）才送到 main。resize 先到 → 被丟；TerminalPanel 的去重（`lastSentCols` / `lastSentRows`）此後不再送同一尺寸 → PTY 永遠 120x30，直到容器尺寸改變或重繪。
- ⏻ 重啟：`pty:restart` = kill + create（120x30），renderer 去重認為尺寸已送過 → **100% 停在 120x30**。
- Terminal Server 端 `createPty` 是同步、同一 socket 依序處理，不是根因。

**證據**（隔離實例，Terminal Server 模式，修正前 `npx vite build` 後跑本單 e2e）：
- 第 1 輪：`restored: pty 120x30, xterm 137x35 ← MISMATCH`、`new #1–#4` 一致、`restart: pty 120x30, xterm 136x35 ← MISMATCH`
- 第 2 輪（加主行程日誌診斷）：restored 這次一致——日誌 `pty:create e2e-t0572-tab → Terminal Server` @17.231Z 與第一次 `pty:resize … 137x35` @17.234Z 只差 3 ms（先後靠運氣）；restart 仍 120x30，日誌在 `[BUG-137] restart … via=restart` 之後到重繪前**沒有任何** `pty:resize`
- 新分頁 8/8 一致（本機 shell 查詢夠快，create 先到）；屬同一競態，只是機率低

**修正**（`ecc00c60`）：
- `src/lib/pty-replay.ts`：新增 `requestPtySizeSync` / `registerPtySizeSyncSink`（形狀同 replay / notice registry；未掛載不保留）。`createPtyWithReplay` 在 `{ ok: true, created: true }` 時、`restartOrCreatePty` 在 `pty:restart` 回 true 時呼叫（restart false → create 的路徑經 `createPtyWithReplay` 一樣觸發，只一次）。
- `src/components/TerminalPanel.tsx`：sink 重設去重；active → 立即 `doResize()`（日誌 `[resize] PTY spawned → doResize`），hidden → 下次 activation 的 doResize 會送出（hidden 容器不 fit）。
- 每個新 spawn 的 PTY 只多 1 次 resize；`created: false`（PTY 已在跑 / T0108 replay）、create 失敗、PTY 上限都不多送；一般 resize 的去重 / 200 ms debounce 不變。main / Terminal Server 未改（T0108 冪等重建、restart、recovery 的既有測試不受影響）。

**涵蓋情境**：
| 情境 | 修正前 | 修正後 | 證據 |
|---|---|---|---|
| 還原分頁（seed + reload） | 偶發 120x30（1/2 輪） | 一致（3/3） | e2e |
| 新分頁（+ 選單 ×4） | 一致（8/8，競態機率低） | 一致（12/12） | e2e |
| ⏻ 重啟（live PTY，`via=restart`） | 必然 120x30（2/2） | 一致（3/3） | e2e |
| ⏻ 重啟已結束分頁（restart false → create） | 同新分頁 | sync 一次 | 單元測試；e2e `t0539` 通過 |
| claude-cli 重啟（kill + `startClaudeCliPty`） | 同新分頁 | 經 `createPtyThenLaunch` → sync | 程式路徑 |
| 外部建立（Worker，`terminal:created-externally`） | PTY 先在 main 建好，分頁掛載後第一次 resize 即生效（不受此競態影響） | 不變 | 程式路徑；e2e `t0553` 通過 |
| direct 模式 | 同一 renderer 競態（`resize` 對未知 id 同樣 no-op） | 同一修正 | 程式路徑（隔離實例預設 Terminal Server，未另測 direct） |
| 遠端視窗（headless） | 同一 renderer 競態 | 同一修正（renderer 端） | 程式路徑 |

### 驗證

- `npm run test:unit`：**266 files / 4633 passed / 3 skipped**（基線 265 / 4626 + 新檔 7 tests）PASS
- 新測試 `src/__tests__/terminal-pty-size-sync.test.tsx` 7 tests；**反向驗證**：暫時讓 `requestPtySizeSync` 變 no-op → 5 紅（created / restart / restart→create / hidden 再 activation / 同步後重繪），2 個負向案例綠；已還原
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0 PASS
- `npx vite build` 成功（exit 0）
- e2e（隔離實例，build 後）：`t0572-new-pty-initial-size` 3/3 輪 PASS；`t0571-shift-right-click-copy` + `t0568-context-menu-mouse-tracking` 2 passed；`t0539-restart-exited-terminal` + `t0553-worker-tab-title` 2 passed
- 未碰使用者的 BAT（9876）與其 Terminal Server；e2e 皆隔離實例，teardown 確認 server 已結束、userData 已移除

### 變更檔案

- `src/lib/pty-replay.ts`
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-pty-size-sync.test.tsx`（新）
- `e2e/t0572-new-pty-initial-size.spec.ts`（新）
- `CLAUDE.md`（新增「新 PTY 的初始尺寸（T0572 / BUG-145）」短節）
- `_ct-workorders/T0572-new-pty-initial-size-sync.md`、`_ct-workorders/BUG-145-new-pty-stays-at-spawn-size.md`

### Commit

- `ecc00c60` fix(terminal): resend the fitted size once a PTY is spawned so it does not keep 120x30 (T0572, BUG-145)
- 工單 / BUG 記帳另一個 `(ct)` commit。`src/styles/settings.css` 的 M 不是本單變更，未納入。未 push、未觸發 workflow、未建 tag、未改版號。

### 偏差 / 後續

- 無範圍偏差；main / Terminal Server 未改。
- 建議（給塔台）：
  1. `e2e/t0571-shift-right-click-copy.spec.ts` 的 `terminal-redraw` 繞法現在可移除（本單依指示未動）；保留也無害。
  2. 殘留（另案評估）：Terminal Server recovery（`handleServerDeath` 以 120x30 重建）renderer 不知道，直到下次 resize / 重繪；可考慮 PtyManager 記住最後尺寸供 restart / recovery 直接以正確尺寸 spawn。
  3. 既有行為（非本單）：背景分頁不 fit，其 PTY 在第一次切到前維持 120x30（例如外部建立、未切過去的 Worker 分頁，agent 會以 120 欄排版）。
