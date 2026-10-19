---
schema_version: 1
schema_kind: plan
id: PLAN-053
title: "升級 Electron 42+（Chromium 148+）：Electron 41 已停止更新；Graphite out-of-order CHECK 改為 GPU 程序重啟"
status: IDEA
priority: low
created_at: "2026-10-19T12:41:35+0800"
links:
  source: "T0668 回報區「建議方向」方案 C；使用者 2026-10-19 同意開 PLAN"
  related: [BUG-164, T0668, T0669]
---

# PLAN-053 — 升級 Electron 42+

## 動機

- Electron 41（Chromium 146）已停止更新：41.10.7（2026-08-24）是最後一版，目前維護中的是 42 / 43 / 44（T0668 查證，2026-10-19）。
- BUG-164：Chromium 146 遇到 Skia Graphite `kOutOfOrderRecording` 會直接 CHECK 崩潰（`graphite_shared_context.cc:291`）。Chromium 147 起改成 context lost 後重啟 GPU 程序（commit `ed44a45932`），不再崩潰，Electron 42 起才帶進來。觸發原因不變。
- T0669 先在 macOS 停用 Graphite（`disable-skia-graphite`）並處理 GPU 崩潰後的終端重建；升級是較長期的解法。

## 待研究 / 待決

1. 目標版本：42 / 43 / 44 中選一個（Chromium 版本、Node 版本、支援期、破壞性變更）。
2. 回歸範圍：見 CLAUDE.md「Electron Runtime」節（Electron ABI、`@lydell/node-pty` / `@kutalia/whisper-node-addon` prebuilt、`verify-native-modules.js`），以及 electron-builder、vite-plugin-electron、內嵌 claude CLI / SDK、Terminal Server、打包 / 簽章 / 公證、三平台安裝版驗收。
3. Graphite：升級後要不要繼續保留 macOS 的 `disable-skia-graphite`。另外要確認 graceful restart 是否會計入 GPU crash limit，也就是 5 分鐘內 3 次就退回軟體繪圖（T0668 未查證）。
4. 是否比照 PLAN-016（Electron 28 → 41）用 EXP 實驗分支先驗證。
