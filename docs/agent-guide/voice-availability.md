# 語音輸入可用性事先檢查（T0802，D247）

> CLAUDE.md「語音輸入可用性事先檢查（T0802，D247）」節的完整說明。改這個功能時兩邊一起更新。

## 用途

whisper addon（`@kutalia/whisper-node-addon`）只在第一次辨識時載入，載入失敗時 fail-soft（BUG-116）：T0802 前麥克風照常可按，使用者錄完音才看到「辨識失敗」。Linux 缺 `libgomp1` / `libvulkan1`，或 glibc < 2.38（Ubuntu 22.04，BUG-203）都會這樣（T0800 實測）。

T0802 起，所有平台在 BAT 啟動後於背景檢查一次 whisper 能不能載入；已知不能用時，麥克風按鈕停用並顯示原因與安裝指令，快捷鍵不開始錄音，Settings › 語音輸入顯示可用性。系統函式庫只寫在提示與文件，不打包進 AppImage（D247）。

## 必守規則

- 🔴 檢查在**短命子程序**中做：`process.execPath` ＋ `ELECTRON_RUN_AS_NODE=1` 執行 `-e <VOICE_PROBE_SCRIPT> <addonPath> [<lib>…]`，只 `require` addon、印一行結果就 `process.exit(0)`。🔴 主行程不提早載入 whisper（不改變不用語音者的記憶體與啟動成本）。
- 🔴 延後到啟動之後：`app.whenReady` 裡 `registerVoiceHandlers` 之後呼叫 `startVoiceAvailabilityCheck()`，計時 `VOICE_AVAILABILITY_DELAY_MS` = 5 s（`unref`）才 spawn；每次 BAT 啟動只排一次，結果只在記憶體。
- 🔴 子程序一律 `execFile` ＋陣列參數＋ `timeout`（`VOICE_AVAILABILITY_TIMEOUT_MS` = 15 s）＋ `windowsHide`（CLAUDE.md「Child Process Spawning」）。
- 🔴 子程序的 env（`buildVoiceProbeEnv`）：主行程 env 去掉 `BAT_*`、`CT_*`、`ELECTRON_*`、`NODE_OPTIONS`、名稱像機密的變數（含 `TOKEN` / `SECRET` / `PASSW` / `CREDENTIAL` / `API_KEY` / `PRIVATE_KEY` / `AUTH`），再設 `ELECTRON_RUN_AS_NODE=1`；🔴 不加 `LD_LIBRARY_PATH`（主行程原本有的照樣繼承，讓子程序看到的載入環境和正式載入相同）。
- 🔴 addon 路徑解析與正式載入共用 `locateWhisperAddon`（`electron/whisper-addon-loader.ts`；預設依賴版 `locateDefaultWhisperAddon`），不另寫一份規則。
- 🔴 `unknown`（還沒檢查、逾時、當掉、無法啟動、沒有結果）一律維持 T0802 前的行為：按鈕可按，正式載入失敗時照舊 fail-soft 顯示錯誤。不得把檢查本身的失敗當成語音不可用。
- 🔴 正式載入（第一次辨識）的行為、log、錯誤訊息不變。正式載入成功時呼叫 `noteRealLoadSucceeded()`：狀態改 `available(load)`，之後的檢查結果若說不可用也維持 `available`（以正式結果為準）。正式載入失敗不改狀態。
- 🔴 `available` 與 `unknown` 時畫面與 T0802 前完全相同（`MicButton` 的 DOM 一致，`voice-availability-ui.test.tsx` 守住）。

## 唯一實作

