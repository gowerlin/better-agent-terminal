---
schema_version: 1
schema_kind: workorder
id: T0720
title: "研究：`v0.7.2-pre.5` 安裝檔比 pre.4 大約 24 MiB、超過 D146 預算的原因與可行對策（只查不修）"
type: research
status: PENDING
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-11-01T09:49:34+0800"
started_at: ""
updated_at: "2026-11-01T09:49:34+0800"
completed_at: ""
depends_on: []
related:
  - "D146（安裝檔瘦身；每平台安裝檔 ≤ 320 MiB、可攜 zip ≤ 450 MiB，以 CI `Report artifact sizes` 量測）；T0544 組成實測、T0546 白名單、T0547 不內建 baseline"
  - "T0717（內嵌 claude CLI 2.1.306 → 2.1.316、codex 0.163 → 0.166，`101adaaf`）、T0718（Agent SDK 0.2 → 0.3.316，含 8 個 `claude-agent-sdk-*` 平台子套件，`61dff300` / `45113164` / `54f52048`）、T0719（BUG-176：ajv / ajv-formats 加進 `dependencies`，`59ef7f37`）"
  - "release：`v0.7.2-pre.4`（run `41226677868`，exe 309 / zip 428 / AppImage 305 / dmg 322 MiB）、`v0.7.2-pre.5`（run `41260924862`，exe 333 / zip 458 / AppImage 328 / dmg 345 MiB）"
  - "CLAUDE.md「Packaging / Release 前置檢查」（安裝檔瘦身、`build.files` 白名單、🔴 不得使用 `build.<platform>.files`）、`docs/agent-guide/packaging-release-checks.md`"
affects_files:
  - _ct-workorders/T0720-research-pre5-installer-size-growth.md
  - "_ct-workorders/_report-T0720-installer-size.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json` / lock、`build` 設定、CI workflow、CLAUDE.md、docs。下載的安裝檔、解壓結果、暫存腳本一律放 Worker 的 scratchpad（下載檔放獨立的空目錄，腳本放另一個目錄），結束後可刪。"
  - "🔴 結論要有證據：每個「多了 X MiB 來自 Y」都附量測方式與數字（檔案路徑、bytes、比較表）；推論與事實分開標示（【推論】）。"
  - "🔴 GitHub 只做唯讀操作，所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）：可 `gh release download`、`gh run view --log`；不得建立 / 編輯 release、tag、issue，不得觸發 workflow。"
  - "🔴 不在本 repo 跑 `npx vite build` / `npm run build*` / electron-builder：同時有 T0722 Worker 在本 repo 改程式並跑 build，`dist-electron/`、`release/` 會互相覆蓋。只比較 CI 產物（GitHub Release 資產與 CI log）；若真的需要本機打包才能回答，寫進「建議下一步」，不執行。不得碰使用者正在用的 BAT 與已安裝的 BAT。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報不寫真名、家目錄路徑（寫 `<使用者資料夾>`）或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0720 — 研究：`v0.7.2-pre.5` 安裝檔變大的原因與對策

## 元資料

- **工單編號**：T0720
- **類型**：research（只查不修）
- **優先級**：P1（結論決定是否放寬 D146）
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：M

## 研究目標

`v0.7.2-pre.5` 四個安裝檔都比 pre.4 大約 23–30 MiB，全部超過 D146 預算（每平台 ≤ 320 MiB、可攜 zip ≤ 450 MiB）：

| 產物 | pre.4（MiB） | pre.5（MiB） | D146 上限 |
|---|---|---|---|
| exe（NSIS） | 309 | 333 | 320 |
| zip（可攜） | 428 | 458 | 450 |
| AppImage | 305 | 328 | 320 |
| dmg | 322 | 345 | 320 |

使用者決定**先看本單結論，再決定要不要放寬 D146**。本單要回答：

