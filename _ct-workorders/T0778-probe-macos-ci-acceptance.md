---
schema_version: 1
schema_kind: workorder
id: T0778
title: "探路：用 GitHub Actions macOS runner 對 `v0.7.3-pre.5` 安裝檔驗 BUG-128（Finder 複製檔案 Command+V）/ BUG-130（mac 終端貼圖）"
type: research
status: DONE
started_at: "2026-11-02T10:49:58+0800"
updated_at: "2026-11-02T11:09:30+0800"
completed_at: "2026-11-02T11:09:30+0800"
session_ids:
  - "57fae901-24d7-44e1-8c8a-751a157179d0"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T10:46:22+0800"
depends_on: []
related:
  - "BUG-128（T0522，`electron/clipboard-file-paths.ts`、IPC `clipboard:read-file-paths`）、BUG-130（T0524，終端貼圖鍵：mac / Linux Ctrl+V `\\x16`、Windows Alt+V `\\x1bv`）；兩張都是 FIXED、待 mac 實機驗收"
  - "既有 e2e：`e2e/t0524-terminal-image-paste.spec.ts`（Windows 隔離實例）、`e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）、`e2e/fixtures/fake-anthropic-api.ts`（假模型，T0736 用法）"
  - "CI：`.github/workflows/pre-release.yml`（macOS 打包用 `macos-15`）、`tests.yml`；CLAUDE.md「Packaging / Release 前置檢查」「Release」節"
