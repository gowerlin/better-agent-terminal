---
schema_version: 1
schema_kind: workorder
id: T0827
title: "PLAN-064：Linux 介面是中文而系統沒有中文（或 emoji）字型時，啟動提示一次並附安裝指令"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T08:56:22+0800"
updated_at: "2026-11-04T09:05:09+0800"
completed_at: "2026-11-04T09:05:09+0800"
session_ids:
  - "6c69e2bd-659f-43da-8a62-18be7587e753"
depends_on: []
related:
  - "PLAN-064；D270 / D271；T0826（`83f1d5bf`，README / site/install `#linux-fonts` / faq 的字型說明）；T0802（語音可用性事先檢查，背景短命檢查＋三態的範本：`electron/voice-availability.ts`、`src/lib/voice-availability.ts`）"
affects_files:
  - _ct-workorders/T0827-linux-cjk-font-hint.md
  - electron/linux-font-check.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/lib/linux-font-hint.ts
  - src/components/LinuxFontHint.tsx
  - src/App.tsx
  - src/stores/settings-store.ts
  - src/types/index.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/lib/__tests__/
  - src/components/__tests__/
  - docs/agent-guide/linux-cjk-font-hint.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - site/install.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只有 Linux 主機執行檢查與提示；Windows / macOS 的行為、啟動流程、日誌完全不變（不 spawn、不註冊會改變行為的東西；IPC 可以註冊但回 `not-linux`）。"
  - "🔴 不自帶字型、不改任何 CSS `font-family`、不改 xterm 字型設定（D270）。不阻擋任何功能，只提示。"
  - "🔴 Child Process 規則照 CLAUDE.md：`execFile` ＋陣列參數＋ timeout（≤ 5 s），不經 shell；`fc-list` 不存在 / 逾時 / exit ≠ 0 / 輸出無法解析 → `unknown`，絕不提示。主行程不得在 import 期或 app ready 前執行檢查。"
  - "🔴 Dialog / 通知規則照 CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」：若用 Dialog 一律 `ModalOverlay`＋[X]＋`onEscape`；用 toast 則沿用既有 toast 元件。不得用 `window.alert` / `confirm`。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。可能與 T0828 / T0831（唯讀研究單，只寫自己的工單檔）同時在 main 執行：commit 一律 `git add <明確路徑>`，不用 `git add -A` / `.`。"
---

# T0827 — Linux 缺中文字型時的啟動提示（PLAN-064）

## 元資料

- **工單編號**：T0827
- **類型**：implementation
- **狀態**：DONE
- **建立時間**：2026-11-04 08:52 (UTC+8)
- **intervention_type**：context-dependent
- **預估規模**：M；Context Window 風險：中
- **降級策略**：先完成「主行程檢查＋IPC＋提示」，文件 / CLAUDE.md 可最後補；做不完回 PARTIAL 並寫明剩餘項

## 規格層級自問

- 目標層：執行（規格見下）
- 決策權：Worker 可決定檔名、元件形式（toast 或 Dialog）、IPC 名稱、`fc-list` 的確切查詢；不可改「只 Linux」「unknown 不提示」「不自帶字型」
- 資訊完整度：足夠；`affects_files` 是預估，實際檔名可依既有慣例調整（例如把狀態放進既有 store），回報區列實際檔案
- 回頭成本：A
- 記憶覆蓋：見 frontmatter

## 任務指令

### 前置條件
- `_ct-workorders/PLAN-064-linux-missing-cjk-font-hint.md`
- `CLAUDE.md`「語音輸入可用性事先檢查（T0802，D247）」節與 `docs/agent-guide/voice-availability.md`（背景檢查、三態、只在記憶體的範本）
- `CLAUDE.md`「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節、「Child Process Spawning」節、「CLAUDE.md 撰寫規則（T0595）」節
- `site/install.md` `#linux-fonts` 段（T0826）

### 輸入上下文

使用者在 WSL（Ubuntu 24.04，WSLg）執行 AppImage，系統沒有中文與 emoji 字型，介面中文與圖示全是方框，看不懂也不知道原因（D270）。文件已由 T0826 補上；本單讓 BAT 自己發現並提示。

### 規格

1. **檢查**（主行程，只 Linux）：app ready 後延遲數秒（比照 T0802 的 5 s）背景執行一次，每次啟動一次，結果只在記憶體。
   - 中文：`fc-list` 查 `:lang=zh`（或更精確的 `zh-tw` / `zh-cn`，Worker 實測決定）是否有任何字型。
   - emoji：查是否有 emoji 字型（例如 `fc-list ':charset=1f600'` 或 family 含 emoji，Worker 決定並寫進 docs）。
   - 結果：`ok` / `missing`（缺中文、缺 emoji 各自一個布林）/ `unknown`（原因：not-linux、no-fc-list、timeout、failed）。
