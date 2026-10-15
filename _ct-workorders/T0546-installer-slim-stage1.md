---
schema_version: 1
schema_kind: workorder
id: T0546
title: "安裝檔瘦身第一階段（T0544 S2）：排除重複 / 用不到的 binary 與 node_modules（C1 / C2a / C2b / C3 / C4 白名單 / C5），不改功能"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-10-15T20:33:46+0800"
updated_at: "2026-10-15T20:33:46+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4"
depends_on: []
related:
  - "T0544 研究報告（本單依據：「調查結論」§1 / §3 C 表 / §4 S2、「建議下一步」1 / 4）；證據目錄 `C:\\Users\\Gower\\AppData\\Local\\Temp\\t0544\\`（pre.3 解壓產物與 tsv 清單，可直接讀）"
  - "D092（per-host baseline matrix；C3 使實作回到 D092）；D094（不在本單復議）；BUG-052 / BUG-118（內嵌 claude 路徑）"
  - "CLAUDE.md「Packaging / Release 前置檢查」「Server bundle baseline（PLAN-031）」「Claude Runtime Selection」"
affects_files:
  - package.json
  - scripts/build-server-bundle.mjs
  - scripts/verify-server-bundle.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - electron/__tests__/
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - CLAUDE.md
  - _ct-workorders/T0546-installer-slim-stage1.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍只限 T0544 第一階段（C1 / C2a / C2b / C3 / C4 / C5）。**不做** A（不附 baseline）、B（codex 不內建）、C6（locales）、D1 / D2 / D3（壓縮格式）——這些待使用者決策，另開單。"
  - "🔴 `package.json` 只改 `build`（`files` / `asarUnpack` / per-platform `extraResources` / `files` 排除）與 C4 所需的 `dependencies` ↔ `devDependencies` 搬移（若採①）；**不得**升降任何套件版本，`version` 欄位不動。lock diff 只能是搬移造成的 `dev` 標記變化（回報區附摘要）。"
  - "🔴 workflow 只可改「列出 / 量測產物大小」相關的 step（例：release job 輸出 `scripts/report-artifact-sizes.mjs` 摘要）；不得改觸發條件、版號、發佈步驟、`dist-baseline` 下載（A 不在本單）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build / 打包產物；不碰使用者正在用的 BAT（port 9876）與 `C:\\Program Files\\BetterAgentTerminal`。本機打包只用 `--dir`（`npm run build:dir` 或等效），產物留在 `release/`，不安裝。"
---

# T0546 — 安裝檔瘦身第一階段（T0544 S2）

## 背景

`v0.6.1-pre.3`：exe 693.9 / zip 868.8 / AppImage 1030.7 / dmg 871.9 MiB。T0544 實測組成後發現多項**重複或執行期用不到**的內容。本單只做不影響功能的部分；預估結果 exe ≈ 454、zip ≈ 570、AppImage ≈ 554、dmg ≈ 640 MiB（T0544 §4 S2）。

## 範圍（逐項依 T0544 §3 C 表；細節、證據與風險以該報告為準）

| # | 內容 | 預估省（exe / zip / AppImage / dmg，MiB） |
|---|---|---|
| C1 | Windows 排除 `@anthropic-ai/claude-code-win32-*/claude.exe`，保留 `@anthropic-ai/claude-code/bin/claude.exe`（hardlink 被 electron-builder 複製成兩份；Windows router 只用 `bin/claude.exe`，BUG-052） | 86.0 / 112.0 / — / — |
| C2a | desktop 不打包 `@anthropic-ai/claude-agent-sdk-*` 平台子套件（SDK 自帶 claude；每個 spawn 點都傳 `pathToClaudeCodeExecutable`，不會執行） | 48.1 / 68.6 / 138.6 / 56.6 |
| C2b | server bundle 不收 `claude-agent-sdk-<plat>`；`verify-server-bundle.js` 對所有 target 禁止該路徑 | tarball linux-x64 約 -70 |
| C3 | AppImage 只收 `linux-x64` baseline（`build.linux.extraResources.filter` 拿掉 `linux-arm64`；與 D092 矩陣一致） | — / — / 227.2 / — |
| C4 | asar 只收執行期需要的 node_modules：採 T0544 推薦的 ② `build.files` 白名單（`ws`、`opencc-js`、`ajv`、`ajv-formats` 與其 `dependencies` 閉包、`@lydell/node-pty*`、`@anthropic-ai/claude-code*`、codex / whisper / SDK js 等 unpacked 需要者），或 ① 把 renderer-only 套件移到 `devDependencies`——擇一並在回報區說明理由 | ≈ 28.8 / 36.3 / 38.6 / 37.7 |
| C5 | whisper addon 只收本平台 `dist/<dir>`（規則與 `electron/whisper-addon-loader.ts` / `verify-native-modules.js` 同步；mac 保留 `mac-arm64` 與 `darwin-arm64`） | 5.4 / 11.8 / 2.9 / 11.3 |

## 必要守門（缺一不可）

1. **require 守門測試**（C4）：掃描建置後 `dist-electron/*.js` 的 `require()`（含 `createRequire` / 動態字串可解析者），每個外部套件都必須被 `build.files` 白名單（或 `dependencies` 閉包）涵蓋；未涵蓋即失敗。測試放 `scripts/__tests__/` 或 `electron/__tests__/`，並說明如何偵測動態 `require` 的盲點。
2. **router 守門**（C2a）：單元測試斷言 embedded 模式缺檔時不會 fallback 到 `claude-agent-sdk-*` 的 binary（T0544 引用 `electron/claude-runtime-router.ts:319-329`）。
3. **`verify-packaged-native.js` 補 Windows**：`--platform win` 檢查 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe` 存在且為 PE，且 `claude-code-win32-*/claude.exe`、`claude-agent-sdk-*` 不存在；mac / linux 檢查同步加入「`claude-agent-sdk-*` 不存在」、Linux 只有 `linux-x64` baseline、whisper 只有本平台目錄。workflow 的 Windows job 在打包後執行它（比照 mac / linux 位置）。
4. **產物大小量測**：新增 `scripts/report-artifact-sizes.mjs`（只讀），在各平台 build job 打包後輸出產物大小與主要組成摘要到 job log（之後 D094 復議的資料來源）；不設失敗門檻。

## 驗收條件

- [ ] 上表 C1 / C2a / C2b / C3 / C4 / C5 全部落地，或於回報區說明不做的理由
- [ ] 守門 1–4 落地並有測試
- [ ] 本機 Windows `--dir` 打包成功；回報 `release/win-unpacked` 大小 vs pre.3 的 Windows 解壓大小（2036 MiB，T0544），並以 `verify-packaged-native.js --platform win` 驗證通過；以 `--runtime=<高號碼>` 啟動打包產物，Agent session（內嵌 claude）、claude-cli 分頁、mermaid 預覽、程式碼高亮可用（截圖或日誌佐證）
- [ ] `npm run build:server-bundle`（或等效）產出的 linux-x64 tarball 不含 `claude-agent-sdk-*`、`verify-server-bundle.js` 通過，回報 tarball 大小
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功（回報區附數字）
- [ ] `CLAUDE.md` 補規則：`claude-agent-sdk-<plat>` 不打包（desktop 與 server bundle）、Windows 只保留 `bin/claude.exe`、`build.files` 白名單 + require 守門（新增執行期依賴時要同步白名單）、Linux 只收 `linux-x64` baseline、whisper 只收本平台
- [ ] 回報區列出：三平台預估大小（依實際改動重算）、mac / Linux 只能在 CI 驗證的項目

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 回報時間
