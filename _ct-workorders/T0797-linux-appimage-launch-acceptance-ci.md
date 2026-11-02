---
schema_version: 1
schema_kind: workorder
id: T0797
title: "Linux AppImage 啟動驗收 workflow：在 ubuntu-22.04 / 24.04 runner 啟動已發佈（或 desktop-build）的 AppImage，確認能開窗、開終端分頁"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T01:09:10+0800"
updated_at: "2026-11-03T01:09:10+0800"
session_ids: []
depends_on: []
related:
  - "D242（本單）；T0784 回報區〈要看的項目〉Linux 列（AppImage 啟動冒煙、Ubuntu 22.04 相容）；T0781（Electron 45 glibc 需求未確認）；PLAN-053；D224"
  - "範本：`.github/workflows/macos-acceptance.yml`（T0778 / T0783：`version` / `build_run_id` 兩種來源、SHA-256 比對、Playwright 驗收、清掉像密鑰的檔案再上傳 artifact）、`e2e/macos/`（`mac-os.ts`、`t0778-macos-paste-acceptance.spec.ts`）、`docs/agent-guide/macos-ci-acceptance.md`"
  - "產物來源：`.github/workflows/desktop-build.yml`（artifact `desktop-linux`，附 `SHA256SUMS.txt`）、`pre-release.yml` / `release.yml` 發佈的 AppImage；`docs/agent-guide/packaging-release-checks.md`〈只 build、不發布的桌面 workflow〉"
