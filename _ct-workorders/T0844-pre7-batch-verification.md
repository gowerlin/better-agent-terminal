---
schema_version: 1
schema_kind: workorder
id: T0844
title: "發 0.7.4-pre.7 前的整批驗證：HEAD 上的四個關卡＋legacy＋verify-native、重跑 T0836 e2e 與 T0841 的 V3 e2e"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T13:17:17+0800"
started_at: "2026-11-04T13:17:56+0800"
updated_at: "2026-11-04T13:23:11+0800"
completed_at: "2026-11-04T13:23:11+0800"
session_ids:
  - "ce577adf-96f0-4cc0-b560-06ef425c595b"
depends_on: [T0843]
related:
  - "D271–D274；本批 T0826–T0843；T0836（e2e 當時 build 含 T0840 未提交改動，需在乾淨 HEAD 重跑）；T0841（V3 e2e 以暫存副本跑過）"
affects_files:
  - _ct-workorders/T0844-pre7-batch-verification.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只驗證、不修：不改任何產品檔、測試檔或 e2e spec；發現失敗寫進回報區〈發現的問題〉（含指令、輸出摘錄、判斷是否本批引入），由塔台開單。暫存副本（例如 T0841 的版本常數副本）放 scratchpad 或用完即刪，不 commit。"
  - "🔴 e2e 一律隔離 runtime；不碰本機 BAT 安裝版與它的 Terminal Server、不改使用者的 `.wslconfig` / WSL 發行版設定、不執行 `wsl --shutdown`。T0836 e2e 需要 `Ubuntu-24.04` 執行中：比照 T0836 的做法以帶標記的 `sleep` 維持執行、跑完結束它；跑前後比對 T0836 的環境清單。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本工單檔。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0844 — pre.7 整批驗證

## 元資料
- **工單編號**：T0844｜**類型**：verification｜**狀態**：DONE｜**建立**：2026-11-04 13:17 (UTC+8)
- **規模**：S｜開工時記錄 `git rev-parse HEAD`（預期為 `a62a062c` 之後只有塔台記帳 commit）

## 任務指令

在目前 `main` HEAD（工作樹乾淨；若有非 `_ct-workorders/` 的未提交變更，停下問塔台）依序執行並記錄 exit code、摘要數字：

1. `npm run typecheck`、`npm run typecheck:electron`（期望 0 / 0）
2. `npm run test:unit`（記錄檔數 / 測試數 / skipped）
3. `npm run test:legacy`
4. `npx vite build`
5. `node scripts/verify-native-modules.js`、`npm run verify:helpers`
6. **T0836 e2e**（乾淨 build）：`$env:BAT_E2E_T0836='1'; npx playwright test e2e/t0836-remote-upload-acceptance.spec.ts`（含 T0843 新增的 ①a soft 斷言）
7. **T0841 V3 e2e**：照 T0841 回報區〈驗證證據分道〉的做法（`npm run build:dir` → `BAT_E2E_V071PRE2=1`、`BAT_E2E_EXECUTABLE=<win-unpacked exe>`、`-g "WSL wizard"`；版本常數用暫存副本，跑完刪除）
8. `CHANGELOG.md` `[Unreleased]`：列出本批條目（不改檔），對照 T0826–T0843 是否都有使用者可見的條目（純內部的 T0838 / T0839 / T0832 / T0833 可以沒有），缺的寫進回報

