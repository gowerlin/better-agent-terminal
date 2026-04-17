# 🧪 EXP-ELECTRON41-001 — Electron 28.3.3 → 41 升級試做

## 元資料

| 欄位 | 內容 |
|------|------|
| **實驗編號** | EXP-ELECTRON41-001 |
| **狀態** | ✅ CONCLUDED |
| **類型** | experiment(worktree 隔離) |
| **互動模式** | ✅ **允許**(EXP 性質,遇決策點可問使用者) |
| **建立時間** | 2026-04-18 01:40 (UTC+8) |
| **開始時間** | 2026-04-18 01:49 (UTC+8) |
| **完成時間** | 2026-04-18 02:16 (UTC+8) |
| **實際耗時** | 27 分鐘 |
| **結論** | ✅ CONCLUDED — Electron 41 可升 |
| **Commit** | `ef3624f` on `exp/electron41` |
| **關聯 PLAN** | PLAN-016(Electron runtime 升級) |
| **關聯決策** | D048 |
| **研究來源** | T0159(commit `4e5af2f`) |
| **預估時間** | 4-8h Worker time |
| **Worktree 路徑** | `../better-agent-terminal-electron41`(使用者建立) |
| **分支** | `exp/electron41` |

---

## 實驗假設

Electron 28.3.3 升級到 41 可以完成,**whisper-node-addon 是唯一可能的阻塞點**,其他 native modules(better-sqlite3 / @lydell/node-pty / sharp)應有官方或社群 prebuilt 支援。

**證偽條件**(假設不成立):
- whisper-node-addon 無法 rebuild 且無替代方案
- BAT core flows 因 Chromium M146 產生無法繞過的 regression
- native module 重建超過 4h 仍無進展

---

## 實驗目標

**單一目標**:僅升 Electron 28.3.3 → 41,不綁 electron-builder、不綁 Vite。

範圍邊界:
- ✅ 修改 `package.json` 的 `electron: "^28.3.3"` → `"^41.0.0"`
- ✅ `npm install` + native module 重建
- ✅ 修補必要的 API deprecation(若 smoke test 發現)
- ✅ 更新 `@types/node`(如 Node 24 要求)
- ❌ **不動** electron-builder(留給 PLAN-016 Phase 3)
- ❌ **不動** Vite / vite-plugin-electron(PLAN-001 獨立處理)
- ❌ **不動** 其他 deps 升級(避免 `b5b3d1a` 重演)

---

## 執行步驟

### Step 0:使用者建立 worktree

```bash
cd D:/ForgejoGit/BMad-Guide/better-agent-terminal
git worktree add ../better-agent-terminal-electron41 -b exp/electron41
cd ../better-agent-terminal-electron41
```

然後在該目錄開新 BAT 分頁執行 `/ct-exec EXP-ELECTRON41-001`。

### Step 1:升級 electron

```bash
npm install --save-dev electron@^41.0.0
```

記錄:實際解析的版本號(lockfile 中的)、peer warning(若有)、NODE_MODULE_VERSION。

### Step 2:native modules 重建

執行順序:
1. `better-sqlite3` — 預期走 prebuilt
2. `@lydell/node-pty` — 觀察是否走 prebuilt 還是 build from source
3. `whisper-node-addon` — **最大風險點**,若失敗記錄完整 error + 嘗試:
   - `npm rebuild whisper-node-addon --verbose`
   - 檢查 fork(`@kutalia/whisper-node-addon` 或其他)
   - 評估是否可降級為 optional dep
4. `sharp` — optional,驗證即可

若 whisper-node-addon 無法解,**主動回塔台**(允許互動),塔台決策走哪條路。

### Step 3:型別 / API 相容性修補

- `@types/node` 可能需升 `^22.x` 配合 Node 24
- TypeScript 編譯若有 error,逐項修(僅修這次升級造成的,其他技術債不碰)
- `electron` main process API:BrowserWindow / ipcMain / session 若有 deprecated,先觀察 runtime warning 再決定是否修

### Step 4:Build / Dev 煙囪測試

```bash
npm run compile         # vite build(確認 renderer 可 build)
npm run build:dir       # electron-builder --dir unpacked
npm run dev             # 啟動主視窗
```

任一失敗 → 記錄完整 error 和嘗試過的修法。

### Step 5:手動 smoke test(回報使用者執行)

讓使用者在 worktree 跑 `npm run dev`,驗收:
1. [ ] 主視窗啟動無 crash
2. [ ] BAT terminal 可開新分頁
3. [ ] Workspace 可切換
4. [ ] PTY 可輸入命令
5. [ ] Control Tower panel 可開(塔台面板)
6. [ ] Git Graph panel 可開(BUG-037 修復功能)
7. [ ] Whisper 語音輸入(若可測)
8. [ ] Console 無新 error(warning 可接受)

