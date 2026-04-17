# T0138 — 研究：BAT Helper Scripts 打包與路徑解析設計

## 元資料
- **工單編號**：T0138
- **類型**：research（研究工單，允許 Worker 互動）
- **狀態**：✅ DONE
- **優先級**：🔴 High（阻擋 v2.x 發布）
- **派發時間**：2026-04-17 12:18 (UTC+8)
- **開始時間**：2026-04-17 12:32 (UTC+8)
- **完成時間**：2026-04-17 12:44 (UTC+8)
- **Commit**：340dc9d
- **關聯 BUG**：BUG-032
- **關聯工單**：T0131（CLI helper 建立）、T0133（Worker 通知實作）、T0134（CT 上游整合）
- **Renew 次數**：0
- **預計 context 用量**：中（讀 main process / preload / electron-builder config / 既有 env var 注入點）

---

## 研究目的

BUG-032 揭露：BAT helper scripts（`bat-terminal.mjs` + `bat-notify.mjs`）在使用者環境完全不可用 —
- 安裝程式沒打包這兩支 binary（B 層）
- BAT runtime 沒注入 helper 路徑 env var（C 層）
- `_local-rules.md` 寫死 cwd-relative 路徑，假設 cwd 在 source root（A 層）

開發機看似能跑是巧合（塔台 cwd 剛好落在 BAT 原始碼目錄）。

**本工單目標**：摸清現況、評估方案、提出修復計畫，**不執行修復**。修復由後續實作工單處理。

---

## 必須調查的問題

### 1. 打包現況（B 層）

- [ ] `package.json` 的 `build` / `electron-builder` 設定目前長什麼樣？
- [ ] `scripts/` 目錄目前是否被任何打包機制涵蓋？（`extraResources` / `asarUnpack` / `files` 白名單）
- [ ] 安裝後實際的目錄結構是什麼？（解開一個現有 installer 看看，或從文件推測）
- [ ] `bat-terminal.mjs` + `bat-notify.mjs` 是否有外部依賴？（純 ESM 還是有 npm packages?）若有 → 影響打包策略

### 2. BAT Runtime 環境變數注入（C 層）

- [ ] BAT 啟動 Claude session 時，PTY spawn 流程在哪？（grep `BAT_SESSION` / `BAT_REMOTE_PORT` / `BAT_TOWER_TERMINAL_ID`）
- [ ] 既有 env vars 怎麼計算的？（hard-code / 從 settings 讀 / 從 main process state？）
- [ ] 新增 `BAT_HELPER_DIR` 應該加在哪？影響範圍？
- [ ] dev mode（`npm run dev`）vs production（installer）如何區分 helper 路徑？

### 3. 路徑解析機制設計（A 層）

評估三個方案的優缺點：

**方案 A：BAT 注入 `BAT_HELPER_DIR` env var**
- 優：簡單，跨平台一致
- 缺：塔台 skill 白名單需改寫；env var 沒設定時的 fallback 邏輯
- 問題：白名單該不該保留 `${BAT_HELPER_DIR:-scripts}` fallback？

**方案 B：Helpers 包成獨立 CLI binary**（pkg / nexe / Bun compile）
- 優：可放到 PATH，呼叫方式最乾淨（`bat-terminal --notify-id ...`）
- 缺：增加打包工具鏈複雜度；Bun compile 跨平台支援？跟 electron 版本綁定？
- 問題：包成 binary 的大小？啟動速度？

**方案 C：BAT 啟動時複製 helpers 到 workspace 隱藏目錄**
- 優：維持 `_local-rules.md` 相對路徑不變
- 缺：每個 workspace 都要複製（垃圾文件）；版本不一致風險（更新 BAT 後舊複本還在）
- 問題：清理時機？跨 workspace 共用還是各自一份？

**請回答：哪個方案最合適？是否有其他方案？**

### 4. `_local-rules.md` 改寫策略（A 層）

依方案 A/B/C 不同，給出對應的改寫提案：
- 完整 diff（哪些行要改、改成什麼）
- 是否保留向後相容 fallback（讓開發機繼續能跑）

### 5. 連動影響評估

- [ ] T0133 Worker→Tower 通知實作有沒有其他相關的 hard-code 路徑？
- [ ] T0134 CT 上游整合（v4.1.0 已發布）的 SKILL.md 是否同樣有問題？需要回 PR 修嗎？
- [ ] 修復後對既有 `BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` 鏈路有無破壞性影響？

---

## 互動規則（research_interaction = true）

- 允許每次最多 3 個提問回問塔台 / 使用者（`research_max_questions: 3`）
- 提問請依優先級排序，每題附「為何需要這資訊」
- 若對方案有強烈傾向（如 B 不可行），直接說，不要做完整對比再勸退
- 開發機巧合 success 是已知背景（不需重新驗證），重點是使用者環境怎麼修

