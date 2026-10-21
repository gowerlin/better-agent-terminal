---
schema_version: 1
schema_kind: workorder
id: CT-T022
title: "【受派】CT 重派同一張工單前先回收舊 Worker 分頁（`--close-worker`），避免新 Worker 完成時回收 AMBIGUOUS 與兩個分頁都標 ✓（BAT BUG-170）"
type: implementation
status: DONE
repo: BMad-Guide
project: BUG-170
priority: P3
sizing: S
created_at: "2026-10-22T00:58:09+0800"
depends_on: []
related:
  - BUG-170
  - D180
  - T0693
  - PLAN-041
  - CT-T011
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T022 — 重派前先回收舊 Worker 分頁

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（BUG-170，D180；T0693 研究回報區「調查結論」2 R2、4-b）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：`CLAUDE.md`「Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145）」節、`docs/agent-guide/worker-tab-recycle.md`；`--close-worker` 契約（PLAN-041「介面契約」，CT-T011 依此撰寫）**不變**。本檔與權威不一致時以權威為準。
- **BAT 不需要改程式**：現行 `--close-worker` 已滿足本需求（見下方「BAT 現況」）。

## 問題

CT 在下列情況會對**同一張工單**再派一個新 Worker，而舊 Worker 分頁還開著：

1. yolo 提問備援：`T#### 需要協助`（`BLOCKED` + `tower_question: open`）→ 塔台在 Renew 區段答覆、`status` 改回 `PENDING`、**派新的 Worker，不對舊分頁送按鍵**（`yolo-mode.md` § 塔台端「收到備援的 `T#### 需要協助`」）。
2. 其他重派：`BLOCKED` / `FAILED` 後 Renew 重派、使用者停掉首派後重派（BAT 第八十 session T0630 實例）。
3. （待 CT 判斷）`ct-done` 補救派工：舊的 `ct-exec` 分頁還在時。

結果：

- 新 Worker `DONE` 後，`worker_auto_close` 的 `--close-worker T####` 因同塔台、同工單有兩個存活分頁回 **exit 5 `AMBIGUOUS`**（BAT `electron/close-worker.ts`：以工單找候選、過濾歸屬塔台，`owned.length > 1` 即拒絕）。CT 依 `work-order-system.md` 只「一行回報使用者，不重試」，兩個分頁都要手動關。
- 新 Worker 回報時，BAT 把同塔台、同工單的所有分頁都標 `✓`（`findReportingWorkers`，BAT 有測試鎖定此行為），舊分頁看起來也像剛完成。

## BAT 現況（CT 可以直接用）

- `--close-worker` 在**呼叫當下**就決定要關哪個分頁：只有一個候選時記下它的 terminal id 再排程，之後新建的分頁不影響這次回收。所以「先 `--close-worker` 舊分頁、再派新 Worker」不會關錯。
- `--delay-ms 0` 可用；到期後等連續安靜 5 s（最多再等 60 s），排程後使用者在舊分頁輸入會取消（T0545 / D145）。
- 舊分頁不存在（使用者已關、BAT 重開後沒還原）→ exit `3` `NOT_FOUND`。
- 隔離工單照現行加 `--worktree keep`（worktree 與 `ct/T####` 分支留給新 Worker 沿用與之後合併）。

## 需要 CT 改的地方（建議，範圍由 BMad-Guide 決定）

1. **重派前回收舊分頁**：塔台要對一張「本塔台曾在 BAT 派過 Worker」的工單再派 Worker 時，派工前先執行
   `"${BAT_HELPER_NODE:-node}" "<helper>\bat-terminal.mjs" --close-worker T#### --notify-id "$BAT_TERMINAL_ID" --delay-ms 0 [--worktree keep]`。
   exit code 處理建議（**不得因此擋住重派**）：

   | exit | 處理 |
   |---|---|
   | `0` | 繼續派工 |
   | `3` NOT_FOUND | 繼續派工（沒有舊分頁） |
   | `4` / `5` / `1` / 其他 | 一行提示使用者（`5` 時請手動關舊分頁），繼續派工；`1` 時本 session 不再嘗試 |

2. **適用範圍**：至少涵蓋上方情況 1、2。情況 3（`ct-done`）請 CT 判斷：舊分頁可能是使用者要保留查看的現場。
3. **不要**在使用者自己於原分頁「重讀工單」的 Renew（研究工單 R1，沿用原分頁）時回收——那個分頁就是要繼續的 Worker。
4. **文件**：`yolo-mode.md`「收到備援」、`work-order-system.md` 的重派流程與 § 收單後回收 Worker 分頁（說明重派前回收與 `worker_auto_close` 的關係：`worker_auto_close: off` 時是否仍回收由 CT 決定，建議仍回收，因為這是避免重複分頁，不是收單回收）。

## 不在範圍

- BAT 端不改 `--close-worker` 契約（不把 `AMBIGUOUS` 改成全部關閉）、不加派工時的重複偵測：前者會改變 PLAN-041 契約語意且可能關掉仍在工作的分頁，後者仍需要 CT 讀新欄位才有用。
- BAT T0694（`cefb9db3`，未發版）：Worker 回報後又開始工作時分頁標籤顯示 `↻`、不列入手動批次關閉；與本單無關，CT 不需要配合。

## 驗收建議