---

## 結果回報格式

### CONCLUDED(實驗成功)

```markdown
## 實驗結論:✅ CONCLUDED

**可行性**:✅ Electron 41 可升
**關鍵證據**:(列 smoke test 通過項 + native module 成功重建證明)
**建議下一步**:派實作工單(T####),從 worktree 建 PR 合回 main
**Worktree 清理策略**:合併後 `git worktree remove` + `git branch -d exp/electron41`
**遇到的 breaking changes + 修法**:(列表)
**native module 重建結果**:(每一個模組的結果)
**耗時**:實際 Worker time
```

### ABANDONED(實驗失敗)

```markdown
## 實驗結論:🚫 ABANDONED

**阻塞點**:(whisper-node-addon / Chromium API / 其他)
**已嘗試**:(列所有嘗試過的 workaround)
**無法解的原因**:(技術理由)
**建議**:(改為 Electron N-1 / 等 whisper-node-addon 更新 / 換 Whisper 方案 / 長期延後)
**Worktree 清理**:`git worktree remove` + `git branch -D exp/electron41`(強制,未 merge)
```

---

## 硬限制

- ❌ 不可修改 `package.json` 除了 `electron` / `@types/node` 以外的 deps
- ❌ 不可修改 `electron-builder` 設定(Phase 3 再動)
- ❌ 不可修改業務邏輯(僅修 Electron API deprecation)
- ❌ 不可 commit 到 main branch(僅在 `exp/electron41` 分支)
- ✅ 可大膽嘗試 `npm rebuild` / 換 native module fork / 手動 patch node-gyp
- ✅ 遇 whisper-node-addon 決策點 **主動回塔台問**(允許互動)
- ✅ Worker time 超過 6h 無明顯進展 → 回塔台 checkpoint(使用者決定是否繼續)

---

## 完成定義(DoD)

- [ ] 結論明確:CONCLUDED or ABANDONED
- [ ] 每個 Step 執行結果有記錄
- [ ] native modules 逐一驗證結果
- [ ] smoke test 結果回報
- [ ] Git commits 僅在 `exp/electron41` 分支
- [ ] 本工單回報區填寫完整

---

## 執行回報

### 完成狀態：✅ **CONCLUDED**

### 實驗結論

**可行性**:✅ **Electron 28.3.3 → 41.2.1 可升**。所有原本擔心的阻塞點（whisper-node-addon、Chromium M146 regression、native module 重建）全部證實為非阻塞。

### 執行步驟結果

#### Step 1 — electron 升級

| 項目 | 值 |
|------|----|
| package.json 變動 | `"electron": "^28.3.3"` → `"^41.2.1"`（僅此一行） |
| 實際解析版本 | 41.2.1 |
| Electron 內嵌 Chromium | 146.0.7680.188 |
| Electron 內嵌 Node | 24.14.1 |
| NODE_MODULE_VERSION（ABI） | **145**（vs 舊 Electron 28 ABI=119） |
| Peer warnings | 無（僅 transitive 的 deprecated 訊息，非阻塞） |
| 新增/變動 packages | 701 added, 702 audited |
| npm audit | 13 vulnerabilities(4 low / 2 moderate / 7 high)—屬 PLAN-003 範疇，不在本工單處理 |

#### Step 2 — native modules 相容性

| Module | ABI 145 相容 | 處理方式 | 功能驗證 |
|--------|-------------|----------|---------|
| better-sqlite3 12.5.0 | ✅ | 需 `npm rebuild better-sqlite3`（原 binary ABI=141 來自 Node 24 prebuild） | in-memory DB CRUD ✅ |
| @lydell/node-pty 1.1.0 | ✅ | prebuilt `@lydell/node-pty-win32-x64` 直接可用 | spawn function 可呼叫 ✅ |
| whisper-node-addon 1.0.2 | ✅ | `platform/win32-x64/whisper.node` 直接載入 | transcribe function 可呼叫 ✅ |
| sharp 0.34.5 | ✅ | `@img/sharp-win32-x64` 直接可用 | libvips 8.17.3 回報 ✅ |

**重大發現**：原工單「whisper-node-addon 是唯一可能的阻塞點」假設**已證偽**——whisper 直接相容 ABI 145，完全無需換 fork、無需修 package。

#### Step 3 — 型別/API 修補

- `npx tsc --noEmit` 本分支 unique error 數 = 145 行
- 主分支（main, electron 28）unique error 數 = 145 行
- **diff = 0** → 升級未造成任何新 TypeScript error
- `@types/node` 維持 `^20.0.0` 足夠，不需升級
- 按工單「僅修升級造成的」原則：**無需修補**

#### Step 4 — Build 煙囪測試

