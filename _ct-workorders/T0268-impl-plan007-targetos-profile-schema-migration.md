# T0268-impl-plan007-targetos-profile-schema-migration

## 元資料
- **工單編號**：T0268
- **任務名稱**：PLAN-007 Phase 1 第一張 — `targetOS` profile schema + 被動 migration + ProfilePanel inline prompt
- **狀態**：TODO
- **建立時間**：2026-04-26 00:18 (UTC+8)
- **類型**：impl（production code,含單元測試）
- **互動模式**：disabled（fire-and-forget;Worker 自決即可,scope 已被 spec doc 凍結）
- **Renew 次數**：0
- **預估 wall time**：4-8h（M sizing,依 spec doc §8 藍圖卡）
- **預估 context cost**：中（讀 profile-manager 全模組 + ProfilePanel + 寫 schema + tests）
- **關聯**：
  - 母 PLAN：PLAN-007（📋 PLANNED,session 27 升級,commit `5e42553`）
  - Spec 依據：`_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.1（schema）+ §6 C-2 拍板（被動 migration + UI 提示雙軌）
  - 前序：T0267(✅ DONE,spec consolidation,commit `f1934f9`)
  - 後續：T0269(PathTranslator interface + IdentityTranslator + contract test scaffold,依本工單)
  - **D089 worktree 策略**：本工單在 `../bat-plan-007` worktree 內執行,**禁止寫主線**
- **affects_files**（**worktree** `../bat-plan-007` 內,**不是主線**）:
  - `electron/profile-manager.ts`(擴 `ProfileEntry` interface + load migration hook + `extractTargetOSMeta` helper)
  - `src/types/profile.ts` 或 profile 型別所在檔(視 codebase 而定)
  - `src/components/ProfilePanel.tsx`(legacy remote 編輯時 inline prompt)
  - 新增 `electron/__tests__/profile-manager.migration.test.ts` 或對應 test 路徑(unit test 三場景)
  - 主線(**禁止寫入**):僅本工單檔回報區可在主線更新

---

## D089 worktree 工作守則

**本工單為 PLAN-007 Phase B 第一張,啟動 worktree 模式**:

1. **cd 到 worktree**:`cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007` 開始所有工作
2. **依賴安裝**:`npm install`(`feature/plan-007-remote-dev` 分支與主線 HEAD 同 `c9373ff`,依賴一致)
3. **commit 全部到 `feature/plan-007-remote-dev` 分支**(worktree HEAD)
4. **絕對禁止**:
   - 切回主線改檔(`git checkout main` 不要做)
   - push 到 origin(D089 規則:整個 PLAN-007 完成才 PR)
   - 在主線(`better-agent-terminal/`)目錄下做任何 source code 修改
5. **本工單檔元資料更新**:Worker 完成後更新 worktree 內 `_ct-workorders/T0268-*.md` 的狀態 → DONE,記 commit hash;**主線的 `_ct-workorders/T0268-*.md` 由塔台同步**(不要 Worker 動)

---

## 任務目標

### 1. `ProfileEntry` schema 擴充

依 spec doc §2.1 凍結結構:

```typescript
export type TargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

interface ProfileEntry {
  // 既有欄位保留(不動)
  id: string
  name: string
  type: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteFingerprint?: string
  remoteProfileId?: string
  createdAt: number
  updatedAt: number
  // 新增
  targetOS?: TargetOS
  // per-OS metadata(依 targetOS 解讀)
  wslDistro?: string
  dockerContainer?: string
  dockerHost?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  useSshTunnel?: boolean      // ssh-* 預設 true
  tunnelLocalPort?: number    // ssh-* 預設動態挑空 port(實際使用時動態決定,schema 只佔位)
}
```

**選 flat schema(非嵌套 union)**:理由見 spec doc §2.1。

### 2. `extractTargetOSMeta` helper

```typescript
export type TargetOSMetadata =
  | { targetOS: 'local' }
  | { targetOS: 'wsl-linux'; wslDistro: string }
  | { targetOS: 'docker-linux'; dockerContainer: string; dockerHost?: string }
  | { targetOS: 'ssh-linux' | 'ssh-darwin'
      sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string
      useSshTunnel?: boolean; tunnelLocalPort?: number }
  | { targetOS: undefined }   // legacy remote profile

