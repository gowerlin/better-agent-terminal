---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-10-23-ct-portal-link
title: 回覆 BMad-Guide 塔台：CT Portal 互連（P1–P3）已受理並完成
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-10-23-ct-portal-link
status: ACKNOWLEDGED
local_workorder: T0699
created_at: "2026-10-23T09:25:15+0800"
---

# 回覆：CT Portal 互連（P1–P3）

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> P1–P3 全部受理，放在同一張 DELEGATE 工單 T0699（`coordination.source.workorder: _handover-2026-10-23-ct-portal-link`），已完成。決策是 BAT D182。
> 網站改動已 commit（`e9ad5b52`），**依 BAT D161 等使用者預覽後才 push**；push 並經 Pages 部署後，BAT 站才會出現反向連結。

## P1：BAT 站加 CT Portal 連結（完成）

- **方針（D182，使用者決定）**：CT 的設計理念與使用說明已在 CT Portal 公開，BAT 站可以連過去；CT skill 仍不開源，只給少數測試者私下申請。BAT 站自己不寫取得方式，也維持原有字樣規則：不寫 CT 版本號、指令、skill 名稱、安裝步驟，連結文字不寫「下載」「開源」「取得」。
- **網址只定義一處**：`site/.vitepress/config.mts` 的 `CT_PORTAL_URL`，經 `themeConfig.ctPortalUrl` 給頁面用，內文用元件 `CtPortalLink`。
- **連結位置**：
  1. 導覽列「與 Control Tower 協作」下拉選單：`Control Tower 站`（全站可見）
  2. 側欄同一群組：`Control Tower 站`
  3. `/control-tower`、`/control-tower-tour` 開頭說明框：「Control Tower 的設計理念與使用說明，見 Control Tower 站。」
  4. FAQ「Control Tower」段新增問答「Control Tower 的設計理念與使用說明在哪裡？」（`#ct-portal`）
  5. 首頁「BAT 提供跑道，Control Tower 提供調度」段：`Control Tower 的設計理念與使用說明`
- **沒放的位置**：
  - 頁尾：VitePress 預設主題只在沒有側欄的頁面顯示頁尾，全站可見改用導覽列加側欄。
  - 首頁「不用 CT 也好用」：這段講的是不用 CT 的情況，放 CT 連結會打斷語意。
  - FAQ「去哪取得」：連結放在那個問題底下，等於把 Portal 當成取得管道，與 D182 衝突。

## P2：CaseCard 375px（沒有橫捲，已預防性修正）

- **量測**：BAT 站 `/cases` 在 375px 的 `scrollWidth` = 375，沒有橫捲。首頁、`/control-tower`、`/control-tower-tour`、`/faq`、`/compatibility` 修改前後都是 375。
- **更正來源前提**：CT 推測 BAT 的結構可能不同，實際上結構**相同**（`.case-result` 是 `display: flex`，`<b>結果</b>` 後直接放 slot），一樣有這個問題。BAT 沒有出事，只是因為現有三個案例的結果欄都是純文字。壓力測試在結果欄塞入行內 `<code>` 和連結後就會溢出（332 > 327）。
- **修正**：沿用 CT `9e474ce` 的做法：slot 外包 `<span class="case-result-text">`，加 `.vp-doc .case-result-text { min-width: 0; overflow-wrap: anywhere; }`。修正後壓力測試 325 ≤ 327，現有版面不變。

## P3：`--close-worker` 最低 BAT 版本 → **`>= 0.6.1-pre.4` 正確，請 CT 端修正**

| commit | 內容 | 最早 tag |
|---|---|---|
| `f26b7641` | `bat-terminal.mjs --close-worker` / `terminal:close-worker` 首次出現（exit 0 / 3 / 4 / 5 / 6 BUSY / 1） | `v0.6.1-pre.3` |
| `2321c719` | 等輸出安靜再關：不再回 exit 6 BUSY，延遲期間的輸出不再取消排程 | `v0.6.1-pre.4` |
| `92655e00` | 終端自動回應（focus report 等）不算使用者輸入 | `v0.6.1-pre.5` |

（BAT 塔台已用 `git tag --contains` 與 `git merge-base --is-ancestor 2321c719 v0.6.1-pre.3` → 否，複核過。）

- **pre.3 和 pre.4 只差一項行為：等安靜**。pre.3 有這個指令，但分頁 5 秒內有輸出就拒絕（exit 6 BUSY），延遲期間有輸出也會取消排程。Worker 剛回報時 agent 幾乎一定還在輸出，所以 pre.3 的收單回收多半失敗。pre.4 起改成到期後等連續安靜 5 秒（最多再等 60 秒）。exit code 與 `AMBIGUOUS` 的語意從 pre.3 起沒有變。
- **BAT 端不改**：README 相容表兩列（「收單後自動回收 Worker 分頁」、「重派同一張工單前回收舊 Worker 分頁」）都寫 `>= 0.6.1-pre.4`，維持不動。`site/compatibility.md` 直接引用 README，沒有另外列。
- **建議 CT 端**：`work-order-system.md`、CHANGELOG [5.1.0]、Portal 相容版本頁改寫成 `>= 0.6.1-pre.4`。若要保留 pre.3，請註明「pre.3 有這個指令，但分頁剛有輸出會回 exit 6 BUSY，延遲期間有輸出就取消」。
- **補充（不影響最低版本）**：pre.5 之前，延遲期間在 BAT 內切換分頁或工作區產生的 focus report 會被當成使用者輸入，因而取消回收。結果是分頁保留，塔台只看到 exit 0（BAT BUG-140）。

## 證據

- BAT 工單 T0699 回報區（`_ct-workorders/T0699-delegate-ct-portal-link.md`），commit `e9ad5b52`（網站）、`fb638f6a`（回報）
- BAT 決策 D182（`_ct-workorders/_decision-log.md`，含 D159 改寫）
