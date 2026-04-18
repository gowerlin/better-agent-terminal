# T0198 — BUG-047 修復(packaging 側):asarUnpack 補 platform-specific 子包

## 元資料

- **編號**:T0198
- **類型**:實作(trivial,設定兩行 + 驗證)
- **狀態**:✅ FIXED
- **估時**:25-40 min(改設定 ~2 + build 驗 `.unpacked/` ~10 + 同類型 grep ~8 + 回報 ~10)
- **建立時間**:2026-04-19 01:54 (UTC+8)
- **開始時間**:2026-04-19 01:59 (UTC+8)
- **完成時間**:2026-04-19 02:03 (UTC+8)
- **關聯**:BUG-047、T0197(翻案發現)、D057、PLAN-005
- **優先級**:🔴 High(V1 packaged app 對 Rico 100% 阻擋,已確認根因)

## 前置條件

- 閱讀 T0197 回報區(根因已精準定位在 packaging 層)
- 閱讀 `package.json` 現有 `build.asarUnpack` 設定
- 了解 npm optional platform subpackage 機制(每個 platform/arch 是**獨立的 top-level entry**,不是主包子目錄)

## 背景(T0197 翻案結果)

**現況**(已確認):
```
node_modules/@anthropic-ai/
├── claude-agent-sdk/           ✅ asarUnpack 有列(cli.js 能 unpack)
├── claude-agent-sdk-win32-x64/ ❌ 漏列(claude.exe 卡在 .asar 內)
├── claude-code/                ✅ 有列
├── claude-code-win32-x64/      ❌ 漏列
└── sdk/
```

**Code 側無問題**:`resolveClaudeCodePath()` 的 asar.unpacked rewrite 邏輯正確,但 `.exe` 根本沒被 unpack,`child_process.spawn` 無法從 ASAR 虛擬 FS 執行 binary → crash。

## 任務

### Step 1:修改 `package.json` 的 `asarUnpack`

現有:
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@img/**/*",
  "dist-electron/terminal-server.js"
]
```

改為:
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-code-*/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk-*/**/*",
  "node_modules/@img/**/*",
  "dist-electron/terminal-server.js"
]
```

新增的兩行 glob 會 cover 所有 `claude-code-<platform>-<arch>` 和 `claude-agent-sdk-<platform>-<arch>` 變體(win32-x64、darwin-arm64、darwin-x64、linux-x64、linux-arm64 等)。

### Step 2:同類型風險排查(grep + read)

檢查其他 native binary 是否有相同 pattern 漏列:

```bash
# 查看 node_modules 有哪些 platform-specific 子包
ls node_modules/@lydell/ 2>/dev/null
ls node_modules/@img/ 2>/dev/null
ls node_modules/ | grep -E "(lydell|img|better-sqlite)" 2>/dev/null
```

**重點確認**:
- `@lydell/node-pty-*`:是否是獨立子包(`@lydell/node-pty-win32-x64` 等)?若是,現在 asarUnpack 有沒有包進去?
- `@img/**/*`:glob 形式已經對(match 底下所有子包),但確認實際 node_modules 有 `@img/sharp-win32-x64` 等獨立子包存在
- `better-sqlite3`:使用 prebuild-install 機制,`.node` 檔在主包 `build/Release/`,通常不是 platform-subpackage 模式,但需確認 package.json 是否列入

**只查不改**:若發現其他 binary 也漏列 → 在回報區註記 + 建議,但**本張只修 claude-code / claude-agent-sdk 兩組**(使用者決策 Q2.C 延續)。

### Step 3:Build 驗證 `.unpacked/` 實際內容

這是**關鍵驗證步驟**。不能只看 tsc/build 通過,必須確認 `.exe` 真的被 unpack。

```bash
# 1. 清乾淨前次 build artifact
rm -rf release/ dist-electron/ dist/

# 2. Build 不出 installer,只做 dir(快速且足以驗證 asarUnpack)
npx electron-builder --win --dir

# 3. 驗證路徑
ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/
# 期望看到:
#   claude-agent-sdk/
#   claude-agent-sdk-win32-x64/   ← 本次新增
#   claude-code/
#   claude-code-win32-x64/        ← 本次新增

# 4. 驗證 .exe 實體存在
ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe
ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe
# 兩個都應該存在且 size > 0
```

若發現 `.exe` 仍缺失 → 根因假設錯誤,回報並停手(不要硬改)。

### Step 4:tsc + vite build(保險)

```bash
npx tsc --noEmit   # 允許 TerminalPanel.tsx 兩個 pre-existing errors(BUG-042),其他都要綠
npx vite build     # 要綠
```

### Step 5:Commit

Conventional Commits,單一 atomic commit:
```
fix(packaging): unpack @anthropic-ai platform subpackages (BUG-047, T0198)

npm optional platform subpackages (claude-code-win32-x64,
claude-agent-sdk-win32-x64, etc.) are independent node_modules entries,
not subdirs of the main package. Previous asarUnpack glob only matched
main packages, leaving claude.exe stuck inside app.asar. Add two glob
patterns to cover all platform/arch variants.

Verified: release/win-unpacked/resources/app.asar.unpacked/ now contains
claude-agent-sdk-win32-x64/claude.exe and claude-code-win32-x64/claude.exe.

Refs: BUG-047, T0197 (root cause analysis), D057
```

