---
schema_version: 1
schema_kind: workorder
id: T0778
title: "探路：用 GitHub Actions macOS runner 對 `v0.7.3-pre.5` 安裝檔驗 BUG-128（Finder 複製檔案 Command+V）/ BUG-130（mac 終端貼圖）"
type: research
status: TODO
session_ids: []
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

- [ ] 〈可行性表〉P1–P5 各有結果與證據（run 連結、artifact 名稱）
- [ ] 情境 ①–⑦（⑧ 選做）逐項 PASS / FAIL / PARTIAL / 不可行，寫明是 Playwright 按鍵還是作業系統層按鍵、剪貼簿是腳本寫入還是 Finder
- [ ] 〈與真人 Mac 實機的差異〉：哪些結論可以代表實機、哪些不行
- [ ] 〈建議〉：塔台可否據此結案 BUG-128 / 130，或還缺什麼
- [ ] workflow run 次數（≤ 8）、push 的 commit 範圍與去識別化掃描結果

---

## 回報區

（Worker 填寫）
