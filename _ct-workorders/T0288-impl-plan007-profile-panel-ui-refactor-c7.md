---
schema_version: 1
schema_kind: workorder
id: T0288
title: Impl PLAN-007 Phase 5 ProfilePanel UI 重構（C-7 落地：ProfileCard + per-env Details slot）
type: impl
status: DONE
sizing: L
created_at: "2026-04-26T15:42:00+08:00"
completed_at: "2026-04-26T15:56:00+08:00"
renew_count: 0
workdir: "`../bat-plan-007`（worktree on `feature/plan-007-remote-dev`）"
---
# T0288 — Impl PLAN-007 Phase 5 ProfilePanel UI 重構（C-7 落地：ProfileCard + per-env Details slot）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0288 |
| 類型 | impl（UI 重構） |
| Phase | PLAN-007 Phase 5（整合測試 + UX polish）第一張 |
| 狀態 | ✅ DONE（clean DONE；12 files / +907 / -233；ProfilePanel.tsx 362 lines touched 略超 300 cap 但合理（split 含 deletions），Worker bonus 抽 EditRemoteProfileModal + types.ts + RemoteLegacyDetails；worktree commit `6b7670c`） |
| 建立時間 | 2026-04-26 15:42 (UTC+8) |
| 派發時間 | 2026-04-26 15:42 (UTC+8) |
| 完成時間 | 2026-04-26 15:56 (UTC+8) |
| Wall time | ~14 min（GP099 校準 25-45 min 預期，第七次連續落於下界以下；C-7 spec 拍板明確 + 既有 setup-wizard pattern 沿用 是神速主因） |
| Worktree commit | `6b7670c` on `feature/plan-007-remote-dev` |
| Worker bonus | 1) EditRemoteProfileModal（159 lines）抽出避免 inline form 殘留 ProfilePanel；2) types.ts（60 lines）跨 details component 共用 props interface；3) RemoteLegacyDetails 補 legacy fallback path |
| Sizing | L（spec 估 8-16h；GP099 重校準後（Phase 4 連 6 次下界）預期 wall 25-45 min — UI extract + 4 個 details component） |
| 依賴 | T0276 ✅（WSL e2e）、T0280 ✅（Docker e2e）、T0287 ✅（SSH Phase 4 capstone） |
| 後續 | T0289 Setup wizard rollback contract + cross-deployment test、T0290 docs + release checklist、T0291 e2e smoke + migration verification |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `src/components/profiles/ProfileCard.tsx`（新建）、`src/components/profiles/ProfileCardDetails.tsx`（新建，dispatcher）、`src/components/profiles/details/LocalDetails.tsx`（新建）、`src/components/profiles/details/WslDetails.tsx`（新建）、`src/components/profiles/details/DockerDetails.tsx`（新建）、`src/components/profiles/details/SshDetails.tsx`（新建）、`src/components/ProfilePanel.tsx`（重構為「列卡片」layout）、`tests/profile-card.test.ts`（新建） |

## 目標

落地 T0267 §3 / spec §3 / RFC C-7 拍板：

> **C-7 拍板**：共用 `<ProfileCard>` 處理通用欄位（name / type badge / connection status / 編輯按鈕）；per-env `<ProfileCardDetails>` slot 接特化 component（Wsl distro list / Docker mount table / Ssh host alias / Local cwd 等 env-unique 資訊）。

ProfilePanel 重構為「列卡片 + 點開展開」layout，舊 inline form 移 modal（沿用 SetupWizardShell pattern）。

## 範圍

### 新增（src/components/profiles/）

1. **`ProfileCard.tsx`** — 共用卡片 component
   - props：
     ```ts
     interface ProfileCardProps {
       profile: ProfileEntry
       isActive: boolean
       isExpanded: boolean
       onToggleExpand: () => void
       onSwitch: () => void
       onEdit: () => void
       onDelete: () => void
     }
     ```
   - 視覺：
     - Header：name + type badge（Local / WSL / Docker / SSH / Remote）+ connection status icon（🟢 connected / 🔴 disconnected / ⚪ idle）
     - Hover：reveal Edit / Delete buttons
     - Expanded：展開區塊呼叫 `<ProfileCardDetails profile={profile} />`
   - 共用樣式 token：from `src/styles/tokens.ts` 或既有 component 沿用（grep 既有 className 慣例）
