---
schema_version: 1
schema_kind: workorder
id: T0544
title: "研究：安裝檔過大（dmg 871 MB / exe 693 MB / AppImage 1030 MB，D094 上限 280 MB）——實測各平台組成，評估縮減方案與取捨"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-10-15T20:06:48+0800"
updated_at: "2026-10-15T20:06:48+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "未定（研究結論後由塔台開實作單）"
depends_on: []
related:
  - "D094（mac installer 280 MB 上限，長期超標未復議，L130）"
  - "D092（server bundle per-host baseline matrix，安裝檔內建 baseline tarball）；D093 / D095 / D120"
  - "D057 / D136（mac 只打 arm64、不做 universal）"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」「Packaging / Release 前置檢查」；docs/server-bundle-distribution.md"
  - "決策日誌 T-B 註記：codex 平台套件 unpackedSize win 223 → 451 MB"
affects_files:
  - _ct-workorders/T0544-research-installer-size-reduction.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改任何產品程式碼、`package.json`、workflow、腳本；只寫本工單檔。commit 用 `git commit --only _ct-workorders/T0544-research-installer-size-reduction.md`（`src/styles/settings.css` 的 M 狀態不是你的變更）。"
  - "🔴 下載與解壓一律放在 repo 之外（例：`%TEMP%\\t0544\\`），每個下載檔各自一個空目錄；**不得**執行下載內容裡的任何程式（只讀檔案大小 / 檔頭 / asar 清單）。研究結束後保留目錄並在回報區寫出完整路徑，不要放進 repo。"
  - "🔴 不 push、不觸發 workflow、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；不要在本機跑 electron-builder 打包（需要時只讀既有 release 產物）。"
---

# T0544 — 研究：安裝檔過大的組成與縮減方案

## 研究目標

回答兩件事，結論必須可決策：

1. **各平台安裝檔實際由什麼組成**（以 `v0.6.1-pre.3` 的 release 產物實測，不以推估代替）。
2. **有哪些縮減方案、各省多少、代價是什麼**，並給推薦組合與預估結果大小；說明 280 MB（D094）是否可達，達不到時建議的新上限。

## 已知資訊（塔台 2026-10-15 20:0x 取得）

`v0.6.1-pre.3` release 資產（`gh release view -R gowerlin/better-agent-terminal`）：

| 資產 | 大小 |
|---|---|
| `BetterAgentTerminal-0.6.1-pre.3-arm64.dmg` | 871 MB |
| `BetterAgentTerminal-0.6.1-pre.3-win.zip` | 868 MB |
| `BetterAgentTerminal.Setup.0.6.1-pre.3.exe` | 693 MB |
| `BetterAgentTerminal-0.6.1-pre.3.AppImage` | 1030 MB |

`server-bundle-v0.6.1-pre.3`：`bat-server-linux-x64` 228 MB、`linux-arm64` 228 MB、`darwin-arm64` 200 MB（皆 `.tar.gz`）。

線索（未驗證，請以實測確認或推翻）：

- `package.json` `build` 的 per-platform `extraResources` 含 `dist-baseline`（server bundle tarball，D092 matrix：Win → linux-x64；Mac arm64 → linux-x64 + darwin-arm64；Linux x64 → linux-x64）。已壓縮的 tarball 再包進安裝檔幾乎不會變小 ⇒ mac 可能約 428 MB、Win / Linux 約 228 MB 來自這裡。
- `build.files` 為 `node_modules/**/*`；`asarUnpack` 含 `@anthropic-ai/claude-code*`、`@anthropic-ai/claude-agent-sdk*`、`@openai/codex-*`、`@lydell/node-pty*`、`@kutalia/whisper-node-addon`。
- runtime 有下載 fallback：`electron/remote/server-bundle-distributor.ts`（baseline / cache 都缺時從 GitHub Release 下載，T0492）。
- claude-agent-sdk 的平台子套件自帶 claude binary，但 BAT 每個 spawn 點都傳 `pathToClaudeCodeExecutable`，不會執行它（CLAUDE.md「bundle 內容限制」，指的是 server bundle；desktop 安裝檔是否也打包了它請實測）。

## 調查範圍

1. **實測組成**：下載 pre.3 的 win zip、AppImage、dmg（dmg 可用 7-Zip 或 WSL `Ubuntu-24.04` 讀；AppImage 可用 WSL `--appimage-extract` 以外的方式，如 `unsquashfs` 讀 squashfs offset，**不要執行 AppImage**）。列出：
   - 前 15 大目錄 / 檔案（解壓後大小）與其在安裝檔中的壓縮後貢獻（估法寫明）
   - `resources/dist-baseline/`、`app.asar`、`app.asar.unpacked/node_modules/` 下各大套件
   - 是否含**用不到**的東西：其他平台 / arch 的 binary、`claude-agent-sdk-<platform>` 內建 claude、sourcemap、測試檔、型別檔、文件、`.bin/`、重複的套件版本等
2. **方案評估**（至少涵蓋以下，可加）：
   - **A** 安裝檔不附 server bundle baseline，首次設定遠端時下載（既有 distributor fallback 是否已足夠？離線 / 內網的退路？與 D092 的關係）
   - **B** codex 改為隨需下載或改用系統 codex（使用者體驗、版本綁定、BUG-083 / 084 的教訓）
   - **C** 清除用不到的檔案（electron-builder `files` 排除規則；逐項列可省大小與風險）
   - **D** 其他：whisper 模型 / addon、壓縮格式（dmg `ULMO` / NSIS `lzma` / AppImage 壓縮）、按需下載的 claude 等
   - **E** 若組合後仍超過 280 MB：建議的 D094 新上限與理由
3. 每個方案寫：可省大小（每平台）、實作範圍（會動哪些檔）、風險 / 退路、需要推翻或新增哪個決策（D###）、驗證方式。

## 研究指引

- 數字一律標來源（實測指令 / 檔案）；推估要標「推估」並寫算法。
- 本單 `interactive: false`：遇到需要使用者決定的取捨，寫進「建議方向」讓塔台問，不要停下來等。
- 不要開始實作；推薦方案由塔台與使用者決定後另開實作單。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 遭遇問題

### 回報時間