---

## 預期產出

1. **現況報告**：打包現狀 / env var 注入現狀 / 路徑解析現狀
2. **方案推薦**：A/B/C 中選一個（或提新方案），含優缺點對照表
3. **修復計畫草稿**：拆成幾張實作工單？每張的範圍、預估難度、依賴順序
4. **`_local-rules.md` 改寫提案**：對應推薦方案的 diff
5. **連動影響清單**：哪些既有功能需重測、CT 上游 PR 是否要回頭修

---

## 工單回報區

### 進度

- 開始：2026-04-17 12:32
- 完成：2026-04-17 12:44
- 用時：約 12 分鐘
- 互動紀錄：無（研究型工單，Worker 依現場證據給出推薦，無需回問塔台）
- Renew 歷程：無

---

### 現況報告（A / B / C 三層）

#### B 層：打包現況

**`package.json` `build` 設定**（L89-154）：
- `build.files` 僅涵蓋：`dist/**/*`、`dist-electron/**/*`、`node_modules/**/*` + 三個 icon
- `build.asarUnpack` 僅處理 `@anthropic-ai/claude-*`、`@img/*`、`dist-electron/terminal-server.js`
- **完全沒有 `extraResources`** — `scripts/` 目錄被 electron-builder 忽略
- 結論：安裝包裡**沒有** `bat-terminal.mjs` / `bat-notify.mjs`

**Helpers 技術特性**：
- 純 ESM（`.mjs`），僅用 Node.js built-in（`net` + `crypto`）
- Node 18+ 即可運行，**零外部依賴**
- 兩檔共約 630 行，體積可忽略
- 適合用 `extraResources` 打包（不需要 `asarUnpack`，因為不在 `node_modules` 內）
- 不需要、也不適合包成獨立 CLI binary（pkg/nexe/Bun 會引入額外工具鏈）

#### C 層：BAT Runtime Env Var 注入現況

**注入點**：`electron/pty-manager.ts`，共 **3 處** `envWithUtf8` 物件（L382-400、L425-451、L495-516），對應三條 PTY 建立路徑：
1. WorkerChild subprocess（`sendToServer({ type: 'pty:create', ... })`）
2. 直接 node-pty（`pty.spawn`）
3. `child_process.spawn` fallback

**已注入的 env vars**：
- `BAT_SESSION: '1'`
- `BAT_TERMINAL_ID: id`
- `BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`（T0129）
- `BAT_TOWER_TERMINAL_ID`（經由 `customEnv`，T0133）

**現況**：**無 `BAT_HELPER_DIR` 類 env var**。新增一個只需在這 3 處 envWithUtf8 各加一行 — 與既有 env var 完全同一條鏈路，零風險。

**Dev vs Production 路徑區分**：
- 可用 `app.isPackaged` 判斷
- Production：`path.join(process.resourcesPath, 'scripts')`
- Dev：`path.join(__dirname, '..', 'scripts')`（`dist-electron/` 的上一層）
- Electron API `process.resourcesPath` 在 packaged app 中指向 `resources/` 目錄

#### A 層：文件層（路徑解析）現況

**本專案 `_local-rules.md` 寫死路徑**（4 處）：
- L286：`node scripts/bat-terminal.mjs claude "/ct-exec T####"`
- L301：白名單表格 ct-exec 項
- L302：白名單表格 ct-done 項
- L310：Agent 自訂參數範例

**CT 上游 skill（`~/.claude/skills/control-tower/`）同樣寫死**（已隨 T0134 發布到 v4.1.0）：
- `SKILL.md` L40-42（白名單 3 行，含 `bat-notify.mjs`）
- `references/auto-session.md` L87-137（多處範例與說明）

**結論**：開發機巧合能跑是因為塔台 Claude session cwd = BAT 原始碼目錄，相對路徑湊巧解析成功。使用者環境 cwd = workspace（如 `2026_Taipower`），相對路徑必失敗。

---

### 方案推薦：方案 A（注入 `BAT_HELPER_DIR` env var）

#### 方案對照

| 方案 | 複雜度 | 安裝包大小 | 維護成本 | 命令簡潔度 | 版本一致性 | 總評 |
|------|--------|-----------|---------|----------|----------|------|
| A. env var | 低 | +幾 KB | 低（單一 env var） | 中（`node "$BAT_HELPER_DIR/..."`） | 高（跟著 app 更新） | ✅ 推薦 |
| B. 獨立 binary | 高 | +10~50 MB（三平台各一） | 高（pkg/Bun/nexe 工具鏈 + CI） | 高（`bat-terminal ...`） | 高 | ❌ 過度工程 |
| C. 複製到 workspace | 中 | 0 | 中（清理/版本同步複雜） | 高（維持相對路徑） | 低（舊複本風險） | ❌ 不推薦 |

