---
schema_version: 1
schema_kind: bug
id: BUG-124
title: "SSH 精靈：目標 sshd 禁止 port forwarding（AllowTcpForwarding no）時，錯誤顯示成「伺服器埠上的程式沒有提供 TLS 憑證」，未指出真正原因"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-14T04:00:58+0800"
updated_at: "2026-10-14T04:13:51+0800"
fixed_at: "2026-10-14T04:13:51+0800"
impact:
  - ssh-wizard
  - error-message
links:
  discovered_in: "T0515 W7(a) 觀察（pre.6 自動化驗收）"
  fix_workorder: T0517
  related: [BUG-093, BUG-099, T0515]
---

# BUG-124 — SSH 精靈 forwarding 被拒時錯誤訊息誤導

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（訊息精準度；流程與 rollback 正確） |
| 可重現 | 必現（目標 sshd 設 `AllowTcpForwarding no`） |
| **狀態** | ✅ FIXED（T0517，待 pre.7 驗收） |
| 回報者 | T0515 Worker（塔台開單） |

## 現象

- 目標 sshd 設 `AllowTcpForwarding no` → 精靈 `fetch-fingerprint` 步驟失敗：`TLS handshake with 127.0.0.1:<local> failed: read ECONNRESET`，對使用者顯示為「伺服器埠上的程式沒有提供 TLS 憑證」
- 原因：`ssh -N -L … ExitOnForwardFailure=yes` 只在本機 listen 失敗時退出；伺服器端拒絕 forwarding 要等連線進來才發生（ssh stderr 會有 `channel … open failed: administratively prohibited` 類訊息），本機看到的只是 TLS 握手被 reset

## 預期

- 能辨識 forwarding 被拒（例：讀 tunnel ssh 行程的 stderr），提示「目標 sshd 不允許 port forwarding（`AllowTcpForwarding`）」；三語

## 證據

- T0515 回報區「觀察」節、W7(a)；重現：`node e2e/real-remote/t0515-wizard-env.mjs up` + `BAT_E2E_PRE6_WIZARD=1 npx playwright test e2e/pre6-wizard-acceptance.spec.ts`（W7(a) 情境）

## 根因與修正（T0517）

- **根因**：精靈的 `ssh -N -L … -o ExitOnForwardFailure=yes` 只在本機 listen 失敗時退出。sshd `AllowTcpForwarding no` 是**逐連線**拒絕：tunnel 照常建立，每個轉送連線由 ssh 印 `channel N: open failed: administratively prohibited: open failed` 後關閉本機 socket，TLS 握手只看到 `read ECONNRESET`，被對應成通用的 `fingerprint-handshake-failed`（「伺服器埠上的程式沒有提供 TLS 憑證」）。實測（Windows OpenSSH → T0515 容器）：tunnel readiness probe 那次轉送就已被拒，拒絕訊息在握手失敗前已出現在 stderr。
- **修正**：
  - `electron/remote/ssh-tunnel.ts`：stderr 新分類 `forwarding-denied`（`/open failed: administratively prohibited/i`）
  - `electron/remote/ssh-wizard-verify.ts`：`WizardTunnelRegistry` 依 session 記住拒絕（保留 ssh 原文那一行）；新 `status(sessionId)`，尚未看到時最多等 1 s（tunnel 已死 / 未知 session 不等）
  - 新 IPC `ssh:verify-tunnel-status`（`ssh-setup-handlers.ts`、`electron/preload.ts`、`src/types/electron.d.ts`）
  - `src/components/setup-wizard/steps/ssh/verify-remote.ts`：`fetch-fingerprint` / `connect-test` 經 tunnel 失敗時，**關 tunnel 之前**查詢；被拒 → 改丟 `ssh-forwarding-denied`（訊息含目標、ssh 原文、原始錯誤）；查詢失敗 / preload 無此 API / 未被拒 → 原錯誤不變。成功路徑不查詢；rollback 不變
  - `error-mapper.ts`：`ssh-forwarding-denied`（ssh、`fetch-fingerprint` / `connect-test`、`append-raw`、`fixed-and-retry` + `cancel`）；`wizard.ssh.error.forwardingDenied` 三語
- **驗證**：新單元測試 21 項；真實 OpenSSH lane 3/3；source build 隔離實例 GUI 精靈 W7(a) `BUG-124.message` PASS（zh-TW 截圖）。細節見 T0517 回報區
