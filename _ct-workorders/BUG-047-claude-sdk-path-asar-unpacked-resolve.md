# BUG-047 — Claude SDK 路徑解析未處理 app.asar.unpacked（V1 裝機即壞）

## 元資料
- **編號**:BUG-047
- **狀態**:🚫 CLOSED(**雙人皆驗**:2026-04-19 Gower 本機 smoke pass + 2026-04-20 Rico v0.2.4-pre.1 回報驗證正確,T0221 `resolveClaudeCodePath()` 修復生效)
- **嚴重度**:🟠 High(**升級**,樣本 2 人:Rico + Gower,跨 pre 版本仍 100% 阻擋)
- **建立時間**:2026-04-19 01:22 (UTC+8)
- **修復時間**:2026-04-19 02:03 (UTC+8,T0198 + T0199 packaging fix) — **失效**
- **退回時間**:2026-04-19 22:20 (UTC+8,v0.2.2-pre.1 複現)
- **發現來源**:用戶 Rico 回報 → Gower dev env Release 安裝包複現
- **回報版本**:v0.0.16-pre.1(Rico)+ **v0.2.2-pre.1(Gower,T0198/T0199 修復後版本仍複現)**
- **安裝來源**:NSIS installer + GitHub Release 皆可重現
- **環境**:Windows 10/11 x64
- **關聯**:PLAN-005(Electron Builder 26 升級,EXP-BUILDER26-001)、T0197(翻案根因分析)、T0198(packaging 主修)、T0199(預防性 @lydell)、**T0220(研究工單,驗收失敗根因調查)**
- **可重現**:100%(packaged app,跨 pre.1/pre.2/v0.2.2-pre.1)/ 0%(dev env)
- **workaround**:無(V1 完全動不了)
- **修復 commits**:`e619b81` T0198 + `5de178e` T0199 — **未生效**
- **真根因**(翻案後再翻案):T0198/T0199 的 packaging fix 假設 asarUnpack pattern 補齊即可,但 v0.2.2-pre.1 仍複現同路徑錯誤 → 待 T0220 調查(installer 實體內容 + code 側 resolve 邏輯)

## 📋 Gower 樣本(2026-04-19 22:20,v0.2.2-pre.1)

**錯誤訊息**:
```
Error: Claude Code native binary not found at
  C:\Program Files\BetterAgentTerminal\resources\app.asar\node_modules\
  @anthropic-ai\claude-agent-sdk-win32-x64\claude.exe.
Please ensure Claude Code is installed via native installer or
specify a valid path with options.pathToClaudeCodeExecutable.
```

**比對 Rico 樣本**:路徑結構完全一致(`app.asar\...\claude.exe`),未 rewrite 為 `app.asar.unpacked\`。

**package.json 現況**(line 153-162):
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-code-*/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk-*/**/*",  ← 應 cover win32-x64
  ...
]
```

pattern 看起來正確,但路徑仍指向 `app.asar\` → 矛盾點待 T0220 查證。

## 📋 Rico 樣本更新(2026-04-19 22:19)

Rico 貼出同錯誤訊息末句:
> `specify a valid path with options.pathToClaudeCodeExecutable.`

表示 Rico 也還沒解決(同 Gower),且 SDK 錯誤訊息本身提示了 **`options.pathToClaudeCodeExecutable` 官方 override API** — 這是 Claude Agent SDK 設計上預期 Electron / packaged 環境需由呼叫端主動傳路徑。

**對 T0220 的意義**:B 面 grep `pathToClaudeCodeExecutable` 即可一擊定位根因。若本專案從未呼叫此 API → 修復路線極明確(main process 判斷 `app.isPackaged` 拼 `.unpacked/` 路徑傳給 SDK)。

## 現象

**Error 訊息**（Rico 截圖）:
```
Claude Code native binary not found at C:\Users\si_is\AppData\Local\Programs\
  BetterAgentTerminal\resources\app.asar\node_modules\
  @anthropic-ai\claude-agent-sdk-win32-x64\claude.exe.
