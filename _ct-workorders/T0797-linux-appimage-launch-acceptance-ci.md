---
schema_version: 1
schema_kind: workorder
id: T0797
title: "Linux AppImage 啟動驗收 workflow：在 ubuntu-22.04 / 24.04 runner 啟動已發佈（或 desktop-build）的 AppImage，確認能開窗、開終端分頁"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T01:09:10+0800"
started_at: "2026-11-03T01:10:31+0800"
updated_at: "2026-11-03T01:27:58+0800"
completed_at: "2026-11-03T01:27:58+0800"
session_ids:
  - "8244f11f-57ce-486c-949d-a603d33364d9"
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

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-03T01:27:58+0800
- **session_id**：8244f11f-57ce-486c-949d-a603d33364d9
- **產品 commit**：`cd938ab6`（`ci: T0797 Linux AppImage launch acceptance workflow (ubuntu-22.04 / 24.04)`）；未 push、未觸發 workflow

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`.github/workflows`、`e2e`、`docs/agent-guide`、`CLAUDE.md`、`playwright.config.ts` 皆存在 → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位，略過；目前分支 `main`
- 環境：`CT_HOME` 未設定（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

新增 Linux AppImage 啟動驗收 workflow，形狀比照 `macos-acceptance.yml`：只有 `workflow_dispatch`、不用 secret；`version`（release）與 `build_run_id`（desktop-build）兩種來源；ubuntu-22.04 / 24.04 matrix。驗收級別達到 **① Playwright**，不需要降級。本機用 WSL Ubuntu 24.04 對 `v0.7.4-pre.1` 照 workflow 步驟實跑：L1 PASS，sandbox 有開。

實跑時發現並修正一個會掩蓋問題的陷阱：**Playwright 的 `_electron.launch` 在 Linux 預設會加 `--no-sandbox`**（`playwright-core` `server/electron/electron.js`，`chromiumSandbox` 預設 false）。第一次實跑因此在沒開 sandbox 的情況下就「通過」了。spec 的 L1 現在明確傳 `chromiumSandbox: true`，並以 renderer 的 `NSpid`（是否有自己的 PID namespace）確認 sandbox 真的開著。這條已寫進 docs 與 CLAUDE.md 那一行。

### 變更檔案

| 檔案 | 內容 |
|---|---|
| `.github/workflows/linux-acceptance.yml`（新） | 兩種來源與 SHA-256 比對（release asset `digest` / desktop-build `SHA256SUMS.txt`，並確認該 run 是 `Desktop build (no release)`）；安裝前記錄 runner 狀態；裝 FUSE 2、Xvfb、binutils 與桌面字型；AppImage 靜態檢查；`xvfb-run` 跑 Playwright；寫 job summary；刪除密鑰檔後上傳 artifact |
| `e2e/linux/t0797-linux-appimage-launch.spec.ts`（新） | L1 / L2 / L1b 三列，PASS / WARN / FAIL 判讀；非 Linux 或沒有 `BAT_E2E_EXECUTABLE` 時 skip |
| `e2e/linux/linux-os.ts`（新） | `/proc`、`ldd`、debug log（`[CRASH]` / `[ERROR]` / startup argv）、不經 Playwright 的啟動 |
| `docs/agent-guide/linux-ci-acceptance.md`（新） | 用途、指令、規則、判讀、本機 WSL 實測、已知限制、驗證清單 |
| `docs/agent-guide/README.md` | 索引加一行 |
| `docs/agent-guide/packaging-release-checks.md` | 在 macOS 驗收那一行之後補 Linux 一行 |
| `CLAUDE.md` | 「Release」節加一行（指令＋sandbox 必守＋docs 連結） |
| `playwright.config.ts` | **未改**：`testMatch: e2e/**/*.spec.ts` 本來就收得到 `e2e/linux/`，spec 自己 skip |

### 驗收對照

- [x] **workflow**
  - 兩種來源、兩個 OS（`fail-fast: false`、`timeout-minutes: 30`）。
  - SHA-256 比對。
  - `permissions: contents: read` + `actions: read`，沒有用任何 secret。
  - artifact 名稱 `linux-acceptance-<version|build<id>>-<os>-attempt<n>`。spec 只從 userData 抄 `Logs/debug-*.log`；上傳前仍依檔名刪 `server-token.json` / `server-cert.json` / `helper-capabilities.json` / `claude-sessions.json`，並依內容刪掉含權杖樣式的檔案（同 macOS workflow）。
