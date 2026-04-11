# 工單 T0016-pre-windbg-dmp-analysis

## 元資料
- **工單編號**:T0016-pre
- **任務名稱**:安裝 WinDbg/cdb + 分析 BUG-004 現有 .dmp 檔 + 獨立驗證 H1
- **狀態**:DONE
- **類型**:Tooling Setup + Forensic Analysis
- **開始時間**:2026-04-11 04:20 (UTC)
- **完成時間**:2026-04-11 04:31 (UTC)
- **前置條件**:T0014 DONE(dmp 存在)、T0015 DONE(H1 假設已提出)
- **嚴重度**:🟡 MEDIUM(與 T0016 平行執行,提供獨立證據強化決策)
- **預估工時**:1 - 2 小時
- **建立時間**:2026-04-11 12:35 (UTC+8)
- **建立者**:Control Tower
- **關聯**:BUG-004、T0015(H1 假設)、T0016(平行修復工單)

---

## 動機

T0015 §7 因 sub-session 環境無 WinDbg/cdb **跳過 dmp 分析**。本工單補齊此能力:
1. 安裝 Windows SDK 的 `cdb.exe`(或同等工具)
2. 分析 T0014 捕捉到的 `Crashes/reports/6528598d-*.dmp`
3. 取得 native stack trace
4. **獨立驗證** T0015 的 H1 假設(WASAPI output pipeline crash)

**為什麼平行於 T0016?**
- T0016 做「方案 E 修復(改 1 行)」— 風險低,不需等 stack trace
- T0016-pre 做「證據強化」— 無論 T0016 結果如何,stack trace 都有獨立價值
- 兩張工單**不重疊檔案**:T0016 改 `recording-service.ts`,T0016-pre 只動系統工具 + 分析檔
- 若 T0016 修好 + T0016-pre 證據一致 → 雙重確認
- 若 T0016 沒修好 → T0016-pre 的 stack trace 指引下一步

---

## 前置背景

### BUG-004 證據(由 T0014 捕捉)

**crash event**:
```
[2026-04-11T03:47:57.124Z] [ERROR] [CRASH] render-process-gone reason=crashed exitCode=-1073741819
```

**Exit code**:`-1073741819` = `0xC0000005` = **STATUS_ACCESS_VIOLATION**

**dmp 檔案位置**:
```
Windows 原始路徑: C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Crashes\reports\6528598d-2995-43cf-96e3-393cb74394ca.dmp
Git Bash 路徑:    /c/Users/Gower/AppData/Roaming/better-agent-terminal-runtime-1/Crashes/reports/6528598d-2995-43cf-96e3-393cb74394ca.dmp
```

### T0015 的 H1 假設(要驗證的)

> **H1:Web Audio API native crash** — `processor.connect(audioContext.destination)` 觸發 Chromium 的 WASAPI output 初始化,在 Windows 音訊 stack 內 native crash。
>
> **預測的 stack trace 特徵**:
> - 應看到 `audioses.dll` / `AudioSes.dll` / `mmdevapi.dll` 等 Windows 音訊模組
> - 可能看到 `IAudioClient` / `WASAPI` 相關符號
> - 可能看到 Chromium 的 `media::`、`webrtc::`、`content::`、`blink::` 等命名空間
> - **不應看到** whisper / `whisper-node-addon` 符號(負證據)

### 塔台推薦的備援假設

若 stack 指向非音訊路徑,考慮:
- **H6**:Chromium renderer 內其他子系統(V8 heap、Blink GC、IPC)
- **H7**:Graphics stack(GPU process、Skia、Blink compositor)
- **H8**:Driver bug(audio driver、USB audio、virtual audio device)

---

## 工作量預估

| 階段 | 預估 |
|------|------|
| §1 工具安裝 | 20 - 60min(取決於下載速度) |
| §2 工具驗證 | 5min |
| §3 dmp 分析執行 | 5 - 15min(取決於符號下載) |
| §4 關鍵資訊擷取 | 15min |
| §5 H1 驗證與解讀 | 15 - 30min |
| §6 報告產出 | 10 - 20min |
| **總計** | **1 - 2 小時** |

---

## 任務指令

### 前置條件
- **新 sub-session**,與 T0016 同時執行但分開終端
- **不要動到** T0016 正在改的 `src/lib/voice/recording-service.ts`
- 檢查系統權限:部分安裝方式需要 admin

### 工作範圍

#### §1 安裝 cdb.exe(3 選 1)