affects_files:
  - ".github/workflows/macos-acceptance.yml（新增，只能 `workflow_dispatch`）"
  - "e2e/macos/**（新增：probe / 情境 spec 與輔助腳本，檔名可調）"
  - "docs/agent-guide/macos-ci-acceptance.md（新增）、docs/agent-guide/README.md（索引加一行）"
  - _ct-workorders/T0778-probe-macos-ci-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目的：先回答「macOS runner 能不能做」，再把做得到的部分跑成 BUG-128 / 130 的驗收證據。結案與否由塔台依 R-G003 判斷，Worker 不改 BUG 單狀態。"
  - "🔴 驗收對象：GitHub Release `v0.7.3-pre.5` 的 macOS arm64 dmg（用 `gh release download v0.7.3-pre.5 -R gowerlin/better-agent-terminal` 下載，先比對 release 的 SHA-256 digest），掛載後把 `.app` 複製到暫存目錄執行，`BAT_E2E_EXECUTABLE` 指到 `.app/Contents/MacOS/<執行檔>`。需要時可 `xattr -dr com.apple.quarantine`（只對複製出來的那份）。🔴 不從 source build 打包、不改產品程式碼（`src/` / `electron/` / `scripts/` 不動）、不改 `e2e/fixtures/**`（需要的 helper 寫在 `e2e/macos/` 內）。"
  - "🔴 workflow 規則：新檔 `.github/workflows/macos-acceptance.yml`，只有 `workflow_dispatch`（可帶 `version` 輸入，預設 `0.7.3-pre.5`）；`permissions: contents: read`；runner `macos-15`（標準 runner，公開 repo 免費；🔴 不用 larger / 付費 runner）；`timeout-minutes` ≤ 30；不使用任何 secret（gh 下載 release 用內建 `GITHUB_TOKEN` 即可）；log、截圖、報告以 artifact 上傳（`retention-days: 7`），🔴 artifact 與 log 不得含權杖、`server-token.json` 內容或整個 env。🔴 不改 `pre-release.yml` / `release.yml` / `tests.yml` / `pages.yml` / `build-server-bundle.yml`，也不把新 workflow 接進發版流程。"
  - "🔴 Probe（每項記 PASS / FAIL / 不可行＋證據，寫進回報〈可行性表〉）：P1 runner 上能啟動安裝版隔離實例並截圖（有沒有圖形環境）；P2 不經 Finder，以 `osascript -l JavaScript`（ObjC bridge，`NSPasteboard` 寫 `NSURL` 檔案 URL，單檔與多檔各一次）寫剪貼簿，記錄剪貼簿實際有哪些類型（例 `public.file-url`、`NSFilenamesPboardType`），並說明與真的 Finder 複製可能的差異；另試一次 AppleScript 叫 Finder 複製（`tell application \"Finder\"`），記錄是否被自動化權限擋下（擋下即記『不可行』，不得嘗試繞過 TCC）；P3 Playwright 送 `Meta+V` 到終端分頁 → PTY 收到什麼（期望：完整路徑，含空白時加引號或跳脫，與 BUG-128 預期一致）；P4 以 `osascript` System Events `keystroke \"v\" using command down` 送作業系統層按鍵，記錄是否被輔助使用權限擋下（擋下即記『不可行』，🔴 不得修改 TCC.db 或用其他手段繞過權限）；P5 剪貼簿放一張圖（例 `osascript` 或隔離實例 main 的 Electron `clipboard.writeImage`）→ 終端分頁按 `Control+V`（Playwright；P4 可行時再加一次作業系統層）→ PTY 收到 `\\x16`；同時確認 Command+V 在有圖時的行為（依 T0524 規格）。"
  - "🔴 情境（P1 可行才做）：BUG-128 ①單檔、②多檔、③路徑含空白、④剪貼簿是純文字時 Command+V 照常貼文字（不回歸）；BUG-130 mac ⑤有圖 Ctrl+V → `\\x16`、⑥有檔案 → 貼路徑、⑦純文字 → 一般貼上。選做 ⑧：安裝版內嵌的 claude CLI ＋ `fake-anthropic-api`（比照 T0736 的作法，對外模型請求必須為 0）在終端分頁按 Ctrl+V，確認 CLI 輸入列出現圖片佔位（例 `[Image #1]`）；做不到記原因、PARTIAL。"
  - "🔴 試跑上限：`workflow_dispatch` 總共最多 8 次 run；每次 run 前先在本機跑得到的部分（語法、TypeScript 單檔檢查）先過。8 次內仍有 probe 判不出來 → 停止、照實回報。觸發與查看一律 `gh … -R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 push 授權（使用者 2026-11-02 同意開探路單，workflow_dispatch 需要 workflow 檔在預設分支）：允許 `git push origin main`（fast-forward，不得 force），每次 push 前依 `_local-rules.md`「公開 repo 去識別化（D176）」跑 `.private/` 的檢查樣式與金鑰樣式掃描（要推的 commit 與追蹤檔），有命中先停下問塔台。push 會一併帶上塔台的 `(ct)` commit 與並行的 T0777 已 commit 的檔案，屬預期。只 commit 自己的檔案（`git commit --only`）。🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）、禁止 force push、不建 tag、不發版、不改 CHANGELOG / release-note / README。"
  - "🔴 並行：T0777 同時在本機跑 e2e（隔離實例）。本單本機只做輕量檢查，🔴 不在本機跑 `npx vite build`、不跑整批 e2e、不啟動 BAT 隔離實例；不動 T0777 的檔案（`e2e/t0777-*`、`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/dialog-close-and-escape.md`）。"
  - "🔴 docs：新增 `docs/agent-guide/macos-ci-acceptance.md`（怎麼觸發、每個 probe 的結果與限制、哪些仍需真人 Mac），`docs/agent-guide/README.md` 索引加一行。不改 CLAUDE.md（是否補一節由塔台決定）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 secret、付費 runner、改發版 workflow、或任何 TCC 繞過 → 一律先問塔台。"
---

# T0778 — 探路：GitHub Actions macOS runner 驗 BUG-128 / 130

## 元資料

- **工單編號**：T0778
- **類型**：research（探路＋做得到的部分直接跑驗收）
- **優先級**：P2
- **建立時間**：2026-11-02T10:46:22+0800
- **預估規模**：M

## 背景

BUG-128（mac：Finder 複製的檔案 Command+V 貼不進終端，T0522）與 BUG-130 的 mac 部分（終端貼圖鍵，T0524）都已修正並發佈多版，但一直等外部 Mac 使用者實機驗收。使用者問能否改用 GitHub Actions 的 macOS runner 自動驗（2026-11-02 第一百零四 session 重啟（四）），塔台評估「大致可行、需要先探路」，使用者同意開本單。

主要的不確定：runner 的圖形環境、剪貼簿寫入能否代表 Finder 複製、Playwright 的 Command+V 是否走到和實體按鍵相同的路徑、System Events 按鍵與 Finder 自動化會不會被 macOS 權限（TCC）擋下。

## 範圍

1. 新增只能手動觸發的 `macos-acceptance.yml` 與 `e2e/macos/` spec。
2. Probe P1–P5，寫〈可行性表〉。
3. 可行的部分跑情境 ①–⑦（⑧ 選做）。
4. docs 新檔＋索引。

## 不做