## 驗收標準

- [ ] `package.json` asarUnpack 新增兩行 glob(`claude-code-*` / `claude-agent-sdk-*`)
- [ ] `npx electron-builder --win --dir` 通過
- [ ] `release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe` 實體存在
- [ ] `release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe` 實體存在
- [ ] `npx tsc --noEmit` 除 BUG-042 兩個 pre-existing 外全綠
- [ ] `npx vite build` 全綠
- [ ] 回報區含:實際 `.unpacked/` 內容、其他 binary 排查結果、commit hash

## 禁止

- ❌ 不擴充修復範圍到 `@lydell/**` / `better-sqlite3`(僅排查回報)
- ❌ 不打 pre.2 tag(塔台決策,使用者另行授權)
- ❌ 不改任何 code 檔(電池側已正確,碰了只會引入 regression)
- ❌ 若 `--dir` build 驗證發現 `.exe` 仍缺 → 停手回報,不要改 `package.json` 其他設定硬試

## 回報區

<!-- Worker 填寫 -->

### 完成狀態

**FIXED** — asarUnpack 已補上 platform-specific 子包 glob,packaged app 中 `claude.exe` 成功從 ASAR 解壓到 `.unpacked/`,等待使用者實機驗收(裝 Rico NSIS installer 測試)。

### `.unpacked/` 實際內容(ls 輸出)

```
$ ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/
claude-agent-sdk/
claude-agent-sdk-win32-x64/     ← 本次新增(原本漏)
claude-code/
claude-code-win32-x64/          ← 本次新增(原本漏)

$ ls -la .../claude-agent-sdk-win32-x64/claude.exe
-rwxr-xr-x 1 Gower 197121 245966496 Apr 19 02:01 .../claude-agent-sdk-win32-x64/claude.exe

$ ls -la .../claude-code-win32-x64/claude.exe
-rwxr-xr-x 1 Gower 197121 245966496 Apr 19 02:01 .../claude-code-win32-x64/claude.exe
```

兩個 `claude.exe` 實體均存在,size ≈ 246 MB(正常尺寸的 Node.js SEA bundle)。

**附加佐證**:electron-builder build log 顯示 signtool 對三個 `.exe` 都執行了簽章動作:
- `claude-code-win32-x64\claude.exe` ✅
- `claude-code\bin\claude.exe` ✅(原本就 unpack,這次 stub launcher 也同時更新)
- `claude-agent-sdk-win32-x64\claude.exe` ✅

### 其他 binary 排查結果(只查不改,範圍守護遵守)

- **`@lydell/node-pty-*`**:⚠️ **存在漏列風險** — `node_modules/@lydell/node-pty-win32-x64/` 內有 `conpty.node` / `conpty_console_list.node`(實際 PTY 原生 binary),目前 asarUnpack **未列**。推測是因 `.node` 模組以 `require()` 載入時 Electron 有內建 asar.unpacked 處理機制(v8 bindings 會自動脫 asar),與 `.exe` 用 `child_process.spawn` 走 file system 呼叫路徑不同。**建議後續觀察**:若使用者回報 terminal/PTY 開不起來 → 開 BUG 單 + 補 `@lydell/node-pty-*/**/*` glob。本次不修以避免擴大範圍。
- **`@img/**`**:✅ 現有 `@img/**/*` glob 已 cover — `@img/sharp-win32-x64`、`@img/sharp-libvips-*` 等子包都是 `@img` 下的 top-level entry,現有 glob 一網打盡。無需改動。
- **`better-sqlite3`**:✅ 不是 platform-subpackage 模式 — `better-sqlite3/build/Release/better_sqlite3.node` 在主包內,由 `npm rebuild better-sqlite3` postinstall 產生對應 ABI。現有配置 `npmRebuild: false` + `files: ["node_modules/**/*"]` 會把整個 `better-sqlite3/` 含 `.node` 都打入 asar,Electron 的 native module loader 能自動處理 asar 內 `.node` 載入(原理同 `@lydell/node-pty`)。目前沒看到運行時問題報告,**不列入 asarUnpack**。

### Commit hash

`e619b81` — `fix(packaging): unpack @anthropic-ai platform subpackages (BUG-047, T0198)`

### 驗證結果

- [x] `package.json` 改動(asarUnpack 新增 `claude-code-*/**/*` 和 `claude-agent-sdk-*/**/*` 兩行)
- [x] `electron-builder --win --dir` 通過(electron-builder 26.8.1 + Electron 41.2.1)
- [x] `.exe` 在 `.unpacked/`(兩個 claude.exe 都存在,各 ~246 MB)
- [x] tsc 除 BUG-042 兩個 pre-existing 外全綠
- [x] vite build 全綠(main.js/sdk/preload/terminal-server 皆產出)

### 使用者待辦(驗收)

本張工單只修 packaging 設定,實機驗收需:
1. `release new pre tag version` 打 pre.2 tag(需塔台/使用者授權)
2. 等 CI 產出 NSIS installer
3. Rico 安裝 v0.0.16-pre.2 → 測試「自動 Kill 現有 Terminal」流程不再 crash

---