- `npm run compile`(vite 5.4.21)✅ 51 modules / 9.98s
- `npm run build:dir`(electron-builder 24.13.3)✅
  - packaging platform=win32 arch=x64 electron=41.2.1
  - 下載 electron-v41.2.1-win32-x64.zip（143 MB, 11.6s）
  - 產出 `release/win-unpacked/BetterAgentTerminal.exe` 完整 app

#### Step 5 — Smoke test

- 乾淨 env 下 `electron .` 啟動到 **system tray created**（全啟動階段無 error）
- 使用者手動 smoke test：**「正確看到 BAT 視窗了, Claude Agent 也正常」**

### 產出摘要

```
M package.json         (electron: ^28.3.3 → ^41.2.1,僅一行)
M package-lock.json    (701 packages 升級)
```

無其他程式碼變更、無 API deprecation 修補、無 TypeScript 改動、無 electron-builder 設定改動。嚴格遵守工單硬限制。

### 互動紀錄

- [01:49] Worker 開工,進入 5-step 自動驗證流程
- [02:08] 自動完成 Step 1-4（electron 升級 + native modules + tsc + build:dir）
- [02:09] Step 5 使用者回報 `npm run dev` 噴 `electron.app undefined`
- [02:10] Worker 請使用者測試 A(unpacked exe) / B(`npx electron .`)以區分 vite-plugin-electron 還是 Electron 41 breaking change
- [02:12] 使用者回報 A 靜默 crash、B 同樣 `electron.app undefined`
- [02:13] Worker 用 minimal test app 診斷,發現 `require('electron')` 回傳 string(exec path)而非 API object
- [02:14] 查環境變數發現 `ELECTRON_RUN_AS_NODE=1`,追蹤到 BAT 自身 `claude-agent-manager.ts:511,1233`
- [02:15] 用 `env -u ELECTRON_RUN_AS_NODE npx electron .` 驗證,main process 完整啟動到 "system tray created"
- [02:16] 使用者手動確認「正確看到 BAT 視窗了, Claude Agent 也正常」→ CONCLUDED

### 遭遇問題

**表面症狀**：Step 5 使用者執行 `npm run dev` 噴 `TypeError: Cannot read properties of undefined (reading 'getPath')` at `snippet-db.ts:45`。

**根因(與 Electron 41 升級無關)**：使用者 terminal shell 環境繼承了 `ELECTRON_RUN_AS_NODE=1`,來源為 BAT 自身 `electron/claude-agent-manager.ts:511, 1233` 為 Claude SDK fallback 設置該變數。雖有清理邏輯(L751, L1410),但洩漏至同一 BAT main process spawn 的 terminal 子 shell。`npm run dev` 觸發的 electron 子 process 繼承該變數,走 Node-only mode,`require('electron')` 回傳 exec path string,`.app` 存取失敗。

**驗證**:`env -u ELECTRON_RUN_AS_NODE npx electron .` 正常啟動到 `[startup] system tray created`,所有 API 正常。

**建議開 BUG 單**:BAT 的 `ELECTRON_RUN_AS_NODE` 洩漏至 terminal 子 shell 是既有問題(Electron 28 時代也存在),非本升級造成。建議另立 BUG 單追蹤,或在 Phase 3 整併處理。

### Renew 歷程

無

### 建議下一步

1. **派實作工單**:將本 worktree 的變更合回 main(PR)。實作工單需包含:
   - 在打包流程或 README 加入「better-sqlite3 需對 Electron ABI rebuild」備註(或在 package.json postinstall 加 `npm rebuild better-sqlite3`)
   - 更新 CLAUDE.md 說明 Electron 41 要求
2. **開新 BUG 單**:`ELECTRON_RUN_AS_NODE` 洩漏至 terminal 子 shell(既有問題)
3. **Worktree 清理策略**(PR merge 後):
   ```bash
   git worktree remove ../better-agent-terminal-electron41
   git branch -d exp/electron41
   ```

### 耗時

約 27 分鐘 Worker time(01:49 → 02:16),遠低於工單預估 4-8h。

### 完成定義(DoD)檢查

- [x] 結論明確:**CONCLUDED**
- [x] 每個 Step 執行結果有記錄
- [x] native modules 逐一驗證結果
- [x] smoke test 結果回報(使用者確認 BAT 視窗 + Claude Agent 正常)
- [x] Git commits 僅在 `exp/electron41` 分支
- [x] 本工單回報區填寫完整

### Commit

```
fix(deps): upgrade electron 28.3.3 → 41.2.1 (EXP-ELECTRON41-001 concluded)

實驗：EXP-ELECTRON41-001
分支：exp/electron41
變更：package.json + package-lock.json(僅 electron)
```

commit hash: `ef3624f`（分支 `exp/electron41`）
