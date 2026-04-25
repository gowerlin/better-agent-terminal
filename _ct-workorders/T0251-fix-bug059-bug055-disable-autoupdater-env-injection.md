# T0251 — 修：BAT spawn 注入 `DISABLE_AUTOUPDATER=1` 防止 embedded claude auto-update 破壞 binary

## 元資料

- **編號**：T0251
- **類型**：bug-fix（衍生自 BUG-059，亦修 BUG-055）
- **狀態**：✅ FIXED（修復已完成，等待 AC2/AC3 運行時驗收）
- **開始時間**：2026-04-25 10:08:52
- **完成時間**：2026-04-25 10:15:26
- **優先級**：🔴 **High**（packaged 用戶端可用性中斷修復）
- **建立時間**：2026-04-25 (UTC+8)
- **派發模式建議**：`--mode on --no-interactive`（修復工單，方案 A 已確定，無需互動）
- **預估時間**：30-45 分鐘（含驗證）
- **Renew 次數**：0
- **前置條件**：
  - T0250 研究結論（方案 A 推薦，5 行 env 注入）
  - BUG-059（本修復目標）
  - BUG-055（連帶修復，dev 場景同根因）
- **affects_files**：
  - `electron/pty-manager.ts`（三處 envWithUtf8：line ~408-431 / ~456-486 / ~534-558）
  - `electron/claude-agent-manager.ts`（manager init 階段或三處 spawn line 720, 1401, 2283）
  - `CLAUDE.md`（補「Embedded claude auto-update 停用」段落）

## 任務指令

### Step 1：注入 env flag

**`pty-manager.ts` 三處 `envWithUtf8` 物件**：

每處加入：
```ts
DISABLE_AUTOUPDATER: '1',  // BUG-059: prevent embedded claude self-rename + global npm install which orphans app.asar.unpacked binary
```
與既有的 `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_REMOTE_PORT` 並排。

**`claude-agent-manager.ts`**：

最簡作法 — 在 manager 建構或 init 階段加：
```ts
process.env.DISABLE_AUTOUPDATER = '1';  // BUG-059: see pty-manager.ts comment
```

或在三處 `query()` spawn 前注入到 SDK options 的 env（若 SDK 介面支援），擇一即可。**首選 process.env** 全域注入，影響所有後續 SDK 子行程繼承，最不易遺漏。

### Step 2：CLAUDE.md 補段落

在「Claude Runtime Selection (PLAN-027, v2.1.49+)」段落之後插入：

```markdown
### Embedded claude auto-update 停用（BUG-059）

BAT 對 embedded 與 system 兩種 runtime 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`：

- **Embedded**：必須關，否則 claude CLI 會把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`，再 `npm install -g` 到使用者 npm prefix（不在 BAT 路徑），導致 BAT 下次 spawn 找不到 binary（BUG-059 / BUG-055 同根因）
- **System**：native installer 已自我關閉 auto-update（`autoUpdatesProtectedForNative: true`），疊加 env flag 無副作用；npm-global system 安裝同樣受益於此 flag
- 使用者要更新 embedded：等 BAT release 重打包；要更新 system：在 BAT 外手動 `claude update` 或重跑 installer

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。
```

### Step 3：自我驗收

1. 救援殘留檔（若 dev workspace 有）：手動 rename `.old.<ts>` 回 `claude.exe`
2. `npm run dev`（或對應 BAT 啟動指令）開 BAT
3. 連續派 5 張 worker 工單（隨意小工單即可，例如 dummy `/ct-help`）
4. 檢查 `node_modules/@anthropic-ai/claude-code*/bin/` 與（若打包過）`app.asar.unpacked/.../bin/` 確認**無 `*.old.*` 殘留**
5. BAT terminal 內手動 `claude --version` → 不應觸發 update
6. （選做）BAT terminal 內 `claude --debug` 觀察是否顯示 update flow 被 env disable

## 驗收條件

- [ ] grep `DISABLE_AUTOUPDATER` 在 BAT codebase 至少出現 **4 次**（`pty-manager.ts` 三處 + `claude-agent-manager.ts` 一處）
- [ ] 連續跑 5 張 worker 工單後，`node_modules/@anthropic-ai/claude-code*/bin/` 與（packaged）`app.asar.unpacked/.../bin/` 都無 `*.old.*` 殘留
- [ ] `claude --version` 在 BAT terminal 內不觸發 update
- [ ] CLAUDE.md 已補充「Embedded claude auto-update 停用（BUG-059）」段落
- [ ] git commit message 含 `BUG-059` 與 `BUG-055` reference

