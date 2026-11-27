---
schema_version: 1
schema_kind: workorder
id: T0955
title: "`v0.8.1-pre.1` 交付版自動化驗收：以隔離實例跑 A-19～A-23（BUG-228 / 229 / 230 / 231、T0950）"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-27T22:09:36+08:00"
started_at: "2026-11-27T22:10:43+08:00"
updated_at: "2026-11-27T22:10:43+08:00"
target_version: "v0.8.1-pre.1（交付版驗收）"
depends_on: []
related:
  - "D450（使用者：「用自動化測試」）；A-19～A-23（D449）；BUG-228（T0946）、BUG-229（T0947）、BUG-230（T0949）、BUG-231（T0951）、T0950；各工單〈待實機〉段；前例 T0923 / T0928（`launchIsolated`＋`BAT_E2E_EXECUTABLE` 驅動交付版 zip）、T0770–T0772 / T0792（安裝版自動化實測）"
affects_files:
  - _ct-workorders/T0955-v081-pre1-automated-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0955` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式（`src/**`、`electron/**`、`scripts/**`）、不改 `e2e/fixtures/`；只可在 `e2e/manual/` 新增本單的驅動腳本，README 同步。"
  - "🔴 受測物：GitHub Release `v0.8.1-pre.1` 的 `BetterAgentTerminal-0.8.1-pre.1-win.zip`。`gh release download v0.8.1-pre.1 -R gowerlin/better-agent-terminal -p '*-win.zip'` 到自己的空目錄，以 `gh release view v0.8.1-pre.1 -R gowerlin/better-agent-terminal --json assets` 的 `digest`（SHA-256）比對，相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.1-win/`；只用 zip，不執行 .exe 安裝檔。解出的 `resources/package.json` 版號必須是 `0.8.1-pre.1`。"
  - "🔴 隔離（不得違反）：使用者正在用安裝版 BAT 跑塔台與本工單的分頁。🔴 不得結束、重啟、連線或寫入安裝版 BAT、它的 Terminal Server / PTY holder、它的 userData（`%APPDATA%\\BetterAgentTerminal`）；不得用 `taskkill /IM` 之類以名稱結束程序，只能結束自己啟動、記下 pid 的程序（D308）。受測實例一律 `launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`（獨立 userData 與 Terminal Server），`dropEnv` 移除 `BAT_*` / `CT_*` / `CLAUDECODE` / `CLAUDE_CODE_*`。使用者層 `~/.claude`、`~/.codex` 前後雜湊相同。"
  - "🔴 不開真的 claude 回合、不花模型額度：以「假 claude」驗證。做法由 Worker 查證後選（例：受測實例的 Settings → Claude Runtime 指向 system、PATH 前置一個假 `claude.exe` / `claude` 腳本；或其他不改產品的方式），回報區寫明。假 claude 要能：① 把收到的 argv 寫進檔案；② 依參數模擬 claude 的全螢幕狀態（送 `ESC[?1049h`、`ESC[?1003h`、`ESC[?1006h`、`ESC[?25l` 後等待）；③ 把 stdin 收到的字寫進檔案；④ 在自己的 PTY env 下呼叫受測實例的 helper（`BAT_HELPER_DIR` 的 `bat-terminal.mjs --set-role tower --bat-contract 2 --mode on`）模擬塔台宣告。找不到不改產品就能讓受測實例啟動假 claude 的方式 → 問塔台。"
  - "🔴 情境（對應 A-n，每項 PASS / FAIL / 未判定附證據）：受測實例 Settings → Shell 設為 Git Bash（`C:\\Program Files\\Git\\bin\\bash.exe`，不存在就 BLOCKED 問塔台）。A-19（BUG-228）：縮圖列「+」→「以塔台開啟 Claude」→ 假 claude argv 最後一個是 `/control-tower`（不是 `C:/Program Files/Git/control-tower`），分頁命令列有 `MSYS2_ARG_CONV_EXCL=` 前置變數，debug log 有 `[T0946]`。A-20（BUG-229 / 231）：假 claude 進入全螢幕＋滑鼠追蹤後按 ⏻，期間以 Playwright 在分頁上持續移動滑鼠並立刻鍵入 `abc`；新 shell 的輸出 / 分頁文字沒有 `35;`…`M` 片段，新假 claude 的 argv 完整且最後是 `/control-tower`，stdin 收到 `abc`（或 log `[agent-command] … input before the launch command … sent after it`），log 有 `[mouse-tracking] reset: before-new-pty`。A-23（T0950）：同一次 ⏻ 後 xterm 在 normal buffer（例：分頁 DOM / `terminal.buffer.active.type` 經可取得的方式），先前寫的標記行可往上捲到，游標狀態照實記錄（看得到 / 看不到，不修）。A-21（BUG-230）：假 claude 宣告塔台後，結束受測實例並保留終端（照 BAT 的關閉流程：quit 時保留 Terminal Server，或該實例支援的等價方式），再以同一 runtime 啟動、Recovery 提示選「保留」→ 塔台分頁仍是 `role: tower` / 契約 2（helper 查詢或待辦分頁不顯示「沒有已宣告的塔台分頁」），log 有 `[tower-role] restored:`；zip 版不支援保留終端 → 記「未判定」與原因。A-22（可選）：同 A-21 但選「重新開始」→ 塔台分頁重新啟動並帶 `/control-tower`（假 claude argv），log 有 `not restored`。反例：一般 Claude CLI 分頁 ⏻ 不帶 `/control-tower`；一般 shell 分頁 ⏻ 後打字立即出現。"
  - "🔴 結果：每項附證據（log 行、argv 檔內容、截圖檔名）；🔴 權杖值、`tower-roles.json` 以外的使用者資料不得出現在回報區；結果與截圖放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0955-results/`（本機，不進 repo），回報區放總表與摘錄。受測版 FAIL 不修產品，記證據、建議開 BUG，繼續跑下一項。同一項最多重試 3 次，仍不穩判「未判定」並附原因，不得硬判 PASS。"
  - "🔴 驗證與 Git：新增 `e2e/manual/` 腳本時 `node --check`（或對 `.ts` 跑 typecheck 可涵蓋的方式），worktree `npm ci`、`npx vite build` exit 0、`npm run typecheck` = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空，自己啟動的程序全部結束（列出 pid）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0955 — `v0.8.1-pre.1` 交付版自動化驗收（A-19～A-23）

## 背景

`v0.8.1-pre.1` 含 BUG-228（Git Bash 改寫 `/control-tower`）、BUG-229（⏻ 後滑鼠回報黏在命令前面）、BUG-230（接回後塔台宣告消失）、BUG-231（⏻ 期間打的字黏在命令前面）、T0950（⏻ 後離開殘留 alt screen）。塔台發了 A-19～A-23 請使用者實機驗收，使用者指示改用自動化測試（D450）。本單以發佈的 zip 開隔離實例、用假 claude 驗證，不碰使用者正在用的安裝版 BAT、不花模型額度。

## 範圍

- 下載並驗證 `v0.8.1-pre.1` zip，開隔離實例（Git Bash shell）。
- 以假 claude 跑 A-19～A-23 與反例，逐項判定並附證據。
- 必要時在 `e2e/manual/` 新增驅動腳本。

## 不做

- 不改產品、不碰安裝版 BAT 與使用者資料、不開真的 claude 回合、不跑 NSIS 安裝。

## 驗收

- [ ] zip 雜湊相符、版號 `0.8.1-pre.1`
- [ ] A-19、A-20、A-23、A-21、（可選）A-22 與反例逐項判定＋證據
- [ ] 隔離：安裝版 BAT 未被碰、使用者層雜湊相同、自己的程序全部結束
- [ ] 新增腳本時 build、typecheck、`node --check`

---

## 回報區

（Worker 填寫）
