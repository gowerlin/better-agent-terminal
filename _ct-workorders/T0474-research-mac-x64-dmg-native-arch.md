---
schema_version: 1
schema_kind: workorder
id: T0474
title: "研究：v0.6.0-pre.2 mac x64 dmg 內各原生元件的實際 CPU 架構（BUG-117），並提出修正選項"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-117
priority: P1
sizing: S
created_at: "2026-10-13T16:47:18+08:00"
started_at: null
updated_at: "2026-10-13T16:47:18+08:00"
completed_at: null
target_version: v0.6.0-pre.3
depends_on: []
related:
  - "BUG-117（推論與疑似影響元件清單）"
  - "T0472 回報區「待查」段"
  - "D057：mac 採雙 arch dmg，不可改回 universal（@electron/universal 的 x64ArchFiles whack-a-mole）"
affects_files:
  - _ct-workorders/BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **純研究，不改任何 tracked 檔**（除本工單與 BUG-117）；不動 `node_modules/`（T0473 正在同一工作樹跑 `npm ci`）、不跑 vite build / 單元測試"
  - "🔴 下載的 dmg / 解出的檔案一律放 scratchpad（或 `%TEMP%`）下**本單專用的新空目錄**，視為不可信資料：不執行其中任何程式（包括 `claude --version`），只做靜態檢查（magic bytes、Mach-O header cputype、`file` 等）。完成後刪除下載與解壓檔，回報區記錄刪除"
  - "🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
---

# T0474 — 研究：mac x64 dmg 原生元件架構

## 任務

1. 取得 `v0.6.0-pre.2` 的 `BetterAgentTerminal-0.6.0-pre.2.dmg`（x64，約 930 MB）；為對照也可取 `-arm64.dmg`（若時間 / 空間允許）
2. 在 Windows 上靜態解開 dmg（例：7-Zip；本機若無合適工具，回報可用方案，不得安裝需要管理員權限的軟體以外的東西——若需安裝工具，限 portable / 使用者層級，回報區記錄）
3. 對 x64 `.app` 內下列檔案讀 Mach-O header 判定 cputype（x86_64 / arm64 / fat 含哪些）：
   - `Contents/MacOS/BetterAgentTerminal`（基準）
   - `app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe` 及是否存在 `claude-code-darwin-*` 子套件
   - `@anthropic-ai/claude-agent-sdk*` 內的原生 binary / 平台子套件
   - `@lydell/node-pty*` 的 prebuild / 平台子套件
   - `better-sqlite3/build/Release/better_sqlite3.node`
   - `@img/sharp-*` / `@img/sharp-libvips-*`
   - `@kutalia/whisper-node-addon/dist/mac-x64/whisper.node`（對照組，預期 x86_64）
   - 其他 `asarUnpack` 內含 `.node` / 可執行檔的套件（掃描列出）
4. 結論：BUG-117 成立與否、受影響元件與對 Intel Mac 使用者的實際後果（哪些功能壞、哪些有 fallback）
5. 修正選項（至少 2 個，含代價）：例如 mac 改為兩個 job（`macos-13` x64 runner 建 x64、`macos-latest` 建 arm64）、或 arm64 host 上以 `npm_config_cpu` / `--cpu=x64` 另行安裝 x64 子套件並在 electron-builder 打包 x64 前替換、或其他；並評估是否應擴充 `scripts/verify-packaged-native.js` 檢查各 `.app` 內這些元件的 cputype。推薦一個
6. 更新 BUG-117：證據摘要、嚴重度建議（只改 BUG 檔本身）

## 驗收條件

- [ ] 每個列出元件的 cputype 證據表（路徑 + 判定 + 檔案大小）
- [ ] 結論 + 修正選項 + 推薦
- [ ] 下載 / 解壓檔已刪除

## Sub-session 執行指示

1. 讀本工單 + BUG-117 + `package.json` 的 `build`（mac / asarUnpack / npmRebuild）+ `pre-release.yml` mac 流程
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 研究 → 填回報區 → `DONE`；commit 本工單 + BUG-117；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 證據

### 結論與修正選項

### 回報時間
