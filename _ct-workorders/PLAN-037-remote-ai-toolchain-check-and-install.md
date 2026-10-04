---
schema_version: 1
schema_kind: plan
id: PLAN-037
title: 遠端（WSL / SSH / Docker）AI 工具套件檢查與一鍵安裝（claude / codex CLI、git、gh 等）
status: IN_PROGRESS
priority: medium
created_at: "2026-10-05T02:28:57+08:00"
updated_at: "2026-10-05T02:28:57+08:00"
links:
  research_workorder: T0407
  related: [PLAN-036, PLAN-035, D131]
---

# PLAN-037 — 遠端 AI 工具套件檢查與一鍵安裝

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-037 |
| 優先級 | 🟡 Medium |
| 狀態 | 🔄 IN_PROGRESS（T0407 研究 DONE `79c6f32`；Phase 1 T0408 ∥ T0409 02:52 派發） |
| 建立時間 | 2026-10-05 02:28 (UTC+8) |
| 決策 | D133（拆單與波次）；D131（範圍 B：檢查＋一鍵安裝；入口：精靈步驟＋設定頁；與 PLAN-036 平行，實作在 T0405 前完成） |

## 背景與動機

PLAN-036 讓遠端 headless server 有了終端與（進行中的）Agent / git / fs 功能，但遠端機器上**有沒有可用的工具**沒有任何機制處理：

- claude CLI：server bundle 內嵌一份給 Agent 面板用；遠端**終端**內的 `claude` 走系統 PATH，WSL 實測沒有裝、也沒登入（T0386 §4）
- codex CLI：server bundle 不含（T0401 先在遠端隱藏 codex 功能）
- git / gh：PLAN-036 T0405（git / github 上遠端）直接依賴遠端是否安裝

## 使用者裁決（2026-10-05 02:28）

- **範圍 B**：偵測各工具是否安裝、版本、登入狀態；缺的工具以按鈕在**遠端終端分頁**打入官方安裝指令（需 sudo 者使用者在分頁內輸入密碼；不需 sudo 者裝到 `~/.local/bin`）。不打包進 server bundle（C 案否決：安裝檔變大、D094 已超標、版本綁死重演 BUG-083 / 084）
- **入口**：WSL / SSH 精靈最後一步「工具檢查」＋遠端 profile 設定頁可隨時重跑
- **排程**：與 PLAN-036 平行；實作在 T0405 前完成

## 階段

1. **Phase 0**：研究 T0407 —— 工具清單、各平台官方安裝方式與校驗、偵測方式、與 PLAN-035 精靈分工、拆單
2. **Phase 1+**：依 T0407 拆單

## 研究結論摘要（T0407，使用者 Q1-Q3 裁決）

- 偵測：server 端共用模組 `electron/handlers/remote-tools.ts` + proxied `remote-tools:detect`；本機視窗以 `remote:detect-tools(profileId)` 短連線
- 安裝：確認框（完整指令 / 來源 / sudo / 位置 / 完整性）→ 在**遠端 profile 視窗**終端分頁自動執行，尾端完成標記 → 自動重新偵測
- 來源：使用者空間優先（claude / codex / uv 官方 install.sh → `~/.local/bin`）；git / gh / rg 走套件管理器（gh 官方簽章 repo）
- WSL 重點：interop 讓 `/mnt/c` 的 Windows 版工具遮蔽，偵測須歸 `interop-only`；`~/.local/bin` 首次安裝後舊分頁看不到；server（systemd）PATH 不含 `~/.local/bin`
- 登入由 T0402 的引導共用，不另做

## 拆單（D133，使用者 02:51 裁決「照研究建議」）

