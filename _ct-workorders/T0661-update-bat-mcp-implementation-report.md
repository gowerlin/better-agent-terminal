---
schema_version: 1
schema_kind: workorder
id: T0661
title: "更新 BMad-Guide 根目錄《BAT MCP Server 規格提案 — 實作報告.md》：從 `v0.7.0-pre.1` 補到 `v0.7.1-pre.2`（M1 / M1b / W1、Worker 啟動確認、Worker 問塔台、session 識別、本批修正）"
type: docs
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T20:59:00+0800"
started_at: "2026-10-18T20:58:04+08:00"
updated_at: "2026-10-18T21:06:51+08:00"
completed_at: "2026-10-18T21:06:51+08:00"
depends_on: []
related:
  - "使用者 2026-10-18 20:2x 指示：發版後更新 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案 — 實作報告.md`（現況停在 2026-10-17 / `v0.7.0-pre.1`）"
  - "來源（只讀）：PLAN-047 / PLAN-048 / PLAN-050 / PLAN-051；工單 T0582（唯讀查詢 channel）、T0583 / T0585 / T0589（worktree 隔離派工與狀態）、T0584 / T0586（BAT MCP shim、codex env）、T0590 / T0594 / T0596 / T0597 / T0620 / T0621 / T0657（blocked 偵測與清除）、T0600（Worker 啟動確認）、T0606–T0611（Worker 問塔台）、T0640–T0644（session 識別）、T0647 / T0648 / T0651（PLAN-051 評估、codex daemon）、T0649–T0660（本批修正）、CT-T015–CT-T021；`_decision-log.md` D149–D170；`release-note.md` / `CHANGELOG.md` 各版；README「與 BMad Control Tower 協作」版本對照表；CLAUDE.md 與 `docs/agent-guide/` 對應節"
affects_files:
  - "D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案 — 實作報告.md（本 repo 以外，BMad-Guide 根目錄 repo）"
  - _ct-workorders/T0661-update-bat-mcp-implementation-report.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **只改那一個外部檔案與本工單**。不改 BMad-Guide repo 的其他檔案，不改本 repo 的產品檔。BMad-Guide repo 的 commit：只 `git -C \"D:/ForgejoGit/@Gower_Labs/BMad-Guide\" commit --only \"BAT MCP Server 規格提案 — 實作報告.md\"`（該 repo 另有不相干的髒檔，不得帶入）；🔴 **不 push 任何 repo**。本 repo 只 commit 本工單檔。"
  - "🔴 保留原文件的結構、語氣與證據等級標記（[實測] / [碼] / [文件] / [推論]）；更新日期與作者行（日期取系統時間）。每個新增的事實都要對得上來源（工單回報區、決策、release note、程式碼位置），不得憑記憶；查不到就不寫或標 [推論]。內部編號（T / D / BUG / PLAN / CT-T）在這份內部報告中可以使用。"
  - "🔴 要更新的重點（依原章節）：§1 摘要（已實作範圍與發佈版本線 `v0.7.0-pre.1` → `v0.7.1-pre.2`、CT 對應版本 v5.2.4 → v5.9.0）；§3 已實作（新增各批：M1、W1、M1b、Worker 啟動確認、Worker 問塔台、session 識別、本批修正，每批列工單 / commit / 驗證 / 發佈版本）；§5 研究結論中已被後續實作推翻或修正的地方（例：codex blocked 偵測最終採 OSC 7501 而非 OSC 9 `-c tui.notifications`；PLAN-051 對 SendMessage / `codex queue` 的前提更正）；§6 待決議題的最終狀態（Q3 / Q4 / Q5 / Q8 / Q12 / Q13 / Q14 等哪些已定案、怎麼定）；§7 後續階段表的狀態（M1 / M1b / W1 / CT-T015 / CT-T016 已完成；M2 / M3 仍未排期；PLAN-051 維持 IDEA）；§8 已知限制（移除已解決的、補上仍有效的，例如未實機驗證項目）；§9 參考。"
  - "🔴 `v0.7.1-pre.2` 的發佈資訊（發佈時間、CI run、server bundle）以 `gh release view v0.7.1-pre.2 -R gowerlin/better-agent-terminal --json publishedAt,url,assets` 與 `gh run list -R gowerlin/better-agent-terminal --workflow pre-release.yml -L 1` 取得；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），只讀。"
  - "🔴 實機驗收狀態照實寫：已安裝版實機驗收過的（例如 T0601 / T0612 / T0645 等）與只有原始碼 / 測試證據的分開。"
