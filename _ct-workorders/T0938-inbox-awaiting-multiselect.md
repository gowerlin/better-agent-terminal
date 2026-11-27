---
schema_version: 1
schema_kind: workorder
id: T0938
title: "待辦分頁「⏸ 待你決定」多選：`inbox_features` 含 `multi` 且 `awaiting_user[].multi: true` 時畫成複選，送出 `U-n：A、C`（CT 6.3.0 契約）"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-070
priority: P2
sizing: M
created_at: "2026-11-27T11:32:11+08:00"
updated_at: "2026-11-27T11:32:11+08:00"
session_ids: []
target_version: "0.8.0-pre.8"
depends_on: ["T0937"]
related:
  - "PLAN-070 子項 4；D394；CT 回覆定稿（CT D906，CT PLAN-021 / 6.3.0）§ 3，定稿表已抄進本單〈契約定稿〉；T0922（推薦與放棄）、T0937（「其他」，本單的 base 已含）"
affects_files:
  - _ct-workorders/T0938-inbox-awaiting-multiselect.md
  - src/lib/tower-inbox.ts
  - src/lib/ct-tower-overview.ts
  - src/lib/__tests__/
  - src/components/inbox/InboxLists.tsx
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/styles/
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
  - site/tower-inbox.md
  - README.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0938` 寫檔（base = 派工當下的 `main`，已含 T0936 / T0937）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 契約以本單〈契約定稿〉為準（CT 已核定，BAT 不得單方更改）。BAT 負責：能力旗標判讀、`multi` 欄位（M1）、送出去重與排序（M3）、多個推薦項（M4）。M2（哪些 `source` 用多選）、M5（原生選單「其他」＋勾選）是 CT 端行為，BAT 不判斷 `source`。"
  - "🔴 唯一實作：`INBOX_FEATURES` / `parseInboxFeatures` 加 `\"multi\"`；`parseTowerStateInbox`（`ct-tower-overview.ts`）讀 `multi`（只接受布林 `true`，其他值與 `options` < 2 項一律當 `false`，不報錯、不略過該筆）；`matchRecommended` 擴充或新增函式回傳推薦代號清單（以 `、` 分隔；單選題只取一個代號＝現行行為；多選題每個都要對得到，有一個對不到就整個不推薦，同 CT 寫入規則）；多選回答文字的組法寫成純函式（例 `multiAnswerText(id, codes, options)`：依 `options` 順序、去重、以 `、` 連接），放 `src/lib/tower-inbox.ts`。不在元件內聯。"
  - "🔴 畫面：只有在 `inboxFeatures` 含 `multi` **且** 該筆 `multi === true` **且** `options` ≥ 2 項時改成複選框（`role=\"group\"`，選項沿用 `data-inbox-option`）；推薦項（可多個）都標「推薦」、預設勾選；「其他（自由回答）」照 T0937 保留在清單最後——選「其他」會取消所有勾選並顯示輸入框，勾任何選項會取消「其他」（兩者互斥，BAT 不送混合回答）。送出：勾 ≥ 1 項 → `U-n：<代號>[、<代號>…]`；「其他」→ `U-n：<文字>`。題目旁加一行「可複選」（i18n 新鍵）。其餘情況（沒有 `multi` 旗標、`multi` 不是 `true`、選項 < 2）畫面與行為和現在完全相同。"
  - "🔴 不變：送出一律經既有 `submit` → `tower-inbox:answer`（`checkInboxAnswer` 單編號行接受任意文字，不改）；放棄 / 略過 / 批次、`⏸N`、🙋 / ⏰ / 💬 / 📋、參考檔案連結、T0937 的放棄提示；不新增 IPC / channel；日誌不記選項與回答內容。"
  - "🔴 測試：純函式——`parseInboxFeatures` 認得 `multi`；`multi` 非布林 / `options` 1 項時為 false；推薦 `\"A、C\"` 在多選題回 [A, C]、在單選題不推薦（或只認單一代號，依現行 `matchRecommended` 行為，不得改單選題的既有斷言）、有一個對不到就不推薦；`multiAnswerText` 依 options 順序、去重、大小寫照 options 寫法。元件——旗標＋`multi: true` 畫複選、預設勾推薦項、勾兩項送 `U-3：A、C`、勾一項送 `U-3：A`、「其他」與勾選互斥、沒有旗標時同一筆仍是單選、`multi: true` 但 1 個選項時單選。既有 inbox 測試（T0908 / T0922 / T0929 / T0930 / T0934–T0937）斷言不改、全過（若必然衝突，問塔台）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉（雙方實機驗收在 CT 6.3.0-pre.1 之後另做），不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」加多選小節（旗標、欄位、畫面、送出格式、與 CT 的分工 M1–M5）；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節補一點（小節標題不改名，T0595）；網站 `site/tower-inbox.md`（`0.8.0-pre.8` 起、需 CT 6.3.0）；README「與 BMad Control Tower 協作」的整合點表與版本對照表加：「其他」（BAT 0.8.0-pre.8，CT 6.1.0 起可用）、放棄文字只當原因與多選（BAT 0.8.0-pre.8 ＋ CT 6.3.0）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態請寫 `DONE`（`FIXED` 是 BUG 用的，L177）。"