- [x] **驗收級別**：① Playwright（L1），沒有降級。L2 與 L1b 只在 L1 起不來時才跑：
  - L2：不經 Playwright 啟動，20 s 後還在、debug log 已建立、沒有 `[CRASH]`。
  - L1b：加 `--no-sandbox` 只為了繼續驗其他項目；需要 L1b 才過的結果標 WARN。
  - 兩級都記錄 glibc（`ldd --version`）、Electron 版本與啟動耗時（視窗載入、終端分頁出現、echo 標記各一個時間）。
- [x] **FUSE**：選 `libfuse2`（22.04）/ `libfuse2t64`（24.04）＋`fuse3`。理由：這是 Ubuntu 的 AppImage 說明叫使用者做的；`--appimage-extract-and-run` 會跳過使用者會撞到的 FUSE 掛載。安裝前另記 `libfuse.so.2` 有沒有，WSL 24.04 精簡映像原本就沒有。
- [x] **sandbox**：不一開始就加 `--no-sandbox`，L1 用 `chromiumSandbox: true`。`apparmor_restrict_unprivileged_userns` 等 sysctl 記在報告 meta，不改 sysctl、不改 AppArmor。
- [x] **spec 在非 Linux 主機 skip**：Windows 上 `npx playwright test e2e/linux/ --list` 列出 1 個 test，執行結果 `1 skipped`。
- [x] **驗證關卡**：YAML 可解析；actionlint 1.7.12 exit 0；typecheck 0 / 0；`test:unit` 綠。細節見〈驗證證據〉。
- [x] **docs**：`linux-ci-acceptance.md`、README 索引、packaging-release-checks 一行、CLAUDE.md 一行（遵守撰寫規則：用途＋必守＋連結）。
- [x] **塔台要跑的指令與判讀方式**：見〈塔台後續〉。

### 驗證證據

