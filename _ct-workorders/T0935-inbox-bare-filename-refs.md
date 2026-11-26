---
schema_version: 1
schema_kind: workorder
id: T0935
title: "待辦分頁參考檔案連結：只寫檔名（沒有 `/`）的檔案也辨識，存在才連"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-26T23:37:08+08:00"
started_at: "2026-11-26T23:38:33+08:00"
updated_at: "2026-11-26T23:39:30+08:00"
tower_question: open
session_ids: []
target_version: "0.8.0-pre.7"
depends_on: []
related:
  - "T0930（參考檔案連結，已知限制「只寫檔名不連結」）、T0934（💬 卡片沿用）；D383；使用者 2026-11-26 截圖（另一個專案的待辦分頁：`🙋 待你執行` 的標題含 `(_reply-<日期>-<主題>.md)`，沒有變成連結）"
affects_files:
  - _ct-workorders/T0935-inbox-bare-filename-refs.md
  - src/lib/inbox-file-refs.ts
  - src/lib/__tests__/inbox-file-refs.test.ts
  - src/components/inbox/useInboxFileRefs.ts
  - src/components/__tests__/
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
  - "🔴 分支：只在 `ct/T0935` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改辨識規則，唯一實作仍是 `src/lib/inbox-file-refs.ts`（T0930）；顯示 `InboxRefText`、存在檢查 `useInboxFileRefs`、開檔 `openFileInFilesTab`、`TowerCardsSection`（T0934）與三個清單的接線都沿用，不另寫第二套、不新增 IPC。"
  - "🔴 新規則：單獨的檔名（不含 `/` `\\`）＋副檔名（`.` 之後 1–8 個英數字、至少一個英文字母；`0.8.0`、`1.2` 這類版號不算）視為檔案參照。解析：依序試工作區根目錄、`_ct-workorders/`（與 T0930 相對路徑同順序）；**存在才成連結**，找不到一律純文字（`github.com`、`example.org` 這類網域名稱因此不會誤連）。前後界線沿用 T0930（前後不得是英數、`_ . - / \\ : @ ~`；中文、中文標點、半形 / 全形括號、引號、反引號相鄰都可以）；檔名開頭可以是 `_`（例 `_reply-….md`、`_tower-state.md`）。"
  - "🔴 不變：T0930 的既有規則（含 `/` `\\` 的路徑、編號、URL / UNC / `~` / `..` / 工作區外不連結）與測試斷言全部不改；存在檢查上限 `INBOX_FILE_REF_MAX` 與只查顯示部分、不輪詢不變（若因檔名參照變多需要調整上限，問塔台）；卡片收合摘要仍不加連結（T0934）；文字逐字不變、不以 HTML 解譯。"
  - "🔴 測試：`inbox-file-refs.test.ts` 新增——括號內的 `_reply-2026-11-26-topic.md`、反引號內的 `package.json`、句中 `README.md`、版號 `0.8.0` / `v1.2` 不算、網域 `github.com` 只有存在同名檔才連、`.md` / `file.` 這類不完整的不算、與中文 / 全形標點相鄰；元件測試：檔名參照在根目錄或 `_ct-workorders/` 存在時成連結並開對路徑、不存在為純文字。既有 T0930 / T0934 測試不改斷言、全過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「參考檔案連結（T0930）」辨識規則與已知限制改寫（移除「只寫檔名不連結」）；CLAUDE.md 對應一點視需要補一句（小節標題不改名，T0595）；網站 `site/tower-inbox.md` 那行「只寫檔名、沒有 `/` 的不會變成連結」改成新規則（版號寫 `0.8.0-pre.7` 起）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑（截圖路徑寫 `<使用者資料夾>`）；測試檔名自行編造（例 `_reply-2026-11-26-topic.md`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0935 — 只寫檔名的參考檔案也可點

## 背景

T0930（`v0.8.0-pre.5`）讓待辦分頁的參考檔案可點，但路徑必須含 `/` 或 `\`（`src/lib/inbox-file-refs.ts` 的 `PATH_SOURCE`），只寫檔名的不連結（T0930〈已知限制〉）。使用者 2026-11-26 在另一個專案的待辦分頁截圖：`🙋 待你執行` 一筆的標題結尾是 `(_reply-<日期>-<主題>.md)`——CT 跨專案回覆檔放在 `_ct-workorders/`，塔台常只寫檔名——沒有變成連結。

## 範圍

- 辨識：單獨的檔名＋副檔名（規則見 memory_overrides）。
- 解析與存在檢查：工作區根目錄 → `_ct-workorders/`，存在才連。
- 適用所有沿用 T0930 的地方：「⏸ 待你決定」「🙋 待你執行」「⏰ 到期提醒」與「💬 塔台訊息」卡片（加亮行、展開內文；收合摘要不加）。

## 驗收

- [ ] `(_reply-….md)`、`` `package.json` ``、句中 `README.md` 等存在的檔成連結，點了在「檔案」頁籤開啟並定位；版號、網域、不存在的檔為純文字
- [ ] T0930 / T0934 既有測試不改斷言全過；新增純函式與元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件三處（docs、CLAUDE.md 視需要、網站）

---

## 回報區

### 待塔台決策

#### Q-1：既有 T0930 斷言 `refs('… 與 sample.md 與 …')` 為 `[]`，與新規則直接衝突，要怎麼處理？
- **提問時間**：2026-11-26T23:39:30+08:00
- **背景**：`src/lib/__tests__/inbox-file-refs.test.ts:89`（`it('ignores pieces without a slash or an extension, and UNC paths')`）斷言 `refs('版本 v0.8.0 與 \`npm run build\` 與 sample.md 與 docs/folder')` 為 `[]`。其中 `sample.md` 正是本單要辨識的「只寫檔名＋副檔名」。`splitFileRefs` 是純函式、不查存在，新規則下 `sample.md` 會回成 `kind: 'ref'` 的候選（存在與否由 `useInboxFileRefs` 決定），這一個斷言必然失敗。memory_overrides 同時寫「T0930 測試斷言全部不改」。
- **選項**：
  - A：只改這一行斷言——把 `sample.md` 從「不辨識」清單移到新測試（斷言它是候選 `{ kind: 'path', path: 'sample.md' }`）；同一行的 `v0.8.0`、`npm run build`、`docs/folder` 照舊斷言 `[]`；其他 T0930 / T0934 斷言一律不動。
  - B：`splitFileRefs(text, { bareNames?: boolean })`，預設關（T0930 行為與斷言逐字不變），三個清單、💬 卡片與 `itemFileRefs` 一律帶 `true`。
  - C：新增 `TextPart` 種類（例 `kind: 'name'`）專給檔名候選，`InboxRefText` / `itemFileRefs` 另外處理；舊測試的 `refs()` 只篩 `'ref'`，斷言自然維持。
  - 其他。
- **建議**：A。該斷言測的正是本單要移除的限制（T0930〈已知限制〉「只寫檔名不連結」），B / C 只是為了讓舊斷言通過而多一個預設值永遠不用的開關或第二種 part，徒增維護面。
- **影響**：決定 `splitFileRefs` 的介面與測試寫法；不影響畫面行為（三案的產品行為相同）。
- **是否阻擋後續**：阻擋實作與測試。
