---
schema_version: 1
schema_kind: workorder
id: T0781
title: "研究：PLAN-053 Electron 主升級要升到哪一版（42–45），BAT 會受哪些破壞性變更影響，附 EXP 驗證計畫與工單草案"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T14:28:11+0800"
depends_on: []
related:
  - "PLAN-053（high）；D222；T0779（41.2.1 → 41.10.7，`a09887fb`：Chromium 146.0.7680.216 / Node 24.18.0 / ABI 145）；T0668（Electron 41 停更、BUG-164 Graphite CHECK 在 Chromium 147 起改為 GPU 程序重啟）；T0669（macOS `disable-skia-graphite`）"
  - "前例：`_archive/plans/PLAN-016-electron-runtime-upgrade-28-to-41.md`、`_archive/workorders/EXP-ELECTRON41-001-electron-runtime-upgrade-feasibility.md`（28 → 41 的做法與踩雷）"
  - "CLAUDE.md「Electron Runtime」「Build Toolchain」「electron-builder 26 migration notes」「本機開發：npm 12 install scripts」「Packaging / Release 前置檢查」「Terminal Server 存活判定與 recovery」節；`docs/agent-guide/build-toolchain.md`、`packaging-release-checks.md`、`logging.md`（`[gpu]`）"
affects_files:
  - _ct-workorders/T0781-research-electron-major-upgrade-target.md
  - _ct-workorders/PLAN-053-electron-42-upgrade.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 只研究：不改產品程式碼、不改 `package.json` / `package-lock.json`、不在 repo 內 `npm install`、不跑 `vite build` / `build:dir` / e2e（與 T0782 並行，T0782 會動 lock 與跑 build）。要實際試的東西（例：在 scratch 目錄 `npm install electron@<候選>` 看 `process.versions`、試裝原生模組 prebuilt）一律放 Worker scratchpad 或系統暫存目錄的 `ct-T0781/`，收尾刪除；不碰使用者的 BAT（`%APPDATA%\\BetterAgentTerminal`）。"
  - "🔴 要回答的問題：① 候選 42 / 43 / 44 / 45 各自的 Chromium、Node、V8、ABI（`NODE_MODULE_VERSION`）、支援期（依 Electron 官方支援政策，哪幾條線還在維護、45 之後多久停）；② 41 → 候選之間的破壞性變更（官方 breaking-changes 文件），逐項對照 BAT 程式碼是否用到（grep `electron/**`、`src/**`、`vite.config.ts`、electron-builder 設定；例：被移除或改名的 API、`webPreferences` 預設值、`session` / `protocol` / `webContents` 變更、`contextBridge`、`utilityProcess`、`BrowserView` 等），列出命中的檔案與行號；③ 相依套件的相容性：electron-builder 26.x 支援到哪一版、`vite-plugin-electron` / `vite-plugin-electron-renderer`、`@lydell/node-pty`、`@kutalia/whisper-node-addon`（是 N-API 還是綁 ABI；有沒有新 ABI 的 prebuilt）、Playwright 的 `_electron`、內嵌 claude CLI / codex 無關但列出確認；④ Node 主版本變動對主行程與 helper 的影響（例：Node 24 → 更新版的行為變更）；⑤ BUG-164：候選版是否已含 Chromium 147+ 的 Graphite 修正、升級後 macOS 的 `disable-skia-graphite`（T0669，`decideSkiaGraphite`）建議保留或移除、GPU 程序 graceful restart 是否計入 crash limit（PLAN-053 待決 3）；⑥ 三平台打包 / 簽章 / 公證、macOS arm64 only（D136）有無影響。"
  - "🔴 來源：只用官方來源（electronjs.org releases / breaking-changes / 支援政策、各套件 GitHub release notes 與 issues、npm 的 `npm view <pkg> versions` / `engines` / `peerDependencies`），每個結論附連結與查核日；查不到的寫「未確認」，不得寫成肯定句。"
  - "🔴 產出（寫在回報區）：候選比較表（版本、Chromium / Node / ABI、支援期、破壞性變更命中數、相依阻擋項）；推薦目標版本與理由（含「一次跳到 X」vs「分段 42 → 44」的取捨）；BAT 會受影響的清單（檔案:行號、要怎麼改、規模）；EXP 驗證計畫（比照 PLAN-016 / EXP-ELECTRON41-001：分支命名、驗證關卡、三平台怎麼驗，含 `macos-acceptance.yml`）；實作 / EXP 工單草案（affects_files、必守規則、驗收）。PLAN-053 文末補〈T0781 結論摘要〉（只摘要、指向本單），狀態維持 IDEA。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單與 PLAN-053；同一 checkout 有 T0782 並行，不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0781 — 研究：Electron 主升級的目標版本

## 元資料

- **工單編號**：T0781
- **類型**：research
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-02T14:28:11+0800
- **預估規模**：M

## 研究目標

PLAN-053 已調為 high。T0779 先在 41 線內升到最後一版 41.10.7，但 41 線已停止更新，BAT 需要升到仍在維護的大版本。T0668（2026-10-19）查證時維護中的是 42 / 43 / 44，現在 npm `latest` 已是 45.2.1。本單要決定升到哪一版、BAT 要改哪些地方、怎麼驗，產出可以直接開 EXP / 實作工單的計畫。

## 已知資訊

- 目前：Electron 41.10.7、Chromium 146.0.7680.216、Node 24.18.0、ABI 145（T0779）。
- 原生模組：`@lydell/node-pty`、`@kutalia/whisper-node-addon` 直接用上游 prebuilt，目前不需要針對 Electron 重建（CLAUDE.md「Electron Runtime」）。
- BUG-164：Chromium 146 遇 Graphite `kOutOfOrderRecording` 直接 CHECK 崩潰；Chromium 147 起改成 GPU 程序重啟；macOS 目前預設 `--disable-skia-graphite`（T0669）。
- 前例：PLAN-016 以 EXP-ELECTRON41-001 驗證後才升 28 → 41。

## 調查範圍

見 frontmatter `memory_overrides` 的問題 ①–⑥。

## 互動規則

- yolo：不問使用者；判讀問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
