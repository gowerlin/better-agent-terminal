---
schema_version: 1
schema_kind: workorder
id: T0381
title: "BUG-090 修復：精靈「取得 TLS 指紋」改用 TLS 握手取憑證指紋 + 全路徑 timeout（WSL / SSH / Docker 共用）"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:18:57+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-090（修復對象）"
  - "T0380 回報區 目標 6 P1-a"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts
  - src/components/setup-wizard/ssh-flow.ts
  - src/components/setup-wizard/docker-flow.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / port 等外部輸入先過既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 不得改使用者 `%USERPROFILE%/.wslconfig`、不得 `wsl --shutdown` / `--install` / `--unregister`、不得刪除或重建 `Ubuntu-24.04`。本機 runtime 驗證只做唯讀查詢或暫存檔，驗完清乾淨。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer 端 log 用 `window.electronAPI.debug.log`，main 端用 `logger`（CLAUDE.md Logging）。"
  - "⚠️ PLAN-035 Phase 1 四張單（T0381→T0382→T0383→T0384）**串行**，都會改 `electron/main.ts`；只改本單範圍，不預先做後面單的內容。不 push。"
---

# T0381 — 「取得 TLS 指紋」改用 TLS 握手

## 背景

`wsl:fetch-fingerprint`（`electron/main.ts` 約 :3527-3547）對 `https://localhost:<port>/fingerprint` 發 GET，但 RemoteServer / bat-server（`electron/remote/remote-server.ts:282`）沒有任何 HTTP request handler，請求永遠沒有回應；IPC 又沒 timeout ⇒ 精靈卡死、取消也解不開、連線殘留。`fetchFingerprintStep` 被 WSL / SSH / Docker 三個 flow 共用。

## 決策（D128）

1. 指紋改用 TLS 握手取得：`tls.connect({ host, port, rejectUnauthorized: false })` → `getPeerCertificate().fingerprint256`，取得後立即 `destroy()`。輸出格式須與 RemoteServer / profile 既有 `remoteFingerprint` 格式一致（T0380 實測 `61:E3:BA:…` 一致；以 `electron/remote/certificate.ts` 的格式為準並寫測試鎖定）
2. **所有路徑都要 timeout**（建議 5s，連線 + 握手合計）；timeout / 錯誤時 socket 一定要 destroy，不留殘留連線；回明確錯誤碼（例如 `fingerprint-timeout` / `fingerprint-unreachable`）給 ErrorMapper（i18n 三語，依專案既有 locale 檔）
3. 精靈取消時 step 不得永久卡住：timeout 即可保證；若 runner 有 abort 機制就接上
4. SSH / Docker：確認它們目前取指紋的實際路徑（SSH 可能經 tunnel 到 local port、Docker 經 port mapping），改用同一個 TLS 握手實作；若走的是別的 IPC，一併修正並寫回報區
5. IPC 名稱可保留 `wsl:fetch-fingerprint`；若改名為共用名稱須同步 preload / `electron.d.ts` 並確保所有呼叫端都已遷移
6. 不在本單：埠衝突（T0382）、網路模式（T0383）、keep-alive（T0384）。本機目前 Mirrored + 主機 RemoteServer 佔 9876，實測時握手會連到**主機 BAT 自己**——那是 T0382 的問題，本單只要保證「取得的是對端憑證指紋、不會卡住」

## 驗收

- unit：指紋格式；timeout 觸發 + socket 被 destroy；連線拒絕 / 握手錯誤回對應錯誤碼；成功路徑（測試內以 `tls.createServer` + 自簽憑證起本地 server，或 mock `tls.connect`）
- `npm run test:unit` 全綠（基線 **794**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `127.0.0.1:<BAT_REMOTE_PORT>`（主機 RemoteServer）呼叫新實作，指紋應等於 BAT 主機 RemoteServer 的指紋，且 5s 內返回；`netstat` 確認不留 ESTABLISHED 連線
- **runtime 驗收（交使用者）**：WSL 精靈第 6 步不再卡住（成功或在 timeout 後明確失敗）

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 6 P1-a，及結論摘要第 1 點）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