2. **提示**（renderer，主視窗）：只有「主機是 Linux＋目前介面語言是中文（zh-TW / zh-CN）＋結果是缺中文字型」時顯示；只缺 emoji 時是否提示由 Worker 決定（建議：介面語言不限，但同一則提示合併列出），寫進回報。
   - 缺中文字型時中文本身顯示不出來 → 提示文字**英文在前、中文在後**（兩種都放），附可複製的指令 `sudo apt update && sudo apt install -y fonts-noto-cjk fonts-noto-color-emoji`、裝完要完全關閉 BAT 重開、說明連到網站 `install#linux-fonts`（若既有外部連結開法可用）。
   - 「不再提示」：持久化到 settings（例 `linuxFontHintDismissed`），之後不再出現；字型裝好後自然不出現。
   - detached 視窗、遠端 profile 視窗不重複顯示（只本機主視窗一次）。
3. **日誌**：`[font-check] …` 只記結果與原因、耗時，不記字型清單全文。
4. **不回歸**：非 Linux 完全不變；`unknown` 不提示；不改字型 / CSS。

### 預期產出
- 主行程檢查模組＋IPC＋preload 型別；renderer 提示元件與 settings 欄位；三語 i18n（en / zh-TW / zh-CN）
- 單元測試：檢查結果解析（ok / missing / unknown 各原因、逾時）、非 Linux 不 spawn、顯示條件（語言 × 結果 × 已關閉）
- `docs/agent-guide/linux-cjk-font-hint.md`（規則、判斷、日誌、已知限制、驗證清單）＋ `docs/agent-guide/README.md` 索引
- `CLAUDE.md` 新增一節（3–12 行，照 T0595 規則：用途、必守規則、唯一實作位置、連到 docs）
- `site/install.md` `#linux-fonts` 段補一句「BAT 偵測到缺字型時會提示」；`CHANGELOG.md` `[Unreleased]` 一條

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- [ ] `npm run test:unit` 全過（回報檔數 / 測試數）
- [ ] `npx vite build` 成功
- [ ] 非 Linux 路徑有測試證明不 spawn、不提示
- [ ] Windows 本機啟動 BAT 開發版（若可行）或以測試證明行為不變；Linux 實機（WSL 無字型 / 有字型）若 Worker 環境可做則做並記錄，做不到就寫進回報〈待實機驗收〉由塔台安排
- [ ] commit 只含本單範圍

## Sub-session 執行指示

1. 讀取本工單全部內容，更新開始時間
2. 載入前置條件
3. 依規格實作、測試、文件
4. 驗證後 commit，填回報區、更新狀態與完成時間

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE
- **commit**：`93c6507a` feat: Linux missing CJK / emoji font hint (T0827)
- **session_id**：6c69e2bd-659f-43da-8a62-18be7587e753
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/main.ts` 等既有）；無 `branch` 欄位（C-2 不適用）；無 `CT_HOME`（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- **模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；未向塔台提問

### 產出摘要

**檢查（主行程，`electron/linux-font-check.ts`）**
- `app.whenReady` 內 `startVoiceAvailabilityCheck()` 之後 `registerLinuxFontCheckHandlers(getAllWindows)` → `startLinuxFontCheck()`，5 s 後（`unref`）跑一次，結果只在記憶體。
- 兩個查詢平行：中文 `fc-list :lang=zh family`、emoji `fc-list :charset=1f4e8 family`；`execFile` ＋陣列參數＋ 5 s timeout＋`windowsHide`，不經 shell。
- **emoji 查 U+1F4E8 而非 U+1F600**（Worker 決定）：WSL 實測 DejaVu Sans 涵蓋 U+1F600（表情區），只有 DejaVu 的系統會誤判為有 emoji；U+1F4E8 / 1F4C1 / 1F50D / 2705 只有 Noto Color Emoji 有。
- **中文查 `:lang=zh`**（Worker 決定）：實測與 `zh-tw` / `zh-cn` 結果相同（15 face），範圍較寬（任何中文字型都算）。
- 三態：`ok` / `missing`（`cjk`、`emoji` 兩個布林＋face 數）/ `unknown`（`pending` / `not-linux` / `no-fc-list` / `timeout` / `failed`；exit ≠ 0、訊號、其他 spawn 錯誤、輸出 > 1 MiB、含 NUL 皆 `failed`）；任一查詢失敗整體 `unknown`。
- 非 Linux：IPC 照樣註冊、回 `unknown(not-linux)`，`schedule` / `check` / `claimHint` 都不 spawn、不記日誌。
- IPC（本機 `ipcMain.handle`）：`font-check:get`、`font-check:claim-hint`（每次啟動只給第一個視窗 true）、推送 `font-check:changed`。

**提示（renderer，`src/components/LinuxFontHint.tsx`）**
- Dialog：`ModalOverlay`＋[X]＋`onEscape`（= 關閉）。標題 / 按鈕 `English / 中文`，本文英文段在前、介面語言段在後；指令可選取＋「Copy / 複製」；「裝好後完全關閉 BAT 再重開」；「Details / 說明」經 `shell.openExternal` 開 `https://gowerlin.github.io/better-agent-terminal/install#linux-fonts`；「Don't show again / 不再提示」寫 `linuxFontHintDismissed: true`。
- 顯示條件（`linuxFontHintItems`）：缺中文只在介面語言 zh-* 時列；**缺 emoji 不限語言、同一則合併列出**（採工單建議，Worker 決定）；指令只列缺的套件（`fonts-noto-cjk` / `fonts-noto-color-emoji`）。
- 只本機主視窗：App.tsx `enabled={profileReady && !detachedWorkspaceId && !windowBoundToRemote && !isRemoteConnected}`（新 state `windowBoundToRemote` 在 `initProfile` 遇到 remote profile 時設定，連線成功或失敗都算）；再經主行程 `claimHint()` 保證每次啟動只一個視窗。