| 位置 | 內容 |
|---|---|
| `src/lib/voice-availability.ts` | 純函式（不 import electron / DOM）：型別 `VoiceAvailability`、`classifyWhisperLoadError`（錯誤原文 → 原因代碼）、`parseVoiceProbeOutput`、`voiceAvailabilityFromProbe`（子程序結果 → 三態）、`voiceAvailabilityLogLine`、`voiceUnavailableLines` / `voiceUnavailableText`（原因與建議動作，i18n）、`aptInstallCommand`、`LINUX_LIBRARY_PACKAGES` |
| `electron/voice-availability.ts` | `VOICE_PROBE_SCRIPT`、`buildVoiceProbeEnv`、`createVoiceAvailability`（排程、執行、去重、`noteRealLoadSucceeded`、訂閱）、`getVoiceAvailability`（行程單例）、`registerVoiceAvailabilityHandlers`、`startVoiceAvailabilityCheck` |
| `electron/voice-handler.ts` | `registerVoiceHandlers` 內註冊可用性 IPC；`voice:transcribe` 正式載入成功後 `noteRealLoadSucceeded()` |
| `electron/main.ts` | `registerVoiceHandlers(getAllWindows)` 之後 `startVoiceAvailabilityCheck()` |
| `src/lib/voice-availability-store.ts` | renderer 端的狀態（`useVoiceAvailability` / `getVoiceAvailabilitySnapshot` / `recheckVoiceAvailability`），每個視窗第一次讀取時訂閱 |
| `src/components/voice/MicButton.tsx` | `unavailable` 時停用、`title` = 原因＋建議動作、`data-voice-unavailable=<code>`、class `voice-unavailable` |
| `src/hooks/useVoiceRecording.ts` | `start()` 開頭擋 `unavailable`（`error` = 同一段文字，不開始錄音） |
| `src/components/voice/VoiceAvailabilityStatus.tsx` | Settings › 語音輸入「可用性」列與「重新檢查」 |

## IPC

本機 `ipcMain.handle`（與其他 `voice:*` 相同，不在 `PROXIED_CHANNELS`、不是 helper channel）：

| channel | 方向 | 內容 |
|---|---|---|
| `voice:getAvailability` | renderer → main | 目前狀態（檢查前是 `unknown(pending)`） |
| `voice:recheckAvailability` | renderer → main | 立刻再跑一次子程序（同時多個請求共用同一次），回傳新狀態 |
| `voice:availabilityChanged` | main → 所有視窗 | 狀態改變時推送（`getAllWindows()`：主視窗、remote profile 視窗、detached 視窗） |

preload：`electronAPI.voice.getAvailability()` / `recheckAvailability()` / `onAvailabilityChanged(cb)`（回傳取消訂閱函式）。舊 preload 沒有這三個時，renderer 一律當 `unknown(pending)`。

## 三態與原因代碼

```ts
type VoiceAvailability =
  | { state: 'unknown'; reason: 'pending' | 'timeout' | 'crashed' | 'spawn-failed' | 'no-result'; detail?: string }
  | { state: 'available'; source: 'probe' | 'load' }
  | { state: 'unavailable'; code: 'missing-library' | 'glibc-too-old' | 'load-failed';
      platform: string; libraries: string[]; requiredGlibc?: string; detail: string }
```