---

# T0661 — 更新 BAT MCP 實作報告

## 背景

BMad-Guide 根目錄的《BAT MCP Server 規格提案 — 實作報告.md》是 BAT 塔台給提案者的實作報告，最後更新 2026-10-17，只寫到第一批（範圍權杖 A1 / A2 等，`v0.7.0-pre.1`）。之後 M1（唯讀查詢 + MCP shim）、W1（worktree 隔離派工）、M1b（blocked 偵測，含 codex OSC 7501）、Worker 啟動確認、Worker 問塔台（PLAN-048）、Claude session 識別（PLAN-050）陸續完成並發佈到 `v0.7.1-pre.2`，CT 也從 v5.2.4 走到 v5.9.0。使用者要求發版後更新這份報告。

## 要做的事

1. 讀原報告與上列來源，整理各批的工單、commit、驗證、發佈版本、CT 對應版本。
2. 依 memory_overrides 的重點逐章更新；新增章節可以，但保留原有編號與結構。
3. 自我檢查：每個版本號、commit、run id 都能在來源找到；Markdown 表格欄數正確。

## 驗證

- 報告內引用的本 repo 檔案路徑存在（grep 確認）
- 版本號 / commit / run id 抽查 10 個以上，列在回報區
- Markdown 預覽無破表（可用任何 Markdown 解析器檢查表格欄數）

## 驗收

- 報告更新到 `v0.7.1-pre.2`，各章與來源一致
- 回報區附：更新章節摘要、抽查清單、BMad-Guide repo 的 commit hash、仍標 [推論] 的項目
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

- 狀態：**DONE**
- 已更新 BMad-Guide 根目錄的《BAT MCP Server 規格提案 — 實作報告.md》，從 `v0.7.0-pre.1` 補到 `v0.7.1-pre.2`；CT 從 v5.2.4 補到 v5.9.0。
- 原有的 §1–§9 編號、結構與語氣都保留。證據等級新增 **[實機]**（已安裝的預覽版上實際操作），與 [實測] 分開。
- 日期行取系統時間：2026-10-18。
- BMad-Guide repo 的 commit：**`33f2a07`**（分支 `dev-main`）。
  - 用 `git commit --only` 只提交該檔，265 insertions / 43 deletions。
  - 該 repo 原有的髒檔 `better-agent-terminal/better-agent-terminal` 沒有帶入。
  - **未 push**。

### 更新章節摘要

