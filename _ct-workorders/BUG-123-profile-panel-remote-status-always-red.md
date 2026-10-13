---
schema_version: 1
schema_kind: bug
id: BUG-123
title: "配置（Profile）對話框：WSL / SSH / Docker（headless bat-server）profile 的狀態燈永遠紅燈 Disconnected，即使該 profile 視窗已開且連線正常"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-14T03:27:58+0800"
updated_at: "2026-10-14T03:27:58+0800"
impact:
  - ui-status
  - profiles
  - remote
links:
  discovered_in: "使用者回報（pre.6 實機，2026-10-14）"
  fix_workorder: T0513
  related: [BUG-122, T0512, T0288, PLAN-039]
---

# BUG-123 — Profile 對話框 headless remote profile 狀態燈永遠紅燈

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（狀態誤導，使用者以為伺服器掛了；功能正常） |
| 可重現 | 必現（使用者 pre.6，WSL Ubuntu-24.04 profile） |
| **狀態** | 🔧 FIXING（T0513） |
| 回報者 | 使用者 |

## 現象

- 截圖 1：`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\7e9ce546-3b6c-43fd-984c-5238744307fb\images\1.png`（紅框圈出 WSL 卡片的紅燈）
- 截圖 2：同目錄 `2.png`（左：主視窗開著配置對話框，WSL 卡片紅燈；右：WSL profile 視窗開著、終端 `gower@GXDEVPC02` 正常、Claude 面板正常回應「遠端主機上的 Claude Code 尚未登入」）
- 本機 Default 卡片綠燈正常

## 預期

- 該 profile 有開著的視窗 / 有 live 連線時應顯示「已連線」；未開時不應顯示成錯誤狀態的紅燈「Disconnected」；真的連不上 / 認證失敗才是錯誤狀態

## 塔台已確認的事實（2026-10-14 03:27）

- `localhost:9877` TCP 可連；WSL 內 bat-server 執行中（PID 381，`~/.local/bat-server/bin/bat-server.mjs`）
- 本機 `%APPDATA%\BetterAgentTerminal\profiles\index.json`：`activeProfileIds = default,wsl-ubuntu-24-04`（本機認為 WSL profile 使用中）；WSL profile 為 `type: remote`、`remoteHost: localhost`、`remotePort: 9877`、有 token / fingerprint、`wslDistro`，**無 `remoteProfileId`**

## 根因（塔台定位，Worker 複核）

- `src/components/ProfilePanel.tsx:96-141` `loadProfiles`：`type === 'remote'` 的卡片不看本機 `activeProfileIds`，而是對 target 呼叫 `remote.listProfiles` → `remote:list-profiles`（`electron/main.ts:2892`）→ 遠端 `profile:list`，再以 `remoteProfileId || 'default'` 比對遠端回傳的 `activeProfileIds`
- headless bat-server 的 `profile:list` 是 stub：`electron/remote/headless-handlers.ts:58` 固定回 `{ profiles: [], activeProfileIds: [] }` ⇒ 所有指向 headless server 的 profile 恆為 `false` → `ProfileCard.tsx:79-80` 落到 `disconnected` → 🔴
- 另：查詢失敗（`'error' in res`）也回 `activeIds: []`，與「沒開視窗」同樣顯示紅燈，無法分辨；`StatusDot` tooltip（`Connected` / `Disconnected` / `Idle`）為寫死英文
