---
schema_version: 1
schema_kind: workorder
id: T0811
title: "PLAN-061：非 Windows 主機的 claude OSC 7501 狀態回報（解析器白名單 / 4096 / 子紀錄、主行程回覆探詢、只補 hooks 關閉的分頁）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:11:52+0800"
started_at: ""
updated_at: "2026-11-03T21:11:52+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-061；D229 / D258；T0789 回報區（④ 做法 B、⑤ 結論、〈建議下一步〉工單草案）；T0621 / D158（codex 7501 規則）；T0717（codex `done` / `error`）；CLAUDE.md「blocked 狀態偵測」「Worker 啟動確認」節；`docs/agent-guide/blocked-state.md`"
affects_files:
  - src/lib/codex-terminal-state.ts
  - "src/lib/__tests__/codex-terminal-state*.test.ts（或新測試檔）"
  - electron/pty-manager.ts
  - electron/terminal-blocked-state.ts
  - "electron/__tests__/**（新增 / 修改本單相關測試）"
  - "electron/remote/headless-entry.ts（只在回覆需要接線時）"
  - "e2e/t0789-claude-osc7501-probe.spec.ts（只在改成驗收用途時；或新 spec，放 vitest / playwright 既有位置）"
  - docs/agent-guide/blocked-state.md
  - "docs/agent-guide/worker-launch-confirmation.md（只在 agentStarted 規則有變時）"
  - CLAUDE.md
  - _ct-workorders/T0811-claude-osc7501-status-non-windows.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍以 D229 / T0789〈建議下一步〉草案為準：① 解析器白名單 `app ∈ { codex, claude-code }`、長度上限 128 → 4096（未完成序列的保留長度跟著改）、只讀 `state` / `kind`、不認得的值忽略；帶 `id=` 的紀錄一律不影響分頁狀態，沒有 `id` 的 `state=clear`（不帶 `app`）才是分頁 clear。② 主行程 `PtyManager.enqueuePtyOutput` 看到探詢 `ESC ] 7501 ; ?`（BEL 或 ST）→ 非 Windows 的 PTY 主機以 BAT 自動寫入回覆固定內容 `ESC]7501;?BEL`，每個探詢只回一次；`handleReplayBuffer`（replay）不回；Windows（ConPTY）不寫。③ claude 狀態套用 codex 規則：第一個序列把 `blockedDetection` 設為 `osc`、已是 `hook` 時忽略；`blocked` → `blockedReason: input`，`working` / `idle` / `done` / `error` / `clear` 清除；`agentStarted` 比照 codex 的 osc 分頁。"
  - "🔴 不做：Esc 中斷 / API 錯誤 / 背景子代理這些「hook 不知道的事」補到 hook 分頁（T0789 建議另案）；不注入 claude 參數或 env（不碰 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`）；不在 xterm / renderer 回覆（T0789 做法 A 不採用）；不改 codex 行為。"
  - "🔴 安全與日誌：`title` / `msg` 不解碼、不存、不記日誌；回覆不算使用者輸入（`isTerminalAutoReply` 已涵蓋 OSC，要有測試守住：不更新 `lastUserInputAt`、不取消 `--close-worker` / 用量限制等待、不清 ⚠️）；PTY 輸出只讀、不改寫（CLAUDE.md blocked 狀態偵測節）。"
  - "🔴 不回歸：hook 分頁行為完全不變；codex 行為不變（`e2e/t0621-codex-osc-state.spec.ts` 必跑；跑不了要說明原因並以單元測試覆蓋 codex 轉換表）；Windows 本機分頁的 PTY 寫入與 T0789 前完全相同（測試守住 win32 不寫）。改 `PtyManager` 時注意 CLAUDE.md 的 PTY env 唯一組裝點、`holdInputForDispatch`、T0788 notify-hold，不得影響。"
  - "🔴 驗證：單元測試（解析：白名單、4096、子紀錄、無 app 的 clear、未知值忽略；回覆：只寫一次、replay 不寫、win32 不寫、自動回應不算輸入）；突變檢查（拿掉回覆 / 拿掉 `id=` 判斷 → 對應測試失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。實機（Linux）：優先 WSL 上的真 claude（`disableAllHooks` 分頁進權限對話框時 `blocked` / `input` / `osc`，回答後清除；hook 分頁仍是 `hook`）。🔴 L185：claude 若未登入，不得登入、不得對未登入的 TUI 送任何按鍵；改用假程式在真 PTY 送探詢與狀態序列驗證回覆與狀態轉換，並在回報註明「真 claude 未實測」。WSL 使用者的 `~/.config/BetterAgentTerminal`、`~/.claude`、`~/.codex`、原本在跑的 bat-server 不改不停，BAT 一律隔離 userData / dataDir。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本單與 T0812 / T0813（研究型，只改各自工單檔）並行，不得改它們的檔。公開 repo（D176）：commit / 回報不寫帳號名與家目錄路徑。"
---

# T0811 — 非 Windows 主機的 claude OSC 7501 狀態回報（PLAN-061）

## 元資料

- **工單編號**：T0811
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:11:52+0800
- **預估規模**：M

## 背景

BAT 的 OSC 7501 解析器（`src/lib/codex-terminal-state.ts`）只收 `app=codex`、上限 128 字元。T0789 查證（Linux PTY、claude `2.1.316`）：claude 要終端回覆 `ESC ] 7501 ; ?` 探詢（2 秒內、在 DA1 回覆之前）才會送狀態，送出的狀態與 BAT hook 幾乎同時，`disableAllHooks` 下照送；Windows 本機的系統 ConPTY 丟掉 OSC 回覆，做不到。D229 定案：範圍是「非 Windows 主機上關掉 hooks 的 claude 分頁」，回覆放主行程（T0789 做法 B）。使用者 2026-11-03 指示開始（D258）。

完整證據、序列實錄、升版檢查清單見 T0789 回報區；本單以其〈建議下一步〉草案為準，上方 memory_overrides 是摘要。

## 範圍

1. 解析器：白名單 `codex` / `claude-code`、上限 4096、`id=` 子紀錄與無 app 的 `state=clear` 規則、只讀 `state` / `kind`（可改名 / 抽出共用模組，但 codex 的 consumer 行為不變）。
2. 主行程回覆：`PtyManager.enqueuePtyOutput` 偵測探詢 → 非 Windows 主機自動寫入固定回覆一次；replay 不回；Windows 不寫。Terminal Server 模式、direct 模式、headless（同一個 `PtyManager`）都要涵蓋；判斷依 PTY 所在主機的平台。
3. tracker：claude 狀態接進 `TerminalBlockedTracker`（規則同 codex），`agentStarted` 比照 osc 分頁。
4. 文件：`docs/agent-guide/blocked-state.md` 加 claude 7501 一節（含 T0789 ⑤-5 升版檢查）、CLAUDE.md「blocked 狀態偵測」節補一兩句（遵守 CLAUDE.md 撰寫規則：只寫用途、必守規則、唯一實作位置、連到 docs）。

## 不做

- hook 分頁的回合信號補強、xterm 回覆、注入 claude 參數、改 codex 行為、發版、push。

## 驗收

- [ ] 實作說明（改了哪些函式、回覆的寫入路徑、平台判斷依據）
- [ ] 單元測試清單與突變檢查結果
- [ ] typecheck 0 / 0、unit、legacy、vite build 結果
- [ ] codex 不回歸證據（`t0621` e2e 或說明＋單元測試）
- [ ] Linux 實機結果（真 claude 或假程式，註明是哪一種）
- [ ] 文件更新清單

---

## 回報區

<!-- Worker 由此往下寫 -->
