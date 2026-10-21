---
schema_version: 1
schema_kind: bug
id: BUG-123
title: "配置（Profile）對話框：WSL / SSH / Docker（headless bat-server）profile 的狀態燈永遠紅燈 Disconnected，即使該 profile 視窗已開且連線正常"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-10-14T03:27:58+0800"
updated_at: "2026-10-14T05:10:55+0800"
fixed_at: "2026-10-14T03:38:40+0800"
closed_at: "2026-10-14T05:10:55+0800"
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
| **狀態** | 🚫 CLOSED（使用者 pre.7 真實 WSL Ubuntu-24.04 卡片 🟢 截圖確認、關窗 15 s 轉 ⚪ 確認（2026-10-14T05:12:01+0800）+ T0520 自動化四態 PASS，2026-10-14T05:10:55+0800；修復 T0513） |
| 回報者 | 使用者 |

## 現象

- 截圖 1：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\7e9ce546-3b6c-43fd-984c-5238744307fb\images\1.png`（紅框圈出 WSL 卡片的紅燈）
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

## 根因與修正（T0513）

- **根因（已複核）**：如上。另外發現 ssh-* profile 的 `remoteHost:remotePort` 是伺服器端的 localhost（只有透過 tunnel 才連得到），舊探測沒走 tunnel，等於連到本機自己。legacy 完整 BAT 的 `activeProfileIds` 反映的是遠端機器自己開著的 profile，不代表本機連線。
- **修正**：燈號改以本機事實為主。新增 `remote:profile-connection-states`（本機 IPC），回傳 PLAN-039 registry 的連線狀態加上該 profile 的 live 視窗數（`collectProfileWindows`），renderer 以 `computeRemoteCardStatus` 判斷：
  - 🟢 本機已連線
  - 🟡 連線中 / 重新連線中
  - 🔴 連線中斷、未釘選指紋、或探測失敗（tooltip 附短原因與原始錯誤）
  - ⚪ 未開視窗（伺服器可連，或未檢查）
  只有「沒連線、也沒開視窗」且非 ssh-* 的 profile 才探測目標。tooltip 三語。對話框開著時，經 `remote:profile-connections-changed` 即時更新。headless `profile:list` 不變。
- **驗證**：unit（新增 27 項）+ 全套 `npm run test:unit` 3501 passed；`typecheck` / `typecheck:electron` = 0；`npx vite build` exit 0；隔離實例 e2e `e2e/t0513-profile-status-light.spec.ts` 通過（截圖路徑見 T0513 回報區）。
- **待驗收**：真人在 pre.7 開 WSL Ubuntu-24.04 視窗，配置對話框中該卡片應為 🟢。