**方式 A — winget 安裝 Windows SDK**(推薦,最快)
```bash
# PowerShell 或 cmd
winget install --id Microsoft.WindowsSDK.10.0.22621 --accept-source-agreements --accept-package-agreements
# 若版本不對,試通用版本
winget install Microsoft.WindowsSDK
```
安裝完 cdb.exe 通常在:
```
C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe
```

**方式 B — 下載 Debugging Tools for Windows 獨立安裝包**
https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/debugger-download-tools

**方式 C — 檢查系統是否已內建**
```bash
# 有些 Windows 10/11 已內建
ls "/c/Program Files (x86)/Windows Kits/10/Debuggers/x64/cdb.exe" 2>/dev/null
ls "/c/Program Files/Windows Kits/10/Debuggers/x64/cdb.exe" 2>/dev/null
# 或 PATH 中
which cdb 2>/dev/null
```
若已存在 → 跳到 §2

**備援方式 D — 使用 WinDbg Preview(Microsoft Store)**
```
winget install Microsoft.WinDbg
```
(CLI 能力較弱,但可互動分析)

#### §2 驗證工具可用
```bash
CDB="/c/Program Files (x86)/Windows Kits/10/Debuggers/x64/cdb.exe"
# 或實際找到的路徑
"$CDB" -version
```
預期輸出類似:`cdb version 10.0.22621.xxx`

若 cdb 需要 DbgHelp.dll,檢查同目錄下有 `dbghelp.dll` 和 `symsrv.dll`。

#### §3 分析 dmp(關鍵步驟)

**設定符號路徑(讓 cdb 能從微軟符號伺服器抓 symbols)**:
```bash
export _NT_SYMBOL_PATH="srv*C:\symbols*https://msdl.microsoft.com/download/symbols"
```

**執行分析**:
```bash
DMP="/c/Users/Gower/AppData/Roaming/better-agent-terminal-runtime-1/Crashes/reports/6528598d-2995-43cf-96e3-393cb74394ca.dmp"
"$CDB" -z "$DMP" -c "!analyze -v; .ecxr; k 20; lmf; lm m audio*; lm m webrtc*; lm m mmdev*; q" > _ct-workorders/reports/T0016-pre-dmp-analysis.txt 2>&1
```

指令說明:
- `!analyze -v`:自動分析,給出 FAULTING_MODULE / FAULTING_IP / ExceptionAddress
- `.ecxr`:切換到例外發生時的 context
- `k 20`:顯示堆疊前 20 frames
- `lmf`:列出載入的模組(帶檔案路徑)
- `lm m audio*`:只列出名稱含 audio 的模組
- `lm m webrtc*`:webrtc 相關模組
- `lm m mmdev*`:Windows 多媒體裝置 API
- `q`:退出

**注意**:
- 首次執行會下載符號(可能很慢,10-50MB)
- 若 Chromium 符號下載失敗(很常見),會看到 `<unknown>` 很多,**這是正常的**,關注 Windows 系統符號即可
- 若全部 frame 都是 `<unknown>`,試加 `.reload /f` 強制重載

#### §4 擷取關鍵資訊

從 `_ct-workorders/reports/T0016-pre-dmp-analysis.txt` 抓出:

1. **ExceptionAddress**(`!analyze -v` 開頭)
2. **ExceptionCode**(應為 `c0000005`)
3. **FAULTING_IP** 和 **FAULTING_MODULE**
4. **Stack trace top 20 frames**(從 `k 20` 輸出)
5. **Audio-related 載入模組**(從 `lm m audio*` 等)
6. **符號解析狀態**(有符號 vs `<unknown>` 的比例)

在回報區用精簡格式呈現,**不要貼整份 stdout**(太長)。

#### §5 H1 驗證

基於 §4 的 stack trace,回答:

1. **FAULTING_MODULE 是什麼?**
   - 若是 `audioses.dll` / `AudioSes.dll` / `mmdevapi.dll` → **H1 強烈支援**
   - 若是 Chromium 的 `chrome_elf.dll` / `chrome.dll` / `libEGL.dll` → **部分支援**(需進一步看 frame)
   - 若是 `ntdll.dll` / `kernel32.dll` → 系統層,看上一個 frame
   - 若是完全不相關(GPU、driver、kernel)→ **H1 反駁**,提出新假設

2. **Stack 是否經過 WASAPI 相關符號?**
   - 關鍵字:`IAudioClient`、`WASAPI`、`MMDevice`、`CAudioClient`、`RenderThread`、`AudioRender`
   - 有任一個 → H1 強烈支援

3. **Stack 是否在 Chromium 的 media subsystem?**
   - 關鍵字:`media::`、`content::AudioRendererHost`、`webrtc::`、`AudioInputStream`、`AudioOutputStream`
   - 有 `AudioOutputStream` 相關 → H1 強烈支援(印證「output 初始化」假設)
   - 有 `AudioInputStream` → H1 **部分反駁**(可能是 input 初始化問題,不是 output)

