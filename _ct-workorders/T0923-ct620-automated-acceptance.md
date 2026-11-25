---
schema_version: 1
schema_kind: workorder
id: T0923
title: "PLAN-069 實機驗收自動化：以 zip 測試版 BAT `0.8.0-exp.1` 與舊版 `0.8.0-pre.3` / `0.8.0-pre.1` zip，在隔離 `CLAUDE_CONFIG_DIR` 跑真的 claude＋CT 塔台，完成 CT checklist M-1–M-15 的 BAT 端執行與判定"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-069
priority: P1
sizing: L
created_at: "2026-11-25T21:31:16+08:00"
updated_at: "2026-11-25T21:31:16+08:00"
target_version: "0.8.0-pre.4（與 CT 6.2.0 同日發佈）"
depends_on: [T0922]
related:
  - "PLAN-069；D350；T0922〈待實機〉；CT 塔台 D890 / D891、CT 工單 T0567（checklist 定稿、測試環境、ct-swap.py）；前例 T0915（6.1.0 驗收的驅動腳本與教訓）"
affects_files:
  - _ct-workorders/T0923-ct620-automated-acceptance.md
  - e2e/manual/
  - e2e/fixtures/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0923` 寫檔（base = 派工當下的 `main`，已含 T0922 `728c3197`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；只可修改 / 新增 `e2e/manual/` 的驅動腳本（優先沿用 T0915 的 `ct610-driver.ts` / `ct610-ctl.mjs` / `ct610-transcript.mjs`，需要時改成通用名稱或加參數，README 同步），必要時以 opt-in 參數擴充 `e2e/fixtures/`（既有 e2e 行為不得改變）。"
  - "🔴 外部路徑（只在本機、不進 repo；腳本從 env 讀路徑，D176）：驗收根目錄 `<使用者資料夾>/AppData/Local/ct620-accept`（以下稱 ACC），其中 `checklist.md`（CT 定稿）、`claude-config/`（測試用 `CLAUDE_CONFIG_DIR`：CT 6.2.0-pre.1、全域 CLAUDE.md、只有 CT guard 的 settings.json）、`ct-swap.py`、空的 `runs/`、`results/`。三個 BAT 放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/<版號>-win/`：`0.8.0-exp.1`（`gh run download 45621864786 -R gowerlin/better-agent-terminal -n desktop-win` 到自己的空目錄，以 `SHA256SUMS.txt` 比對 zip 後解壓；只用 zip，不執行 .exe 安裝檔）、`0.8.0-pre.3` 與 `0.8.0-pre.1`（`gh release download v0.8.0-pre.N -R gowerlin/better-agent-terminal -p '*win.zip'` 到各自的空目錄，與 GitHub asset digest 或 SHA256 檔比對後解壓）。T0915 已解壓過 `0.8.0-pre.1-win/` 時，核對雜湊後可沿用。"
  - "🔴 前置條件（開工先查，任一不成立 → 不開任何 claude 回合，狀態 BLOCKED，回報缺什麼，通知塔台）：① `ACC/checklist.md` SHA-256 開頭 `d7546b35`（不符就停下問塔台）；② `claude-config/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容）；③ `ct-swap.py status --target <ACC>/claude-config/skills` 結論是 6.2.0-pre.1；④ 三個 zip 的 exe 都在。"
  - "🔴 啟動方式：一律 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`，絕不用預設 userData；不碰使用者的安裝版 BAT、其 userData / Terminal Server / `bat-pty-holder`）。env 加 `CLAUDE_CONFIG_DIR=<ACC>/claude-config`，並以 `dropEnv` 移除繼承的 `CLAUDECODE`、`CLAUDE_CODE_*`、`CT_*`。"
  - "🔴 情境與順序照 `checklist.md` § 2（CT 定稿，以 checklist 為準；下列為摘要）：S1（`0.8.0-exp.1` × 6.2.0-pre.1）M-1 → M-2＋M-12 → M-3 → M-13 → M-14 → M-4～M-9；S2（`0.8.0-pre.3`）M-10；S3（換 6.1.1）M-11，跑完換回 6.2.0-pre.1；S4a（`0.8.0-pre.1`）/ S4b（`interactive-prompts: off`）/ S4c（Codex）M-15。每個情境一份新測試專案副本 `ACC/runs/<情境>/`（從 `ACC/ct-test-project/` 複製），跑完保留。"
  - "🔴 換版（S3 前後）：照 checklist § 1.4 逐字執行，工作目錄 ACC：`<使用者資料夾>/.local/bin/python.exe -X utf8 -I -B <ACC>/ct-swap.py install-611 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap`；換回把 `install-611` 改 `install-620`；查版本 `status --target <ACC>/claude-config/skills`。🔴 一定帶 `--target`（不帶 exit 2；目標在使用者層一律拒寫）。exit `0` 成功（最後兩行「結論：9 個 skill 都是 <版號>」「完成。請開新的 Claude Code session…」）；`1` 失敗（stderr 最後一行以「失敗：」開頭，目標已還原）；`2` 參數錯誤。換版後一律開新的 claude 分頁。非 0 → 該情境停止、回報原文、問塔台。"
  - "🔴 CT 塔台提醒（逐條照做）：① 測試專案範本 `ACC/ct-test-project/` 由本單建立：git repo、`master` 分支、一個 commit、只有 `README.md`，第一行 `# ct-test-project`。② `interactive-prompts: on` 時每筆待決都開原生選單；M-4～M-9 要從待辦分頁回答 → 先按 Esc 關掉選單、不回答；若 M-12-4（Esc 後該筆仍在清單）FAIL，M-4～M-9 改在 `off` 的新副本補跑（checklist § 7 第 8 點）。③ 斷點 A 的觸發：讓 Worker 檢查 `docs/spec.md`，不存在就回 BLOCKED（M-2a、M-5）；塔台沒寫推薦項 → M-2a 判未觸發、改跑 M-2b。④ M-7、M-9 在塔台輸入框**手打**（BAT host 會擋不支援的寫法，這兩項驗 CT 對手打的處理）。⑤ M-15c Codex 需要隔離的 `CODEX_HOME`（以 `ct-swap.py install-620 --target <CODEX_HOME>/skills` 裝 CT）且使用者已登入 Codex；不具備 → 判「未觸發」，不得要求使用者操作。⑥ 塔台開小工單前若先用選單問需求：選第一項，或在「其他」打「照你的建議」，並記錄。"
  - "🔴 權限與操作（沿用 T0915 做法與教訓）：測試 config 沒有 permissions → 測試工作區的工作區層級 Agent 啟動參數設 `--dangerously-skip-permissions`（只限隔離 runtime 的測試工作區）；需要權限對話框的項目另開不帶此參數的塔台分頁，帳號預設 auto mode 時以 Shift+Tab 切 manual。塔台是 BAT 開的 claude-cli 分頁；輸入用 Playwright 鍵盤打進 xterm；原生選單（AskUserQuestion）用方向鍵 / Enter / Esc 操作。讀取：DOM（待辦分頁、推薦標記、放棄 / 略過控制項、縮圖 `⏸N` / `📨 待送`）、helper 查詢輸出、debug log（`[tower-inbox]` / `[notify-hold]` 等）、`_tower-state.md` frontmatter、claude 對話紀錄（`ct610-transcript.mjs`）。新專案第一次開塔台後若待辦分頁沒有讀到狀態檔，按 ↻（BUG-220 已修，若仍需按 ↻ 記為 BAT 端觀察）。需要模型配合的狀態以明確提示詞觸發，同一項最多試 3 次，仍沒出現判「未觸發」，🔴 不得硬判 PASS。自動核准權限的判斷不要只靠畫面文字（T0915 遭遇問題）。"
  - "🔴 結果檔：照 checklist § 1.5 格式寫 `ACC/results/M-n.md`（＋截圖目錄 `M-n/`）：執行時間（系統取時）、測試專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現，`BAT_REMOTE_TOKEN` 只寫「已設定」）、本項 claude 回合數。🔴 CT 端判定欄留空。工單回報區附總表（每項 BAT 端判定、回合數、情境專案路徑）。"
  - "🔴 FAIL：BAT 端 FAIL 不修產品程式，記重現步驟與證據，回報區建議開 BUG（塔台開單），繼續跑其他項。checklist 看不懂或與實際 UI 不符 → 依 ct-exec § Questions For Tower 問塔台（塔台轉 CT），不自己改 checklist。"
  - "🔴 驗證與 Git：腳本進 `e2e/manual/`（不被一般 `npm run test:e2e` 收進去，README 寫手動執行方式與 env）；worktree `npm ci`；`npx vite build` exit 0、兩個 typecheck = 0；若改了 `e2e/fixtures/`，跑 2 支既有使用 `launchIsolated` 的 e2e 確認不回歸。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（只結束本單建立的 electron / claude / codex 程序）；使用者層 `~/.claude`、`~/.codex` 不得有任何變更（前後比對雜湊）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`，範例路徑 `C:/Users/demo`）。結果檔在 ACC（本機），可寫實際路徑。yolo：不得問使用者。"
