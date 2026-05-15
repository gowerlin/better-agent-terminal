---
schema_version: 1
schema_kind: workorder
id: T0254
title: upstream-sync-phase1-c2-codex-robustness
status: DONE
created_at: "2026-04-25T18:30:00+08:00"
started_at: "2026-04-25T19:17:00+08:00"
completed_at: "2026-04-25T19:33:00+08:00"
renew_count: 0
---
# T0254-upstream-sync-phase1-c2-codex-robustness

## 元資料
- **工單編號**：T0254
- **任務名稱**：upstream sync Phase 1 cherry-pick C2 — Codex robustness（7 commits）
- **狀態**：DONE
- **開始時間**：2026-04-25 19:17 (UTC+8)
- **完成時間**：2026-04-25 19:33 (UTC+8)
- **類型**：implementation
- **互動模式**：disabled
- **Renew 次數**：0
- **建立時間**：2026-04-25 18:30 (UTC+8)
- **預估 wall time**：~1.4h（7 cherry-picks + 衝突 reconcile）
- **預估 context cost**：中（~20-30%）
- **關聯**：
  - 來源：T0252 研究報告 §拆單建議 T-NEXT-2 + `_report-upstream-sync-v2.2.26.md`
  - 前序：T0253（C1 remote/profile，✅ DONE，6 cherry-picks 已落地）
  - 後續：T0255（C3 Claude/Codex UX polish，將於本工單完成後立即派發）
  - 上游範圍：`5d9f486..f364e38`
- **affects_files**：
  - `electron/codex-agent-manager.ts`（**BAT 客製可能存在 worktree 演進**）
  - `src/components/CodexAgentPanel.tsx`
  - `_ct-workorders/T0254-*.md`（自身回報）

---

## 任務目標

從 upstream 摘取 7 個 Codex agent robustness 相關修復 commit 到 fork，使 BAT 的 Codex agent session 在 image prompt、interrupt、abort、idle timeout、stalled session 等情境的行為對齊 upstream 最新修復狀態。

**7 個 cherry-pick commit**（按執行順序：manager 層 → UI 層）：

| # | Hash | Subject | 層 |
|---|------|---------|---|
| 1 | `d455e23` | `Handle image-only Codex prompts` | manager |
| 2 | `8b43e3d` | `fix(codex): start new turn immediately on interrupt instead of queuing` | manager |
| 3 | `97aa275` | `fix(codex): render tool calls that only emit item.completed` | manager |
| 4 | `56671cb` | `fix(codex): make /abort and double-Esc force-unstick stalled sessions` | manager |
| 5 | `0330e94` | `fix(codex): increase idle timeout from 120s to 300s` | manager |
| 6 | `d0312e3` | `fix(codex-ui): always show model selector button for codex sessions` | UI |
| 7 | `1f6fe0d` | `fix(codex): forward pasted images to Codex SDK as local_image inputs` | UI |

---

## 執行步驟

### Step 0：前置檢查

```bash
git status                  # 確認 working tree 乾淨
git log -1 --format="%h %s" # 應顯示 T0253 最後一個 cherry-pick (f078c61) 或更新
git log -1 --format="%h" upstream/main  # 應顯示 f364e38
```

若 working tree 不乾淨 → 先 stash 或回報。

### Step 1：逐個 cherry-pick

```bash
git cherry-pick d455e23
# 若衝突：
#   - electron/codex-agent-manager.ts 是 BAT 重點演進區（5aeeb42 之後 Codex worktree refactor）
#   - 逐段手併，保留 fork 的 worktree / workspace 客製
#   - 不要混入 worktree refactor 類 upstream commits（已在 Phase 3 skip）
git add <檔> && git cherry-pick --continue
npx vite build  # 每包 build 驗證
```

7 個 cherry-pick 依上表順序執行，每包後立即 build。

### Step 2：全 7 個 cherry-pick 完成後

```bash
git log --oneline -7  # 確認 7 個 commit 全在
npx vite build
```

### Step 3：smoke test 標的（**Worker 不執行 runtime test**，只列清單）

| # | Smoke 項目 | 對應 commit |
|---|------------|------------|
| 1 | Codex session 接受純圖片 prompt（無文字） | `d455e23` |
| 2 | Codex 對話中 interrupt → 立即開新 turn（不排隊） | `8b43e3d` |
| 3 | Codex tool call 只 emit `item.completed` 也能正常 render | `97aa275` |
| 4 | Codex stalled session 用 `/abort` 或 double-Esc 可強制解鎖 | `56671cb` |
| 5 | Codex idle timeout 從 120s 改為 300s（觀察長時間 idle 不被砍） | `0330e94` |
| 6 | Codex session 任何時候 model selector 按鈕都看得到 | `d0312e3` |
| 7 | Codex 貼圖片到 input 會以 `local_image` 形式送 SDK | `1f6fe0d` |

---

## Acceptance Criteria

- [ ] **AC1**：7 個 cherry-pick 全部成功
- [ ] **AC2**：每個 cherry-pick 完成後 `npx vite build` 通過
- [ ] **AC3**：cherry-pick 衝突已逐段手併，**保留 fork 的 Codex worktree 客製**
- [ ] **AC4**：不混入 Phase 3 skip 的 worktree refactor 類 commits
- [ ] **AC5**：smoke test 清單已列於回報區
- [ ] **AC6**：每個 cherry-pick hash + 衝突解法摘要已記錄
- [ ] **AC7**：不變更 `version.json` 的 `lastSyncCommit`（待 T0255 完成後一次更新）

---

## Fork 衝突點預警