### 驗收條件
- [x] 1–7 全部 PASS，或失敗都附原因與是否本批引入
- [x] 環境前後比對相同；暫存檔已清

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（步驟 1–7 全部 PASS；`test:unit` 第一次跑有 1 個既有的偶發失敗，重跑通過，見〈發現的問題〉1）
- **HEAD**：`47f803177553d2966d65dfc62bfcbcac44fa8d0d`（`a62a062c` 之後只有塔台記帳 commit `47f80317`），開工時工作樹乾淨
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 唯一的 `affects_files` 是 `_ct-workorders/` 下的檔，不適用；C-2 沒有 `branch` 欄位。`CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **Commit**：只 commit 本工單檔；沒有產品變更
- **session_id**：ce577adf-96f0-4cc0-b560-06ef425c595b

### 驗證結果

| # | 關卡 | 結果 | 證據 |
|---|---|---|---|
| 1 | `npm run typecheck` / `npm run typecheck:electron` | PASS | exit 0 / exit 0 |
| 2 | `npm run test:unit` | PASS（重跑後） | 第一次：exit 1，`Test Files 1 failed \| 434 passed \| 3 skipped (438)`、`Tests 1 failed \| 7731 passed \| 40 skipped (7772)`。唯一的失敗 `electron/__tests__/bat-mcp-launch.test.ts` › `claude: --mcp-config=…` 是暫存目錄名稱碰巧含 `ENV`（見〈發現的問題〉1）；該檔單獨重跑 `Tests 18 passed (18)`。其餘 7731 個測試通過 |
| 3 | `npm run test:legacy` | PASS | exit 0，`files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`（不跑的 11 檔與腳本 `EXCLUDED` 相同） |
| 4 | `npx vite build` | PASS | exit 0 |
| 5 | `node scripts/verify-native-modules.js` / `npm run verify:helpers` | PASS | `All 2 required native modules present`（whisper `win32-x64`、embedded claude native）；`6 runtime helper(s) … same set as the server bundle, with a closed import set`、`no server bundle baseline (D146)` |
| 6 | T0836 e2e（乾淨 HEAD 的 build） | PASS | 13:20:15 → 13:21:07，`3 passed (51.7s)`，exit 0。①a（T0843 的 soft 斷言）：toast「未附加（超過單檔 50 MiB 上限）：<file>」、chip 移除、沒有 `claude:send-message`、host `uploads/` 0 筆，日誌 `codes=TOO_LARGE`；①b–①e、②（拖放、Ctrl+V 貼圖、⏻ 保留、關閉 10 s 刪除）、③ Docker 都 PASS。spec 自己的環境比對 12 項全 `same`（home / install / units / bat-units / bat-server / tagged / root / containers / container-count / own-containers / images / windows-ssh）；收尾 `bat-e2e-t0836-server: removed`、`tagged before: 0 \| tagged after: 0`、`removed /tmp/bat-e2e-t0836`、Windows 暫存與 runtime userData 已刪 |
| 7 | T0841 V3 e2e（`npm run build:dir` → win-unpacked） | PASS | `build:dir` exit 0（`release/win-unpacked/BetterAgentTerminal.exe`，FileVersion `0.7.4-pre.6`）。暫存副本 `e2e/zz-t0844-tmp-v071.spec.ts`＝`v071-pre2-acceptance.spec.ts` 只改 `EXPECTED_VERSION` 為 `0.7.4-pre.6`（diff 只有第 60 行），`BAT_E2E_V071PRE2=1`、`BAT_E2E_EXECUTABLE=<win-unpacked exe>`、`-g "WSL wizard"`：13:21:46 → 13:21:51，`4 passed (4.3s)`。逐項：`ENV.file-version`、`ENV.app-version.wizard`、`V3.wsl-wizard-title-and-distro-menu`、`V5.wsl-buttons`、`V5.wsl-step-text`、`V3.wsl1-convert-offered`、`V4.a-wsl-requires-wsl2`、`V3.wsl-systemd-offered`、`V4.a-wsl-systemd-disabled`、`V4.a-wsl-home-unresolved`、`SAFETY.wizard-no-write`（guard 19 次全 stub、real 0、blocked 0）、`CLEANUP.wizard` 全 PASS。跑完立即刪除暫存副本（已確認不存在、沒有 commit）；證據（`results.json`、`wizard-guard-calls.json`、4 張截圖）在 session scratchpad `t0844-e2e/` |
| 8 | `CHANGELOG.md` `[Unreleased]` 對照 | 缺 1 項（見下） | 見下表 |

**環境前後比對**（本單另做，與 spec 的比對分開）：

| 項目 | 開工前 | 結束後 |
|---|---|---|
| `wsl -l -v` | `Ubuntu-24.04 Stopped 2` | `Ubuntu-24.04 Stopped 2`（之後我做 `ps` 檢查時 `wsl -d` 又把它拉起來，閒置後會自己停；沒有任何保活程序） |
| `~/.wslconfig` SHA-256 | `DC1E8465…54F61D` | 相同 |
| 本機安裝版 BAT 程序（`C:\Program Files\…`） | 1212, 5236, 12248, 30704, 31496, 36332 | 相同；沒有其他 BAT 程序殘留 |
| 帶標記的保活 `sleep`（`T0844_KEEPALIVE=1 sleep 1800`，distro 內 pid 969） | 跑 T0836 前啟動 | T0836 跑完就 `kill`，`no keepalive` |
| `/tmp/bat-e2e-t0836`、`%TEMP%\bat-t0663` | 不存在 | 不存在 |
| `%APPDATA%\BetterAgentTerminal-runtime-e2e*` | — | 只剩 `…-e2e-t0609-1793616886860`（2026-11-02 18:54，T0609 遺留，不是本單；沒動它） |
| `git status --porcelain` | 乾淨 | 只有本工單檔 |

沒有改 `.wslconfig` / 發行版設定、沒有 `wsl --shutdown`、沒有碰本機安裝版與它的 Terminal Server。

**步驟 8：CHANGELOG `[Unreleased]` 對照**（沒改檔）

`[Unreleased]` 共 Changed 3 條、Added 7 條、Fixed 1 條，內文提到的工單：T0826、T0827、T0829、T0830、T0832、T0833、T0834、T0835、T0840、T0841、T0842。

| 工單 | 類型 | 有條目？ | 判斷 |
|---|---|---|---|
| T0826、T0827、T0829、T0830、T0834、T0835、T0840、T0841、T0842 | 使用者可見 | 有 | — |
| T0832、T0833 | 純內部（host 暫存 / client 驅動） | 有（併在「遠端視窗可附加本機檔案」） | 可以沒有，有也無妨 |
| T0838、T0839 | 純內部 | 沒有 | 依工單可以沒有 |
| T0828、T0831、T0837 | research | 沒有 | 沒有產品變更 |
| T0836 | verification（只新增 e2e spec） | 沒有 | 沒有產品變更 |
| **T0843** | 使用者可見（上傳失敗提示改字） | **沒有** | 見〈發現的問題〉2 |

### 發現的問題

1. **`bat-mcp-launch.test.ts` 偶發失敗（不是本批引入）**
   - 指令：`npm run test:unit`（第一次）；失敗位置 `electron/__tests__/bat-mcp-launch.test.ts:87`，`expect(content).not.toMatch(/env|token|BAT_REMOTE/i)`。
   - 輸出摘錄：寫進設定檔的 `args` 是 `C:\…\Temp\t0584-launch-17ENVT\Program Files\BAT\scripts\bat-mcp.mjs`。第 48 行 `fs.mkdtempSync(path.join(os.tmpdir(), 't0584-launch-'))` 的 6 個隨機字元剛好是 `17ENVT`，含 `ENV`，被不分大小寫的 `/env/` 比到。檔案內容本身正確（只有 `type` / `command` / `args`，沒有 env / 權杖）。
   - 重跑：`npx vitest run electron/__tests__/bat-mcp-launch.test.ts` → 18 passed。
   - 判斷：測試寫法造成的偶發失敗，跟產品無關。這個測試檔最後一次改動是 `5d104926`（2026-11-02，T0767），早於本批。隨機後綴命中 `env` / `token` 的機率不高，但 CI 的 `tests` job 一碰到就會擋發版。建議塔台開一張小單：斷言只檢查 JSON 的鍵（例 `Object.keys(parsed.mcpServers.bat)`）或把暫存路徑先從內容中拿掉再比對。
2. **CHANGELOG `[Unreleased]` 沒有 T0843 的條目**
   - T0843（`ab391de9`）把遠端附件上傳失敗的提示改成「先講原因、每個檔名只出現一次」（例：「未附加（超過單檔 50 MiB 上限）：<file>」）。這屬於使用者看得到的文字。
   - 不過上傳功能本身在本批才新增（Added 第 3、4 條，還沒發布過），所以也可以只在 Added「遠端視窗可附加本機檔案」那條補一句提示格式，不另開一條。由塔台決定要不要補、怎麼補；本單依規定沒有改檔。

### 互動紀錄
- [13:17] 開工，`CT_MODE=yolo`、`CT_INTERACTIVE=0`；HEAD `47f80317`、工作樹乾淨。沒有向塔台提問。
- [13:20 前] `test:unit` 1 個失敗 → 查明是暫存目錄名稱含 `ENV`，單獨重跑通過，繼續。
- [13:20] Ubuntu-24.04 原本是 Stopped；比照 T0836 以帶標記的 `sleep` 維持執行，T0836 e2e（13:20:15 → 13:21:07）跑完後 `kill` 結束。
- [13:21] V3 e2e（13:21:46 → 13:21:51）用暫存 spec 副本跑完後立即刪除。
- 沒有 compact / resume。開工時工單沒有 `## 塔台補充（…）`；填回報前檢查也沒有新的段落。驗證前那一次檢查漏做了（在填回報前補做，結果同樣沒有），本單沒有產品 commit。
- 時間只取自系統時間與 e2e 的起訖紀錄；「13:20 前」是因為 unit 測試的結束時間沒有另外記錄。

### 回報時間
2026-11-04T13:22:16+0800