affects_files:
  - .github/workflows/linux-acceptance.yml
  - e2e/linux/**
  - docs/agent-guide/linux-ci-acceptance.md
  - docs/agent-guide/README.md
  - docs/agent-guide/packaging-release-checks.md
  - CLAUDE.md
  - playwright.config.ts
  - _ct-workorders/T0797-linux-appimage-launch-acceptance-ci.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標：回答「AppImage 在 Ubuntu 22.04 / 24.04 開得起來嗎」，並讓之後每一版都能一鍵重驗。新 workflow `.github/workflows/linux-acceptance.yml`，照 `macos-acceptance.yml` 的形狀：只有 `workflow_dispatch`；輸入 `version`（測 release `v<version>` 的 AppImage，以 release asset digest 比對 SHA-256）與選填 `build_run_id`（測 desktop-build run 的 `desktop-linux` artifact，以該 run 的 `SHA256SUMS.txt` 比對，並確認該 run 是本 repo 的 desktop-build）；`permissions: contents: read` ＋ `actions: read`；不用任何 secret；matrix `os: [ubuntu-22.04, ubuntu-24.04]`、`fail-fast: false`；`timeout-minutes` 合理上限。AppImage 實際檔名以 release 資產為準（先 `gh release view v0.7.4-pre.1 -R gowerlin/better-agent-terminal --json assets` 查），不要猜。"
  - "🔴 驗收內容（由強到弱，做得到的最強那一級，降級要寫原因）：① 首選：仿 `e2e/macos/` 在 `e2e/linux/` 寫 Playwright spec，以 `_electron.launch` 啟動 AppImage 解開後的執行檔（或 AppImage 本身，擇可行者），在 `xvfb-run` 下確認主視窗出現、預設終端分頁可輸入、`echo <隨機標記>` 的輸出出現在畫面（或經 BAT 可讀到），截圖；② 最低：`xvfb-run` 啟動後 ≥ 20 s 程序仍在、`~/.config/BetterAgentTerminal/Logs/debug-*.log` 已建立且沒有致命錯誤（樣式依 `electron/logger.ts` / `early-crash-log.ts` 的實際字串訂）、正常關閉。兩級都要記錄 glibc 版本（`ldd --version`）、Electron 版本、啟動耗時。spec 必須在非 Linux 主機自動 skip，不得讓 Windows / macOS 本機的 `npm run test:e2e` 失敗；若需改 `playwright.config.ts` 才能收 / 排除 `e2e/linux/`，只做最小改動。"
  - "🔴 不得掩蓋相容性問題：FUSE 與 Chromium sandbox 正是使用者會撞到的地方。先用一般使用者的方式啟動（必要套件：22.04 `libfuse2`、24.04 `libfuse2t64`，或改用 `--appimage-extract-and-run`，擇一並寫明理由）；不得一開始就加 `--no-sandbox`。若 24.04 因 AppArmor 限制 unprivileged user namespace 等原因啟動失敗，該情況本身就是要回報的結果：記錄錯誤原文，可另跑一次帶 `--no-sandbox` 以繼續驗其他項目，報告中兩次結果分開列，整體結論標 WARN / FAIL 而非 PASS。"
  - "🔴 產出：job summary 與 artifact（`linux-acceptance-<來源>-<os>-attempt<n>`：報告 md、截圖、BAT debug log）；上傳前照 macOS workflow 刪掉像密鑰的檔案（`server-token.json`、`helper-capabilities.json` 等，以實際 userData 內容為準）。新 docs `docs/agent-guide/linux-ci-acceptance.md`（用途、指令、判讀、已知限制），`docs/agent-guide/README.md` 索引加一行，`packaging-release-checks.md` 在 macOS 驗收提到處補 Linux 一行；`CLAUDE.md`「Release」節只加一行（指令＋連到 docs），遵守 CLAUDE.md 撰寫規則。不放進 `pre-release.yml` / `release.yml` / `tests.yml`，不加任何發布動作。"
  - "🔴 驗證（本機）：workflow YAML 可解析；能取得 `actionlint` 就跑（取不到寫明）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（若新增 ts 在兩者範圍外寫明）；`npm run test:unit` 綠；Windows 本機跑 `npx playwright test e2e/linux/ --list` 或等效方式確認 spec 會 skip。可選：本機若有 WSL Ubuntu（WSLg），下載 `0.7.4-pre.1` 的 AppImage 照 workflow 步驟手動跑一次並記錄結果；沒有就寫明。"
  - "🔴 Worker 不 push、不觸發 workflow（GitHub 上執行需檔案在 default branch，屬對外動作，由塔台收單後 push 並執行）。回報區列出塔台要跑的確切指令（`gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal -f version=0.7.4-pre.1` 等）與判讀方式。"
  - "🔴 不發版、不改 CHANGELOG / release-note。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存腳本用 Write 寫檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`。"
---

# T0797 — Linux AppImage 啟動驗收 workflow

## 元資料

- **工單編號**：T0797
- **類型**：implementation（CI 驗收 workflow）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T01:09:10+0800
- **預估規模**：M

## 背景

T0784 把 Electron 升到 45 時列了 Linux 待驗項目：AppImage 能啟動、Ubuntu 22.04 相容（T0781 查不到 Electron 45 的 glibc 下限）。`desktop-build` / `pre-release` 的 Linux job 只打包與檢查產物，從沒啟動過 AppImage；macOS 有 `macos-acceptance.yml`，Linux 沒有對應的驗收。使用者選擇在 CI 補啟動驗收（D242），之後每版可重跑。

## 範圍

1. `.github/workflows/linux-acceptance.yml`（`version` / `build_run_id` 兩種來源，ubuntu-22.04 / 24.04 matrix）。
2. `e2e/linux/` Playwright spec（首選）或程序＋日誌的最低檢查（降級要寫原因）。
3. docs 與索引、CLAUDE.md 一行。

## 不做

- 不進任何發版 / 測試關卡 workflow、不加發布動作、不 push、不觸發 workflow。
- 不改產品程式碼；若驗收發現產品需修（例：sandbox 問題），在回報區寫出現象與建議，由塔台開 BUG。

## 驗收

- [ ] workflow 兩種來源、兩個 OS、SHA-256 比對、無 secret、artifact 已清密鑰檔
- [ ] 驗收級別（① Playwright / ② 最低）與降級原因；FUSE / sandbox 處理方式與理由
- [ ] spec 在非 Linux 主機 skip
- [ ] YAML 可解析、actionlint（或寫明取不到）、typecheck 0 / 0、`test:unit` 綠
- [ ] docs / README 索引 / packaging-release-checks / CLAUDE.md 一行
- [ ] 回報區列出塔台要跑的指令與判讀方式

---

## 回報區