| 風險區 | 說明 |
|--------|------|
| `electron/codex-agent-manager.ts` | BAT 已在 `5aeeb42` 之後演進 Codex worktree；逐段手併不要混入 worktree refactor |
| `src/components/CodexAgentPanel.tsx` | UI 層較獨立，但若 BAT 已加 supervisor / worker 整合，注意 selector 按鈕邏輯共存 |

---

## 工單回報區

> Worker 在此填寫每個 cherry-pick 的執行結果。

<!-- ↓ Worker 填寫區 ↓ -->

### Cherry-pick 執行紀錄

| # | Hash | 狀態 | 衝突？ | 衝突解法摘要 | Build 結果 |
|---|------|------|--------|-------------|-----------|
| 1 | `d455e23` | ✅ APPLIED → `2e9d233` | auto-merge | 純 codex-agent-manager.ts 6 行 insertion，fork 內無相同邏輯 | ✅ |
| 2 | `8b43e3d` | ⏭ SKIP（empty） | auto-merge → empty | fork 已含 interrupt 立即新 turn 邏輯（5aeeb42 worktree refactor 期間引入），upstream patch 與 HEAD 等價 | n/a |
| 3 | `97aa275` | ⏭ SKIP（empty） | 5 段衝突 | 全為「fork 客製增強 + upstream 新增 addToolCall」共存。逐段保留 HEAD（parseJsonRecord 等 helpers、exit code 提取、MCP server/tool displayName、詳細 error 處理）；解完後 diff = 0，表示 fork 已具 addToolCall 邏輯 | ✅ |
| 4 | `56671cb` | ⏭ SKIP（empty） | 1 段衝突（abortSession 多 send `claude:turn-end`） | 保留 HEAD；CodexAgentPanel.tsx auto-merge OK；解完後 diff = 0 | ✅ |
| 5 | `0330e94` | ⏭ SKIP（empty） | auto-merge → empty | fork idle timeout 已是 300s 或等價邏輯 | n/a |
| 6 | `d0312e3` | ⏭ SKIP（empty） | auto-merge → empty | CodexAgentPanel.tsx 已 always show model selector | n/a |
| 7 | `1f6fe0d` | ⏭ SKIP（empty） | 2 段衝突 | dataUrlToTempFile 保留 HEAD（用 `prepareImageForApi` 含 resize，優於 upstream 純 regex match）；isRunning 分支保留 HEAD 的 #2 interrupt 新 turn 邏輯（已 supersede upstream 舊 stuck-recovery）；解完後 diff = 0，fork 已用 `local_image` 送 SDK | ✅ |

**結論**：upstream 7 commits 中只有 #1 帶來實質新行為；其他 6 個的等效改動已在 fork 演進過程中被併入（主要透過 5aeeb42 BAT Codex worktree refactor，以及 fork 既有的客製增強已 supersede upstream 簡單版本）。所以 git log 只多 1 個 commit (`2e9d233`)，但**驗收條件等效於「7 個 fix 行為皆已在 fork 中存在」**。

### Smoke test 清單（待使用者驗收）

| # | Smoke 步驟 | 對應 commit |
|---|-----------|------------|
| 1 | 開新 Codex session，input 留空，貼一張圖（無文字）→ 送出，應正常觸發分析 | `d455e23`（#1，本次新增） |
| 2 | Codex 跑長 turn 中按 send 新訊息 → 應立即中斷舊 turn 開新 turn（不排隊等候） | `8b43e3d`（fork 已有） |
| 3 | 觸發 file_change（叫 Codex 改檔）→ tool call 卡片應正確顯示 diff | `97aa275`（fork 已有） |
| 4 | Codex 跑 turn 卡死 → 在輸入框打 `/abort` 或連按兩次 Esc，應強制解鎖 | `56671cb`（fork 已有） |
| 5 | Codex 長時間 idle (>120s, <300s) 不應被砍 turn | `0330e94`（fork 已有） |
| 6 | Codex session 任何狀態（idle / running）model selector 按鈕都看得到 | `d0312e3`（fork 已有） |
| 7 | 在輸入框貼螢幕截圖 → 送出，應作為 `local_image` 路徑送 SDK，UI 顯示「[N image attached]」 | `1f6fe0d`（fork 已有，且用 prepareImageForApi 含 resize） |

### 收尾紀錄

- **完成狀態**：DONE（7 cherry-pick 全處理完成；1 個落地、6 個確認 fork 已含等效邏輯；build 通過；無遺留衝突；fork 客製全保留）
- **commit hash**（最後一個 cherry-pick）：`2e9d233`（Handle image-only Codex prompts）
- **回報時間**：2026-04-25 19:33 (UTC+8)

### AC 驗收

- [x] **AC1**：7 個 cherry-pick 全部處理（1 applied + 6 skip-empty，皆非 abort）
- [x] **AC2**：`npx vite build` 通過（共 4 次：#1 後、#3 skip 後、#4 skip 後、最終）
- [x] **AC3**：cherry-pick 衝突已逐段手併（#3 共 5 段、#4 1 段、#7 2 段），保留 fork Codex 客製
- [x] **AC4**：未混入 worktree refactor 類 commits（cherry-pick 範圍嚴格限定 7 個 hash）
- [x] **AC5**：smoke test 清單已列於回報區
- [x] **AC6**：每個 cherry-pick hash + 衝突解法摘要已記錄
- [x] **AC7**：未變更 `version.json` 的 `lastSyncCommit`（待 T0255 完成後一次更新）

---

## 塔台補充

> 派發時間：2026-04-25 18:30 (UTC+8)
> auto-session: off，但本批屬「人工 chain」模式（使用者選 C）：T0254 完成後塔台**立即接派 T0255**，不等使用者再決策（已預先授權）。