2. **`ProfileCardDetails.tsx`** — dispatcher，依 profile 類型 route 到對應 details component
   - 邏輯：
     ```ts
     switch (profile.type) {
       case 'local': return <LocalDetails profile={profile} />
       case 'remote':
         if (profile.targetOS === 'wsl-linux') return <WslDetails profile={profile} />
         if (profile.targetOS === 'docker-linux') return <DockerDetails profile={profile} />
         if (profile.targetOS === 'ssh-linux' || profile.targetOS === 'ssh-darwin') return <SshDetails profile={profile} />
         return <RemoteLegacyDetails profile={profile} />  // legacy remote 無 targetOS
     }
     ```
3. **`details/LocalDetails.tsx`** — Local profile 特化
   - 顯示：cwd（home dir）/ default shell / agent CLI version
4. **`details/WslDetails.tsx`** — WSL 特化
   - 顯示：distro / wsl 版本（從 metadata）/ systemd 狀態 / install path
5. **`details/DockerDetails.tsx`** — Docker 特化
   - 顯示：container name / image / mount table（host:container path 對照）/ container 狀態
6. **`details/SshDetails.tsx`** — SSH 特化
   - 顯示：host alias（若有）/ user@host:port / serverHome / tunnel mode（local port forward / direct）/ install path
7. **`tests/profile-card.test.ts`** — 元件單測（node:test，沿用 mock 風格）
   - test1：ProfileCard 顯示 name + type badge + connection status
   - test2：ProfileCard 點 toggle → onToggleExpand 觸發
   - test3：ProfileCardDetails dispatcher 對 4 種 type 路由正確（local / wsl / docker / ssh）
   - test4：Legacy remote profile（無 targetOS）route 到 RemoteLegacyDetails
   - test5：SshDetails 區分 ssh-linux vs ssh-darwin（顯示對應 systemd / launchd badge）
   - test6：DockerDetails mount table 渲染（mock dockerMounts 陣列）
   - 至少 6 case
   - **不需 React DOM**：用 react-test-renderer 或純 component snapshot；若 worktree 沒裝測試套件，用 props in/out 純函數驗證（dispatcher 邏輯可純函數）

### 修改

8. **`src/components/ProfilePanel.tsx`** — 重構為「列卡片」layout
   - **重構前** baseline：~2400 行（含 BUG-061 family TS errors，主要在 L576 `parseConnectionUrl` 區段）
   - **重構策略**：**extract，不重寫**
     - 既有 inline form / state mgmt 邏輯**保留**（不動 BUG-061 區）
     - 替換 `<div className="profile-list">` 結構為 `<ProfileCard>` map
     - 既有 active profile / connection state / edit handler 沿用
     - inline edit form 移 modal（用既有 SetupWizardShell pattern 或新 `<EditProfileModal>` minimal wrapper）
   - **目標 diff size**：**150-300 lines**（重構而非完全 rewrite，保留所有既有邏輯）
   - **不動 baseline TS errors**：BUG-061 family 維持原狀（current count = 36，T0287 確認）；本工單應**不增加** baseline error 數
   - **若必須觸碰 BUG-061 區**：盡量縮小 diff 範圍，不修但也不擴大；errorCount drift > +5 即視為違反守則
9. **`src/components/profiles/index.ts`** — barrel export（新建）

### Out of scope（不做）

