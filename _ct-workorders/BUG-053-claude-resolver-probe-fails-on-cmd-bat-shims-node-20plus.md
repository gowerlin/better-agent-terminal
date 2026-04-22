# BUG-053 — `probeClaudeHealth` 無法 spawn `.cmd` / `.bat` shim(Node 20+ CVE-2024-27980)

## 元資料

- **編號**:BUG-053
- **狀態**:🚫 CLOSED(2026-04-22 19:50 隨 BUG-054 驗收一併關閉;T0235 改採 Option A = 砍 `.cmd`/`.bat` 偵測,對齊 native SDK 方向)
- **嚴重度**:🟢 Low(dev 模式、無 `.exe` 的環境才會 hit;fallback-to-embedded 已保底)
- **建立時間**:2026-04-22 18:50 (UTC+8)
- **發現來源**:T0233 AC-4 Windows 驗證 probe(`tests/_windows-probe.ts`)
- **關聯**:
  - T0230 `electron/claude-resolver.ts`(`probeClaudeHealth` 未加 `shell: true`)
  - PLAN-027(Claude runtime selection)
  - Node.js 20+ CVE-2024-27980 mitigation:spawn `.cmd`/`.bat` 無 `shell: true` → `EINVAL`
- **可重現**:Windows,Node >= 20.12.1,`detectSystemClaude(customPath='X.cmd')` → `healthStatus: 'spawn-failed'`,即使 .cmd 本身可執行
- **workaround**:改指 `.exe`;或保持 `fallbackToEmbedded: true`(預設),降級到內嵌 claude

## 現象(T0233 probe 實測)

```
$ npx tsx tests/_windows-probe.ts
[AC-4.2++ customPath → .cmd shim] C:\Users\Gower\AppData\Roaming\npm\claude.cmd:
{
  "path": "C:\\Users\\Gower\\AppData\\Roaming\\npm\\claude.cmd",
  "version": "",
  "versionRaw": "",
  "healthStatus": "spawn-failed",
  "source": "custom"
}
```

直接 `spawn('.../claude.cmd', ['--version'])`(無 `shell: true`)→ 同步 throw `EINVAL`。`probeClaudeHealth` 的 try/catch 接住,回傳 null,偵測結果標為 `spawn-failed`。

## 根因

`electron/claude-resolver.ts:186`:

```ts
child = spawn(binaryPath, ['--version'], {
  timeout: PROBE_TIMEOUT_MS,
  windowsHide: true,
})
```

Node.js 20.12.1+ 預設禁止 spawn `.cmd`/`.bat` 而無 `shell: true`(CVE-2024-27980)。當 `binaryPath` 以 `.cmd` 或 `.bat` 結尾,此 spawn 會同步 throw `EINVAL`。

## 影響範圍

