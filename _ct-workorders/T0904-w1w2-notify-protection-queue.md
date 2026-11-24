---
schema_version: 1
schema_kind: workorder
id: T0904
title: "PLAN-068 W1＋W2（在 `v0.8.x`）：送通知的保護 —— B0 通知不搶捲動 / 選取 / 焦點、#23 草稿保護（`draft`）、B 閱讀保護（`reading`）、文字＋Enter 原子送出、回答進同一佇列的基礎；只對契約 v2 塔台"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
updated_at: "2026-11-25T05:11:53+08:00"
started_at: "2026-11-25T05:11:53+08:00"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0903]
related:
  - "PLAN-068；T0902（規格：§1〈終端內的行為〉、§2.4、§5、§6′、R2′ / R3′、調查結論 §1（#23 重新評估、信號 S1、250 ms 窗口）與 §2（B0 `terminal.input('\\r', false)`）、第二版拆單 W1 / W2 列）；T0903（W0）；GitHub #23 / #24；D332 / D333"
  - "T0788（`NotifyHoldController`、`notify-hold-store`、「📨 待送 N」）、T0566（用量限制自動繼續的 Enter 路徑）、T0749（attention 對帳）；CLAUDE.md「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」節、`docs/agent-guide/notify-hold.md`"
affects_files:
  - _ct-workorders/T0904-w1w2-notify-protection-queue.md
  - electron/notify-hold.ts
  - electron/handlers/pty.ts
  - electron/handlers/terminal.ts
  - electron/pty-manager.ts
  - electron/remote/
  - electron/preload.ts
  - electron/main.ts
  - electron/__tests__/
  - src/components/TerminalPanel.tsx
  - src/components/TerminalThumbnail.tsx
  - src/stores/notify-hold-store.ts
  - src/types/
  - src/lib/
  - src/lib/__tests__/
  - src/__tests__/
  - src/components/__tests__/
  - src/locales/
  - scripts/bat-notify.mjs
  - scripts/__tests__/
  - tests/bat-*.test.mjs
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0904（塔台已預先從 `v0.8.x` `d6b9ce86` 建立分支 `ct/T0904`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0904` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（含 W0 T0903），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0 已完成（T0903，`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`、`terminal:role-changed` 的 `towerContract`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0904（W1+W2）、T0905（W3）、T0906（W4），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W1＋W2 合併，因兩者都改 `TerminalPanel.tsx`）：① **B0**：`towerContract == 2` 的塔台分頁，helper 通知（與日後回答）的 submit Enter 改用 `terminal.input('\\r', false)`（不捲動、不清選取、不搶焦點），仍寫 `{ auto: true }`；其他分頁（含非塔台分頁收到的 bat-notify）與 T0566 路徑維持現狀（R3′，測試守住）。② **`draft`**（#23）：host 以 S1 規則追蹤塔台分頁輸入框是否有使用者草稿（最後一次 Enter / Ctrl+C 之後有其他使用者輸入 = 有草稿；bracketed paste 內的 `\\r` 不算送出），有草稿時保留 helper 通知，放行 = 使用者 Enter / Ctrl+C 後安靜 1 s，或「立即送出」；**不設上限**，保留滿 5 分鐘發一次系統通知。③ **`reading`**（B）：renderer 回報塔台分頁「閱讀中」（normal buffer `viewportY < baseY`、有選取、或最近 10 s 有滾輪 / PageUp / Shift+PageUp），停手 10 s 放行、**最長 60 s**；🔴 不擋使用者自己的回答；遠端以新的 proxied channel `terminal:reading-state { terminalId, reading }`（只有布林）。④ **原子送出**：`towerContract == 2` 的塔台分頁，helper 通知一律經 `NotifyHoldController`（不保留時 pass-through），文字送出到 `{ auto: true }` 的 `\\r` 抵達之間（最多 1 s），同分頁的使用者輸入由 host 暫存、Enter 後原樣補寫。⑤ 「📨 待送」顯示保留原因（你在輸入 / 你在閱讀 / 等你回答對話框）＋「立即送出」。⑥ 佇列要能接受「回答」來源的項目（介面與測試即可；回答的 UI 與 IPC 在 W5），規則照 §2.4 表（回答受 blocked / `draft` 保護、不受 `reading` 擋，回答的 Enter 算使用者輸入）。"
  - "🔴 不得改變：T0788 的 reason（`permission` / `question` / `elicitation` / `input`）對所有分頁照舊、`held-full` / 8 筆上限 / 不設逾時（D228）、`bat-notify` / `bat-terminal` 的 exit code 與 stdout、`{ auto: true }` 不算使用者輸入（T0788 第 9 點）、`terminal:notify` 不寫 PTY（T0716）、日誌只記 id / reason / 長度。版本不符或非塔台分頁：行為與今天完全相同（R9′）。"
  - "🔴 #23 驗證：e2e 隔離實例以假 TUI（node 行編輯器腳本，不需登入 claude）重現「草稿＋通知被同一個 Enter 送出」並驗證修正（T0902 建議），另測 250 ms 窗口內打字與按 Enter 兩種情況、`reading` 的 60 s 上限、版本不符時行為不變。真 xterm 單元測試：B0 往上捲時 `viewportY` 不變、選取保留、焦點不變、`onData` 位元組與 keydown 路徑相同。"
---

# T0904 — PLAN-068 W1＋W2：送通知的保護

## 背景

GitHub #24（塔台訊息讀到一半被擠走）與 #23（Worker 通知混進塔台輸入框的草稿）的整合設計已雙方核定（T0902、BAT D329 / D330、CT D868）。T0902 查證：#23 在現行程式仍會發生（塔台 `idle` 或 `working` 時都會；寫入與 Enter 之間 250 ms 窗口雙向出錯）；畫面被拉回底部有一部分是 BAT 自己的 submit Enter 走 xterm 使用者輸入路徑造成（B0）。W0（T0903）已提供每個塔台分頁的 `towerContract`。

## 實作

照 `memory_overrides` 的範圍與 T0902 §2.4 / §5 / R2′ / R3′：host（`NotifyHoldController`，本機與 headless 共用）＋ renderer（`TerminalPanel.tsx` 的 Enter 與閱讀信號、「📨 待送」）。順帶把 T0903〈遭遇問題〉2 提到的 `electron/remote/path-aware-channels.ts` `terminal:role-changed` 說明字串補上 `mode` / `towerContract`（`electron/remote/` 在 `affects_files`）。

## 驗收

- [ ] B0：v2 塔台分頁通知不捲動 / 不清選取 / 不搶焦點；其他分頁與 T0566 不變
- [ ] `draft`：草稿不被混入（假 TUI e2e 重現並修正）；放行條件、「立即送出」、5 分鐘提醒
- [ ] `reading`：延後與 60 s 上限；遠端 channel；不擋回答
- [ ] 原子送出：250 ms 窗口兩種情況
- [ ] 回答來源項目的佇列規則（介面與測試）
- [ ] 版本不符 / 非塔台：行為與今天相同；T0788 既有測試全綠
- [ ] 驗證關卡（commit 前完整 test:unit；head 第一次即綠）、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0904`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
