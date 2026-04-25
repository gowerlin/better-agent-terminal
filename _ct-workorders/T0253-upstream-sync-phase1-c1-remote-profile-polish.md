# T0253-upstream-sync-phase1-c1-remote-profile-polish

## 元資料
- **工單編號**：T0253
- **任務名稱**：upstream sync Phase 1 cherry-pick C1 — remote/profile polish（6 commits）
- **狀態**：DONE
- **類型**：implementation
- **互動模式**：disabled
- **Renew 次數**：0
- **建立時間**：2026-04-25 16:50 (UTC+8)
- **開始時間**：2026-04-25 16:48 (UTC+8)
- **完成時間**：2026-04-25 17:03 (UTC+8)
- **預估 wall time**：~1.8h（6 cherry-picks + 衝突 reconcile + smoke test）
- **預估 context cost**：中（~20-30%，需 spot-read upstream 各 commit + fork 對應檔現況）
- **關聯**：
  - 來源：T0252 研究報告 §拆單建議 T-NEXT-1 + `_report-upstream-sync-v2.2.26.md`
  - upstream 範圍：`5d9f486..f364e38`（v2.1.46 → v2.2.26-pre.7）
  - lastSyncCommit 將在 T0253-T0255 全完成後一次更新（不在本工單內動）
- **affects_files**：
  - `electron/main.ts`（IPC handler proxy 邏輯，**BAT 客製重區**）
  - `electron/remote/protocol.ts`
  - `electron/server-core/register-handlers.ts`
  - `electron/remote/remote-client.ts`
  - `src/components/ProfilePanel.tsx`
  - `_ct-workorders/T0253-*.md`（自身回報）

---

## 任務目標

從 upstream 摘取 6 個 remote/profile 相關修復 commit 到 fork，使 BAT 的 remote 連線、profile 切換、image preview 等行為對齊 upstream 最新修復狀態。

**6 個 cherry-pick commit**（按執行順序）：

| # | Hash | Subject |
|---|------|---------|
| 1 | `77ad1c0` | `fix(remote): proxy image:read-as-data-url so previews resolve remotely` |
| 2 | `32aa1b5` | `fix(remote): scope IPC + event broadcasts per-window profile` |
| 3 | `2a3c4d5` | `Scope remote client status to profile windows` |
| 4 | `2867f77` | `fix(remote-profile): show unreachable dialog with 6s timeout and local fallback` |
| 5 | `e9ecced` | `fix(profile): show correct running state per profile when remote is connected` |
| 6 | `c189dbf` | `fix(profile): prevent silent data loss when index.json read fails` |

> 執行順序：`77ad1c0` → `32aa1b5` → `2a3c4d5` → `2867f77` → 並行 `e9ecced` / `c189dbf`

---

## 執行步驟

### Step 0：前置檢查

```bash
# 確認 upstream 已 fetch 至 f364e38
git log -1 --format="%h" upstream/main  # 應顯示 f364e38

# 確認當前 branch 乾淨
git status
git log -1 --format="%h %s"
```

若 working tree 不乾淨 → 先 stash 或回報。

### Step 1：逐個 cherry-pick（含衝突 reconcile）

**通用流程**（每個 commit）：

```bash
git cherry-pick <hash>
```

若衝突：
1. `git status` 看衝突檔
2. **逐段手併**（不機械接受任一邊）
3. 特別注意 `electron/main.ts`：
   - fork 已有 `ALWAYS_LOCAL_CHANNELS = new Set(['workspace:save', 'workspace:load'])`（T0165 C1.2 引入）
   - fork 已有 PLAN-018 remote 資安加固（certificate / token / path-guard）
   - upstream patch 若觸這些區，需確認 fork 改動仍保留
4. `git add <檔>` + `git cherry-pick --continue`
5. **不要修改 commit message**（保留 upstream 原始 hash 對照與 PR 連結）

### Step 2：每包 cherry-pick 後立即 build 驗證

```bash
npx vite build
```

若 build fail：
- 不要繼續下一個 cherry-pick
- 修到 build green 才往下

### Step 3：全 6 個 cherry-pick 完成後