export function extractTargetOSMeta(entry: ProfileEntry): TargetOSMetadata
```

實作只是 switch on `entry.targetOS`,把 flat 欄位拍成 typed metadata,給後續 Phase 使用(translator 註冊 / wizard / UI)。**本工單只交付 helper,呼叫端先不接**(後續工單再用)。

### 3. 被動 migration(spec §2.1 + §6 C-2)

`profile-manager.ts` 的 load 邏輯加 hook:

```typescript
function migrateProfile(entry: ProfileEntry): ProfileEntry {
  if (entry.targetOS !== undefined) return entry  // 已有,跳過
  if (entry.type === 'local') {
    return { ...entry, targetOS: 'local' }  // **不更新 updatedAt**(避免污染同步時序)
  }
  // type='remote' 且 targetOS undefined → 不補,維持 legacy 走 IdentityTranslator
  return entry
}
```

**插入點**:profile load(從 disk / 記憶體 cache 讀取)後、回傳給呼叫端前。

**禁止主動 migration**(C-2 拍板):不在 load 時自動補 remote profile 的 targetOS。

### 4. ProfilePanel inline prompt(legacy remote)

`ProfilePanel.tsx`(或對應 component)在編輯 type='remote' + targetOS undefined 的 profile 時,顯示一個 **inline 提示(非 modal,不阻擋)**:

```
⚠ 此 profile 未設定 targetOS,將以 legacy mode 連線(無 path translation)。
  [選擇 targetOS ▾]  wsl-linux / docker-linux / ssh-linux / ssh-darwin
```

選擇後寫入 `entry.targetOS` 並更新 `updatedAt`。**不強制使用者填**(可繼續用 legacy)。

實作風格:
- inline 提示在 profile detail panel 上方(visual hierarchy:警告 banner)
- dropdown 用既有 BAT UI 元件(找 codebase 內 select component)
- **不寫對應 metadata 欄位的 UI 編輯**(後續 T0287 ProfilePanel 重構工單做),本工單只 cover targetOS dropdown

### 5. 單元測試(三場景必過)

新增 `profile-manager.migration.test.ts`(或 codebase 既有 test 路徑):

```
describe('Profile schema migration (T0268)', () => {
  it('local profile without targetOS → auto-migrates to "local"')
  it('remote profile without targetOS → stays undefined (legacy)')
  it('local/remote profile with targetOS → no change (idempotent)')
})
```

**額外建議**(達標即可):
- `extractTargetOSMeta` 5 種 targetOS 各一個 happy-path test
- `extractTargetOSMeta` undefined targetOS → 回 `{ targetOS: undefined }`

---

## 執行步驟

### Step 1:cd worktree + 環境快照
```bash
cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007
git status
git log --oneline -3
git branch --show-current  # 應為 feature/plan-007-remote-dev
```

### Step 2:依賴安裝(如需要)
```bash
npm install
# native module rebuild(better-sqlite3 / @lydell/node-pty)應自動跑
```
若 npm install 失敗或太慢,確認本機磁碟空間 + npm cache。**不要動 package.json**。

### Step 3:讀 BAT profile 既有結構
- `electron/profile-manager.ts`:讀全文,找 ProfileEntry 定義 / load 入口 / save 入口
- `src/types/profile.ts`(或對應檔):若型別在這定義,後續編輯這
- `src/components/ProfilePanel.tsx`:讀現有編輯流程,找 inline 提示插入點

### Step 4:擴 ProfileEntry schema
按上方「任務目標 1」加新欄位,**全部 optional**,既有 profile load 不會 break。

### Step 5:寫 extractTargetOSMeta helper
按上方「任務目標 2」實作 + export。

### Step 6:加被動 migration hook
按上方「任務目標 3」在 profile-manager.ts load 路徑插 `migrateProfile()`。

### Step 7:寫 inline prompt UI
按上方「任務目標 4」在 ProfilePanel 加 banner + dropdown。

### Step 8:寫單元測試(三場景必過 + extractTargetOSMeta tests)
按上方「任務目標 5」。

### Step 9:跑測試 + build 驗證
```bash
npm test -- profile-manager.migration  # 或對應 test 命令
# 或 npm test 全跑(視 codebase 慣例)
npm run build  # 確認 TS 編譯通過
```
build / test 失敗 → fix。失敗 ≥3 次或 30 min → 回塔台問。

### Step 10:commit 到 worktree branch
```bash
# 在 ../bat-plan-007 內
git add electron/profile-manager.ts src/types/profile.ts \
        src/components/ProfilePanel.tsx \
        electron/__tests__/profile-manager.migration.test.ts \
        # 視實際修改檔調整
git commit -m "feat(profile): T0268 targetOS schema + migration + inline prompt

PLAN-007 Phase 1 第一張。

- ProfileEntry 加 targetOS / wslDistro / dockerContainer / sshHost
  / sshUser / sshPort / sshKeyPath / useSshTunnel / tunnelLocalPort 欄位
  (全 optional,既有 profile 向下相容)