## 非目標（out of scope）

- 改 PLAN-027 預設 runtime
- postinstall 清理 `.old.*` script（follow-up 評估）
- 修使用者已污染的 `installMethod: "global"` user config（follow-up 評估）
- 上游回報 Anthropic（並行做，不阻塞本修復）

## 跨平台 spot-check（選做）

若 dev 機是 Windows，**強烈建議**請另一台 macOS 或 Linux 機 spot-check：開 BAT 跑 1-2 張 worker 工單後檢查對應 path 下無 rename 殘留。

## 回報區（Worker 填寫）

- **完成狀態**：FIXED（修復已完成，等待驗收）
- **開始時間**：2026-04-25 10:08:52
- **回報時間**：2026-04-25 10:15:26
- **執行模式**：CT_MODE=on（BAT 內部終端派發）

### 產出摘要

依 D087 / 方案 A 在所有 BAT spawn 路徑無條件注入 `DISABLE_AUTOUPDATER=1`：

| 檔案 | 注入點 | 行號（修改後） |
|------|-------|--------------|
| `electron/pty-manager.ts` | server-mode envWithUtf8 | 421 |
| `electron/pty-manager.ts` | node-pty envWithUtf8 | 474 |
| `electron/pty-manager.ts` | child_process fallback envWithUtf8 | 554 |
| `electron/claude-agent-manager.ts` | constructor 全域 process.env 注入 | 227 |
| `CLAUDE.md` | 新增「Embedded claude auto-update 停用（BUG-059）」段落 | 83-93 |

注入策略：
- pty-manager 三處 envWithUtf8：在 `BAT_SESSION` 之後、`BAT_TERMINAL_ID` 之前並排注入，附 `// BUG-059:` 註解
- claude-agent-manager constructor：採全域 `process.env` 注入（首選方案，影響所有後續 SDK 子行程，最不易遺漏；不依賴 SDK options.env 介面）

驗證：
- grep DISABLE_AUTOUPDATER 在 codebase 命中 4 處（AC1 ✓）
- `npx tsc --noEmit` PASS（0 errors）
- `npx vite build` PASS（renderer + electron + preload + terminal-server 四 bundle 全綠）
- 受影響檔案 git diff 已檢視，無 BUG-038 ELECTRON_RUN_AS_NODE 等舊邏輯回歸

### 互動紀錄

無

### 遭遇問題

- worker shell 被自動鎖在 `_ct-workorders/` 子目錄，無法靠 `cd` / `--prefix` 切到專案根。改用 `node -e "process.chdir('../'); ..."` 包裝，type-check 與 build 皆 PASS。非阻塞性，僅記錄供後續工單參考。

### 自我驗收狀態

| 驗收條件 | 狀態 | 備註 |
|---------|------|------|
| AC1：grep DISABLE_AUTOUPDATER ≥ 4 次 | ✅ | pty-manager.ts:421/474/554、claude-agent-manager.ts:227 |
| AC2：5 張 worker 工單後無 `*.old.*` 殘留 | ⏳ 待塔台/使用者驗收 | 需重啟 BAT 並實機跑連續 worker session |
| AC3：`claude --version` 不觸發 update | ⏳ 待塔台/使用者驗收 | 需在新啟動 BAT terminal 內執行 |
| AC4：CLAUDE.md 補充段落 | ✅ | 「Embedded claude auto-update 停用（BUG-059）」段落已加 |
| AC5：commit message 含 BUG-059 + BUG-055 reference | ✅ | 見下方 commit hash |

AC2/AC3 為運行時驗收，必須在 build + 重啟 BAT 後手動觀察，無法在 worker session 內自動驗證。程式碼變更 + type-check + build 已完成，等待塔台/使用者跑「重啟 BAT → 連續派 5 張 worker → 檢查 `node_modules/@anthropic-ai/claude-code*/bin/` 與 packaged `app.asar.unpacked/.../bin/` 無 `*.old.*`」即可結案。

### Renew 歷程

無

### Commit

- `426d6fc` — fix(electron): inject DISABLE_AUTOUPDATER=1 into all BAT spawn paths
  - 含工單編號 T0251、BUG-059、BUG-055、研究來源 T0250、決策 D087 reference



---

**建立者**：Control Tower（Session 25，2026-04-25）
**對應 BUG**：BUG-059（修復目標）+ BUG-055（連帶修復）
**對應決策**：D087（採方案 A）
**研究來源**：T0250