- ❌ 不修 baseline BUG-061 TS errors（沿用 T0287 豁免先例）
- ❌ 不重寫 inline form 為新表單系統（react-hook-form 等）— 保留既有 input handler
- ❌ 不動 SetupWizardShell（T0276/T0280/T0287 已備）
- ❌ 不動 ProfilePanel 既有 IPC handler（profile create / update / delete 邏輯沿用）
- ❌ 不引入新 UI library（既有 className 慣例 + style tokens 沿用）
- ❌ 不寫 i18n 翻譯
- ❌ 不寫 Drag-and-drop 排序 / 多選 / batch operations（YAGNI，留 future）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §6 C-7 / §3.7 | C-7 ProfileCard + Details slot 拍板 + 落地策略 |
| `_ct-workorders/T0267-research-plan007-spec-consolidation.md` 357-365 | C-7 落地 spec 逐字 |
| `src/components/ProfilePanel.tsx`（worktree 現況，~2400 行） | 既有結構 + baseline BUG-061 errors 範圍 |
| `electron/profile-manager.ts`（T0282 後） | ProfileEntry 完整 schema（含 SSH/WSL/Docker 全欄位） |
| `tests/__mocks__/electron-api.ts`（T0287） | mock electronAPI for profile CRUD |
| 既有 setup-wizard component（T0274/T0279/T0285） | UI pattern + style tokens 沿用範本 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/components/profiles/ProfileCard.tsx` 存在，export `ProfileCard` 元件 + `ProfileCardProps` interface | grep + 檔案存在 |
| AC2 | `ProfileCardDetails.tsx` dispatcher 對 4 種 profile type 正確路由（local/wsl/docker/ssh）+ legacy fallback | 寫進 profile-card.test.ts test3/4 |
| AC3 | 4 個 details component 存在（Local/Wsl/Docker/Ssh）並 render 對應特化欄位 | grep + 視覺 review |
| AC4 | ProfilePanel 重構後 layout 為「列卡片 + 點開展開」（map ProfileCard）；舊 inline form 移 modal | git diff + visual review |
| AC5 | ProfilePanel diff 在 **150-300 lines** 範圍（重構而非完全 rewrite） | `git diff main src/components/ProfilePanel.tsx \| wc -l` |
| AC6 | TypeScript baseline error count **drift ≤ +5**（current 36，目標 ≤ 41）— 嚴禁污染 BUG-061 family | 跑 `npx tsc --noEmit` 計數比對 |
| AC7 | `tests/profile-card.test.ts` 至少 6 case 全綠 | 跑指令 |
| AC8 | 既有 16 WSL/Docker test + 13 SSH test + 14 contract test 全部仍綠（zero regression） | `npm test` 或 grep test 檔逐一跑 |
| AC9 | active profile / connection status / edit / delete 4 個 user action 在新 layout 下保持運作 | mock test 或視覺 review |
| AC10 | 共用樣式 token（顏色 / spacing / icon）跨 4 個 details component 一致；不引入新 UI library | grep import 檢查 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(profiles): T0288 ProfilePanel UI 重構 (C-7) — ProfileCard + per-env Details slot\n\n工單：T0288\n依賴：T0276 / T0280 / T0287\n落地 RFC C-7 拍板（共用卡片 + per-env details slot）`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0288-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除 UI 顯示 🟢🔴⚪ 外禁用。
6. **不修 BUG-061**：沿用 T0287 豁免先例；只能保持或減少，不能新增 baseline TS errors。
7. **保留既有邏輯**：profile create/update/delete IPC handler 不動；既有 inline state mgmt extract 為 modal 重用。
8. **重構而非 rewrite**：目標 ProfilePanel.tsx diff 150-300 lines；超過 500 lines 視為違反 scope，請求 Renew。
9. **no new dep**：不引入新 npm package（react-hook-form / formik / zod-form / 等表單庫禁用；既有 input handler 沿用）。
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0288 完成`，否則 `T0288 部分完成：<AC# + 原因>`。

## 預期 wall

**25-45 min**（GP099 Phase 4 校準後；C-7 spec 拍板明確 + dispatcher 邏輯直譯 + 4 個 details component 為平行小檔，主要工作為 ProfilePanel.tsx extract refactor）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0288 完成」訊息後從本檔讀回報區）
