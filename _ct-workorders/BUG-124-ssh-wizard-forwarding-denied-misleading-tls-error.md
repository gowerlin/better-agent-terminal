---
schema_version: 1
schema_kind: bug
id: BUG-124
title: "SSH 精靈：目標 sshd 禁止 port forwarding（AllowTcpForwarding no）時，錯誤顯示成「伺服器埠上的程式沒有提供 TLS 憑證」，未指出真正原因"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-14T04:00:58+0800"
updated_at: "2026-10-14T04:03:26+0800"
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
| **狀態** | 🔧 FIXING（T0517） |
| 回報者 | T0515 Worker（塔台開單） |

## 現象

- 目標 sshd 設 `AllowTcpForwarding no` → 精靈 `fetch-fingerprint` 步驟失敗：`TLS handshake with 127.0.0.1:<local> failed: read ECONNRESET`，對使用者顯示為「伺服器埠上的程式沒有提供 TLS 憑證」
- 原因：`ssh -N -L … ExitOnForwardFailure=yes` 只在本機 listen 失敗時退出；伺服器端拒絕 forwarding 要等連線進來才發生（ssh stderr 會有 `channel … open failed: administratively prohibited` 類訊息），本機看到的只是 TLS 握手被 reset

## 預期

- 能辨識 forwarding 被拒（例：讀 tunnel ssh 行程的 stderr），提示「目標 sshd 不允許 port forwarding（`AllowTcpForwarding`）」；三語

## 證據

- T0515 回報區「觀察」節、W7(a)；重現：`node e2e/real-remote/t0515-wizard-env.mjs up` + `BAT_E2E_PRE6_WIZARD=1 npx playwright test e2e/pre6-wizard-acceptance.spec.ts`（W7(a) 情境）