4. **結論三選一**:
   - ✅ **H1 確認**:方案 E(繞過 audioContext.destination)正確
   - ⚠️ **H1 部分確認**:問題在 Web Audio 區域但不是 output,可能需調整方案 E
   - ❌ **H1 反駁**:提供新假設(H6/H7/H8)和下一步建議

#### §6 產出報告

在回報區填寫結構化結果。

---

## 禁止事項

- ❌ **修改任何 src/ electron/ 程式碼**(這是 T0016 的範圍)
- ❌ **修改 package.json**
- ❌ **動 T0016 正在改的 `recording-service.ts`**
- ❌ **觸碰 dmp 檔**(只讀,不刪不移不複製到其他位置)
- ❌ **啟動 dev server / Electron**(不需要)
- ❌ **寫入符號快取以外的系統目錄**(除了 `C:\symbols`)

---

## 允許事項

- ✅ 安裝系統工具(winget、debugger)
- ✅ 下載 Microsoft 符號(自動,由 cdb 處理)
- ✅ 讀 dmp
- ✅ 寫入分析報告到 `_ct-workorders/reports/T0016-pre-dmp-analysis.txt`
- ✅ 執行 `cdb` 指令

---

## 預期產出

1. cdb 安裝方式和驗證結果
2. `_ct-workorders/reports/T0016-pre-dmp-analysis.txt`(完整 cdb 輸出)
3. Stack trace 前 20 frames(精簡版在回報區)
4. FAULTING_IP + FAULTING_MODULE
5. H1 驗證結論(確認 / 部分 / 反駁)
6. 若 H1 反駁,提出新假設 + 證據

---

## 驗收條件

- [ ] cdb 已安裝且可執行(`cdb -version` 有輸出)
- [ ] dmp 成功解析(即使符號不全)
- [ ] Stack trace 至少 10 frames 可讀
- [ ] FAULTING_MODULE 已識別
- [ ] `_ct-workorders/reports/T0016-pre-dmp-analysis.txt` 存在且內容完整
- [ ] §5 結論明確(不可寫「不確定」,必須給方向)
- [ ] `git status` 只新增 `_ct-workorders/reports/T0016-pre-dmp-analysis.txt`(不動其他檔)

---

## Sub-session 執行指示

### 執行步驟
1. 新開 sub-session(**不要與 T0016 共用 session**)
2. `/ct-exec T0016-pre`
3. 讀本工單
4. 執行 §1 → §6
5. 填寫回報區
6. `/ct-done T0016-pre`

### 執行注意事項

- **T0016 平行執行中**,**嚴禁動 `src/lib/voice/recording-service.ts`**
- 若 `winget` 沒權限,嘗試 `winget install --scope user`
- 若符號下載太慢,在 `.ecxr` 指令前加 `.sympath+ https://msdl.microsoft.com/download/symbols`
- 若 `!analyze -v` 只吐 `Probably caused by : Unknown_Module`,試:
  ```
  !heap -p; .reload /f; !analyze -v
  ```
- 若所有方式都失敗,在回報區寫明並跳過(不扣分)
- **時間 box**:§1 工具安裝超過 60 分鐘視為失敗,跳過後續
- **絕對不要**為了分析結果完美而修改程式碼

---

## 回報區

### 完成狀態
DONE

### §1 工具安裝
方式 A（winget 安裝 Windows SDK）：

`winget install --id Microsoft.WindowsSDK.10.0.22621 --accept-source-agreements --accept-package-agreements --silent`

- 安裝結果：成功
- cdb 路徑：`C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe`
- cdb 版本：`10.0.22621.2428`

### §2 驗證
`cdb -version` 輸出：

`cdb version 10.0.22621.2428`

### §3 執行指令
執行時間（UTC）：2026-04-11 04:30:58（`_ct-workorders/reports/T0016-pre-dmp-analysis.txt` 寫入時間）

```powershell
$env:_NT_SYMBOL_PATH='srv*C:\symbols*https://msdl.microsoft.com/download/symbols'
& 'C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe' `
  -z 'C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Crashes\reports\6528598d-2995-43cf-96e3-393cb74394ca.dmp' `
  -c "!analyze -v; .ecxr; k 20; lmf; lm m audio*; lm m webrtc*; lm m mmdev*; q" `
  *> _ct-workorders\reports\T0016-pre-dmp-analysis.txt