- extractTargetOSMeta helper(switch on targetOS,回 typed metadata)
- 被動 migration:local 自動補 'local',remote 留 undefined 走 legacy
- ProfilePanel legacy remote inline prompt(非阻擋)

Tests: profile-manager.migration.test.ts 三場景 + extractTargetOSMeta 5 + undefined。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git log --oneline -3
```

### Step 11:報告塔台
**Worker 不更新工單檔元資料**(D089 規則:工單檔在主線,worktree 沒有此檔)。

回報訊息給塔台:
```
T0268 完成
- worktree commit: <hash>
- branch: feature/plan-007-remote-dev
- AC1-AC8 結果(下方回報區的對照表)
```

塔台收到後會在主線同步 T0268 工單檔元資料(狀態 DONE / 完成時間 / commit hash)+ 把 Worker 填寫的「回報」內容貼進主線工單檔。

---

## AC(acceptance criteria)

- **AC1**:`ProfileEntry` 新增 9 個 optional 欄位(targetOS + 8 個 per-OS),既有 profile load 不 break
- **AC2**:`extractTargetOSMeta` helper 實作 + export,5 個 targetOS + undefined 各自正確 narrow
- **AC3**:被動 migration:local profile load 後自動補 `targetOS='local'`(updatedAt 不變);remote profile 留 undefined
- **AC4**:ProfilePanel 編輯 type='remote' + targetOS undefined 的 profile 時顯示 inline prompt(banner + dropdown),不強制阻擋
- **AC5**:單元測試三場景全綠 + extractTargetOSMeta tests 全綠
- **AC6**:`npm run build` 通過(TS 無 error)
- **AC7**:既有 BAT remote profile(legacy)仍可正常連線(IdentityTranslator 路徑,本工單不實作 translator,只確認 schema 不 break 現有連線邏輯)
- **AC8**:Commit 在 `feature/plan-007-remote-dev` worktree 分支(不在 main)

---

## 嚴格禁止

- ❌ **切回主線(main)做任何修改**(D089 規則)
- ❌ push 到 origin(整個 PLAN-007 完成才 PR)
- ❌ 寫主線(`better-agent-terminal/`)目錄下任何檔案
- ❌ 動 `package.json` 主版本依賴
- ❌ 實作 PathTranslator 或其他 translator(留給 T0269+)
- ❌ 實作 wizard step / setup wizard UI(留給 T0274+)
- ❌ 實作 metadata 欄位的編輯 UI(留給 T0287 ProfilePanel 重構)
- ❌ 主動 migration remote profile 的 targetOS(C-2 拍板:不要)
- ❌ 跨工單決策(失敗 / scope 不清 → 回塔台)

---

## 失敗 / PARTIAL 處理

任一觸發:
- 時間止損(>8h 仍未完成 AC1-AC8)
- npm install / build / test 失敗 ≥3 次解不開
- profile-manager.ts 結構與 spec 假設差異過大(如 schema 寫死無 optional 欄位機制)

→ 工單狀態填 PARTIAL/FAILED,觸發 yolo 斷點 B,塔台 pause。

---

## 回報

### Step 1-3 — 環境快照 + code 偵察摘要
(git status / log / 既有 schema 結構摘要)

### Step 4-7 — 實作摘要
- ProfileEntry 擴充:diff 概覽
- extractTargetOSMeta:程式碼節錄
- migrateProfile hook 插入點
- ProfilePanel inline prompt 截圖描述(文字 mock)

### Step 8-9 — 測試結果
- profile-manager.migration test 三場景結果
- extractTargetOSMeta tests 結果
- npm run build / npm test 全跑結果

### AC 驗收
| AC | 狀態 | 證據 |
|----|------|------|
| AC1 schema 擴充 | ✅/❌ | |
| AC2 extractTargetOSMeta | ✅/❌ | |
| AC3 被動 migration | ✅/❌ | |
| AC4 inline prompt | ✅/❌ | |
| AC5 unit tests 全綠 | ✅/❌ | |
| AC6 build pass | ✅/❌ | |
| AC7 legacy 連線不 break | ✅/❌ | |
| AC8 commit 在 worktree branch | ✅/❌ | |

### 給塔台的下一步建議
- T0269 PathTranslator + IdentityTranslator 起點(本工單為 helper 鋪好 schema)
- 是否發現 spec doc §2.1 假設與實際 codebase 衝突
- 工程量驗證(實際 wall vs 估 4-8h)

### 收尾 commit
- worktree commit hash:
- worktree branch:`feature/plan-007-remote-dev`
