---
schema_version: 1
schema_kind: bug
id: BUG-096
title: "`App.tsx` initProfile 的 `remote.connect` 不帶 fingerprint，以未 pin 驗證的新 client 取代 main 已驗證的連線"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
impact:
  - remote-profile-trust
links:
  fix_workorder: null
  related: [T0385, T0386, PLAN-036]
---

# BUG-096 — renderer 端遠端重連不帶 fingerprint

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（遠端信任鏈缺口；TOFU pinning 在 renderer 重連路徑失效，推定） |
| 可重現 | 推定 100%（程式碼證據） |
| **狀態** | 📂 OPEN |
| 回報者 | T0385 Worker 觀察；T0386 歸類為獨立 BUG（不屬 PLAN-036） |

## 現象（程式碼證據）

- `src/App.tsx:528` initProfile 呼叫 `window.electronAPI.remote.connect(host, port, token)`，未傳 profile 的 `remoteFingerprint`
- `electron/main.ts` `remote:connect`（約 `:3256`）支援第 5 參數 fingerprint
- `loadProfileSnapshotDetailed`（`electron/main.ts:1215-1235`）已用 pin 過的 fingerprint 建立 client；renderer 再 connect 會以新 client 取代

## 修復方向（待定）

- initProfile connect 帶上 `remoteFingerprint`；或 main 重用已驗證的 client，renderer 不重建
- 無 fingerprint 的 legacy profile 應拒絕（與 `main.ts:1202` 一致）
