---
schema_version: 1
schema_kind: plan
id: PLAN-053
title: "升級 Electron 42+（Chromium 148+）：Electron 41 已停止更新；Graphite out-of-order CHECK 改為 GPU 程序重啟"
status: IN_PROGRESS
priority: high
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

## 2026-11-02 狀態核對（第一百零五 session，D221）

- **優先度 low → high**（使用者決定）。塔台查證：`package-lock.json` 鎖 **41.2.1**（`package.json` `^41.2.1`）；electron@41 最新 41.10.7（41 線最後一版、已停止更新），npm `latest` 為 **45.2.1**。BAT 除了停在停更的版本線，連 41 線之後 8 個修補小版本都沒裝；修補版通常含 Chromium 安全修正（推論）。
- **第一步**：開 **T0779**，在 41 線內升到 41.10.7（大版本不變、原生模組 ABI 不變）。
- **主升級**：待決第 1 點要重新查目標版本（T0668 查證時是 42 / 43 / 44，現在已有 45）；仍比照 PLAN-016 先開 EXP 分支驗證（待決第 4 點）。狀態維持 IDEA，T0779 收單後再拆主升級的研究單。

## T0779 結果（2026-11-02）

- **版本**：Electron 41.2.1 → **41.10.7**（`package.json` `^41.10.7`；Node 24.18.0、Chromium 146.0.7680.216、ABI 145 不變）。lock 只改 electron 與它自己的相依（`@electron/get` 2.0.3 → 5.1.0，`extract-zip` 換成 `@electron-internal/extract-zip`，連帶移除只給舊版用的 7 個套件）；原生模組、electron-builder、vite、內嵌 CLI、GPU / Graphite 設定都沒動。
- **驗證（Windows x64）**：verify-native-modules、typecheck 0 / 0、`test:unit`、`test:legacy`、`vite build`、`build:dir` ＋ `verify-packaged-native.js` 全綠，打包產物 Electron = 41.10.7；e2e 冒煙 5 支（t0572 / t0776 / t0735 / t0744 / t0762）全過。
- **未驗證**：macOS / Linux，待 CI 三平台 build 與 `macos-acceptance.yml`。
- 狀態維持 IDEA、優先度不變；主升級（42+）另開單。

## T0781 結論摘要（2026-11-02）

> 只是摘要，證據、行號、來源連結與工單草案見 `T0781-research-electron-major-upgrade-target.md` 回報區。

- **待決 1（目標版本）**：建議**一次升到 Electron 45**（45.2.x：Chromium 156、Node 24.22.1、ABI 150，暫定支援到 2027-04-27）。42 已在 2026-10-20 停止支援；43 只剩約 2 個月；44 與 45 工作量相同。備案：45 本身有回歸時退到 44.x。
- **待決 2（回歸範圍）**：需要改的主要是 **Electron 44 的 main 行程 `clipboard` 改寫**（`readImage` / `writeImage` 移除、`read` 改 Promise，45.2.1 實測），影響圖片貼上 / 複製圖片 / macOS Finder 檔案貼上（`electron/main.ts`、`clipboard-file-paths.ts`、3 支 e2e），規模 M。其餘：42 起 `electron` 不再 postinstall 下載（CI 已用 `install.js`，可用）、macOS 通知需簽章（正式版已簽）、44 起 macOS 13 以上（README 要改）、Linux badge 失效；45 的 `safeStorage` 同步 API 棄用，46 移除（另開單）。原生模組 `@lydell/node-pty`、`@kutalia/whisper-node-addon` 都是 N-API，已在 45.2.1 實測載入；Node 主版本不變。electron-builder / Playwright 支援範圍未確認，EXP 一次只換 Electron。
- **待決 3（Graphite）**：43 / 44 / 45 的 Chromium 都已把 `kOutOfOrderRecording` 改成 context lost，但 context lost 重啟以 exit code 34 結束，**仍計入 5 分鐘 3 次的 crash limit**（原始碼查證）；`kAsyncShaderCompilesFailed` 仍會 CHECK。建議升級時**保留** macOS `disable-skia-graphite`，之後另開單評估。
- **待決 4（EXP）**：建議比照 PLAN-016 開 `EXP-ELECTRON45-001`（分支 `exp/electron45`），驗證關卡與三平台作法見 T0781。開工前塔台待決：三平台 CI 怎麼跑（預覽版屬對外動作）、`allowScripts.electron` 去留、safeStorage 是否併入。
- 狀態維持 IDEA。

## 2026-11-02 塔台：主升級開工（D223）

- 狀態 IDEA → **IN_PROGRESS**。依 T0781 建議目標 **Electron 45**。使用者決定：
  1. 試做用 `T####` ＋ BAT worktree 隔離（不用 EXP 前綴手動 worktree）→ **T0784**（`isolation: worktree`，分支 `ct/T0784`）。
  2. 三平台用新增的只 build、不發布 workflow 驗 → **T0783**（先做）。
  3. safeStorage async 另開 → **T0785**（T0784 合回後、Electron 46 前）。
  4. `allowScripts.electron` 在 T0784 一併移除並記錄。
- 順序：T0783 → push main → 塔台試跑 desktop-build → 派 T0784（Windows 關卡）→ 塔台以 desktop-build ＋ macos-acceptance 驗 `ct/T0784` 三平台 → 合併工單回 main → T0785。