**為何不選 B**：
- `pkg` 已停止官方維護；`@yao-pkg/pkg` 社群 fork
- Bun compile 的 Node 版本與 Electron 28 的 Node 版本不一定一致
- 兩支純 ESM、零依賴的 helper 包成 binary 純粹是 overhead
- 增加 CI 複雜度（三平台各編譯一份）
- 與 Electron 的打包鏈路互不相關，維護心智成本高

**為何不選 C**：
- 每個 workspace 複製一份 → 垃圾文件
- BAT 升級後 workspace 內舊版 helper 不會自動更新 → 版本漂移風險
- 清理時機模糊（何時刪？session 結束？workspace 移除？）
- 多 session 寫入同個路徑的 race condition

**方案 A 細節**：

1. **打包**（`package.json`）：
   ```json
   "extraResources": [
     { "from": "scripts", "to": "scripts",
       "filter": ["bat-terminal.mjs", "bat-notify.mjs"] }
   ]
   ```
   → 安裝後位於 `<install-root>/resources/scripts/bat-terminal.mjs`

2. **路徑解析**（`electron/main.ts` 或 `electron/pty-manager.ts`）：
   ```ts
   const helperDir = app.isPackaged
     ? path.join(process.resourcesPath, 'scripts')
     : path.join(__dirname, '..', 'scripts')
   ```

3. **Env var 注入**（`pty-manager.ts` 3 處 envWithUtf8 各加一行）：
   ```ts
   BAT_HELPER_DIR: helperDir,
   ```

4. **白名單改寫**（`_local-rules.md` + CT 上游 skill）：
   ```
   node "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"
   node "$BAT_HELPER_DIR/bat-notify.mjs" "T#### 完成"
   ```
   Windows Git Bash / macOS bash / Linux bash 皆支援 `$VAR` 展開。

5. **Fallback 策略（推薦：不 fallback）**：
   - `BAT_HELPER_DIR` 未設 = 非 BAT 環境或 BAT 版本過舊 → 直接失敗比靜默走錯路徑好
   - 開發機不再「巧合 success」— 對齊使用者環境行為
   - 若要 fallback，可考慮 `${BAT_HELPER_DIR:-./scripts}`，但會掩蓋真實問題

---

### 修復計畫草稿（3 張實作 + 1 張整合驗收 + 1 張上游 PR）

#### T0139（B 層）— electron-builder 打包 helpers

- **範圍**：`package.json` 新增 `build.extraResources`
- **改動量**：單檔，約 5 行
- **風險**：低
- **驗證**：`npm run build:dir` 後檢查 `release/win-unpacked/resources/scripts/bat-terminal.mjs` 存在
- **依賴**：無
- **預估難度**：⭐（最簡單）

#### T0140（C 層）— 注入 `BAT_HELPER_DIR` env var

- **範圍**：
  - `electron/pty-manager.ts` 3 處 envWithUtf8 加 `BAT_HELPER_DIR`
  - 需在 ptyManager 建構時接收 helperDir（或直接 import helper 判斷邏輯）
  - `electron/main.ts` 在建立 ptyManager 時傳入 helperDir
- **改動量**：約 15-25 行，2 檔
- **風險**：低-中（3 處要同步改，dev/prod 路徑判斷要正確）
- **驗證**：BAT 內新開終端 → `echo $BAT_HELPER_DIR` → 顯示路徑，且 `node "$BAT_HELPER_DIR/bat-terminal.mjs" --help` 可執行（或至少不是 ENOENT）
- **依賴**：T0139
- **預估難度**：⭐⭐

#### T0141（A 層）— `_local-rules.md` 改寫

- **範圍**：`_ct-workorders/_local-rules.md` L286、301、302、310
- **改動量**：4 行，1 檔
- **風險**：低（純文件改寫）
- **驗證**：塔台在 BAT 內派發測試工單 T####，白名單指令不再 ENOENT
- **依賴**：T0140
- **預估難度**：⭐

#### T0142（整合驗收）— BUG-032 END-TO-END

- **範圍**：
  1. `npm run build` 產生安裝包
  2. 在 `D:\ForgejoGit\2026_Taipower` 實戰重裝 BAT
  3. 派發測試工單，驗證 auto-session 路由成功（非降級剪貼簿）
  4. 驗證 Worker 完成後自動通知塔台（T0133 鏈路）
  5. 並帶跑 T0135 9 項 MANUAL + BUG-031 副作用檢查（workspace 一致性）