1. **Dev 模式啟動 BAT(node_modules/.bin 在 PATH 前)**:偵測會先找到 `node_modules/.bin/claude.cmd`,probe 失敗,fallback 到內嵌。設定面板會把 `system` 模式當成 unhealthy,出現 degraded toast,使用者可能誤以為系統 claude 有問題。
2. **使用者僅有 npm global `.cmd` shim**:若使用者 `npm install -g @anthropic-ai/claude-code` 後,npm 只建立 `.cmd` shim(Windows npm 預設行為),沒有 `.exe`。系統模式會被判為 unhealthy。但多數 Windows 使用者會透過 `claude-code` 安裝腳本,那腳本會放 `.exe` 到 `%USERPROFILE%\.local\bin\`,所以問題會繞過。
3. **Production packaged BAT**:不受影響 —— 打包後的 BAT 不把 `node_modules/.bin` 放到子進程 PATH。

## 預期行為

`probeClaudeHealth` 應該成功 probe `.cmd` / `.bat` shim,正確回傳 version 字串。

## 修復建議(僅記錄,不在本 BUG 執行)

Option A(最小改動):`probeClaudeHealth` 偵測路徑後綴,若為 `.cmd` 或 `.bat`,加 `shell: true`:

```ts
const isShim = /\.(cmd|bat)$/i.test(binaryPath)
child = spawn(binaryPath, ['--version'], {
  timeout: PROBE_TIMEOUT_MS,
  windowsHide: true,
  shell: isShim,
})
```

Option B(遵循 Node 官方指引):對 `.cmd`/`.bat` 改用 `spawn('cmd.exe', ['/c', binaryPath, '--version'], {...})`。
- 副作用:`shell: true` 會把 args 走過 shell quoting(`--version` 沒有特殊字元,安全);但若未來 args 含使用者輸入,須 audit 安全性。

Option C(產品決策):Windows 只接受 `.exe` 作為 system claude。`.cmd` shim 視為不支援,detector 直接忽略 `.cmd`/`.bat`。這簡化實作,代價是 npm-global-only 的 Windows 使用者無法用 system mode。

## 風險與優先級建議

- 🟢 Low:packaged 不會 hit;預設 `fallbackToEmbedded: true` 讓壞掉的 probe 降級到內嵌,不會 crash session
- 若 PLAN-027 Phase 2 要把 system claude 當正式選項推給使用者,應該提升到 Medium 並優先處理
- 若 PLAN-027 僅 dev 自用,可留 backlog

## 驗證

T0233 probe 已產出完整重現步驟:`npx tsx tests/_windows-probe.ts`(非測試套件成員,本 BUG 閉環前可保留作回歸檢查)。

## 回報區

### FIXED — 2026-04-22 19:43(T0235 — 採 Option C)

**決策**:採「Option C — Windows 偵測只認 `.exe`」。理由:
- claude v2.x 已改 ship 原生 `.exe`,anthropic 官方 installer 不放 shim
- `.cmd` / `.bat` 只出現在 legacy `npm install -g` 或專案 `node_modules/.bin`,前者建議改 installer,後者不應在使用者 PATH
- 砍掉 shim 偵測=砍掉 Node 20+ CVE 相容處理,程式碼簡單、行為可預期

**修改檔案**:
- `electron/claude-resolver.ts:93` `WINDOWS_BIN_NAMES` 由 `['claude.exe', 'claude.cmd', 'claude.bat']` 縮為 `['claude.exe']`,comment 改為引用 BUG-053 / T0235。
- `electron/claude-resolver.ts:8` 上方檔頭 comment「cross-platform; .exe wins over .cmd/.bat」改為「Windows scans `.exe` only, no shims」。
- `tests/_windows-probe.ts:53` 的 `.cmd` probe 保留作 regression check,更新 comment 標註預期行為(`spawn-failed` → router fallback 到 embedded)。
- `docs/plan-027-cross-platform-verification.md` Windows 段改寫:新增「Windows 推薦安裝」區塊,移除「`.exe` 優先於 `.cmd/.bat`」對照表列,改為「❌ 不再自動偵測 shim」+ 推薦 anthropic 官方 installer + legacy npm 使用者兩條路線。

**驗證**:
- `grep -rn "claude\.cmd\|claude\.bat" electron/ src/ --include="*.ts"` 無命中(production code 乾淨)
- `grep -rn "claude\.cmd\|claude\.bat" tests/ --include="*.ts"` 只剩 `_windows-probe.ts`(regression probe)
- `npx tsc --noEmit` exit 0、`npx vite build` 三 target 綠、`claude-resolver.test.ts` 17/17 pass

**customPath 的 `.cmd` / `.bat`**:scope 內仍允許使用者手動指(customPath 繞開 scan filter),但 health probe 仍會 `EINVAL` 失敗 → router 依 `fallbackToEmbedded` 決定 fallback / 噴 degraded toast。這是預期行為,不是 bug。

**Commit**:(待 Step 8 填入)
