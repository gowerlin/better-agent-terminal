---
schema_version: 1
schema_kind: workorder
id: T0748
title: "pre.8 工作區等待提示 ⚠️ 遠端驗收：WSL 遠端工作區的分頁等待 → 本機視窗工作區列 ⚠️（不耗 token）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T20:21:32+0800"
depends_on: [T0746]
related:
  - "T0735（`b4daaf1f`，D200–D203；主行程 `TerminalAttentionNotifier` 推每個 PTY）；T0736〈仍需手動實機驗收〉：遠端 / headless 工作區的分頁等待 → 本機視窗的工作區列 ⚠️"
  - "既有 WSL / 遠端 e2e：`e2e/t0550-wsl-acceptance.spec.ts`、`e2e/pre6-ui-remote-acceptance.spec.ts`、`e2e/t0555-node-nvm-wsl.spec.ts`、`e2e/real-remote/`；T0743（WSL Docker 驗收，只動自建資源的做法）"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節（hook 與 codex OSC 7501）、「遠端 Tower 通知（PLAN-036 K）」、「多 remote profile 同時連線（PLAN-039）」；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-pre8-remote-workspace-waiting.spec.ts（新增，檔名可調；需要 WSL 時偵測不到就 skip）"
  - "e2e/fixtures/（只在需要共用 helper 時新增或擴充；不改既有 spec 的行為）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0748-wsl-remote-workspace-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（隔離實例；本機工作區 A = 正在看的、WSL 遠端工作區 R = 放分頁的；斷言在 A 看 R 的列，沿用 T0735 / T0736 的 DOM / selector）：① R 的分頁進入 hook 類 blocked（優先用 WSL 內真的 claude CLI ＋ spec 內的假 Anthropic API 回需要權限的 tool_use；WSL 沒有 claude 或無法驅動時，改在 R 分頁以自訂 CLI 呼叫遠端的 `bat-hook.mjs` 送 `PermissionRequest`，同 T0735 的模擬法；兩者擇一並寫明）→ A 看 R 列實心 ⚠️、tooltip 是 permission 原因且不含內容 → 解除後清除。② R 分頁送 codex OSC 7501 `blocked`（格式以 `src/lib/codex-terminal-state.ts` 為準，例如在遠端 shell 以 printf 輸出）→ `input` → R 列 ⚠️；送 `idle` 後清除。③ 等待在沒看 R 時結束 → R 列淡化 ⚠️；切到 R 分頁且視窗有焦點後清除（D203）。④ 本機分頁與 R 分頁同時等待 → 各自的列與總數 badge `⚠️ N` 正確；點 ⚠️ 跳到等最久的分頁。⑤ 遠端連線中斷再連上（選做）→ 記錄 ⚠️ 的行為。做不到的情境寫原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 不耗 token：claude 只打 spec 內的假 Anthropic API（沿用 T0727 / T0736 的做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`），不得用使用者的 claude / codex 登入或真實 API；回報區列出對外模型請求數（預期 0）。WSL 內連 Windows 主機上的假 API 時注意位址（WSL 網路模式），只開在測試需要的 port。"
  - "🔴 不改使用者的 WSL 環境：WSL `Ubuntu-24.04`（Running）。先讀既有 WSL e2e 怎麼安裝 / 啟動 bat-server；🔴 只能用測試專用的安裝目錄、dataDir、port 與 systemd unit 名（或不經 systemd 直接啟動），名稱一律含 `bat-e2e-t0748`；若既有做法會覆蓋或重啟使用者自己在 WSL 的 bat-server（例如共用 `~/.better-agent-terminal`、同名 systemd unit、預設 port），先停下來問塔台。不 `apt install`、不改 WSL 設定檔與 `/etc`、不關閉或重啟 WSL。跑完刪除本單建立的檔案、程序與 unit，清單寫進回報區；使用者既有的 WSL 檔案與程序前後清單一致（列出比對方式）。"
  - "🔴 隔離：本機一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（獨立 userData 與 remote port），不碰使用者正在用的 BAT 與其 userData、remote profiles，不執行任何安裝檔。🔴 使用 T0746 建好的 `dist` / `dist-electron`，不得再跑 `npx vite build`（與 T0747 並行）；server bundle 若需要建置，只建到暫存目錄，不改 repo 內追蹤檔。工作區名稱一律 `e2e-t0748-*`。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `t0735-workspace-waiting-badge` 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行指向新 spec。回報區列〈仍需手動〉（例如 SSH / Docker 遠端、安裝版）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、WSL 使用者名稱或帳號。"
  - "🔴 `docs/agent-guide/worker-tab-recycle.md` 與並行的 T0747 共用：只在 commit 前一刻改；改之前 `git diff -- docs/agent-guide/worker-tab-recycle.md` 若有不是你的變更（T0747 尚未 commit），等它 commit 後再改（最多等 15 分鐘，逾時問塔台），改完立即 commit。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0748 — pre.8 工作區等待提示 ⚠️ 遠端驗收（WSL）

## 元資料

- **工單編號**：T0748
- **類型**：implementation（驗收用 e2e，假模型）
- **優先級**：P2
- **建立時間**：2026-11-01T20:21:32+0800
- **預估規模**：M

## 背景

T0735 的工作區 ⚠️ 依主行程推送的每個 PTY attention 判斷；T0736 只驗了本機分頁。遠端工作區（WSL / SSH / Docker）的分頁在 headless bat-server 上，等待狀態要經遠端連線回到本機視窗的工作區列。本單以 WSL 驗這條路徑，不耗 token。

## 範圍

1. 情境 ①–⑤（見 frontmatter，⑤ 選做）。
2. 新 spec（偵測不到 WSL 就 skip）。
3. docs 一行。

## 不做

- 不用真實模型；不改使用者的 WSL 環境與 bat-server；不驗 SSH / Docker。
- 不改產品程式碼、不重新 build。

## 驗收

- [ ] 情境 ①–④ 逐項結果（⑤ 選做），寫明 ① 用的是真的 claude 還是 hook 模擬
- [ ] 對外模型請求數 0；自建資源清單與清理結果；使用者 WSL 前後比對
- [ ] 新 spec 連跑 2 次、`t0735` 綠、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

（Worker 填寫）
