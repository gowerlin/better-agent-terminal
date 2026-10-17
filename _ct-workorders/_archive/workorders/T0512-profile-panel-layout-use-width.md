---
schema_version: 1
schema_kind: workorder
id: T0512
title: "Profile（配置）對話框版面：remote 卡片展開內容不留空白左欄、善用寬度，對話框加寬（BUG-122）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T02:41:26+0800"
started_at: "2026-10-14T02:42:35+0800"
updated_at: "2026-10-14T02:51:03+0800"
completed_at: "2026-10-14T02:51:03+0800"
target_version: "0.6.0-pre.6"
related:
  - BUG-122
  - "T0413（PLAN-037 F，RemoteToolsEntry 掛入 ProfilePanel）"
  - "使用者截圖 D:\\Downloads\\2026-10-14_023824.jpg"
affects_files:
  - src/components/ProfilePanel.tsx
  - src/components/profiles/
  - src/components/remote-tools/
  - src/styles/
  - src/components/__tests__/
  - e2e/
  - _ct-workorders/T0512-profile-panel-layout-use-width.md
  - _ct-workorders/BUG-122-profile-panel-remote-card-empty-left-column.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **與 T0511 並行**：T0511 正在改 `src/components/setup-wizard/**`、`src/locales/**`、`electron/remote/ssh-*`。本單**不得修改**這些路徑；`git commit` 只 stage 本單檔案（`git commit --only` 或精準 `git add`），不得把 T0511 的 WIP 帶進來。若需要新增 i18n 字串，改用既有 key；真的必要時回報區列出，由塔台排在 T0511 之後補。"
  - "🔴 `RemoteToolsPanel` 也用於 setup wizard 完成頁（`host='wizard'`）：本單改動不得改變 wizard 內的呈現；若改的是共用元件，以 `host` 區分或只改 profile 端的容器樣式，並以截圖證明 wizard 不變。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；截圖 / e2e 一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。"
---

# T0512 — Profile 對話框善用寬度（BUG-122）

## 背景

使用者回報（截圖 `D:\Downloads\2026-10-14_023824.jpg`，請先看圖）：「配置」對話框的 remote 卡片展開後，「遠端 AI 工具」面板只佔右半，左側一整欄空白。使用者原話：「左邊空白無用？請善用空間或整個 Dialog Width x2」。

## 任務

1. 找出左欄空白的根因（卡片 grid / flex 欄位配置、`expandedExtras` 被放進第二欄等），回報區寫明
2. 修版面，讓展開內容橫跨卡片全寬，不留空白欄
3. 對話框寬度：在合理範圍內加寬（使用者提議 ×2，視窗寬度不足時要能縮回，不得出現水平捲軸）。加寬後若「遠端 AI 工具」的工具清單適合排成多欄（例如必要 / 建議兩欄，或工具卡片 grid），可一併做；判斷依據與取捨寫在回報區
4. 本機卡片、遠端多張卡片、窄視窗（例如 800 px 寬）三種情況都不能變差

## 驗證

- 單元測試：若既有 `src/components/__tests__/remote-tools-entry-points.test.tsx` 等有涉及結構，維持通過；版面的關鍵 class / 結構可加斷言
- **截圖證據**：隔離實例（source build，`npx vite build`）以 Playwright 開「配置」對話框，造一個 remote profile 並展開（`RemoteToolsEntry` 的偵測結果可 mock / 以 IPC stub 提供，不需真遠端），修改前 / 後各截一張（寬視窗 + 800 px 窄視窗）；另截 setup wizard 完成頁證明不變。截圖路徑列在回報區
- `npx vite build` exit 0、`npm run typecheck` = 0、相關 unit test 通過

## 驗收條件

- [x] 左欄空白消失，展開內容用滿寬度
- [x] 對話框加寬且窄視窗不出現水平捲軸
- [x] wizard 完成頁呈現不變（截圖）
- [x] 未改 T0511 範圍檔案；commit 只含本單檔案
- [x] BUG-122：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-122、截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**狀態：DONE**（驗收 5 項全過；commit 見下）

