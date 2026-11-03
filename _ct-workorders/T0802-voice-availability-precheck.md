---
schema_version: 1
schema_kind: workorder
id: T0802
title: "語音輸入事先檢查 whisper 能否載入（所有平台、短命子程序），不可用時停用麥克風並提示原因與安裝指令"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T13:30:03+0800"
started_at: ""
updated_at: "2026-11-03T13:30:03+0800"
completed_at: ""
session_ids: []
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

- [ ] 檢查在子程序執行、啟動後延後、結果三態；`unknown` 維持現行行為
- [ ] `unavailable` 時按鈕停用、滑過顯示原因與安裝指令；快捷鍵不開始錄音並顯示原因；Settings 顯示可用性
- [ ] `available` / `unknown` 時畫面與行為和改動前相同
- [ ] 遠端 / detached 視窗行為查證並記錄
- [ ] desktop-build 三平台綠；linux-acceptance：22.04 `glibc-too-old`、24.04 `available`，既有 L1 / L2 / W1 與 T0800 一致
- [ ] typecheck 0 / 0、unit / legacy 綠、vite build；純函式與子程序檢查有單元測試
- [ ] docs、README、CLAUDE.md

---

## 回報區

（Worker 填寫）