| 章 | 更新內容 |
|---|---|
| 標頭 | 日期與作者行；追蹤單據加 PLAN-048 / 050 / 051、研究單、D149–D170、CT-T014–T021；證據等級加 [實機] |
| §1 摘要 | 發佈線 `v0.7.0-pre.1` → `v0.7.1-pre.2`（含 CI run 與 server bundle）、七批實作、CT v5.2.4 → v5.9.0；尚未實作的改為 M2 / M3 未排期、PLAN-051 IDEA；列出研究結論的兩處修正 |
| §2 | 不變；第 7 列補一句「正式版 shim 沿用」 |
| §3 已實作 | 拆成 3.1–3.8：第一批（原內容，補 T0581 實機）、M1 + W1、M1b、啟動確認、問塔台、session 識別、本批修正、發佈時間線（11 版 × 發佈時間 × CI run × CT 對應）。每批都分開寫「安裝版實機」與「只有原始碼 / 測試」 |
| §4 | 加「落地狀態」：CT v5.3.0 實作、模式 ② 由 T0588 實跑、模式 ③ 未跑；耗時改成 T0585 實測約 270 ms |
| §5 | 原結論照錄，以「→ 修正」標出被推翻或修正處：codex env 白名單（BUG-148）、`--mcp-config=` 形式、codex 握手已驗、AskUserQuestion 原因被蓋（BUG-150）、三條清除路徑、**codex 改用 OSC 7501（T0619 原文）**、C-0 已修、Windows longpaths；新增「沒有預見的發現」：codex 共用 daemon（BUG-159）、**PLAN-051 前提更正（原文）** |
| §6 | Q1–Q14 全部更新為最終狀態：Q3 / Q5 / Q12 已實作；Q8 定案為不設秒數門檻（CT v5.5.0）；Q9–Q11 / Q14 由 CT v5.3.0 實作；Q4 隨 M2 未排期；Q7 待議；Q13 的 worktree 池未做 |
| §7 | 階段表：A1 / A2 / T、M1、M1b、W1、CT-T015 / T016 標完成，新增啟動確認 / PLAN-048 / PLAN-050 三列；M2 / M3 未排期；PLAN-051 IDEA；註記 PLAN-047 frontmatter 仍 IN_PROGRESS |
| §8 | 移除已解決的一條（「待 pre.1 實機驗收」）；其餘依主題分組；補上仍有效的限制與未實機驗證的項目（T0620 / T0623 / T0657、`/clear` 換 id、`0.7.1-pre.2` 四項、codex daemon、macOS / Linux） |
| §9 | 參考補上各 PLAN、研究 / 實作 / 探針 / 合併工單、BUG-146–163、`docs/agent-guide/` 九篇、主要實作檔、CT 各版的 BMad-Guide 工單、Release 連結 |

### 驗證

**來源**

- 由 3 個唯讀子代理分批讀工單回報區、決策日誌、release-note / CHANGELOG。
- 我另外直接讀了這些：README 版本對照、`terminal-output-redaction.ts`、`helper-capability.ts`、`helper-query-channels.md`、`bat-mcp-launch.ts`、`bat-mcp.mjs` 的 tool 名稱、CT `merge-workorder.md` / `work-order-template.md`、PLAN-047 / 048 / 050 / 051 的 status。
- 發佈資訊（唯讀，一律帶 `-R gowerlin/better-agent-terminal`）：
  - `gh release view v0.7.1-pre.2`：publishedAt `2026-10-18T12:55:18Z`，isPrerelease true
  - `server-bundle-v0.7.1-pre.2`：`12:55:47Z`，3 平台 tarball + sha256 + manifest
  - `gh run list --workflow pre-release.yml`：11 個版本對應的 run 都是 success；`39128867451` 的 10 個 job 全部 success
  - `gh release list`：取得 11 個版本的 publishedAt

**表格**

- 以腳本計算每列未跳脫的 `|`：12 張表、103 列，**欄數不符 0**。
- `marked` lexer 也解析出 12 張表。

**路徑**

- 報告引用的本 repo 路徑 14 個（`electron/` / `scripts/` / `src/` / `docs/`），全部存在。
- e2e / 測試檔名 12 個，全部在 `git ls-files` 中。
- PLAN 檔 4 個存在。

**commit hash**

- 報告內共 44 個 hash。
- 40 個 BAT commit 全部是 `9c5fe2b1`（`v0.7.1-pre.2` tag）的祖先。
- 4 個（`70afce0` / `c2962d7` / `d092206` / `dada1bd`）是 BMad-Guide 的 CT commit，已在該 repo 以 `git log` 核對 subject。

**抽查清單（19 項）**