- **source／docs**
  - YAML：`js-yaml` 解析成功，14 個 step。
  - actionlint 1.7.12：本機沒有安裝，從 `rhysd/actionlint` 的 GitHub release 下載 Windows 單一執行檔到 scratchpad 執行。`linux-acceptance.yml` exit 0；對照組 `macos-acceptance.yml` 也是 exit 0。本機沒有 shellcheck，所以 run 區塊的 shellcheck 檢查沒有跑到。
  - spec 型別檢查：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/linux/*.ts` exit 0。
- **build／tests**
  - `npm run typecheck` = 0，`npm run typecheck:electron` = 0。新增的 `e2e/linux/*.ts` 不在這兩者範圍內，改由上面的 tsc 指令檢查。
  - `npm run test:unit`：385 個檔案通過，6783 passed、10 skipped。
  - Windows 上 `npx playwright test e2e/linux/`：`1 skipped`。
- **runtime smoke（選做：本機 WSL Ubuntu-24.04，對象 `v0.7.4-pre.1`）**
  - 下載 AppImage，SHA-256 `c41e9cac…0136d`，與 release `digest` 相同。
  - 環境：Ubuntu 24.04.5、glibc 2.39、kernel 6.18 WSL2、沒有 `apparmor_restrict_unprivileged_userns` 檔。
  - 第 1 次：L1 通過，但 argv 帶 `--no-sandbox`（Playwright 自己加的）。找出原因後修正 spec。
  - 第 2 次：AppImage 沒有執行權限，spawn 回 `EACCES`（workflow 由 Inspect 步驟負責 `chmod +x`）。這次也跑到了 L2 / L1b 的路徑，並找出 L2 的 bug：spawn 錯誤沒有 `exit` 事件，被誤判成「20 s 後仍在」。已修正。
  - 第 3 次（最終）：**L1 PASS**。
    - 啟動耗時：視窗 45.3 s、終端分頁 47.5 s、鍵盤 echo 標記 49.8 s。
    - sandbox：主程序命令列沒有 `--no-sandbox`；Tab 程序 `NSpid` = `2045 4 1`，有自己的 PID namespace。
    - 縮圖預覽也看得到標記。
    - debug log 0 個 `[CRASH]`、0 個 `[ERROR]`；結束 0.98 s，Terminal Server 跟著結束。
    - 截圖人工確認：視窗、終端與 echo 輸出都正確。中文 UI 與部分圖示顯示成方塊（缺 CJK / emoji 字型），因此 workflow 加裝 `fonts-noto-cjk` / `fonts-noto-color-emoji`。這兩個字型套件沒有在本機實測。
  - AppImage 靜態檢查：
    - AppRun 不會自己加 `--no-sandbox`；`.desktop` 的 `Exec=AppRun --no-sandbox %U`；`chrome-sandbox` 不是 setuid。
    - 主程式最高需要 `GLIBC_2.25`；whisper addon 的 `libggml-base.so` / `libggml-vulkan.so` 需要 `GLIBC_2.38`（見〈遭遇問題〉）。
- **deployment／release／外部確認**：不適用。workflow 還沒在 GitHub 上跑過，要等塔台 push 後 dispatch。

### 塔台後續（push 後要跑的指令與判讀）

```bash
gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal -f version=0.7.4-pre.1
gh run list -R gowerlin/better-agent-terminal --workflow linux-acceptance.yml -L 3
gh run view <run id> -R gowerlin/better-agent-terminal          # 兩個 job：ubuntu-22.04 / ubuntu-24.04
gh run download <run id> -R gowerlin/better-agent-terminal -D <資料夾>
# 試做分支：先 desktop-build，再
gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal -f build_run_id=<desktop-build run id>
```

判讀（完整版見 `docs/agent-guide/linux-ci-acceptance.md`〈驗收級別與判讀〉）：
1. 每個 OS 的 job summary 依序有三段：`linux-report.md`、`appimage-inspect.md`、`runner-context.md`。先看 `linux-report.md` 的 `verdict`：
   - **PASS**：L1 全過。
   - **WARN**：job 綠燈但有 `::warning::`。代表 L1 有項目沒過，或需要 `--no-sandbox` 才能用。這不是 PASS。
   - **FAIL**：job 紅燈。
2. 24.04 要同時看 `runner-context.md` 的 `apparmor_restrict_unprivileged_userns`：
   - 值是 `1` 而 L1 起不來（錯誤原文含 sandbox 字樣），代表「24.04 預設設定下要 `--no-sandbox`」，屬產品問題，請開 BUG。
   - 值是 `0` 而 L1 PASS，不能代表預設設定的 24.04 桌面（桌面版預設是 `1`），報告與決策要寫明。
3. 22.04 看 L1 是否 PASS，並對照 `appimage-inspect.md` 的 GLIBC 清單（runner glibc 2.35）。
4. L1 起不來時，用 L2 分辨「app 本身起不來」與「Playwright 驅動不了」，再用 L1b 看加 `--no-sandbox` 後其他項目是否正常。

### 遭遇問題

- **Playwright 自動加 `--no-sandbox`**：已在 spec 修正（`chromiumSandbox: true`），並寫入 docs 與 CLAUDE.md 的必守。如果沒修，CI 會在沒有 sandbox 的情況下報 PASS，正好掩蓋工單要找的相容性問題。
- **`Seccomp: 2` 不能當 sandbox 證據**：WSL 上主程序本身就是 2。改用 `NSpid` 判斷，已寫入 docs。
- **WSL 閒置後重開、`/tmp` 被清空**：中途重下載一次 AppImage，暫存位置改到家目錄底下，跑完已刪除。
- **🟡 建議塔台評估開 BUG**：`@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so`、`libggml-vulkan.so` 需要 `GLIBC_2.38`，Ubuntu 22.04 只有 2.35。這是靜態檢查的結果，推論 22.04 上語音輸入（whisper）會載入失敗。本驗收沒有測語音輸入；如果 whisper 在啟動時就載入，CI 的 22.04 debug log 會出現 `[ERROR]`。建議等 CI 結果出來後，開 BUG 處理「22.04 的語音輸入」或「改用相容 2.35 的 prebuilt」。

### 互動紀錄

- [01:10] 開工。`CT_MODE=yolo`，整張工單沒有向塔台提問（範圍內的選擇都依工單 memory_overrides 決定）。
- [01:16] 本機有 WSL Ubuntu-24.04，依工單「可選」項目照 workflow 步驟實跑。在 WSL 內安裝了 `libfuse2t64`、`xvfb`、`binutils`、`libnss3`、`libasound2t64`（`fuse3` 原本就有），這些套件留在使用者的 WSL 裡。

### 後續建議

- **whisper GLIBC 2.38 / 22.04**：見〈遭遇問題〉。
- 如果 GitHub 的 ubuntu-24.04 runner 上 `apparmor_restrict_unprivileged_userns` = 0，可另開工單評估加一個 matrix 變體：在 runner 上把該值設成 1，模擬桌面版預設。本單依工單「不得掩蓋 / 不改系統設定」的精神沒有做。
- macOS 版 `e2e/macos` 的 `mac-os.ts` 與 `linux-os.ts` 各有一份 `runCmd`。這是刻意不共用，避免改其中一個平台影響另一個；日後如果要共用，再另行評估。