#### 1. 根因

T0288（PLAN-007 C-7）新增的 `ProfileCard` 使用 `profile-card` / `profile-card-header` / `profile-card-toggle` / `profile-card-info` / `profile-card-badge` / `profile-card-body` 等 class，**但 `src/styles/` 從未定義這些 class 的 CSS**（`git log -S"profile-card-header"` 只有 6b7670c 這一筆）。卡片根元素同時帶舊的 `profile-item`，而 `.profile-item` 是 `display: flex`（**row**）+ `align-items: center` + `justify-content: space-between`，於是：

- 卡片的兩個子元素 `.profile-card-header` 與 `.profile-card-body`（`expandedExtras` + details）被**左右並排**成兩欄
- header 自己沒有 flex，toggle / 名稱 / 時間 / 狀態點各佔一行；並因 `align-items: center` 被垂直置中在很高的展開卡片中段，捲到可視範圍外 → 使用者看到的就是「左欄空白、右邊才是遠端 AI 工具」
- 對話框本身 `.settings-panel { width: 450px }`，inline `maxWidth: 520` 只是上限，實際 450px

修改前量測（寬視窗 1600px）：卡片 406px，展開 body 只有 238px、左緣比 header 右偏 144px，header top = 958px（body top = 437px）。

#### 2. 修改

| 檔案 | 內容 |
|---|---|
| `src/styles/settings.css` | ① `.settings-panel.profile-panel { width: min(1040px, 90vw) }`（520 × 2；窄視窗依 90vw 縮回，`.settings-panel` 原有 `max-width: 90vw` 保留）② `.profile-card` 改 `flex-direction: column` + `align-items: stretch`：header 在上、body 在下橫跨全寬 ③ `.profile-card-header` 成為一列（toggle / 名稱+badge+meta / 狀態點 / 動作鈕），toggle、badge、meta（ellipsis）、狀態點補樣式 ④ `.profile-card-body` `min-width: 0` ⑤ 順帶補 `profile-details*`（T0288 details slot，同樣從未有 CSS，以前是 16px 大字堆疊）：12px、label / value 兩欄 grid、Docker mounts 表格 |
| `src/styles/remote-tools.css` | **只限 `.remote-tools-panel--profile`**：每個 tier 的工具清單改為 `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`（寬 1040 對話框約 3 欄、800px 視窗 2 欄、更窄 1 欄），row `min-width: 0` 讓長路徑照舊 ellipsis。wizard（`--wizard`）與遠端視窗沿用共用的單欄 `.remote-tools-list` |
| `src/components/ProfilePanel.tsx` | 主對話框 `className="settings-panel profile-panel"`，移除 inline `maxWidth: 520`（唯一的一行 TSX 改動；子對話框不動） |
| `src/components/__tests__/remote-tools-entry-points.test.tsx` | +2 測試：展開卡片子元素為 `[profile-card-header, profile-card-body]`、面板在 body 內且帶 `remote-tools-panel--profile`、對話框帶 `profile-panel`；CSS source guard（`.profile-card` column、`.profile-card-header` flex、`.settings-panel.profile-panel` 寬度、grid 只掛在 `--profile`、`remote-tools.css` 不出現 `--wizard`、共用 `.remote-tools-list` 仍 column） |
| `e2e/t0512-profile-panel-layout.spec.ts`（新） | 隔離實例 source build；main 端 stub `remote:detect-tools`；造 WSL + SSH 兩個 remote profile；寬 1600 / 窄 800 截圖並量測。第二個 test 以 main 端 stub 16 個 WSL wizard channel 跑完 WSL wizard 到完成頁截圖（distro 名含空白，keep-alive sync 不會 spawn `wsl.exe`），並斷言 wizard 工具清單仍是 `display: flex` 單欄 |

