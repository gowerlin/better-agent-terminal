---
schema_version: 1
schema_kind: bug
id: BUG-090
title: 設定精靈「取得 TLS 指紋」永久卡住：伺服器沒有 `/fingerprint` HTTP handler，IPC 也沒有 timeout（WSL / SSH / Docker 共用）
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:18:57+08:00"
impact:
  - setup-wizard-wsl
  - setup-wizard-ssh
  - setup-wizard-docker
links:
  fix_workorder: T0381
  research_workorder: T0380
  plan: PLAN-035
  related: [BUG-087, BUG-088, BUG-091]
---

# BUG-090 — 「取得 TLS 指紋」永久卡住

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（三種遠端精靈都共用這一步，全部無法走到底） |
| 可重現 | 100%（T0380 實測：TLS 握手 14ms 完成，之後 8 秒沒有任何 HTTP 回應） |
| **狀態** | 🔧 FIXING（T0381） |
| 回報者 | 使用者截圖（WSL 精靈第 6 步一直「進行中」）；T0380 研究定位根因 |

## 現象

- WSL 精靈第 6 步「取得 TLS 指紋」一直顯示進行中，不會成功也不會失敗；取消精靈後 runner 仍卡在 `await step.run()`
- 精靈取消後，BAT 主程序仍保有 `127.0.0.1:61786 ↔ 127.0.0.1:9876` 的 ESTABLISHED 連線（殘留請求）

## 根因（塔台 2026-10-04 22:18 已複核程式碼）

- `electron/main.ts` `wsl:fetch-fingerprint`（約 :3527-3547）以 `https.get('https://localhost:<port>/fingerprint')` 取指紋，**沒有 timeout**
- `electron/remote/remote-server.ts:282` `https.createServer({ cert, key })` 沒有掛任何 request handler，只處理 WebSocket upgrade ⇒ HTTP GET 永遠等不到回應
- `fetchFingerprintStep` 被 `wsl-flow.ts:22`、`ssh-flow.ts:31`、`docker-flow.ts:22` 共用 ⇒ **SSH / Docker 精靈同樣受影響**（BUG-088 的實機驗收也會卡在這一步）
- 加重因素：在 Mirrored 模式下，T0380 實測這個請求連到的是**主機 BAT 自己的 RemoteServer**（埠衝突，見 BUG-091）

## 修復方向（D128）

改用 TLS 握手取對端憑證指紋（`tls.connect` + `getPeerCertificate().fingerprint256`），所有路徑都要有 timeout；見 T0381。
