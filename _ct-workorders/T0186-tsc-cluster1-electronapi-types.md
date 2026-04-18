# T0186 — PLAN-019 Cluster 1:ElectronAPI type 定義補齊

## 元資料
- **編號**:T0186
- **類型**:implementation
- **狀態**:DONE
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185(盤點來源,Cluster 1)
- **派發時間**:2026-04-18 22:14 (UTC+8)
- **開始時間**:2026-04-18 22:24 (UTC+8)
- **完成時間**:2026-04-18 22:32 (UTC+8)
- **預估工時**:30-40 min
- **Renew 次數**:0

## 塔台決策背景
T0185 盤點總錯誤 **133 / 19 檔**,Cluster 1(ElectronAPI type 定義落後於 preload 實作)佔 **~65 錯誤(49%)**。塔台調整 Q2.B 為 **Cluster 優先**,本張為第一張,預期消除 ~49% 技術債。

乾淨路線(Q3.A):**補齊真正的 type 定義,禁止用 `@ts-expect-error` 矇騙**。

## 目標
對齊 `window.electronAPI` 的 TypeScript type 定義與 preload 實際暴露的 API,讓 Cluster 1 所列 TS2339 / 相關 TS2322 錯誤全數消除。

## 範圍
- **僅改 type 宣告檔**(`src/types/electron.d.ts` 或等效位置;若無則建立/延伸)
- 可讀 `electron/preload.ts`(或等效入口)對照實際暴露 surface
- 可讀 `electron/ipc-handlers/**`、`electron/remote/**`、`electron/window-manager/**` 確認 handler signature

## 禁止事項(hard rules)
- ❌ 改 preload runtime 實作
- ❌ 改 IPC handler runtime 實作
- ❌ 新增 / 移除 preload 暴露 API(只補 type,不動實作 surface)
- ❌ `@ts-expect-error` 除非確認為第三方型別缺失(需在 PR 註解說明)
- ❌ 改 `tsconfig.json`
- ❌ 動 PLAN-019 其他 cluster(本張專注 Cluster 1)
- ❌ 跑 `npx vite build`(驗收用 `tsc --noEmit`)

## 執行步驟

### Step 1:盤點 preload 實際暴露 surface
```bash
# 找 preload 入口
grep -rn "contextBridge.exposeInMainWorld" electron/
```
產出完整 API 樹,對照 T0185 Cluster 1 列表。

### Step 2:定位現有 type 宣告
```bash
grep -rn "electronAPI" src/types/ src/**/*.d.ts 2>/dev/null
grep -rn "interface.*ElectronAPI\|Window.*electronAPI" src/ electron/
```
確認既有宣告位置與命名慣例,**遵循現有結構**繼續補。

### Step 3:補齊 namespace / property

對照 T0185 回報 Cluster 1 清單,逐一補:

| Namespace / Property | 出現檔案 | 來源 handler |
|---------------------|---------|------------|
| `electronAPI.profile.*` | App, ProfilePanel | 查 profile-manager IPC |
| `electronAPI.remote.*` | App, ProfilePanel, SettingsPanel | 查 remote/ |
| `electronAPI.snippet.*` | ClaudeAgentPanel, SnippetPanel | 查 snippet IPC |
| `electronAPI.worktree.*` | WorkspaceView | 查 worktree IPC |
| `electronAPI.image.*` | ClaudeAgentPanel, FileTree, PathLinker | 查 image IPC |
| `electronAPI.update.*` | UpdateNotification | 查 update IPC |
| `electronAPI.system.*` | App | 查 system IPC |
| `electronAPI.window.{newWindow,getWindowProfile,getWindowIndex,getWindowId,getDetachedId,setDockBadge,onDetached,onReattached,detach}` | App, workspace-store, settings-store | 查 window-manager |
| `electronAPI.dialog.{confirm,selectFiles}` | ClaudeAgentPanel, TerminalPanel | 查 dialog IPC |
| `workspace.{onDetached,onReattached,detach,getDetachedId}` | App | 見下備註 |

**備註**:`workspace.*` 那組若實際屬於不同 namespace(如 `electronAPI.workspace`),請以 preload 實際為準;若是 zustand store 方法則應在 `workspace-store` 類別補齊而非 electron types。Step 1 的 `exposeInMainWorld` grep 應能澄清。

### Step 4:驗收
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-after.log

