---
schema_version: 1
schema_kind: workorder
id: T0937
title: "待辦分頁「⏸ 待你決定」有選項的題目加「其他（自由回答）」；放棄備註改成只寫原因"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-070
priority: P2
sizing: S
created_at: "2026-11-27T11:25:19+08:00"
updated_at: "2026-11-27T11:25:19+08:00"
session_ids: []
target_version: "0.8.0-pre.8"
depends_on: []
related:
  - "PLAN-070 子項 1；D393；T0908（契約 v2 清單與回答）、T0922（推薦與放棄）、T0936（同版，已在 `main`）；給 CT 的提案 `_reply-2026-11-27-ct-inbox-other-multiselect.md`"
affects_files:
  - _ct-workorders/T0937-inbox-awaiting-other-answer.md
  - src/components/inbox/InboxLists.tsx
  - src/lib/tower-inbox.ts
  - src/lib/__tests__/
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/styles/
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
  - site/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0937` 寫檔（base = 派工當下的 `main`，已含 T0936）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 「其他」：`awaiting_user` 有 `options`（非 `optionsInvalid`）的題目，單選清單最後多一項「其他（自由回答）」（i18n 新鍵；en `Other (free answer)` / zh-TW `其他（自由回答）` / zh-CN `其他（自由回答）`）。選了它 → 在清單下方出現一行輸入框（沿用 `.inbox-free-input`、`maxLength` 900、Enter 送出、IME 組字中不送），送出 `U-n：<文字>`（trim 後非空才可送）；改選其他選項時輸入框收起、文字保留在元件狀態即可。不支援多選（PLAN-070 子項 4 另開單）。"
  - "🔴 送出路徑不變：一律經既有 `submit` → `onAnswer` → `tower-inbox:answer`（`checkInboxAnswer` 單編號行本來就接受任意文字）；不新增 IPC / channel、不改 `checkInboxAnswer` / `enqueueAnswer`。自由文字以「放棄」或「略過」開頭時，CT 會當成放棄（CT 規格的已知取捨）：輸入框下方顯示一行提示（i18n 新鍵，例「以「放棄」開頭會被當成放棄」），只在文字以這兩個詞開頭時出現，不擋送出。"
  - "🔴 推薦項：預設選取仍是 `recommended`（T0922）；「其他」永遠不是預設、不標推薦。`options: []` 的題目維持原本的自由輸入框（不重複加「其他」）。"
  - "🔴 放棄備註文字：`inbox.dismiss.dismissNote` 從「原因或新方向（一行，選填）」改成「原因（一行，選填）」（en / zh-CN 對應改）；放棄的送出格式、勾選批次、「全部放棄」不動。要給新方向改用「其他」（CT 端語意由 CT 改，見提案第 2 點；BAT 不另判斷）。"
  - "🔴 不變：⏸ 的 `waitingOrders`、推薦標記、放棄 / 批次、🙋 / ⏰ / 💬 / 📋、參考檔案連結（T0930 / T0935 / T0936）；`inbox_features` 沒有 `dismiss` 時「其他」照樣顯示（它不屬於 dismiss 能力，CT 6.1.0 起就接受 `U-n：<自由文字>`）。"
  - "🔴 測試：元件——有選項時清單最後是「其他」、選了才出現輸入框、送出 `U-n：<文字>`（經 mocked `tower-inbox:answer`）、空白不可送、IME 組字中 Enter 不送、以「放棄」開頭顯示提示仍可送、推薦項仍預設選取、`options: []` 不加「其他」、`optionsInvalid` 不加；放棄備註 placeholder 新文字。既有 T0908 / T0922 / T0929 / T0930 / T0934 / T0935 / T0936 測試斷言不改、全過（若必然衝突，問塔台）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」與「推薦項與放棄（PLAN-069）」補「其他」與放棄備註的說明（T0937）；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節補一句（小節標題不改名，T0595）；網站 `site/tower-inbox.md`〈怎麼回答〉補「其他」（`0.8.0-pre.8` 起）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態請寫 `DONE`（`FIXED` 是 BUG 用的，L177）。"
---

# T0937 — 待你決定加「其他」

## 背景

使用者 2026-11-27：「如果選項都不在清單內，用放棄填原因，會被當新選項還是會真的放棄只記原因，如果是，應該統一要有其他選項可填」。

BAT 待辦分頁的「⏸ 待你決定」在 `options` 非空時只有單選＋送出，沒有自由輸入（`InboxLists.tsx` 約第 334–356 行；只有 `options: []` 才有輸入框）。原生選單有內建「其他」、終端可打 `U-n：<文字>`，只有待辦分頁沒有，使用者只能借「放棄…」備註欄填字，而 CT 會把放棄附的文字當新方向。使用者裁示（D393）：統一要有「其他」；放棄附的文字改成只當原因（CT 端另改，PLAN-070）。

## 範圍

- 「⏸ 待你決定」有選項的題目加「其他（自由回答）」，送出 `U-n：<文字>`。
- 放棄備註欄文字改成只寫原因。
- 不做多選（PLAN-070 子項 4，等 CT 核定契約後另開單）。

## 驗收

- [ ] 有選項的題目最後有「其他」；選了出現輸入框，送出 `U-n：<文字>`，塔台收到
- [ ] 推薦項仍預設選取；`options: []` 的題目畫面不變
- [ ] 以「放棄」開頭的文字顯示提示、仍可送
- [ ] 放棄備註 placeholder 改為「原因（一行，選填）」
- [ ] 既有 inbox 測試不改斷言全過；新增元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件三處（docs、CLAUDE.md、網站）

---

## 回報區

（Worker 填寫）
