---
schema_version: 1
schema_kind: workorder
id: T0679
title: "研究：BUG-168 — tests/ 底下 8 檔失敗、9 檔逾時逐項分類（測試過時／產品回歸／測試本身壞），查失效 script，提出修正分組與納入 CI 的建議（只查不修）"
type: research
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:15:54+0800"
depends_on: []
related:
  - "BUG-168（現象、失敗項目與逾時清單）；BUG-167 / T0678（同類問題的處理方式與盤點表、跑法）"
  - "可能相關：T0552 / T0554（`electron/server-bundle-install-script.ts` 乾淨覆蓋與精靈 rollback）、T0378（linger、systemd unit 絕對路徑）、PLAN-032（精靈 runner）、PLAN-027（Claude runtime router）、T0505（`buildBaseSshArgs`）；CLAUDE.md「Remote 資安」「Claude Runtime Selection」節與 `docs/agent-guide/`"
affects_files:
  - _ct-workorders/T0679-research-bug168-tests-triage.md
  - "_ct-workorders/_report-T0679-tests-triage.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定。暫存檔與除錯輸出一律放 Worker 的 scratchpad。"
  - "🔴 分類要有證據：每一項失敗都歸到 (A) 測試過時（產品行為依某工單／決策改變；附 commit 與工單編號）、(B) 產品回歸（測試期望才是正確行為；附證據與受影響的使用情境）、(C) 測試本身壞（環境依賴、mock 不全、平台限定）、(D) 無法判定（寫明缺什麼）。不確定時寫 (D)，不要硬歸類。"
  - "🔴 判斷 (A) 或 (B) 時，以工單、決策紀錄與 `docs/agent-guide/` 的現行規則為準，不以「現在的程式碼就是對的」為準。SSH／WSL 的 systemd unit、launchd plist、linger、安裝腳本相關的項目要特別仔細。"
  - "🔴 逾時：找出卡在哪個步驟、等的是什麼（mock 沒回應的步驟、真的啟動外部程序、等待使用者輸入等），可以加大逾時或開除錯輸出重跑；每檔單次執行不超過 5 分鐘，全程不要真的連線遠端、不要啟動真的 WSL／Docker／SSH 服務。若測試會真的動到本機環境（寫檔到家目錄、啟動服務），先停，寫進回報，不執行。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼與工單；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱，不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0679 — 研究：BUG-168 測試失敗與逾時分類

## 研究目標

`tests/` 底下 41 個不在 `test:unit` 的測試裡，有 8 檔失敗（29 項）、9 檔逾時，另有 2 組 `package.json` script 指向不存在的檔案（清單見 BUG-168）。要回答：

1. 每一項失敗是測試過時、產品回歸、測試本身壞，還是無法判定？
2. 每一個逾時卡在哪一步、為什麼？
3. 兩組失效 script 的檔案是什麼時候、為什麼不見的？該刪 script 還是補檔？
4. 修好之後，怎麼讓這些測試不再沒人跑？

## 已知資訊

- 跑法（T0678 實測）：自寫 harness 的用 `npx tsx <file>`；`import … from 'node:test'` 的用 `npx tsx --test <file>`；Node v24.22.0。
- 同類先例 BUG-167：失敗原因是 T0277／T0282 依工單加了欄位，測試沒跟上，屬 (A)。
- 這些測試多數集中在遠端開發（SSH／WSL／Docker 精靈與安裝腳本）、Claude runtime router、Profile 卡片。

## 調查範圍

- 8 個失敗檔的每一個失敗項目：期望值與實際值的差異、相關產品程式、改動它的 commit 與工單。
- 9 個逾時檔：卡住的步驟與原因。
- `package.json` 的 `test:claude-ctrl-o`、`diagnose:ctrl-o*`：檔案刪除的 commit 與原因。
- 納入 CI 的做法：改成 vitest 收進 `test.include`、新增一個跑 tsx／node:test 的 script 並在 CI 執行，或維持手動；各自的工作量、執行時間、平台限制（例如只能在 Windows 跑的測試）。

## 研究指引

- 先讀 BUG-168 與 T0678 回報區的盤點表。
- 每個檔案先找最後幾次改動產品程式的 commit（`git log -- <產品檔>`），對照工單「要做的事」與驗收條件。
- 產品回歸的判斷要能說出「哪個使用情境會壞」。

## 互動規則

- yolo：問題問塔台，每輪最多 3 題；能從工單與決策紀錄判斷的，自己判斷並寫理由。

---

## 回報區

### 完成狀態

### 調查結論（逐項分類表：檔案、項目、分類 A／B／C／D、證據、相關 commit／工單）

### 逾時分析（檔案、卡住的步驟、原因、分類）

### 失效 script

### 建議方向（修正工單分組：每組範圍、大小、風險；產品回歸各自一組）

### 納入 CI 的建議（選項、工作量、執行時間、推薦）

### 子代理使用

### 遭遇問題

### 回報時間