1. **增加量來自哪裡**：逐項列出 pre.4 → pre.5 的大小差異（至少 Windows 完整拆解，其他平台盡量），對到 T0717 / T0718 / T0719 的哪個變更。
2. **哪些是必要的、哪些可以拿掉**：例如 SDK 0.3 的平台子套件是否把用不到的 binary 打進安裝檔（D146 / T0544 時「SDK 內建 claude（不執行）」就是被排除的一項）、是否有重複的 claude / codex binary、其他平台的子套件是否被打進來。
3. **對策選項與預估**：每個選項預估省多少（每個平台）、要動哪些檔案、風險（會不會壞掉 Claude 面板 / runtime router / 打包驗證）、規模；以及「不瘦身、直接放寬 D146」時建議的新上限。

## 已知資訊

- pre.5 包含：內嵌 `@anthropic-ai/claude-code` 2.1.316（T0717 回報：`bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 335,469,216 bytes、hardlink 2，套件檔案清單與 2.1.306 相同）、內嵌 codex 0.166.0、`@anthropic-ai/claude-agent-sdk` 0.3.316（含 8 個 `claude-agent-sdk-*` 平台子套件）、ajv / ajv-formats（T0719 為 BUG-176 加進 `dependencies`）。
- D146：T0544 量過的組成（Electron、codex、claude、Windows 重複 claude.exe、SDK 內建 claude、asar 內用不到的 node_modules 等）；T0546 以 `build.files` 否定 extglob 白名單瘦身。
- CI `Report artifact sizes` step 有每次 run 的產物大小；pre.4 run `41226677868`、pre.5 run `41260924862`。
- 【塔台推測，待查】SDK 0.3 的平台子套件可能各帶一個原生 binary，而 Claude 面板走 `pathToClaudeCodeExecutable` 指到內嵌 CLI，不需要它。

## 調查範圍

1. **CI 產物比較**：下載 pre.4 / pre.5 的 Windows zip（必要），解壓後依目錄 / 套件比較大小差異（`resources/app.asar` 內容可用 `@electron/asar` 列表或解開、`app.asar.unpacked`、`resources/` 其他檔）。AppImage / dmg 視可行性比較（例如 CI log、tar 清單、`--appimage-extract` 不可用時說明），做不到的寫明理由並以 Windows 結果推估。
2. **差異歸因**：每一筆差異對到哪個套件 / 版本 / 工單；確認 SDK 0.3 平台子套件、claude-code 2.1.316、codex 0.166、ajv 各佔多少；確認 asar 白名單是否讓不需要的檔案進來（含其他平台的子套件）。
3. **執行期需求**：被懷疑可拿掉的檔案，執行期是否真的用不到（Claude 面板 `query()` 用哪個 executable、`resolveEmbeddedClaudePath` / runtime router、SDK 0.3 在找不到子套件 binary 時的行為、headless / server bundle 是否另有需求）。附程式碼位置。
4. **對策**：列 2–4 個選項（例：白名單排除 SDK 平台子套件、去除重複 binary、改壓縮設定、放寬 D146），每個附各平台預估大小、要動的檔案、需要補的守門（`asar-runtime-deps.test.mjs`、`verify-packaged-native.js` 等）、風險、規模。給出推薦。

## 研究指引

- 先讀 `package.json` 的 `build` 區塊（`files` 白名單、`asarUnpack`、`extraResources`）、`scripts/verify-packaged-native.js`、`electron/claude-agent-manager.ts` 的 `query()` 選項、`electron/claude-runtime-router.ts`。
- 結論第一段用一句話回答「pre.5 多出的約 24 MiB 主要來自 ___，可以 / 不可以安全拿掉」，再接比較表與選項。
- 若某項只能在 mac / Linux 實機確認，寫進「待實機確認」。

## 互動規則

- yolo：不問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，每輪最多 3 題。
- 互動紀錄寫入回報區。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 子代理使用

### 遭遇問題

### 回報時間
