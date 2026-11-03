---
schema_version: 1
schema_kind: bug
id: BUG-204
title: "Linux 打包版語音輸入無法載入：`whisper.node` 找不到同目錄的 `libwhisper.so.1`（相依 `.so` 不在動態載入器搜尋路徑，22.04 / 24.04 皆同）"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-11-03T03:10:02+0800"
updated_at: "2026-11-03T11:45:52+0800"
impact:
  - linux
  - voice
links:
  discovered_in: "T0799 linux-acceptance W1（desktop-build `41502529486`；run `41504087753` / `41504962084` / `41505876807`）"
  related: [BUG-203, BUG-202, T0799, T0798]
---
# BUG-204 — Linux 打包版 whisper 找不到 `libwhisper.so.1`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（Linux 打包版的語音輸入完全不能用；BAT 其他功能不受影響） |
| 可重現 | 每次：ubuntu-22.04 / 24.04 runner，三次 run 錯誤原文相同 |
| **狀態** | 🔧 FIXING（T0800） |
| 回報者 | 塔台（T0799 CI 查證） |

## 現象

- 在 main 程序照 `electron/whisper-addon-loader.ts` 的方式 `require` 打包內 `resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64/whisper.node`：
  `libwhisper.so.1: cannot open shared object file: No such file or directory`
- `libwhisper.so.1` 在同一目錄（`appimage-inspect.md` 有列）；`whisper.node` 與 `libggml*.so` 之間沒有指向同目錄的 RUNPATH（`$ORIGIN`），動態載入器不搜尋同目錄。

## 判斷

- 推論：Linux 打包版（AppImage）的語音輸入在任何發行版都無法載入；22.04 另有 `GLIBC_2.38` 問題（BUG-203），要先解決本單才看得到。
- 是否只影響打包版（dev 環境 `node_modules` 是否同樣失敗）、BAT 是否優雅降級（UI 提示 vs 靜默）未查。

## 修正方向（待定）

1. 載入 `whisper.node` 前先以絕對路徑依序 `process.dlopen` / 預載相依 `.so`（libggml-base → libggml-cpu → libggml → libwhisper …）。
2. 打包時（afterPack）以 `patchelf --set-rpath '$ORIGIN'` 修正 RUNPATH，或改用上游有 RUNPATH 的 build。
3. 驗收：linux-acceptance 的 W1 改為能判定成功（另需實際轉錄一小段音檔則另議）。

## 處理紀錄

- 2026-11-03 03:10 開單（OPEN，medium），依 T0799 W1 查證；BUG-203 的 glibc 問題被本單遮住，兩單一起處理較合理。
- 2026-11-03 11:45 → FIXING（T0800，D245）：先查證再選修法，塔台偏好打包時讓相依函式庫從同目錄解析；不用 `LD_LIBRARY_PATH`；BUG-203 在同單只查證。
