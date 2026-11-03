---
schema_version: 1
schema_kind: workorder
id: T0802
title: "語音輸入事先檢查 whisper 能否載入（所有平台、短命子程序），不可用時停用麥克風並提示原因與安裝指令"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T13:30:03+0800"
started_at: "2026-11-03T13:32:11+0800"
updated_at: "2026-11-03T14:06:50+0800"
completed_at: "2026-11-03T14:06:50+0800"
session_ids:
  - "b80cde4d-e50a-4581-8416-932cb43ab953"
depends_on: []
related:
  - "D247；T0800 回報區〈降級行為（只記錄，未改）〉〈後續建議〉第 3、4 點；BUG-204（CLOSED，RUNPATH `$ORIGIN`）；BUG-203（WONTFIX，22.04 `GLIBC_2.38`，D246）；BUG-116（whisper fail-soft）"
  - "現況：載入 `electron/whisper-addon-loader.ts`（第一次辨識才載入，fail-soft）；失敗 log `[voice] whisper addon unavailable, voice input disabled: …`、`[voice] transcribe rejected: …`（`electron/voice-handler.ts`）；renderer `src/hooks/useVoiceRecording.ts` 錄音停止後顯示 `辨識失敗: Voice recognition module (whisper) is unavailable: …`；麥克風按鈕不會事先停用"