- 不改產品程式碼、共用 fixture、既有 workflow。
- 不繞過 macOS 權限（TCC）。
- 不改 BUG 單狀態、不發版。

## 驗收

- [x] 〈可行性表〉P1–P5 各有結果與證據（run 連結、artifact 名稱）
- [x] 情境 ①–⑦（⑧ 選做）逐項 PASS / FAIL / PARTIAL / 不可行，寫明是 Playwright 按鍵還是作業系統層按鍵、剪貼簿是腳本寫入還是 Finder
- [x] 〈與真人 Mac 實機的差異〉：哪些結論可以代表實機、哪些不行
- [x] 〈建議〉：塔台可否據此結案 BUG-128 / 130，或還缺什麼
- [x] workflow run 次數（≤ 8）、push 的 commit 範圍與去識別化掃描結果

---

## 回報區

### 完成狀態

- **狀態**：DONE（探路結論：macOS runner 可以做；情境 ①–⑦ 與選做 ⑧ 全部 PASS）
- **完成時間**：2026-11-02T11:09:30+0800
- **session_id**：57fae901-24d7-44e1-8c8a-751a157179d0
- BUG-128 / BUG-130 的狀態未改（依工單，由塔台依 R-G003 判斷）。

### 結論摘要

GitHub Actions `macos-15` runner 有登入的 Aqua 圖形工作階段，對 Finder 送 Apple Events、System Events 送鍵、螢幕截圖都沒被 TCC 擋（runner 映像本身的授權，本單沒有動任何權限）。所以三種最接近實機的條件都做得到：**發佈的 dmg 安裝版**＋**Finder 自己放上剪貼簿的檔案**＋**作業系統層的 Command+V / Control+V**。Run #2 中 BUG-128 ①②③④、BUG-130 ⑤⑥⑦（加 ⑤b）全部 PASS，共 60 次按鍵 0 失敗；⑧ 安裝版內嵌 claude CLI 2.1.316 在 Ctrl+V 後輸入列出現 `[Image #1]`，模型 API 外連 0。

### 可行性表