```bash
git log --oneline -6  # 確認 6 個 commit 全在
npx vite build  # 最終 build 驗證
```

### Step 4：smoke test 標的（**Worker 不執行 runtime 測試**，只列驗證清單，標 AC 待使用者驗收）

| # | Smoke 項目 | 對應 commit |
|---|------------|------------|
| 1 | remote profile connect → image preview 可正常顯示 | `77ad1c0` |
| 2 | 多 window 開不同 profile → IPC 事件不會跨 window 串擾 | `32aa1b5` / `2a3c4d5` |
| 3 | remote 不通時跳出 unreachable dialog（6s timeout）+ local fallback 可用 | `2867f77` |
| 4 | profile 切換時 running state badge 即時反映正確狀態 | `e9ecced` |
| 5 | profile index.json 讀取失敗時不靜默丟資料 | `c189dbf` |

---

## Acceptance Criteria

- [ ] **AC1**：6 個 cherry-pick 全部成功（`git log` 看得到 6 個對應 commit）
- [ ] **AC2**：每個 cherry-pick 完成後 `npx vite build` 通過（無 TS / build error）
- [ ] **AC3**：cherry-pick 過程若有衝突，已逐段手併，**保留 fork 既有 PLAN-018 / T0165 改動**
- [ ] **AC4**：`electron/main.ts` 的 `ALWAYS_LOCAL_CHANNELS` 與 PROXIED_CHANNELS 邏輯未被 upstream patch 破壞
- [ ] **AC5**：smoke test 清單已列於本工單回報區（runtime 驗收由使用者後續執行，Worker 不需執行）
- [ ] **AC6**：本工單回報區記錄每個 cherry-pick 的 hash + 是否有衝突 + 衝突解法摘要
- [ ] **AC7**：不變更 `version.json` 的 `lastSyncCommit`（待 T0253-T0255 全部完成後另開 commit 更新）

---

## Fork 衝突點預警

| 風險區 | 說明 | 處理 |
|--------|------|------|
| `electron/main.ts` | BAT 已有 PLAN-018 remote 資安加固 + T0165 ALWAYS_LOCAL_CHANNELS | upstream patch 必須與 fork 改動共存，不可覆蓋 |
| `electron/remote/*` | BAT remote stack 已大改寫（PLAN-018 P.1-P.7） | 若 upstream 改 remote-client / protocol，需確認 fork 的 wss/fingerprint/safeStorage 仍生效 |
| `electron/server-core/register-handlers.ts` | BAT 可能無此檔 | 若 upstream 是新檔則直接接受；若是修改則確認 fork 對應檔位置 |
| `src/components/ProfilePanel.tsx` | BAT 已加 remoteFingerprint UI | upstream patch 不可移除 fingerprint 欄位 |

---

## 工單回報區

> Worker 在此填寫每個 cherry-pick 的執行結果。

<!-- ↓ Worker 填寫區 ↓ -->

### Cherry-pick 執行紀錄

