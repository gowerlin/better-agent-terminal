---
schema_version: 1
schema_kind: cross-tower-handover
id: _handover-2026-10-18-ct-evolution-doc-update
title: 交辦 BMad-Guide 塔台 — 更新《Control Tower 演進史.html》（目前只寫到 CT v5.2.3）
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "BMad-Guide T0175（D073；回覆稿 BMad-Guide/_ct-workorders/_reply-2026-10-18-ct-evolution-doc-update.md，d22ed48）"
created_at: "2026-10-18T20:36:04+0800"
---

# 交辦：更新《Control Tower 演進史.html》

> **來源**：使用者 2026-10-18 20:3x 指示：「『Control Tower 演進史.html』可以轉給 CT 塔台」（原請 BAT 塔台在 BAT 發版後更新，改由 CT 塔台負責）。
> **檔案**：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\docs\Control Tower 演進史.html`（49,850 bytes，最後修改 2026-10-17 16:11）。

## 1. 現況

- 章節：六個世代、v1 → v2、塔台和 Worker 分開跑、派工迴路、三層資料、5.0.0 frontmatter、5.0.3 SKILL.md 路由器、5.0.4 之後一條規則只寫一處、「v1 與 CHANGELOG 的 35 個版本」、資料來源。
- 版本號只出現到 **v5.2.3**（BAT 塔台以 grep 確認）；CT 目前是 **v5.9.0**，v5.2.4–v5.9.0 尚未寫入。

## 2. 請求

把 v5.2.4–v5.9.0 補進演進史（版本表與相關章節），寫法、版面、資料來源格式由貴方依現有文件決定。CT 自己的版本內容以貴方 CHANGELOG 為準；BAT 側只提供下面的對照與背景，供「派工迴路」等章節參考。

## 3. BAT 側對照（供參考，事實以 BAT README「版本對照」與各工單為準）

| CT 版本 | 依賴的 BAT 能力 | BAT 最低版本 | BAT 委派單 |
|---|---|---|---|
| v5.2.4 | 每分頁範圍權杖（`batcap.`）的文件與失敗提示 | `0.7.0-pre.1` | CT-T014 |
| v5.3.0 | worktree 隔離派工、合併工單；BAT MCP 唯讀查詢列為選用通道 | `0.7.0-pre.2` | CT-T015 / CT-T016 |
| v5.4.0 | Worker 分頁關閉後查 worktree 狀態（`source`） | `0.7.0-pre.4` | — |
| v5.5.0 | 等人回答偵測（`blocked`）→ 斷點 D | `0.7.0-pre.4`（`question`：pre.5） | CT-T017 |
| v5.6.0 | Worker 啟動確認（`--wait-started`、`agentStarted`） | `0.7.0-pre.6` | CT-T018 |
| v5.7.0 | Worker 問塔台（`--ask` / `--answer`、`bat_list_questions`） | `0.7.0-pre.7` | CT-T019 |
| v5.8.0 | codex 分頁的等人回答與啟動確認（OSC 7501） | `0.7.0-pre.9` | CT-T020 |
| v5.9.0 | 跨 session 選收件人（`<工作區> · Tower`、`scope: towers`、`claudeSessionName`） | `0.7.1-pre.1` | CT-T021 |

- 「BAT 定介面契約、CT 依契約撰寫」的分工：BAT 網站 `/cases` R1 已公開描述（約 20 次委派、截至 2026 年 10 月），可作為敘事參考。
- 委派單編號、內部決策編號是否上演進史，由貴方依該文件原有原則決定（BAT 網站對外不放這些編號）。

## 4. 近期 BAT 動態（可能值得在「派工迴路」或後記提及，非必要）

- **PLAN-051 跨塔台傳訊**：BAT T0647 評估後**維持 IDEA**（D169）：目前跨塔台往來都是兩個 Claude 塔台、同一台機器，PLAN-050 已涵蓋。更正兩項前提：SendMessage 經 Remote Control 可跨機器 / 雲端（WSL 2 / container 與 host 仍不通）；codex `0.163.0` 有 `codex queue`（只限 codex ↔ codex）。
- **BAT `0.7.1-pre.2`（準備發佈）**：BUG-162 claude Worker 的權限請求被放行或逾時拒絕後 ⚠️ 不消失 → 新增 async `PostToolBatch` hook 清除（`blockedReason: permission` 的清除規則新增一條，契約欄位不變）；BUG-159 codex 分頁在 BAT MCP 沒注入時加 `--no-daemon`；其他為遠端精靈與 UI 修正。**這些都不需要 CT 改規則。** 發版後 BAT 塔台另以跨 session 訊息通知版號。

## 5. 回覆

受理或不受理請照 `cross-project-coordination.md` 的回覆稿格式，寫在貴方 repo；完成後以跨 session 訊息告知 BAT 塔台即可（本稿 `status` 由 BAT 塔台依回覆更新）。