Run：[41380866131](https://github.com/gowerlin/better-agent-terminal/actions/runs/41380866131)（run #2，以此為準）；artifact `macos-acceptance-0.7.3-pre.5-attempt1`（7 天，至 2026-11-09）。runner：macOS 15.8.2（24H232）arm64、`launchctl managername` = Aqua、`SHELL=/bin/bash`。受測 app：`v0.7.3-pre.5` arm64 dmg（release digest `sha256:f55331cd…b93f` 比對一致）、`Signature=adhoc`、`spctl` rejected（未公證，直接執行可啟動）。

| Probe | 結果 | 證據 |
|---|---|---|
| P1 啟動安裝版隔離實例並截圖 | PASS | 視窗可見且有焦點；Playwright 截圖 `p1-window.png`；OS `screencapture -x` 拍到整個桌面 `p1-screen.png`（134 KB，含 Dock 與選單列） |
| P2 JXA `NSPasteboard writeObjects`（NSURL）單檔 / 多檔 | PASS | 剪貼簿型別 `public.file-url`、`NSFilenamesPboardType`、`Apple URL pasteboard type` 等；BAT `clipboard:read-file-paths` 回傳正確路徑。與 Finder 的差異：腳本寫的是一般 file URL，Finder 寫的是 file reference URL（`file:///.file/id=…`）＋`com.apple.finder.noderef`、`fndf`、純文字檔名 |
| P2b AppleScript 叫 Finder 選取＋System Events Command+C | PASS（可行） | `tell application "Finder"` exit 0；Finder 選取＋Command+C 後剪貼簿出現 Finder 的型別。沒有被自動化權限擋下 |
| P3 Playwright `Meta+V` | PASS | 6/6，PTY 收到完整路徑，每次 1 個 chunk（沒有重複貼上） |
| P4 System Events `keystroke "v" using command down / control down` | PASS（可行） | 8/8；送鍵前最前景程式 = `BetterAgentTerminal`、Electron 有焦點視窗；沒有被輔助使用權限擋下 |
| P5 剪貼簿放圖 → Control+V / Command+V | PASS | 6/6 收到 `\x16`；圖片來源：BAT main 的 Electron `clipboard.writeImage`、另一個程序寫 `public.png` |

### 情境結果

| # | 情境 | 結果 | 按鍵 | 剪貼簿 | 次數 |
|---|---|---|---|---|---|
| ① | BUG-128 單檔 Command+V → 路徑 | PASS | Playwright＋作業系統層 | 腳本＋Finder | 12/12 |
| ② | BUG-128 多檔 → 以空白分隔 | PASS | Playwright＋作業系統層 | 腳本＋Finder | 12/12 |
| ③ | BUG-128 路徑含空白 → `'…/with space.txt'` | PASS | Playwright＋作業系統層 | 腳本＋Finder | 12/12 |
| ④ | BUG-128 不回歸：純文字 Command+V | PASS | Playwright＋作業系統層 | 腳本（`pbcopy`） | 2/2 |
| ⑤ | BUG-130 有圖 Control+V → `\x16` | PASS | Playwright＋作業系統層 | 腳本（Electron / `public.png`） | 3/3 |
| ⑤b | （加測）T0524 規格：有圖 Command+V → `\x16` | PASS | Playwright＋作業系統層 | 腳本 | 3/3 |
| ⑥ | BUG-130 有檔案 Control+V → 貼路徑 | PASS | Playwright＋作業系統層 | 腳本＋Finder | 12/12 |
| ⑦ | BUG-130 純文字 Control+V → 一般貼上 | PASS | Playwright＋作業系統層 | 腳本（`pbcopy`） | 2/2 |
| ⑧ | 選做：內嵌 claude CLI＋`fake-anthropic-api`，Ctrl+V → `[Image #1]` | PASS | Playwright | 腳本（`public.png`） | 1/1 |

- 「次數」= 按鍵 2 種 × 剪貼簿來源 2 種 × 每種重複 3 次。每次按鍵前以獨立 JXA 讀取確認剪貼簿的檔名清單正好是預期檔案。
- BAT debug log 每次都對應記到 `[terminal-paste] Command+V → paths|text|image` / `Ctrl+V → …`（`debug-paste-lines.log`）。
- ⑧：模型 API 請求 0（假模型也是 0，未送出提示）；被封鎖 proxy 記到 `CONNECT downloads.claude.ai:443`、`CONNECT github.com:443` 各 1 次（claude 啟動檢查，已擋下，沒有離開 runner）。截圖 `s8-claude.png` 可見輸入列 `❯ [Image #1]`。

### 與真人 Mac 實機的差異

可代表實機：發佈的同一個 dmg、真的 macOS 15 Apple Silicon、真的系統剪貼簿、Finder 自己產生的剪貼簿內容（含 file reference URL）、經視窗伺服器的 `keyDown`（含主選單 Paste 快捷鍵是否搶先）。

不能代表、仍需真人 Mac：實體鍵盤與輸入法（注音 / 拼音開著時按 Command+V）、非 US 鍵盤配置、macOS 15 以外的版本、剪貼簿管理工具或全域快捷鍵攔截、其他來源的檔案複製（Path Finder、VS Code、網路磁碟 / iCloud）、中文檔名與大量檔案、zsh（runner 分頁是 bash；兩者在 BAT 都走 posix 引號，預期相同）、登入帳號的真 claude（⑧ 用假模型＋API key）。細節寫在 `docs/agent-guide/macos-ci-acceptance.md`。

### 建議

- BUG-128 與 BUG-130（mac 部分）：本單證據是**交付版 `v0.7.3-pre.5` 在真 macOS 上、Finder 真複製＋作業系統層按鍵**的實測，全數 PASS。依 R-G003「修正已進入客戶交付版，或已在測試環境實測過 → CLOSED」，建議塔台可據此結案，驗證依據寫「交付版 `v0.7.3-pre.5`＋T0778 run 41380866131」。剩下的差異（輸入法、其他 macOS 版本、剪貼簿工具）屬實機環境變因，不是本次修正的邏輯，風險低；若塔台想保留一點保險，可在下次有 Mac 使用者回報時順手確認「注音輸入法開著時 Command+V」一項。
- BUG-130 的 Windows 部分不在本單範圍。
- 後續可選（塔台決定）：① 之後 mac 相關修正可用 `-f version=<新版>` 重跑本 workflow 當回歸；② 加一個中文檔名情境（目前沒測）；③ CLAUDE.md 是否補一節。

### 異動檔案

- `.github/workflows/macos-acceptance.yml`（新增；只有 `workflow_dispatch`、`contents: read`、`macos-15`、`timeout-minutes: 30`、無 secret、artifact 7 天、上傳前刪含權杖樣式的檔案）
- `e2e/macos/t0778-macos-paste-acceptance.spec.ts`（新增）、`e2e/macos/mac-os.ts`（新增：osascript / JXA 輔助）
- `docs/agent-guide/macos-ci-acceptance.md`（新增）、`docs/agent-guide/README.md`（索引加一行）
- 未動：`src/`、`electron/`、`scripts/`、`e2e/fixtures/**`、其他 workflow、CLAUDE.md、T0777 的檔案。

### 驗證證據

- 本機（每次 push 前）：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/macos/*.ts` = 0 錯誤；`npx playwright test e2e/macos/ --list` = 1 test；workflow 以 js-yaml 解析通過（觸發只有 `workflow_dispatch`、permissions `contents: read`）。依工單未在本機跑 vite build、整批 e2e 或隔離實例。
- CI：run #2 `1 passed (2.7m)`，job 約 5 分鐘。

### workflow run 次數

2 / 8：

| # | run | 結果 | 說明 |
|---|---|---|---|
| 1 | [41380312342](https://github.com/gowerlin/better-agent-terminal/actions/runs/41380312342) | failure | P1–P5 都可行；P2、⑥ 一個變體 FAIL 經查是測試腳本問題：JXA 一次寫 2 個 NSURL 後，獨立讀取只看到 1 個 item，BAT 讀到的與剪貼簿一致（BAT 不是錯的）；⑧ 實際有出現佔位，只是 regex 沒算到游標移動畫出的空白 |
| 2 | [41380866131](https://github.com/gowerlin/better-agent-terminal/actions/runs/41380866131) | success | 修正：寫入腳本等到 item 數與檔名數正確才結束、每次按鍵前獨立確認剪貼簿、檔案情境每個變體重複 3 次、⑧ regex 改 `/\[Image\s*#\d+\]/`。全部 PASS |

### push 範圍與去識別化掃描

- push 1：`eb9a41f3..051b053e`（含塔台的 `(ct)` commit、T0777 已 commit 的 `e1e7f2d1` / `954b0348` / `1acc1803`，與本單 `051b053e`）。
- push 2：`051b053e..4ef73ab0`（本單 spec 修正）。
- push 3：本單 docs `083a66ce` 與工單收尾 commit（結案時一起推）。
- 每次 push 前以 `.private/` 的檢查樣式掃要推的 diff：0 命中；金鑰樣式（`sk-ant-`、`ghp_`、`github_pat_`、`AKIA`、`AIza`、`PRIVATE KEY`、`batcap.`）只命中 workflow 裡「刪除含權杖檔案」那一行的 regex 本身（不是金鑰）。追蹤檔整體掃描另有 2 筆既有的 `<claude-mem-context>`（`_ct-workorders/_archive/state-snapshots/2026-Q4-b.md`、`_ct-workorders/_archive/workorders/T0676-deidentify-public-records.md`，是 T0676 的紀錄被歸檔後排除路徑沒跟上，不在本單 push 的 diff 內）——請塔台留意檢查樣式的排除路徑。
- 兩個 run 的 artifact 下載後本機掃描 `batcap.`、`BAT_REMOTE_TOKEN`、`server-token`、`GITHUB_TOKEN`、`ghs_` 等：0 命中。

### 遭遇問題

- Run #1 的 JXA 多檔寫入遺失 item（見上），已在 spec 修正並記入 docs「已知限制」。
- `e2e/fixtures/electron-isolation.ts` 的 `TERMINAL_SERVER_SCRIPT` 是 Windows 版面（`resources/app.asar`），mac 的 `.app` 是 `Contents/Resources`，teardown 的殘留 Terminal Server 比對在 mac 不會命中。實測正常 quit 時 Terminal Server 已結束（`alive after teardown: false`），影響只在 quit 失敗時；依工單不改 fixture，記入 docs。
- 工單 frontmatter 原本 `status: TODO`（非 `PENDING`），已照 Phase 1 改為 `IN_PROGRESS`。

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = 主 checkout，非 worktree，`CT_HOME` 未設）
- C-1：工單在 REPO_ROOT 的 `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 的可測項目最近祖先（`.github/workflows/`、`e2e/`、`docs/agent-guide/`）都存在 → present（資訊性）
- C-2：工單沒有 `branch` 欄位，未比對（實際在 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定

### 互動紀錄

無（yolo，未向塔台提問）。

### 子代理與 Workflow 使用

無。