- **風險**：中（真實使用者環境整合測試）
- **依賴**：T0141
- **預估難度**：⭐⭐⭐（整合驗收最耗時）

#### T0143（上游回 PR）— 修 CT skill 白名單

- **範圍**：
  - `~/.claude/skills/control-tower/SKILL.md` L40-42
  - `~/.claude/skills/control-tower/references/auto-session.md` 多處
  - PR 到 BMad-Control-Tower repo（上游 v4.1.0 已發布，需 bump v4.1.1）
- **改動量**：約 10 行，2 檔
- **風險**：低-中（需上游 maintainer review，有向後相容考量 — 若其他 BAT fork 仍用 cwd-relative，PR 需說明這是 BAT 環境契約）
- **依賴**：T0142 驗收通過（需真實環境背書）
- **預估難度**：⭐⭐

**依賴圖**：
```
T0139 (打包) → T0140 (env var) → T0141 (_local-rules) → T0142 (整合驗收) → T0143 (上游 PR)
```

---

### `_local-rules.md` 改寫提案（diff）

```diff
  ├─ BAT_SESSION=1（在 BAT 內部終端）
  │  └─ 使用 BAT 內部終端：
- │     node scripts/bat-terminal.mjs claude "/ct-exec T####"
+ │     node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"
  │     → WebSocket → RemoteServer → BAT 內建新終端分頁
```

```diff
  | 用途 | 指令 | 條件 |
  |------|------|------|
- | BAT 內部終端 | `node scripts/bat-terminal.mjs claude "/ct-exec T####"` | `BAT_SESSION=1` |
- | BAT 內部終端 | `node scripts/bat-terminal.mjs claude "/ct-done T####"` | `BAT_SESSION=1` |
+ | BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"` | `BAT_SESSION=1` |
+ | BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-done T####"` | `BAT_SESSION=1` |
```

```diff
  # 假設 claude-code preset 設定了 --dangerously-skip-permissions
- node scripts/bat-terminal.mjs claude "/ct-exec T####" --dangerously-skip-permissions
+ node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####" --dangerously-skip-permissions
```

**向後相容選項（不推薦）**：`node "${BAT_HELPER_DIR:-scripts}/bat-terminal.mjs"` — 保留開發機巧合行為，但會掩蓋使用者環境的真實問題。建議不加 fallback。

---

### 連動影響清單

| 項目 | 評估 |
|------|------|
| T0133 其他 hard-code 路徑？ | ❌ 無。`bat-notify.mjs` 唯一引用點就是 `_local-rules.md`，已涵蓋在 T0141 |
| CT 上游 v4.1.0 (T0134) 是否有問題？ | ✅ 有。`SKILL.md` L40-42 + `auto-session.md` 多處寫死。需 T0143 回 PR |
| 既有 `BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` 鏈路？ | ✅ 無破壞。新 env var 與既有 env var 同一條注入鏈路，不動既有邏輯 |
| T0135 9 項 MANUAL 驗收是否作廢？ | ✅ 作廢。baseline 會變動，需於 T0142 整合驗收時一併重跑 |
| BUG-031 副作用（通知鏈路 workspace 一致性）？ | ✅ 一併納入 T0142 驗收 |
| 對 dev mode 工作流有影響？ | 🟡 輕微。`BAT_HELPER_DIR` 在 dev mode 指向 `<source>/scripts/`，開發者照常跑 |

---

### 結論

1. **根因**：使用者環境的 helper script 解析路徑從未被完整設計，開發機巧合能跑掩蓋了問題
2. **推薦方案**：**方案 A**（`BAT_HELPER_DIR` env var）— 複雜度最低、與既有 env var 鏈路對齊、維護成本最小
3. **修復計畫**：拆成 5 張工單（T0139 打包 → T0140 env var → T0141 文件 → T0142 整合驗收 → T0143 上游 PR），總難度中等
4. **不建議**：方案 B（binary 過度工程）、方案 C（版本漂移風險）、向後相容 fallback（掩蓋問題）

---

### 待塔台決策

1. **方案選擇**：接受方案 A 推薦，還是偏好方案 B/C / 有其他方案？
2. **Fallback 策略**：`BAT_HELPER_DIR` 未設時 — (a) 直接失敗（推薦）/ (b) fallback 到 `./scripts/`（向後相容）？
3. **工單拆分粒度**：5 張獨立（推薦）還是整併為 2-3 張大工單？
4. **T0143 時機**：本地驗收（T0142）後才發上游 PR（推薦）還是同步進行？
5. **v2.x 發布時機**：這 5 張工單完成前不發 v2.x，還是先發 pre-release 標記「auto-session 有已知問題」？

---