**多欄取捨**：選「每個 tier 內的工具卡片 grid」而非「必要 / 建議兩欄並排」。理由：tier 數量不均（必要 2、建議 2、可選 4、前置條件 2），tier 並排會造成高度參差、閱讀順序跳動；卡片 grid 保留 tier 由上而下的順序，寬度不足時自然退回 1 欄，不需 media query。grid 只掛在 profile host，wizard 完成頁（`maxHeight: 45vh` 捲動區）不受影響。

#### 3. 驗證證據

| 關卡 | 結果 |
|---|---|
| `npx vite build` | exit 0（修改前、修改後各一次） |
| `npm run typecheck` | exit 0 |
| `npx vitest run src/components/__tests__ src/components/profiles src/components/remote-tools` | 7 files / 91 tests passed（`remote-tools-entry-points.test.tsx` 12/12，含新增 2） |
| e2e `npx playwright test e2e/t0512-profile-panel-layout.spec.ts`（修改前 build） | layout test **FAIL**（預期，重現 BUG：`toggleRowGap` 28px、body 238/406px 偏右）；wizard test PASS |
| e2e 同上（修改後 build） | **2 passed** |

修改後量測：寬視窗對話框 1040px、卡片 996.7px、展開 body 971.3px 且左緣與 header 對齊、body 位於 header 下方；窄視窗（800px）對話框 720px（= 90vw）、卡片 676.7px、body 651.3px；兩種寬度 `document` 與 `.settings-body` 水平溢出皆 0（無水平捲軸）；本機卡片 toggle 與名稱同列（中心差 < 0.001px）。

**wizard 完成頁不變**：修改前後 `wide-wizard-complete.png` / `narrow-wizard-complete.png` **sha256 完全相同**（`4c099a8c…` / `ed019acd…`），工具清單 `display: flex`、單欄。

**截圖**（`C:\Users\Gower\AppData\Local\Temp\bat-t0512\evidence\`，`before-*` / `after-*` 各 8 張）：

- `{before,after}-wide-wsl-expanded.png`、`{before,after}-wide-two-remote-expanded.png`、`{before,after}-wide-local-card.png`
- `{before,after}-narrow-wsl-expanded.png`、`{before,after}-narrow-two-remote-expanded.png`、`{before,after}-narrow-local-card.png`
- `{before,after}-wide-wizard-complete.png`、`{before,after}-narrow-wizard-complete.png`

#### 4. 範圍與限制

- 未修改 T0511 範圍（`src/components/setup-wizard/**`、`src/locales/**`、`electron/remote/ssh-*`）；未新增 i18n 字串。commit 以 `git commit --only` 只含本單檔案，T0511 的 WIP（含 `e2e/pre5-ssh-alias.spec.ts`、`electron/**` 測試）未帶入。
- 截圖 / e2e 皆為隔離實例（`--runtime=e2e-t0512-*`，`BAT_REMOTE_PORT` 為隨機埠），結束後 userData 已刪、Terminal Server 已關；未碰 9876 / 真實 userData；未消耗 Claude token。
- source build 時 working tree 含 T0511 WIP（共用 build），對本單版面無影響。
- 未跑全套 e2e（L141）；未 push。
- wizard e2e 依賴 WSL wizard 的 channel 名稱與回傳格式（stub 表在 spec 內）；日後 WSL 步驟改 IPC 時需同步更新 stub。

#### 5. Landing Zone Check

PASS — C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 informational（`src/components/ProfilePanel.tsx` 等存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

#### 6. Commit

`277b369` fix(profiles): T0512 profile dialog uses full width (BUG-122)（7 檔，`git commit --only`）；本收尾 metadata 另一筆 chore commit；不 push。

## 塔台裁決（2026-10-14 02:51，第五十九 session）

- 接受 DONE：commit `277b369` 7 檔與回報一致、未含 T0511 WIP；塔台目視 `after-wide-wsl-expanded.png` 確認左欄空白消失、工具卡片 grid
- 全套 unit / typecheck:electron 未在本單跑（只跑相關 91 tests + typecheck src）→ 併入 T0511 完成後的塔台聯合複驗