affects_files:
  - electron/whisper-addon-loader.ts
  - electron/voice-handler.ts
  - electron/voice-availability*.ts
  - electron/preload.ts
  - electron/main.ts
  - electron/__tests__/**
  - src/hooks/useVoiceRecording.ts
  - src/components/**
  - src/lib/voice-availability*.ts
  - src/lib/__tests__/**
  - src/types/**
  - src/locales/**
  - src/__tests__/**
  - e2e/linux/**
  - .github/workflows/linux-acceptance.yml
  - docs/agent-guide/voice-availability.md
  - docs/agent-guide/linux-ci-acceptance.md
  - docs/agent-guide/README.md
  - README.md
  - CLAUDE.md
  - _ct-workorders/T0802-voice-availability-precheck.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 檢查方式（D247）：所有平台（Windows / macOS / Linux）在啟動後背景做一次，以**短命子程序**試載 whisper addon（例 `process.execPath` ＋ `ELECTRON_RUN_AS_NODE=1` 跑一段只 `require` addon、回報結果就結束的腳本；或其他不在主行程載入 addon 的做法），🔴 不得在主行程提早載入 whisper（不改變未使用語音者的記憶體與啟動成本）、不拖慢啟動（延後到啟動完成後，例如 app ready ＋ 數秒或 idle）。子程序一律 `execFile` / `spawn` ＋陣列參數＋ timeout（CLAUDE.md「Child Process Spawning」），🔴 子程序的 env 不得含 `BAT_REMOTE_TOKEN` 等權杖、不加 `LD_LIBRARY_PATH`。addon 路徑解析與正式載入共用同一個函式（不另寫一份規則）。每次 BAT 啟動檢查一次、結果只存在記憶體；可另提供 Settings 的「重新檢查」（選做）。"
  - "🔴 結果分三態：`available` / `unavailable`（帶原因代碼與錯誤原文的截短版，例 `missing-library`（附庫名，例 `libgomp.so.1`、`libvulkan.so.1`）、`glibc-too-old`（附需要的版本）、`load-failed`（其他））/ `unknown`（還沒檢查、子程序逾時 / 當掉 / 無法啟動）。🔴 `unknown` 一律維持現行行為（按鈕可按，正式載入失敗時照舊 fail-soft 顯示錯誤），不得把檢查本身的失敗當成語音不可用。正式載入（第一次辨識）的行為、log 與錯誤訊息不變；若正式載入成功而檢查曾說不可用，以正式結果為準並更新狀態。"
  - "🔴 UI（D247，使用者選定）：`unavailable` 時麥克風按鈕停用（灰）、滑過顯示原因與建議動作：Linux 缺庫 → `sudo apt install libgomp1 libvulkan1`（依實際缺的庫列出；指令以 Debian / Ubuntu 為例並說明其他發行版套件名可能不同）；glibc 太舊 → 需 glibc 2.38 以上（例 Ubuntu 24.04）；其他 → 錯誤原文摘要。快捷鍵（Alt+M 等既有語音快捷鍵）在 `unavailable` 時不開始錄音、改顯示同樣的原因（toast 或既有提示方式）。Settings 的語音區顯示可用性與原因。所有新字串走 i18n（`src/locales/**`，至少 zh-TW / en，與既有語言檔一致）。模型未下載等既有狀態的行為不變；`available` 與 `unknown` 時畫面與 T0802 前完全相同。找出所有會開始錄音的入口，逐一套用。"
  - "🔴 遠端 / detached 視窗：查清楚語音辨識在遠端 profile 視窗與 detached 視窗實際在哪個行程執行，可用性要反映實際執行辨識的那一端；查證結果寫進回報區。若遠端行為與本機不同而超出本單（例需改 headless server），記錄後依 ct-exec § Questions For Tower 問塔台，不自行擴大。"
  - "🔴 Linux 驗收（比照 D245 授權）：可 push 分支 `ct/T0802`（不 push `main`），`gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal --ref ct/T0802 -f ref=ct/T0802`（參數以 workflow 實際 inputs 為準）取得安裝檔，再 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0802 -f build_run_id=<desktop-build run id>`；desktop-build 最多 3 次、linux-acceptance 最多 5 次，都不發布。linux-acceptance 加一項（或擴充 W1）：22.04 檢查結果應為 `unavailable` / `glibc-too-old`、24.04 應為 `available`，以 Playwright 看麥克風按鈕停用狀態或以 debug log 判讀（擇可靠者，理由寫進回報與 docs）；22.04 / 24.04 既有 L1 / L2 / W1 結果須與 T0800 一致（22.04 PASS、24.04 只因 BUG-202 降級而 WARN）。完成後刪遠端分支，本機分支交塔台。`gh` 一律帶 `-R`（L122）。Windows / macOS 由 desktop-build 綠燈＋單元測試覆蓋（本機 Windows 可用 `npm run dev` 或打包目錄實測檢查結果為 `available`，若做就附 log）。"
  - "🔴 日誌：檢查結果記一行 debug log（例 `[voice] availability: available|unavailable(<code>)|unknown(<reason>) in <ms> ms`），🔴 不記完整路徑中的家目錄（或沿用既有 log 慣例）、不記 env。"
  - "🔴 回歸與驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 綠、`npm run test:legacy` 綠、`npx vite build`；判斷邏輯（錯誤原文 → 原因代碼、三態 → 按鈕狀態 / 提示）抽成純函式並有單元測試；子程序檢查以注入的假 spawn 測逾時 / 當掉 / 成功 / 各種失敗。新增 Dialog（若有）遵守 CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」。新增 IPC 時 trace 所有 consumer；若新增執行期依賴或改 `build.files`，依 CLAUDE.md「Packaging / Release 前置檢查」同步白名單與檢查（子程序腳本若是獨立檔案，確認打包後找得到）。"
  - "🔴 文件：新增 `docs/agent-guide/voice-availability.md`（檢查方式、三態、原因代碼、UI 行為、日誌、遠端行為、已知限制、驗證清單）並登記到 `docs/agent-guide/README.md`；`docs/agent-guide/linux-ci-acceptance.md` 更新驗收項目判讀；README「語音輸入 › Linux」補一句「無法使用時麥克風按鈕會停用並顯示原因」（系統相依與 22.04 限制已在，不重寫）；CLAUDE.md 新增一節 3–12 行（用途、必守規則、唯一實作位置、docs 連結），依 CLAUDE.md 撰寫規則（T0595）。不改 CHANGELOG / release-note。"
  - "🔴 不打包 `libgomp` 或 `libvulkan` 進 AppImage（D247）、不改 whisper 打包 / RUNPATH（T0800）、不改辨識本身與模型下載。不發版、不 push `main`。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。另一張工單 T0801 同時在 main repo 執行（只動 `e2e/manual/**` 與 `docs/agent-guide/packaging-release-checks.md`），不要碰它的檔案。"
---

# T0802 — 語音輸入事先檢查可用性，不可用時停用麥克風並提示原因

## 元資料

- **工單編號**：T0802
- **類型**：implementation（語音輸入 UX / 原生模組可用性）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T13:30:03+0800
- **預估規模**：M

## 背景

whisper addon 只在第一次語音辨識時載入，失敗時 fail-soft（BUG-116）。T0800 實測：Linux 缺系統的 `libgomp1` / `libvulkan1`，或 Ubuntu 22.04 的 glibc 2.35 太舊（BUG-203），語音輸入都會載入失敗。目前麥克風按鈕照常可按，使用者錄完音才看到「辨識失敗」。D247：所有平台在啟動後以短命子程序事先檢查，已知不可用時停用麥克風並顯示原因與安裝指令；系統相依只寫文件與提示，不打包進 AppImage。

## 範圍

1. 背景可用性檢查（子程序、三態、原因代碼），不在主行程提早載入 whisper。
2. UI：按鈕停用＋原因提示、快捷鍵、Settings 語音區顯示可用性；i18n。
3. 查證遠端 / detached 視窗的語音執行位置，可用性反映實際執行端。
4. linux-acceptance 驗證 22.04（`glibc-too-old`）/ 24.04（`available`）；`ct/T0802` 分支跑 desktop-build → linux-acceptance。
5. 測試、docs（新檔＋索引＋linux-ci-acceptance）、README 一句、CLAUDE.md 一節。

## 不做

- 不打包系統函式庫、不改 whisper 打包 / RUNPATH、不改辨識與模型下載、不發版、不 push `main`。

## 驗收

- [x] 檢查在子程序執行、啟動後延後、結果三態；`unknown` 維持現行行為
- [x] `unavailable` 時按鈕停用、滑過顯示原因與安裝指令；快捷鍵不開始錄音並顯示原因；Settings 顯示可用性
- [x] `available` / `unknown` 時畫面與行為和改動前相同
- [x] 遠端 / detached 視窗行為查證並記錄
- [x] desktop-build 三平台綠；linux-acceptance：22.04 `glibc-too-old`、24.04 `available`，既有 L1 / L2 / W1 與 T0800 一致
- [x] typecheck 0 / 0、unit / legacy 綠、vite build；純函式與子程序檢查有單元測試
- [x] docs、README、CLAUDE.md

---

## 回報區

### 完成狀態

- **狀態**：DONE（驗收 7 項全部完成）
- **開始**：2026-11-03T13:32:11+0800　**完成**：2026-11-03T14:06:50+0800
- **session_id**：b80cde4d-e50a-4581-8416-932cb43ab953

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設，非 worktree）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：抽查 `electron/whisper-addon-loader.ts`、`electron/voice-handler.ts`、`electron/preload.ts`、`electron/main.ts`、`src/hooks/useVoiceRecording.ts` 皆存在 → PASS
- C-2：工單沒有 `branch` 欄位，不比對（目前 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 結果摘要

- **檢查方式**：`app.whenReady` 中 `registerVoiceHandlers` 之後呼叫 `startVoiceAvailabilityCheck()`，5 s 後（`unref` 計時器）以 `execFile(process.execPath, ['-e', VOICE_PROBE_SCRIPT, <addonPath>, …Linux 庫名], { env, timeout: 15 s, windowsHide })` 跑短命子程序（`ELECTRON_RUN_AS_NODE=1`）；子程序只 `require` addon，失敗時在 Linux 另以 `process.dlopen` 逐一試 `libgomp.so.1` / `libvulkan.so.1`（載入器只報第一個缺的庫），印一行 `@@bat-voice-probe@@{json}` 後 `process.exit(0)`。主行程不載入 whisper。addon 路徑由新抽出的 `locateWhisperAddon`（正式載入 `createWhisperAddonLoader` 也改用它，錯誤訊息逐字不變）決定。
- **子程序 env**（`buildVoiceProbeEnv`）：去掉 `BAT_*` / `CT_*` / `ELECTRON_*` / `NODE_OPTIONS` / 名稱含 `TOKEN|SECRET|PASSW|CREDENTIAL|API_KEY|PRIVATE_KEY|AUTH` 的變數，只加 `ELECTRON_RUN_AS_NODE=1`；不加 `LD_LIBRARY_PATH`（原有的照樣繼承，與正式載入看到的相同）。
- **三態**：`available(probe|load)` / `unavailable(missing-library | glibc-too-old | load-failed)`（附 `libraries`、`requiredGlibc`、`detail`：截到 300 字、家目錄換 `~`）/ `unknown(pending | timeout | crashed | spawn-failed | no-result)`。`unknown` 不擋任何東西；正式載入成功 → `noteRealLoadSucceeded()` 改 `available(load)`，之後檢查說不可用也維持（正式結果為準）；正式載入失敗不改狀態。
- **UI**：`MicButton`（四個使用處：PromptBox、MainPanel、Claude / Codex 面板）在 `unavailable` 且沒有錄音進行時停用，`title` = 原因＋建議動作（Linux 已知庫 → `sudo apt install libgomp1 libvulkan1`，只列實際缺的，註明 Debian / Ubuntu；glibc → 需要 glibc 2.38 以上（例 Ubuntu 24.04）；其他 → 錯誤摘要），另加 `data-voice-unavailable=<code>`。所有開始錄音的入口（按鈕、PromptBox 的 Alt+M）都經 `useVoiceRecording.start()`（`toggle()` 也是），在 `start()` 開頭擋下並把同一段文字放進 `error`（PromptBox 提示列顯示）。Settings › 語音輸入最上方新增「可用性」列＋「重新檢查」（`VoiceAvailabilityStatus.tsx`，IPC `voice:recheckAvailability`，選做項目已做）。新字串 `voiceAvailability.*`（en / zh-TW / zh-CN）。`available` / `unknown` 時按鈕 DOM 與 T0802 前逐字相同（單元測試比對 `outerHTML`）。
- **日誌**：`[voice] availability: available in 40 ms (probe)` / `unavailable(<code>) in <ms> ms [libraries=…] [glibc>=…]: <detail>` / `unknown(<reason>) in <ms> ms`；不記 env、不記權杖。
- 沒有新增 Dialog；沒有新增執行期依賴、沒有改 `build.files`。

### 遠端 / detached 視窗查證

- `voice:*` 全部以 `ipcMain.handle` 註冊在本機主行程（`electron/voice-handler.ts`）；不在 `PROXIED_CHANNELS`（`electron/remote/protocol.ts`），headless bat-server（`electron/remote/headless-*.ts`）沒有語音 handler。
- ⇒ remote profile 視窗（WSL / SSH / Docker）與 detached 視窗的錄音（renderer `getUserMedia`）與辨識（本機主行程 whisper）都在**本機**；辨識後的文字才送進分頁。可用性只有本機一份 = 實際執行辨識的那一端，不需改 headless server，沒有範圍外問題要問塔台。
- 推送 `voice:availabilityChanged` 經 `getAllWindows()` = `windowMap`（所有主視窗與 remote profile 視窗都由 `createWindow` 建立）＋ `detachedWindows`；每個 renderer 第一次讀取時另以 `getAvailability()` 補拿目前狀態。

### 變更檔案

- 新增：`electron/voice-availability.ts`、`src/lib/voice-availability.ts`、`src/lib/voice-availability-store.ts`、`src/components/voice/VoiceAvailabilityStatus.tsx`、`docs/agent-guide/voice-availability.md`；測試 `src/lib/__tests__/voice-availability.test.ts`、`electron/__tests__/voice-availability.test.ts`、`src/components/voice/__tests__/voice-availability-ui.test.tsx`、`electron/__tests__/linux-acceptance-v1.test.ts`
- 修改：`electron/whisper-addon-loader.ts`（抽出 `locateWhisperAddon` / `locateDefaultWhisperAddon`）、`electron/voice-handler.ts`、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/types/voice-ipc.ts`、`src/hooks/useVoiceRecording.ts`、`src/components/voice/MicButton.tsx`、`src/components/voice/VoiceSettingsSection.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`、`electron/__tests__/voice-handler-whisper-fail-soft.test.ts`、`e2e/linux/linux-os.ts`、`e2e/linux/t0797-linux-appimage-launch.spec.ts`、`docs/agent-guide/README.md`、`docs/agent-guide/linux-ci-acceptance.md`、`README.md`、`CLAUDE.md`（新節「語音輸入可用性事先檢查（T0802，D247）」，CLAUDE.md 66,749 字元）
- `affects_files` 以外：`scripts/__tests__/asar-runtime-deps.test.mjs`（見〈偏離〉第 1 點）
- `.github/workflows/linux-acceptance.yml` 不需改（V1 在既有 Playwright 步驟內）

### 驗證

| 證據道 | 結果 | 證據 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0（最終狀態 `67fd975a` 重跑） |
| 單元測試 | PASS | `npm run test:unit`：394 檔、6899 passed / 24 skipped / 0 failed（新增 4 檔；第一次跑 2 檔失敗，修正見〈遭遇問題〉後全綠） |
| legacy | PASS | `npm run test:legacy`：33 檔 / 472 tests，0 failed |
| build | PASS | `npx vite build` 成功 |
| 本機 runtime（Windows 11） | PASS | ① 開發用 Electron 以 `ELECTRON_RUN_AS_NODE` 子程序實載 `whisper.node`：`available in 167 ms`；壞路徑 → `unavailable(load-failed)`。② 原始碼 build 以隔離 runtime（`--runtime=e2e-t0802-local-*`）啟動：`[voice] IPC handlers registered` 05:47:41.365Z → `[voice] availability: available in 40 ms (probe)` 05:47:46.413Z（延後 5.05 s），renderer `getAvailability()` = `{"state":"available","source":"probe"}`；首次啟動沒有分頁所以畫面上沒有麥克風按鈕；隔離 userData 已清除 |
| desktop-build | PASS | run `41586110095`（`ct/T0802` @ `db414abe`）：prepare / typecheck / tests / win / mac / linux 全 success（1 / 3 次） |
| linux-acceptance | PASS | run `41587066026`（`build_run_id=41586110095`，1 / 5 次）：22.04 verdict **PASS**（L1 PASS、L2 PASS、W1 INFO、**V1 PASS** `unavailable(glibc-too-old)`、按鈕 disabled、`data-voice-unavailable=glibc-too-old`、title 三行原因、檢查 8808 ms）；24.04 verdict **WARN**（`L1: sandbox auto-disabled (BUG-202 fallback)`，L2 PASS、W1 PASS、**V1 PASS** `available(probe)`、按鈕可按、檢查 4489 ms）。L1 / L2 / W1 與 T0800（`41575592616`）一致 |
| macOS | 未實機 | desktop-build mac 綠燈＋單元測試覆蓋（工單允許） |

- V1 判讀選 IPC（`electronAPI.voice.getAvailability()`）為主、麥克風按鈕一致性與 debug log 為佐證：按鈕是否在畫面上取決於分頁類型與版面（例 Claude CLI 分頁不顯示），IPC 每次都讀得到且就是按鈕的資料來源；理由同時寫在 `docs/agent-guide/linux-ci-acceptance.md` V1 列。

### Commit

- `3a168bc4` feat(voice): check whisper availability before recording (T0802)
- `0a72c340` test(voice): neutral fake values in the probe env test (T0802)
- `953d5f48` docs: voice availability pre-check (T0802)
- `67fd975a` docs: T0802 linux-acceptance V1 results and probe timings
- 皆在本機 `main`，未 push `main`。
- CI 分支：本機 `ct/T0802` = `db414abe`，以 `origin/main` 為 parent、內容 = `3a168bc4` + `0a72c340` 的 T0802 檔案（以暫存 index ＋ `commit-tree` 建立，沒有切換分支；因 main 的工作樹與 T0801 共用、且 `main` 領先 origin 8 個 commit 含 T0801 未推的內容，避免把別張單推上遠端）。已 push 並在 CI 後**刪除遠端分支**（`git ls-remote` 確認 0 筆）；本機分支交塔台。docs commit 不在該分支（不影響 CI）。
- push 前依 `.private/` 檢查樣式與金鑰樣式掃 `origin/main..ct/T0802`：第一次命中測試假值 `ghp_x` / `sk-ant-x`（非真金鑰），改為 `fake-token` / `fake-key` / `fake-cap`（`0a72c340`）後 0 筆。

### 偏離與範圍外

1. **`scripts/__tests__/asar-runtime-deps.test.mjs`（不在 `affects_files`）**：該守門掃 `electron/` 的非字面 `require` / `process.dlopen`，`VOICE_PROBE_SCRIPT` 字串命中而使 `test:unit` 失敗。CLAUDE.md「Packaging / Release 前置檢查」規定非字串字面的 require 須登記在 `DYNAMIC_REQUIRE_SITES`，工單 memory_overrides 也要求「依 CLAUDE.md『Packaging / Release 前置檢查』同步白名單與檢查」，所以加一列 `'electron/voice-availability.ts': ['@kutalia/whisper-node-addon']`（載入的是已打包、已登記的同一個套件）。只加這一列；若塔台認為須另開單，可單獨 revert 該檔的這一列，但 `test:unit` 會因此失敗。
2. **README「語音輸入 › Linux」**：除了補一句（麥克風停用並顯示原因、Settings 重新檢查），另刪掉既有限制句中已不正確的「錄音結束後會顯示『辨識失敗』，」（T0802 後 22.04 會直接停用按鈕）；系統相依與 22.04 限制的內容沒有重寫。
3. 工單 frontmatter 原本 `status: TODO`（ct-exec 預期 `PENDING`），照常改 `IN_PROGRESS` → `DONE`。

### 遭遇問題

- 第一次 `npm run test:unit`：① `electron/__tests__/voice-opencc-lazy-require.test.ts` 的 `vi.mock('../whisper-addon-loader')` 沒有新匯出，`getVoiceAvailability()` 建立時存取 `locateDefaultWhisperAddon` 即丟例外 → 改成延遲引用 `locateAddon: () => locateDefaultWhisperAddon()`（只在實際檢查時才存取；正式行為不變）；② 上述 asar 守門（〈偏離〉第 1 點）。兩者修正後全綠。
- 本機 Playwright 腳本第一次因頁面導覽（`Execution context was destroyed`）中斷，留下一個隔離 userData `BetterAgentTerminal-runtime-e2e-t0802-local-*`（沒有殘留程序），已刪除；第二次改為輪詢時吞掉導覽錯誤後成功。

### 後續建議

- 逾時 15 s 在 GitHub runner 的 22.04 AppImage 實測 8.8 s（FUSE 冷讀），餘裕約 1.7 倍；更慢的機器會得到 `unknown(timeout)`（退回 T0802 前行為、不誤停用）。若日後在實機看到 `unknown(timeout)`，可考慮把 `VOICE_AVAILABILITY_TIMEOUT_MS` 提到 30 s（子程序在背景，代價低）。
- macOS 未實機驗證；若之後關閉 Electron 的 RunAsNode fuse，子程序會變成完整 app 啟動（逾時被殺 → `unknown`），需同步改此功能（已寫入 docs 已知限制）。

### 互動紀錄

- [13:32] 開工：yolo、`CT_INTERACTIVE=0`。
- [13:47] 本機隔離 runtime 實測 `available`。
- [13:49] push `ct/T0802`、desktop-build `41586110095`。
- [13:59] linux-acceptance `41587066026`。
- 全程沒有向塔台提問（遠端 / detached 查證結果不需改 headless，沒有範圍外問題）。