**日誌**：`[font-check] ok|missing cjk=… emoji=…|unknown(<reason>) in N ms (cjk faces=…, emoji faces=…)`、`[font-check] hint handed to a window`；renderer `[font-check] hint shown: …` / `hint dismissed …`。只記 face 數，不記字型清單。

**實際異動檔案**（與 `affects_files` 一致，無額外檔案）
- 新增：`electron/linux-font-check.ts`、`src/lib/linux-font-hint.ts`、`src/components/LinuxFontHint.tsx`、`electron/__tests__/linux-font-check.test.ts`、`src/lib/__tests__/linux-font-hint.test.ts`、`src/components/__tests__/linux-font-hint.test.tsx`、`docs/agent-guide/linux-cjk-font-hint.md`
- 修改：`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、`src/stores/settings-store.ts`、`src/types/index.ts`、`src/locales/{en,zh-TW,zh-CN}.json`（`linuxFontHint.*`）、`docs/agent-guide/README.md`、`CLAUDE.md`（新節「Linux 缺中文字型的啟動提示（PLAN-064 / T0827）」，6 行；CLAUDE.md 75,737 字元）、`site/install.md`（`#linux-fonts` 補一段）、`CHANGELOG.md`（`[Unreleased]` › Added 一條）

**驗收條件**
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- [x] `npm run test:unit`：409 檔 passed / 2 skipped（411）；7176 tests passed / 38 skipped（7214）。新增 3 檔共 52 個測試：`electron/__tests__/linux-font-check.test.ts` 14、`src/lib/__tests__/linux-font-hint.test.ts` 20（含語言 × 結果矩陣）、`src/components/__tests__/linux-font-hint.test.tsx` 18；`dialog-escape` / `dialog-no-outside-close` source guard 通過
- [x] `npx vite build` 成功
- [x] 非 Linux 路徑：`linux-font-check.test.ts`「not Linux」對 win32 / darwin 驗證 `schedule` 不排程、`check` 不呼叫 execFile、`claimHint` false、日誌 0 行；元件測試驗證 `not-linux` 不提示、不 claim
- [x] Windows：以測試證明行為不變（未在 BAT 內另啟開發版，避免干擾本機執行中的 BAT）；Linux：WSL Ubuntu 24.04 以 esbuild 打包真模組 harness 實測（見下）；AppImage 實機 UI 列〈待實機驗收〉
- [x] commit 只含本單範圍（`git add <明確路徑>`，未用 `-A`）

**Linux 實測（WSL Ubuntu-24.04，fontconfig 2.15.0，真 `child_process.execFile`）**

| 情境 | 結果 |
|---|---|
| 已裝 Noto CJK / Color Emoji | `[font-check] ok in 17 ms (cjk faces=15, emoji faces=1)` |
| `FONTCONFIG_FILE` 只含 dejavu（模擬 WSL 預設） | `[font-check] missing cjk=true emoji=true in 9 ms` |
| `FONTCONFIG_FILE` 無字型目錄 | `[font-check] missing cjk=true emoji=true in 7 ms` |
| `PATH=/nonexistent` | `[font-check] unknown(no-fc-list) in 3 ms` |

**待實機驗收**（塔台安排）
1. Linux AppImage（WSL 無中文 / emoji 字型、zh-TW 介面）：啟動約 5 s 後出現提示、英文段可讀、Copy 可用、Details 開網站、「不再提示」後重開不再出現。
2. 裝好字型完全重開後不出現（debug log `[font-check] ok …`）。
3. 英文介面＋只缺中文字型不出現；英文介面＋缺 emoji 出現英文提示。
4. Windows / macOS 啟動 debug log 沒有任何 `[font-check]` 行。

### 互動紀錄

- [08:56] 開工；yolo、未提問。
- [09:00] Worker 決定（工單授權範圍內）：中文查 `:lang=zh`、emoji 查 U+1F4E8（WSL 實測 DejaVu 涵蓋 U+1F600）；元件用 Dialog；缺 emoji 不限語言並合併列出；指令只列缺的套件。

### Renew 歷程

（無）

### 遭遇問題

- 元件測試第一版在 `beforeEach` 先呼叫 `settingsStore.setLinuxFontHintDismissed` 而 `window.electronAPI` 尚未 stub，產生 unhandled rejection；改為先 stub 再設定後通過（只影響測試）。
- 工作區另有 T0828 / T0831 Worker 同時在 main 執行，各自已 commit 自己的工單檔；本單 commit 用明確路徑，未觸及它們。

### 回報時間

2026-11-04T09:05:09+0800