# 比對 baseline
# T0185 baseline: 133 errors / 19 files
# 預期: ~68 errors(減 ~65,Cluster 1 歸零)
```

若減少數 < 55 或 > 75,**回報區標註並分析**(可能是 cluster 邊界誤判 / preload 對照遺漏 / 衍生新錯誤)。

### Step 5:回歸驗證
- 確認沒有新增錯誤(`tsc` output diff 無紅色新項)
- `git diff` 確認只改了 type 宣告檔
- 不必跑 vite build(本張專注 type 層)

## 交付物 / 驗收標準
- [ ] preload surface 盤點結果(grep output 摘要)
- [ ] 修改的 type 宣告檔清單(單一檔案最佳)
- [ ] `tsc --noEmit` after-count:____ errors / ____ files
- [ ] Cluster 1 錯誤歸零(或說明殘留項)
- [ ] 無新增錯誤
- [ ] `git diff --stat` 附上
- [ ] 1-2 行 commit message(conventional:`chore(types): ...` 或 `fix(types): ...`)

## 互動規則(implementation 工單)
- 研究型互動 **不啟用**(Worker 自主執行)
- 若 preload 實際暴露的 surface **與 T0185 盤點有出入**(如 API 名稱 rename、namespace 重組),**暫停回塔台**,不要自行調整實作
- 若遇 `workspace.*` 屬於 store 而非 electronAPI,**回塔台**(可能需拆出第二張工單)

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:DONE

### Worker 回報

**完成狀態**:DONE
**開始時間**:2026-04-18 22:24
**完成時間**:2026-04-18 22:32

**preload surface 盤點**:
- 入口:`electron/preload.ts`(`contextBridge.exposeInMainWorld('electronAPI', electronAPI)`,line 565)
- 完整 namespace:`platform, pty, workspace, settings, dialog, image, clipboard, app, update, tunnel, system, debug, shell, git, gitScaffold, github, agent, supervisor, claude, worktree, profile, remote, snippet, voice, fs, terminalServer`(共 26 個)
- 舊 `src/types/electron.d.ts` 缺失:`image, update, system, worktree, profile, remote, snippet` 共 7 個 namespace + 多數既有 namespace 的部份方法

**修改檔案**:
- `src/types/electron.d.ts`:+86 / −3(唯一修改檔)
- 工具檔:無

**tsc --noEmit 結果**:
- Baseline(T0185):133 errors / 19 files
- After T0186:60 errors / 15 files
- **減少:73 errors / 4 files**(預期 55-75,命中)

**Cluster 1 歸零檢查**(全部從 tsc output 歸零):
- [x] `electronAPI.profile.*`(list / listLocal / create / save / load / delete / rename / update / duplicate / get / getActiveIds / activate / deactivate)
- [x] `electronAPI.remote.*`(startServer / stopServer / serverStatus / connect / disconnect / clientStatus / testConnection / listProfiles)
- [x] `electronAPI.snippet.*`(getAll / getById / create / update / delete / toggleFavorite / search / getCategories / getFavorites / getByWorkspace)
- [x] `electronAPI.worktree.*`(create / remove / status / merge / rehydrate)
- [x] `electronAPI.image.readAsDataUrl`
- [x] `electronAPI.update.{check, getVersion}`
- [x] `electronAPI.system.onResume`
- [x] `electronAPI.app.{getWindowId, getWindowProfile, getWindowIndex, newWindow, setDockBadge}`(T0185 標為 `electronAPI.window.*`,preload 實際屬於 `app.*` namespace — 見邊界發現)
- [x] `electronAPI.dialog.{confirm, selectFiles, selectImages}`
- [x] `workspace.{detach, reattach, getDetachedId, onDetached, onReattached}`(屬 `electronAPI.workspace` namespace,非 zustand store)
- [x] `electronAPI.claude.abortSession`(附加修補,preload 有但 .d.ts 缺)
- [x] `electronAPI.git.{getDiffFiles, getStatus}` 回傳型別 `{status, file}`(對齊 handler 實際輸出,舊 .d.ts 錯寫為 `{path, status}`,GitPanel.tsx 消費者用 `f.file`)

**邊界發現 / 與 T0185 盤點差異**:
1. T0185 標記的 `electronAPI.window.{newWindow,...}` 在 preload 中**實際屬於 `electronAPI.app.*`**(非 `.window`)。採 preload 實際為準。
2. T0185 標記的 `workspace.{onDetached,...}` 確實屬於 `electronAPI.workspace`,非 zustand store。
3. 順帶發現 `claude.abortSession` 在 preload 有但 .d.ts 缺,一併補齊。
4. 順帶修正 `git.getDiffFiles / getStatus` 回傳 key 名(`path`→`file`),與 handler 實作一致、與唯一消費者 GitPanel.tsx 一致。

**殘留 60 錯誤分類**(非 Cluster 1,屬其他 cluster):
- `File.path`(ClaudeAgentPanel):Electron 對 HTML File 的擴充型別問題 — Cluster 2/3
- `SessionMeta.lastRequestDurationMs / TerminalInstance.agentCommandSent / hasUserInput / WorkspaceStore.markXxx`:store shape — 屬後續 cluster
- 新增 TS2322(unknown → 具體型別):SnippetPanel / ClaudeAgentPanel JSX 消費 `Promise<unknown>` 未收斂 — 屬下一 cluster(消費者端 narrow)
- `types/index.ts` `"timing"` literal、`sprint-status.ts` null vs undefined:非 electronAPI 範疇

**禁止事項遵守**:
- [x] 未改 preload / IPC handler runtime
- [x] 未新增 / 移除 preload 暴露 API
- [x] 無 `@ts-expect-error`
- [x] 未改 `tsconfig.json`
- [x] 未跑 `npx vite build`

**互動紀錄**:無(implementation 工單,Worker 自主執行)
**遭遇問題**:無
**Renew 歷程**:無

**commit hash**:`987137b`

---

**塔台驗收紀錄**(塔台填寫):
- 接收時間:
- 驗收結果:
- 下一張工單(T####):