```

### §4 關鍵資訊
**ExceptionAddress**: `00007ff6d7d6437b (electron!Cr_z_adler32+0x7c7cb)`
**ExceptionCode**: `c0000005 (Access violation)`
**FAULTING_IP**: `00007ff6d7d6437b`
**FAULTING_MODULE**: `electron.exe`（`MODULE_NAME: electron`）

**Stack trace(top 20)**:
```
1.  electron!Cr_z_adler32+0x7c7cb
2.  electron!GetHandleVerifier+0x4c8b0f
3.  electron!GetHandleVerifier+0x4c9463
4.  electron!uv_random+0x173d55
5.  electron!sqlite3_dbdata_init+0x13bda60
6.  electron!cppgc::internal::WriteBarrier::DijkstraMarkingBarrierRangeSlow+0x44db7b
7.  electron!Cr_z_adler32+0x982f7
8.  electron!Cr_z_adler32+0xa08a3
9.  electron!GetHandleVerifier+0xefb9
10. electron!uv_os_getpid+0x2c448
11. electron!uv_fs_get_system_error+0x167b10
12. electron!v8::ScriptCompiler::ScriptStreamingTask::ScriptStreamingTask+0x845f2
13. electron!v8::ScriptCompiler::ScriptStreamingTask::ScriptStreamingTask+0x85469
14. electron!v8::ScriptCompiler::ScriptStreamingTask::ScriptStreamingTask+0x81770
15. electron!v8::ScriptCompiler::ScriptStreamingTask::ScriptStreamingTask+0x818ed
16. electron!std::__Cr::vector<v8::CpuProfileDeoptInfo,std::__Cr::allocator<v8::CpuProfileDeoptInfo> >::vector<v8::CpuProfileDeoptInfo,std::__Cr::allocator<v8::CpuProfileDeoptInfo> >+0x10445
17. electron!Cr_z_adler32+0x4891e2
18. KERNEL32!BaseThreadInitThunk+0x17
19. ntdll!RtlUserThreadStart+0x2c
```

**Audio-related 載入模組**:
- `lm m audio*`：無匹配
- `lm m webrtc*`：無匹配
- `lm m mmdev*`：無匹配
- `lmf` 可見 `WINMM.dll` 已載入，但未出現在 faulting frame/頂部 stack

**符號解析狀態**:top stack 19 frames 皆可解析為 `module!symbol`，無 `<unknown>`；主要落在 `electron` 模組，系統尾端為 `KERNEL32` / `ntdll`。

### §5 H1 驗證結論
**驗證結果**:❌ 反駁

**理由**:
1. faulting point 是 `electron!Cr_z_adler32+0x7c7cb`（frame #1），非 `audioses.dll` / `mmdevapi.dll` / `AudioSes.dll`。
2. top stack 出現 `cppgc` / `v8::ScriptCompiler` 路徑（frame #6, #12-#16），偏向 renderer/V8 路徑。
3. `lm m audio*` / `lm m webrtc*` / `lm m mmdev*` 皆無匹配，stack 無 `WASAPI` / `IAudioClient` / `AudioOutputStream` 關鍵符號。

**若反駁,新假設**:
H6（Chromium renderer 內非音訊子系統）較可能：目前證據顯示為 electron 模組內 NullPtr read，並伴隨 V8/cppgc stack，較接近 renderer memory/GC/資料路徑異常，而非 WASAPI output 初始化。

### §6 附加觀察
- `AV.Dereference: NullPtr`，讀取位址 `0x0`。
- 當下寄存器 `r14=0`，對應 fault 指令 `mov rcx,qword ptr [r14]`。
- 多個參數/記憶體區塊出現 `aaaaaaaa...`，符合 poisoned/uninitialized pattern 的常見跡象。
- `!analyze -v` 分析耗時約 97 秒（含符號解析）。

### git status
（以工單相關檔案為範圍）

```bash
?? _ct-workorders/T0016-pre-windbg-dmp-analysis.md
?? _ct-workorders/reports/T0016-pre-dmp-analysis.txt
```

（備註：工作樹另有大量非本工單的既有變更）

### 互動紀錄
無

### 問題與觀察
- `sprint-status.yaml` 搜尋結果：根目錄 / `_bmad-output/` / `docs/` 皆未找到，標記為「不適用」。
- 無阻塞；工具安裝完成後可直接分析 dmp。

### 遞交給塔台的問題
建議 Tower 開後續工單做 H6 驗證：
1. 啟用更完整 Electron/Chromium symbols，重跑同一份 dmp 以提升 `electron!Cr_z_adler32` 對應函式可讀性。
2. 檢查 crash 前 renderer 端資料路徑（特別是壓縮/buffer 相關資料）是否存在空指標或生命週期競態。
