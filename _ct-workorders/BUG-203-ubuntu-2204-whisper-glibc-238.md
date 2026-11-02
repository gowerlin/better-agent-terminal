---
schema_version: 1
schema_kind: bug
id: BUG-203
title: "Ubuntu 22.04 上語音輸入（whisper）疑似無法載入：`libggml-base.so` / `libggml-vulkan.so` 需要 `GLIBC_2.38`（＋`GLIBCXX_3.4.32`），22.04 只有 glibc 2.35（靜態檢查，未實測）"
status: OPEN
severity: low
reproducibility: unverified
created_at: "2026-11-03T02:17:46+0800"
updated_at: "2026-11-03T02:17:46+0800"
impact:
  - linux
  - voice
links:
  discovered_in: "T0798 `linux-acceptance.yml` Inspect 步驟（run `41495143950` / `41496512040`）"
  related: [BUG-202, T0797, T0798, D243]
---
# BUG-203 — Ubuntu 22.04 上 whisper 函式庫需要 glibc 2.38

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響語音輸入；BAT 啟動不載入 whisper，22.04 啟動驗收 PASS） |
| 可重現 | 未實測（靜態檢查推論） |
| **狀態** | 📂 OPEN（待查：實測語音輸入） |
| 回報者 | 塔台（T0798 CI 驗收） |

## 現象（靜態檢查）

- `resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so`、`libggml-vulkan.so` 最高需要 `GLIBC_2.38`；`ldd` 在 22.04 報 `` libc.so.6: version `GLIBC_2.38' not found ``，`libggml-vulkan.so` 另有 `` libstdc++.so.6: version `GLIBCXX_3.4.32' not found ``。其餘 whisper 檔最高 `GLIBC_2.34`。
- 22.04 啟動驗收的 debug log 沒有 whisper / ggml 錯誤（啟動時不載入）。

## 判斷

- 推論：22.04（glibc 2.35）上啟用語音輸入時 addon 載入會失敗。證據不足 → 維持 OPEN 待查，不猜。
- 來源：上游 `@kutalia/whisper-node-addon` 的 prebuilt（BAT 不重建，見 CLAUDE.md「Electron Runtime」native modules）。

## 修正方向（待查證後決定）

1. 先在 22.04 實測語音輸入（CI 或實機），確認失敗與錯誤訊息、BAT 是否優雅降級。
2. 若確認：換用相容 glibc 2.35 的 build（上游版本 / 自建）、或在 22.04 停用語音並提示、或寫進已知限制。

## 處理紀錄

- 2026-11-03 02:17 開單（OPEN，low，待查）。