Please ensure Claude Code is installed via native installer or
specify a valid path with options.pathToClaudeCodeExecutable.
```

## 根因（Rico 精準診斷）

| | 路徑 |
|---|-----|
| **Code 期望** | `resources\app.asar\node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe` |
| **實際位置** | `resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe` |

Electron-builder 的 `asarUnpack` 把 binary 解壓到 `app.asar.unpacked/`（正確行為,`.exe` 不能在 ASAR 內直接執行）,但 Claude SDK 路徑解析邏輯**沒處理 `app.asar` → `app.asar.unpacked` 的 rewrite**。

## 預期 vs 實際

- **預期**:packaged app 執行 Claude SDK 時,路徑自動 rewrite 為 `app.asar.unpacked/` 找 `claude.exe`
- **實際**:hardcoded 或直接用 `__dirname` 拼接的路徑停留在 `app.asar/`,找不到檔案 → throw

## 為何 dev env 沒碰到

`npm run dev` 直接用 `node_modules/`,不經 asar 打包。Dev 時 `claude.exe` 位於專案根的 `node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/`,路徑解析走原生 node resolution,不經 electron-builder 的 asarUnpack 機制。

只有 **packaged app** 會 hit 此 bug。

## 調查方向（留 Worker）

1. **Grep claude.exe 路徑 resolution 邏輯**:
   ```bash
   grep -r "claude-agent-sdk.*claude.exe\|pathToClaudeCodeExecutable\|claude-agent-sdk-win32" electron/ src/
   grep -r "app.asar\b" electron/ src/
   ```
2. **SDK 期望的 resolve pattern**:
   - `require.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe')` — 若用這個應該自動處理 unpacked
   - `path.join(__dirname, 'node_modules/...')` — 手動拼接會壞
   - `process.resourcesPath` 拼接 — 需要明確 `.unpacked/`
3. **Electron 標準做法**:
   ```ts
   // 在 main process:
   const binaryPath = path.join(
     process.resourcesPath,
     'app.asar.unpacked',
     'node_modules',
     '@anthropic-ai/claude-agent-sdk-win32-x64',
     'claude.exe'
   )
   ```
   或更 portable:
   ```ts
   import { fileURLToPath } from 'url'
   const modulePath = require.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/package.json')
   const binaryPath = path.join(path.dirname(modulePath), 'claude.exe')
   // Node 在 packaged app 會自動把 require.resolve 指向 .unpacked/
   ```
4. **驗證**: 
   - dev env 應無改動可繼續運作
   - packaged app 應能找到 `.unpacked/` 下的 binary

## 處理方向

### Phase 1：根因定位 + 小改修復
- 開研究+實作合一工單（trivial 級別,範圍明確）
- Grep claude binary resolution 邏輯 → 改為 `app.asar` → `app.asar.unpacked` 相容寫法

### Phase 2：打 pre-release 驗證
- `release new pre tag version` → 產 v0.0.16-pre.2
- Rico + Gower 裝 pre.2 驗證
- 若 fix 確認,再出正式 v0.0.16

### Phase 3：同類型排查
- grep 其他 platform binary 是否也有同樣問題:
  - `@img/**`（CLAUDE.md 列為全平台 binary）
  - `@lydell/node-pty-*`
  - `better-sqlite3` native module
- 若其他 binary 也走 `app.asar` path → 一次性修

## 根因假設優先排序

1. **🔴 SDK path resolution 沒 asar.unpacked 處理**（Rico 精準定位,高信心）
2. **🟡 electron-builder asarUnpack config 未明確列 `@anthropic-ai/claude-agent-sdk-win32-x64`**（實際上 .unpacked 有檔案,所以 asarUnpack 有 match 到,但 pattern 可能過寬或精確度可疑）
3. **🟢 D057 雙 arch dmg 決策的 Windows 副作用**（Windows 不走 universal,但 asarUnpack 設定可能跨平台共用 pattern）

## 備註

- **不阻擋 T0196**:T0196 是 UI 修復（Bug/Backlog tab archive toggle）,與 packaging / SDK path 獨立,繼續進行
- **Q5.D 嚴重度**:目前 Rico 單人回報,Gower dev env 正常。單 packaged 用戶視角為 100% 阻擋,但樣本小,暫標 🟡 Medium
- **處理時機**:本 session 僅建檔,待 T0196 完成 + `*evolve` 收尾後,下 session 或專案節奏允許時派修復工單
- **D057 關聯**:CLAUDE.md 明載「`@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@img/**`、`@lydell/node-pty-*` 都 ship 全平台 binary」,本 BUG 正是這些 binary 路徑之一出包
