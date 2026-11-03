---
schema_version: 1
schema_kind: bug
id: BUG-204
title: "Linux 打包版語音輸入無法載入：`whisper.node` 找不到同目錄的 `libwhisper.so.1`（相依 `.so` 不在動態載入器搜尋路徑，22.04 / 24.04 皆同）"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-11-03T03:10:02+0800"
updated_at: "2026-11-03T12:35:20+0800"
fixed_at: "2026-11-03T12:07:51+0800"
closed_at: "2026-11-03T12:35:20+0800"
closed_reason: "交付版 v0.7.4-pre.2 linux-acceptance 41578537967 實測通過"
fix_commit: "fb4c0f8c（分支 ct/T0800；docs 3d02147b）"
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
| **狀態** | 🚫 CLOSED（T0800；交付版 `v0.7.4-pre.2` linux-acceptance `41578537967` 24.04 W1 PASS） |
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
- 2026-11-03 12:07 → FIXED（T0800 `fb4c0f8c`，docs `3d02147b`，分支 `ct/T0800` 待合併）：afterPack 以 patchelf 把打包內 whisper 共享物件的 RUNPATH 改成 `$ORIGIN`；desktop-build `41575226873` 三平台綠、linux-acceptance `41575592616` 24.04 W1 PASS。CLOSED 依據：合併後交付版（pre-release）的 linux-acceptance 24.04 W1 PASS。

## T0800 結果

- **根因（上游，非 BAT 打包）**：`@kutalia/whisper-node-addon` 1.1.0 的 `dist/linux-x64/` ELF 都帶上游 CI 建置目錄的 RUNPATH（`whisper.node`：`/home/runner/work/whisper-node-addon/whisper-node-addon/deps/whisper.cpp/build/Release`；`libwhisper.so*` / `libggml.so` / `libggml-cpu.so` 同路徑加結尾空項目；`libggml-vulkan.so` 另有 `…/VULKAN_SDK/lib`；`libggml-base.so` 沒有 RUNPATH）。dev 環境（WSL Ubuntu 24.04，直接 `require` `node_modules` 的 `whisper.node`）同樣 `libwhisper.so.1: cannot open shared object file`。`libwhisper.so` / `.so.1` / `.so.1.7.6` 是三個內容相同的實檔（npm tarball 不保留 symlink），名稱與 `NEEDED` 一致。
- **修法**：`afterPack`（`scripts/version-manifest.cjs` → `scripts/linux-whisper-runpath.cjs`）在 Linux 打包時對 `dist/linux-*` 的共享物件跑 `patchelf --set-rpath '$ORIGIN'`，讀回檢查；缺 patchelf → 打包失敗。`verify-packaged-native.js` 加 `whisper-runpath`。三個會打 Linux 的 workflow 在打包前 `Install patchelf (Linux, BUG-204)`。不用 `LD_LIBRARY_PATH`；Windows / macOS 不變。
- **驗證**：desktop-build `41575226873` 三平台綠（Linux log：`afterPack (T0800): whisper RUNPATH = $ORIGIN for 8 file(s) … (patchelf 0.18.0)`、`verify-packaged-native` ✅）。linux-acceptance `41575592616`：24.04 W1 **PASS**（`whisper addon loaded (whisper() exported)`，RUNPATH `$ORIGIN`），verdict WARN 僅因 BUG-202 自動降級；22.04 verdict PASS，W1 INFO = BUG-203 的 `GLIBC_2.38`。
- **執行期系統相依**：`libgomp1`、`libvulkan1` 仍由系統提供（runner 有）；沒裝 `libgomp1` 時錯誤改為 `libgomp.so.1: cannot open shared object file`（WSL 實測）。
- **降級行為（只記錄）**：whisper 只在第一次辨識時載入，失敗不影響啟動與其他功能；debug log 一次 `[voice] whisper addon unavailable, voice input disabled: …`，renderer 錄音停止後顯示 `辨識失敗: Voice recognition module (whisper) is unavailable: …`，麥克風按鈕不會事先隱藏。

## 結案紀錄

- 2026-11-03 12:35 CLOSED：交付版 `v0.7.4-pre.2`（pre-release run `41577071236`）的 linux-acceptance run `41578537967`：ubuntu-24.04 W1 **PASS**（`whisper addon loaded (whisper() exported)`，RUNPATH `[$ORIGIN]`）；ubuntu-22.04 W1 INFO（`GLIBC_2.38` not found，BUG-203 已列為已知限制，D246）。