- BAT 上以 yolo 派一張 `worker_question_timeout: 0` 的小工單讓它走備援 → 塔台答覆並重派 → 舊分頁被回收、只剩新分頁 → 新 Worker `DONE` 後 `--close-worker` exit `0`。
- 舊分頁已手動關掉時重派 → `--close-worker` exit `3`、照常派工。

## 完成回覆

請以跨 session 訊息或 `_reply-*.md` 告知：修改的 CT 檔案與版本號、情況 3 的決定、與 BAT 權威的差異（若有）、需要 BAT 補的東西（若有）。BAT 收到後由 BAT 塔台代跑「驗收建議」並把 BUG-170 改為 FIXED。

### 收到的回覆（BAT 塔台記錄，2026-10-22T01:02:20+0800）

- BMad-Guide 塔台（`BMad-Guide · Tower`）跨 session 訊息：**受理**，開 BMad-Guide T0184（CT v5.12.0 + guide v5.12.0），2026-10-22 01:02 以 yolo、不隔離派出（分頁 `BMad-Guide · Worker · T0184`）。
- 對方決策 D094（使用者拍板）：
  1. 版號 v5.12.0 MINOR：塔台多一個步驟，BAT 介面與 BAT 最低版本都不變。
  2. 涵蓋：備援重派、BLOCKED / FAILED Renew 重派、使用者停掉首派後重派、首派 exit 8 後使用者決定重派。重派前 `--close-worker T#### --notify-id "$BAT_TERMINAL_ID" --delay-ms 0`，隔離工單加 `--worktree keep`；exit 0 / 3 照常派工；5 / 4 / 1 / 其他一行提示後照常派工；exit 1 時本 session 的收單回收也不再嘗試。
  3. `ct-done` 補救派工：**不回收，保留現場**；收單遇 exit 5 照現行一行提示使用者手動關。
  4. `worker_auto_close: off` 時**仍回收**（同 BAT 建議）。
  5. 研究單使用者在原分頁重讀時不回收；`--wait-started` 不支援而去參數重派時不回收（前一次沒有建立分頁）。
- 規則權威：`work-order-system.md` 新小節；`yolo-mode.md`「收到備援」、`research-workorder.md`、`auto-session.md`、`tower-config.md`、`SKILL.md` 只放引用。
- BAT 待辦：對方塔台複驗 T0184（回報區 AC-3：修改檔案與版號、與 BAT 權威的差異、需要 BAT 補的東西）後回覆；屆時 BAT 塔台代跑本檔「驗收建議」，通過後 BUG-170 → FIXED。

### CT 端完成（BAT 塔台記錄，2026-10-22T01:14:00+0800）

- 來源：BMad-Guide 塔台跨 session 訊息。BMad-Guide T0184 DONE（對方塔台已複驗）；CT **v5.12.0**（MINOR）兩端已裝 16/16（下一個 session 生效），guide v5.12.0 只打包。commit：產品 `53dd232`、工單 `53c0062`、塔台 `7b0b99f`（BMad-Guide dev-main，未 push）。BAT 介面與 CT 要求的 BAT 最低版本都不變。
- 規則唯一權威：`control-tower/references/work-order-system.md` § 回報處理流程 › 重派前回收舊 Worker 分頁（v5.12.0+）；`yolo-mode.md`「收到備援」、`research-workorder.md`、`auto-session.md`、`tower-config.md`、`merge-workorder.md`、`SKILL.md` 只放引用。BAT 塔台已確認本機安裝的 `work-order-system.md` 含新小節。
- 規則與 D094 一致；exit 1 記為「不支援 `--close-worker`」，與收單回收共用同一個 session 旗標。`ct-done` 補救派工、研究單在原分頁重讀、`--wait-started` 去參數重派、首派都不回收。
- 與 BAT 權威的差異：無（只有寫法：helper 路徑寫法沿用 CT 的 Node 解析；exit 6 BUSY 歸在「其他」）。需要 BAT 補：無。
- BAT 待辦：塔台 session 重開（載入 CT v5.12.0）後代跑「驗收建議」兩個情境；通過 → BUG-170 FIXED。
- 補充（2026-10-22T01:25:16+0800）：CT 另出 **v5.12.1** PATCH（BMad-Guide T0185，commit `47bab75`，兩端已裝）：只改文件，`worker_close_delay` 的取消條件改照 BAT T0545 / D145（延遲期間的輸出不取消，只有使用者輸入取消，終端自動回應不算；到期後等連續安靜 5 s、最多再 60 s）。行為、指令、exit code 與 v5.12.0 相同；與 BAT 權威差異無、需 BAT 補無。驗收以 v5.12.1 為準。
- **BAT 驗收（2026-10-22T01:35:57+0800）：PASS**。塔台載入 CT v5.12.1，以 yolo、`worker_question_timeout: 0` 的測試工單代跑「驗收建議」兩情境。T0695（`76306429`）：備援重派前 `--close-worker T0695 --delay-ms 0` exit 0，舊分頁 `exited`、只剩新分頁；收單回收 exit 0（不再 AMBIGUOUS）。T0696（`4b25af6e`）：使用者手動關舊分頁後，重派前 `--close-worker T0696` exit 3 NOT_FOUND、照常派工；收單回收 exit 0。 → BUG-170 FIXED。