| # | Hash | 狀態 | 衝突？ | 衝突解法摘要 | Build 結果 |
|---|------|------|--------|-------------|-----------|
| 1 | `77ad1c0` | ✅ | 是 | `electron/main.ts` 保留 BAT 現有 path-guard / `MAX_IMAGE_SIZE` 實作，將 `image:read-as-data-url` 移入 fork 既有 proxied handler 架構；`electron/remote/protocol.ts` 保留 fork 的 `fs:*` 清單並追加 proxied image channel；未恢復已刪除的 `electron/server-core/register-handlers.ts`。 | `npx vite build` 通過 |
| 2 | `32aa1b5` | ✅ | 是 | `electron/main.ts` 合併 per-window profile scoping 與 fork 的 `remoteOpMutex`、runtime warning/path-guard 改動；`ProfilePanel.tsx` 保留 fork 的唯讀 fingerprint UX，同時套用 upstream 連線 URL / full-row 版面；`electron/window-registry.ts` 接受 `getCachedEntries()`。 | `npx vite build` 通過 |
| 3 | `2a3c4d5` | ✅ | 是 | `electron/main.ts` 將 `RemoteClient` 視窗篩選改綁 `boundProfileId`，並讓 `remote:client-status` 只對呼叫者所屬 profile 視窗回報 connected/info。 | `npx vite build` 通過 |
| 4 | `2867f77` | ✅ | 是 | `electron/main.ts` 以 fork 現行 connect API / `remoteOpMutex` 重建 upstream 的 `loadProfileSnapshotDetailed()`、unreachable dialog、local fallback 啟動流程；`electron/remote/remote-client.ts` 保留 fork 的 reconnect/backoff 實作，只把 auth timeout 降到 6 秒並改用常數。 | `npx vite build` 通過 |
| 5 | `e9ecced` | ✅ | 是 | `electron/main.ts` 的 `remote:list-profiles` 改為回傳 `activeProfileIds` 並保留 fork 既有 `fingerprint` / `errorCode`；`electron/preload.ts` / `src/types/electron.d.ts` 對齊 richer return type；UI 端採用 upstream 的 local/remote 分段與 per-remote-target running-state fan-out。 | `npx vite build` 通過 |
| 6 | `c189dbf` | ✅ | 否 | clean cherry-pick；`electron/profile-manager.ts` 直接接受 upstream 修復。 | `npx vite build` 通過 |

### Smoke test 清單（待使用者驗收）

- `77ad1c0`
  remote profile connect 後，在 FileTree / PathLinker 開啟遠端圖片預覽，確認 `image:read-as-data-url` 可正常顯示，不再讀取本機不存在路徑。
- `32aa1b5` / `2a3c4d5`
  同時開兩個不同 profile 視窗：
  一個 local、一個 remote；確認 local 視窗的 IPC 不會被 proxy 到 remote。
  若有多個 remote alias，確認 `remote:client-status` 與事件廣播只反映當前綁定 profile 視窗。
- `2867f77`
  啟動一個已配對但目標 server 關閉的 remote profile：
  確認約 6 秒內跳出 unreachable dialog。
  確認啟動流程會 fallback 到 local profile（優先 `default`）而非靜默空白。
- `e9ecced`
  在 ProfilePanel 檢查 Local / Remote 分段：
  local profiles 的 running badge 仍依本機 active profiles 顯示。
  remote aliases 的 running badge 依其目標 server 的 `activeProfileIds` 顯示，而不是被其他 remote 連線污染。
- `c189dbf`
  模擬 profile `index.json` 讀取失敗情境，確認不會靜默覆蓋/遺失既有資料，並觀察錯誤處理行為符合預期。

### 收尾紀錄

- **完成狀態**：DONE
- **產出摘要**：成功 cherry-pick 並整合 6 個 upstream remote/profile 修復 commit；最終 commit 序列為 `e7e59ec`、`ffebfd9`、`9192975`、`85a76f3`、`47912c2`、`f078c61`。影響檔案：`electron/main.ts`、`electron/preload.ts`、`electron/profile-manager.ts`、`electron/remote/protocol.ts`、`electron/remote/remote-client.ts`、`electron/window-registry.ts`、`src/components/ProfilePanel.tsx`、`src/locales/en.json`、`src/locales/zh-CN.json`、`src/locales/zh-TW.json`、`src/styles/settings.css`、`src/types/electron.d.ts`。
- **遭遇問題**：多個 upstream commit 與 fork 的 BAT/PLAN-018 remote stack、唯讀 fingerprint UX、path-guard / proxied handler 架構重疊，需逐段手併；另因工單檔目前為未追蹤檔，回報內容未納入本次 cherry-pick commit 鏈。
- **互動紀錄**：無
- **Renew 歷程**：無
- **commit hash**（最後一個 cherry-pick）：`f078c61`
- **回報時間**：2026-04-25 17:03 (UTC+8)
- **yaml**：不適用（cherry-pick 工單）

---

## 塔台補充

> 派發時間：2026-04-25 16:50 (UTC+8)
> YOLO mode active，但本批屬「單張派發 + 等決策」模式（使用者選 B），完成後塔台暫停，等使用者驗收 + 決定是否派 T0254。