---

# T0923 — PLAN-069 實機驗收自動化（CT checklist M-1–M-15）

## 背景

PLAN-069（推薦項、放棄 / 略過 / 批次、`inbox_features`）的 BAT 端是 T0922（已併入 `main` `728c3197`），CT 端是 6.2.0-pre.1（含 R6：塔台暫停改用原生選單）。驗收比照 6.1.0（T0915，CT D890）：BAT 主導自動化，CT 負責 checklist、測試環境（CT T0567）與 CT 端判定。測試版 BAT `0.8.0-exp.1` 由 `desktop-build.yml` run `45621864786` 打包（只打包、不發佈，D350）。

## 驗收

- [ ] 前置條件檢查（checklist 雜湊、測試目錄已登入、CT 6.2.0-pre.1、三個 zip）
- [ ] 測試專案範本 `ACC/ct-test-project/` 建立（照 CT 提醒 ①）
- [ ] S1：M-1、M-2＋M-12、M-3、M-13、M-14、M-4～M-9
- [ ] S2：M-10（`0.8.0-pre.3`）
- [ ] S3：M-11（換 6.1.1 → 跑 → 換回 6.2.0-pre.1，`status` 確認）
- [ ] S4a / S4b / S4c：M-15（Codex 不具備時判未觸發）
- [ ] 每項結果檔與截圖寫入 `ACC/results/`，回報區總表
- [ ] 使用者層 `~/.claude` / `~/.codex` 無變更、安裝版 BAT 未被碰、程序清理
- [ ] build、兩個 typecheck；改 fixture 時既有 e2e 不回歸

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 落點檢查

### 前置條件

### 總表（BAT 端判定；CT 端判定欄留空給 CT）

### 建議開 BUG（BAT 端 FAIL／發現，由塔台開單）

### 產品變更

### 驗證

### 環境與清理

### 遭遇問題

### 互動紀錄

### 隔離分支證據
- branch：`ct/T0923`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