| 情況 | 結果 |
|---|---|
| 子程序回報 `ok` | `available(probe)` |
| 錯誤原文有 `` version `GLIBC_x.y' not found `` | `unavailable(glibc-too-old)`，`requiredGlibc` = 出現過的最大版本 |
| `<soname>: cannot open shared object file`（Linux）、`Library not loaded: …/<name>.dylib`（macOS） | `unavailable(missing-library)`，`libraries` = 庫名 |
| 其他載入錯誤（含 Windows 的 `The specified module could not be found.`，原文不含 DLL 名稱）、addon 找不到（未安裝、沒有這個平台的 `whisper.node`、不支援的平台） | `unavailable(load-failed)` |
| 逾時被殺 | `unknown(timeout)` |
| 沒有結果就被訊號結束或 exit ≠ 0 | `unknown(crashed)` |
| 無法啟動（ENOENT、EACCES、同步丟例外） | `unknown(spawn-failed)` |
| exit 0 但沒有結果行 | `unknown(no-result)` |
| 尚未檢查 | `unknown(pending)` |

- 子程序輸出的結果行前面是 `@@bat-voice-probe@@`（`VOICE_PROBE_MARKER`），其他輸出忽略；有結果行時以結果為準（addon 回報後才當掉也算數）。
- Linux 的載入器只報第一個缺的庫，所以子程序在載入失敗時另以 `process.dlopen` 逐一試 `LINUX_PROBE_LIBRARIES`（`libgomp.so.1`、`libvulkan.so.1`）：能載入的會丟「did not self-register」（不算），只有 `cannot open shared object file` 才列進缺少清單。glibc 太舊時也會列出缺的庫（兩個提示都顯示）。
- `detail` = 錯誤原文去掉多餘空白、家目錄換成 `~`、截到 `VOICE_DETAIL_MAX_CHARS` = 300 字。

## UI 行為

| 狀態 | 麥克風按鈕 | 開始錄音（按鈕 / Alt+M） | Settings › 語音輸入 › 可用性 |
|---|---|---|---|
| `available` | 與 T0802 前相同 | 與 T0802 前相同 | ✅ 可以使用 |
| `unknown(pending)` | 與 T0802 前相同 | 與 T0802 前相同 | 尚未檢查（BAT 啟動幾秒後自動檢查） |
| `unknown(其他)` | 與 T0802 前相同 | 與 T0802 前相同 | ⚠ 未確認（原因）＋「語音輸入照常可用…」 |
| `unavailable` | 停用（灰，既有 `:disabled` 樣式），滑過顯示原因＋建議動作 | 不開始錄音，`error` 顯示同一段文字（PromptBox 的提示列 `⚠ …`） | ❌ 無法使用＋原因＋建議動作 |

- 建議動作：Linux 缺已知的庫 → `sudo apt install libgomp1 libvulkan1`（只列實際缺的；註明是 Debian / Ubuntu 指令、其他發行版套件名可能不同）；Linux 缺未知的庫或 macOS → 「請安裝提供 <庫名> 的套件」；glibc 太舊 → 「需要 glibc 2.38 以上的系統（例 Ubuntu 24.04）」；其他 → 錯誤原文摘要。裝好後可在 Settings 按「重新檢查」或重開 BAT。
- 錄音已經在進行時（`recording` / `transcribing`）不打斷，按鈕照舊。
- `unavailable` 優先於「請先下載模型」（模型未下載的既有提示與行為在 `available` / `unknown` 時不變）。
- 開始錄音的入口：`MicButton`（`PromptBox`、`MainPanel`、`ClaudeAgentPanel`、`CodexAgentPanel`）與 `PromptBox` 的 Alt+M，全部經 `useVoiceRecording` 的 `start()`（`toggle()` 也是），所以擋在 `start()` 一處。
- 新字串在 `src/locales/{en,zh-TW,zh-CN}.json` 的 `voiceAvailability.*`；既有語音字串（硬寫中文）不動。

## 日誌

- 主行程每次檢查一行（`electron/logger.ts`）：
  - `[voice] availability: available in 40 ms (probe)`
  - `[voice] availability: unavailable(glibc-too-old) in 812 ms glibc>=2.38: <detail>`
  - `[voice] availability: unavailable(missing-library) in 55 ms libraries=libgomp.so.1,libvulkan.so.1: <detail>`
  - `[voice] availability: unknown(timeout) in 15003 ms`
- 正式載入改寫狀態：`[voice] availability: available (real load succeeded; the check said unavailable(<code>))`；之後檢查又說不可用：`[voice] availability: kept available (the real load already succeeded)`。
- 🔴 不記 env、不記權杖；`detail` 的家目錄換成 `~`。正式載入的既有日誌（`[voice] whisper addon loaded: …` / `[voice] whisper addon unavailable, voice input disabled: …` / `[voice] transcribe rejected: …`）不變。
- renderer：擋下錄音時 `[voice] useVoiceRecording: not started, voice input unavailable (<code>)`（`debug.log`）。

## 遠端 / detached 視窗（T0802 查證）

- `voice:*` 全部以 `ipcMain.handle` 註冊在本機主行程（`electron/voice-handler.ts`），不在 `PROXIED_CHANNELS`（`electron/remote/protocol.ts`），headless bat-server（`electron/remote/headless-*.ts`）沒有語音 handler。
- 所以 remote profile 視窗（WSL / SSH / Docker）與 detached 視窗的錄音（renderer `getUserMedia`）與辨識（本機主行程的 whisper）都在**本機**執行，辨識完的文字才送進（遠端）分頁。可用性只有一份，就是本機主行程的檢查結果 = 實際執行辨識的那一端；不需要改 headless server。
- 推送經 `getAllWindows()`：`windowMap`（`createWindow` 建立的主視窗與 remote profile 視窗）＋ `detachedWindows`。每個視窗的 renderer 第一次讀取時自己 `getAvailability()` 補拿，晚開的視窗也拿得到目前狀態。

## 已知限制

- Linux 只對 `LINUX_PROBE_LIBRARIES` 兩個庫逐一試；其他缺的庫一次只會看到第一個（載入器的限制），裝好後「重新檢查」才看到下一個。
- Windows 的載入錯誤不含 DLL 名稱，一律 `load-failed`、只顯示原文摘要。
- macOS 未實機驗證（desktop-build 綠燈＋單元測試覆蓋）；`ELECTRON_RUN_AS_NODE` 依賴 Electron 的 RunAsNode fuse（本專案沒有關閉，`claude-agent-manager.ts` 的 Electron fallback 也依賴它）。若日後關閉該 fuse，子程序會變成完整 app 啟動：結果會是 `unknown`（逾時被殺），行為退回 T0802 前，但要記得同步改這裡。
- 檢查只驗 `require` ＋匯出 `whisper()`，不實際轉錄；模型未下載、GPU 後端初始化失敗等仍由正式辨識回報。
- 子程序與主行程用同一個 Electron 執行檔，啟動時多一個短命程序。實測耗時：本機 Windows（原始碼 build）40–170 ms；GitHub runner 的 AppImage（FUSE 掛載、冷啟動）24.04 4489 ms、22.04 8808 ms（linux-acceptance run `41587066026`）。逾時 15 s 的餘裕約 1.7 倍；更慢的機器會得到 `unknown(timeout)`，行為退回 T0802 前（不會誤停用），需要時再調 `VOICE_AVAILABILITY_TIMEOUT_MS`。

## 實測（T0802）

| 環境 | 結果 | 麥克風按鈕 | 證據 |
|---|---|---|---|
| 本機 Windows 11（原始碼 build，隔離 runtime） | `available(probe)`，`registered` 後 5.05 s 檢查、40 ms | 首次啟動沒有分頁，未顯示 | debug log `[voice] availability: available in 40 ms (probe)` |
| GitHub ubuntu-24.04（glibc 2.39，desktop-build `41586110095` 的 AppImage） | `available(probe)` | 可按，`title` = `語音輸入 (Alt+M)` | linux-acceptance `41587066026` V1 PASS |
| GitHub ubuntu-22.04（glibc 2.35） | `unavailable(glibc-too-old)`，`requiredGlibc` 2.38 | 停用，`data-voice-unavailable=glibc-too-old`，`title` 三行（無法使用／glibc 太舊／需要 glibc 2.38 以上的系統） | 同上 V1 PASS |

## 驗證清單

- 單元測試：`src/lib/__tests__/voice-availability.test.ts`（原因代碼、結果解析、三態、log 行、提示文字、三語系 key 一致）、`electron/__tests__/voice-availability.test.ts`（注入假 `execFile`：成功 / 逾時 / 當掉 / exit ≠ 0 / 無法啟動 / 同步丟例外 / 沒有結果 / 結果後當掉、env 過濾、參數、排程一次、去重、正式載入優先、IPC 推送）、`src/components/voice/__tests__/voice-availability-ui.test.tsx`（按鈕在 `available` / `unknown` 與 T0802 前 DOM 相同、`unavailable` 停用與提示、錄音中不打斷、`start()` / `toggle()` 擋下、Settings 狀態與重新檢查）、`electron/__tests__/voice-handler-whisper-fail-soft.test.ts`（註冊、正式載入成功改 `available`）、`electron/__tests__/linux-acceptance-v1.test.ts`（V1 判讀）。
- `scripts/__tests__/asar-runtime-deps.test.mjs`：`VOICE_PROBE_SCRIPT` 的 `require(target)` / `process.dlopen` 登記在 `DYNAMIC_REQUIRE_SITES`（載入的是已打包的 `@kutalia/whisper-node-addon`）。
- linux-acceptance V1（見 [linux-ci-acceptance.md](linux-ci-acceptance.md)）：22.04 應為 `unavailable(glibc-too-old)`、24.04 應為 `available`。
- 本機：隔離 runtime 啟動後 `getAvailability()` 與 debug log 的 `[voice] availability:` 行。