| # | 項目 | 結果 |
|---|---|---|
| 1 | `6b2ac19e` = T0582 唯讀 channel，最早出現在 `v0.7.0-pre.2` | ✅ `git merge-base --is-ancestor` |
| 2 | `15559f8b` = T0621 OSC 7501，首發 `pre.9`（不在 `pre.8`） | ✅ |
| 3 | `b6acce0a` = T0641 `--name`，首發 `0.7.1-pre.1`（不在 `pre.9`） | ✅ |
| 4 | `00bdcaeb` = T0607，首發 `pre.7`（不在 `pre.6`） | ✅ |
| 5 | `75a867b1` = T0600，首發 `pre.6`（不在 `pre.5`） | ✅ |
| 6 | `ff14fa5d`（T0657）、`5b1be0f5`（T0651）都在 `9c5fe2b1` 內 | ✅ |
| 7 | `9c5fe2b1` = `chore: bump version to 0.7.1-pre.2`，也是 run `39128867451` 的 headSha | ✅ |
| 8 | run `39033898223` → headSha `7771b546` = tag `v0.7.0-pre.1` | ✅ |
| 9 | run `39106509652` → `c0f4dcae` = tag `v0.7.0-pre.9` | ✅ |
| 10 | run `39115475526` → `1bc9ccca` = tag `v0.7.1-pre.1` | ✅ |
| 11 | `v0.7.0-pre.2` publishedAt `15:03:48Z` → 23:03 UTC+8 | ✅ |
| 12 | `d1b82946` subject 為 T0584 shim | ✅ |
| 13 | `8c7bd4c4` subject 為 T0586 / BUG-148 | ✅ |
| 14 | `ddb9b970` subject 為 BUG-150 / T0597 | ✅ |
| 15 | BMad-Guide `dada1bd` = T0174 CT v5.9.0（CT-T021） | ✅ |
| 16 | BMad-Guide `d092206` = T0165 CT v5.6.0 | ✅ |
| 17 | CT-T019 = BMad-Guide T0169 v5.7.0（`3c88c74` / `746e5bc` 收單） | ✅ |
| 18 | MCP tool 共 8 個，名稱與 `scripts/bat-mcp.mjs` 一致；檔案 866 行 | ✅ |
| 19 | 遮罩樣式（batcap / sk / github / aws / authorization / pem）與 `terminal-output-redaction.ts` 一致；沒有專案自訂樣式的機制 | ✅ |

**撰寫中更正的兩處**

- Q9：原答覆「工單可覆寫為 squash」在 CT v5.9.0 `merge-workorder.md` 中找不到。報告改寫為「沒有實作」，標 [文件 CT]。
- Q3：初稿寫「tower 權杖未宣告時查詢範圍也是 shell」不精確。依 `helper-query-channels.md` 改為「不能用 workspace / towers scope，但仍可查自己派出的 Worker」。

### 仍標 [推論] 的項目

- 新增內容沒有任何 [推論]。查不到來源的說法一律不寫，或寫明「未找到 / 沒有實作」。
- 只有原文標頭的證據等級說明保留 [推論] 這個標記。
- 下列幾處以來源原文為準，但實機無法重現，報告中已註明：
  - codex 共用 daemon（BUG-159）的結論來自原始碼分析，標 [碼 codex `rust-v0.163.0`]。
  - BUG-151 在 T0601 是間接證據。

### 變更檔案

- `D:\ForgejoGit\@Gower_Labs\BMad-Guide\BAT MCP Server 規格提案 — 實作報告.md`：BMad-Guide `33f2a07`
- `_ct-workorders/T0661-update-bat-mcp-implementation-report.md`：本工單，只 commit 本檔
- 本 repo 原有的髒檔 `src/styles/settings.css` 沒有動，也沒有帶入 commit

### 落點檢查

- **C-0：PASS**。`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。
- **C-1：PASS**。工單在 `REPO_ROOT/_ct-workorders/` 下。
- **C-3：不適用**。`affects_files` 第一項是本 repo 以外的絕對路徑，第二項在 `_ct-workorders/` 下（排除）。外部檔案實際存在。
- **C-2**：工單沒有 `branch` 欄位。
- `CT_HOME` 未設定，不是 worktree。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 偏差與備註

- 工單開始時 `status` 是 `TODO`，不是 `PENDING`；照常改成 IN_PROGRESS。
- frontmatter 的 `created_at`（20:59:00）晚於實際開工時間 `started_at`（20:58:04，系統時間），沒有修改。
- 給塔台的觀察：PLAN-047 的 frontmatter / Metadata 表沒有隨 M1b 等批次更新（`updated_at` 停在 2026-10-17）。報告 §7 照實寫了；是否整理由塔台決定，本單沒有改。
- 互動：無（yolo，沒有提問）。

### 互動紀錄

- 無。