| 工單 | 代號 | 內容 | 前置 | 狀態 |
|---|---|---|---|---|
| T0408 | A | 偵測核心：probe 腳本 + parse + `RemoteToolsReport` 型別 | T0407 | ✅ DONE（`ab30fff` / `6d7daab`，03:10 複驗 1442 tests / vite / tsc 40；WSL 唯讀實測與 T0407 §0 一致） |
| T0409 | C | 安裝食譜 + 完成標記 + host 白名單 | T0407 | ✅ DONE（`ce27a82`，03:04 複驗 38/38；剩餘風險列入 T0414：`curl \| sh` 管線 `$?`、gh rpm GPG 自動匯入、RHEL rg 需 EPEL） |
| T0410 | D | `RemoteToolsPanel` + `InstallConfirmDialog` + i18n | T0408、T0409 | ✅ DONE（`8a17984`，03:22 與 T0411 聯合複驗 PASS） |
| T0411 | B | headless / main 接線：`remote-tools:detect` + `remote:detect-tools` + smoke S10（🔒 main / protocol / headless-entry） | T0408 | ✅ DONE（`49b1ca5`，03:22 聯合複驗：1514 tests / vite / e2e 0 failed / tsc 40；preload `remoteTools.detect(profileId)` / `detectHere()`；WSL 部署 + S10 待辦） |
| T0412 | E | 跨視窗安裝執行（pending install 佇列、遠端視窗建分頁 + 標記掃描）（🔒 main） | T0409-T0411 | 🔄 03:24 派發（與 T0413 平行） |
| T0413 | F | 入口：精靈完成區塊 + `ProfileCard.expandedExtras` | T0410 | ✅ DONE（`11d02f1`，03:31 塔台目標測試複驗 297/297；全套 + vite build 待 T0412 後聯合複驗） |
| T0414 | G | 實機驗收（首次允許實際安裝） | T0411-T0413 | 保留編號 |

之後才是 PLAN-036 T0405（git 上遠端）→ T0406（fs）。
- T0410 注意（T0409 備註）：install.sh 類食譜假設遠端有 `curl`；偵測到 `curl` missing 時停用 claude / codex / uv 安裝鈕並提示。i18n key 以 `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS` / `UNSUPPORTED_REASONS`（→ `remoteTools.unsupported.<reason>`）為準
- T0412 注意：安裝分頁 shell 需 POSIX 系（gh apt 食譜用 `$(mktemp)`）
- 波次調整（塔台 03:10）：T0410 與 T0411 檔案完全不重疊（UI vs electron 接線），改為平行；T0410 不跑 vite build 避免與 T0411 互相覆寫輸出
- T0408 備註：從 Windows 經 `wsl.exe` 跑多行 probe 必須用 `--exec`（`--` 會經預設 shell 重新解析而吃掉參數）
- T0410 UX 小注：確認框的確認鈕與列上「安裝」同文案，T0414 實機時評估是否改「確認安裝」
- WSL server 03:23 重新部署 HEAD `e7b346e`（T0411；備份 tag `t0411`），smoke **10/10 PASS**：S10 `ubuntu 24.04 pkg=apt priv=passwordless wsl=true`、git / curl / bash / python3 ok，claude / gh / codex / rg / uv / node missing。註：server 端 probe 的 codex 為 `missing`（不是 interop-only）——systemd 服務環境沒有 WSL interop 附加的 `/mnt/*` PATH，與 BAT 遠端終端（同由 server spawn）的實際可見性一致
- T0412 / T0413 API 契約（塔台 03:23 定）：`remoteTools.requestInstall({ profileId, toolId, kind })`，只帶 toolId + kind，遠端視窗自行重建指令
- T0413 範圍偏離（使用者 03:31 接受）：設定精靈完成後**不再自動關閉**（原本一完成就 `close()`，完成畫面從未被看見），停在完成畫面顯示工具面板，由使用者按 × / 遮罩關閉
- 待補 locale（塔台於 T0412 完成後補，含 `i18n-completeness` 預期集合）：`remoteTools.installRequestFailed`——zh-TW「無法在遠端視窗啟動安裝。」、zh-CN「无法在远端窗口启动安装。」、en「Could not start the install in the remote window.」