---

# T0938 — 待你決定多選

## 背景

使用者 2026-11-27 要求多選「現在就做」（D393）。BAT 提案 `_reply-2026-11-27-ct-inbox-other-multiselect.md`，CT 已核定（CT D906，CT 6.3.0，先 6.3.0-pre.1），有 5 處修改（M1–M5）。本單是 BAT 端實作（PLAN-070 子項 4）。

## 契約定稿（CT 回覆 § 3，原文摘錄；不得單方更改）

| 項目 | 定稿 |
|---|---|
| 能力旗標 | CT 6.3.0 起每次寫 `inbox_features: ["recommended", "dismiss", "multi"]`。`multi` = 寫這份狀態檔的塔台看得懂多選回答。BAT 只在有這個值時把 `multi: true` 的題目畫成複選 |
| 欄位 | `awaiting_user[].multi`：布林、選填、預設 `false`；只在 `options` ≥ 2 項時有意義（M1：CT 只在 ≥ 2 項時寫，YAML 不加引號的 `true`；讀者看到 < 2 項的 `multi: true` 時忽略，不報錯） |
| 什麼時候用 | M2：CT 只在 `source` 是 `tower-question` / `worker-question` 且選項可同時成立時寫；yolo 斷點一律單選（CT 端行為） |
| 回答格式 | 冒號後整段拆成代號後，每個都對得到同一筆的 `options`（不分大小寫）才算多選，重複的去掉（M3）；只有一個代號 = 單選。**BAT 固定依 `options` 順序、以 `、` 連接送出** |
| 解析 | 判斷順序：放棄／略過 → 代號比對 → 自由文字（CT 端） |
| 推薦項 | M4：多個代號（以 `、` 連接）只限 `multi: true` 的那一筆；單選題的 `recommended` 仍只放一個代號。每個推薦項都標「（推薦）」、依原順序排在最前面。CT 寫入前確認每個代號都對得到，有一個對不到就整個不寫 |
| 原生選單 | M5（CT 端）：`multiSelect: true`；不加放棄選項；「其他」與勾選同時出現的處理由 CT 判斷 |
| 確認行 | 例 `U-3 已收到：A、C → <處置>`（CT 端） |
| 放棄／略過 | 不變；多選題照樣可 `U-n：放棄` |
| 批次 | 不變：多編號只用在放棄／略過；`U-1、U-3：A` 仍不支援 |

相容：CT 6.2.x 的狀態檔沒有 `multi` 旗標，BAT 畫面維持現狀；`bat_contract` 維持 2。

## 範圍

- 解析：`multi` 旗標、`multi` 欄位、多個推薦項。
- 畫面與送出：複選框、「其他」互斥、`U-n：A、C`。
- 文件四處（docs、CLAUDE.md、網站、README 協作章節）。

## 塔台補充（派工前，2026-11-27 11:34）

- T0937 已合併（「其他」＝`[data-inbox-option-other]`、輸入框 `[data-inbox-other-input]`、放棄提示 `[data-inbox-other-hint]` / `inbox.answer.otherDismissHint`，判斷沿用 `isDismissAnswer`）。多選模式的「其他」沿用這套元件，不另寫。
- 併入本單：`options: []`（與 `optionsInvalid`）的自由回答欄也顯示同一行放棄提示（同一個判斷、同一個 i18n 鍵、不擋送出）；元件測試補一項。這是 T0937〈後續建議〉。

## 驗收

- [ ] `options: []` 的自由回答欄以「放棄 / 略過」開頭時顯示放棄提示（T0937 後續）
- [ ] 旗標＋`multi: true`＋≥ 2 選項 → 複選；推薦項（可多個）預設勾選並標推薦；送出依 options 順序、`、` 連接
- [ ] 「其他」與勾選互斥；放棄 / 略過 / 批次不變
- [ ] 沒有旗標、`multi` 不是 `true`、選項 < 2 → 與現在完全相同
- [ ] 既有 inbox 測試不改斷言全過；新增純函式與元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟（雙方實機驗收在 CT 6.3.0-pre.1 後另做）
- [ ] 文件四處

---

## 回報區

（Worker 填寫）
