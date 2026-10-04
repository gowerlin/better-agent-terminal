---
schema_version: 1
schema_kind: plan
id: PLAN-035
title: WSL 環境全自動化（從未安裝 WSL 到可用的 BAT 伺服器，含環境不符時自動修正）
status: PLANNED
priority: high
created_at: "2026-10-04T22:04:14+08:00"
updated_at: "2026-10-04T22:04:14+08:00"
links:
  research_workorder: T0380
  related: [BUG-086, BUG-087, BUG-089, BUG-071, PLAN-031, PLAN-032]
---

# PLAN-035 — WSL 環境全自動化

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-035 |
| 優先級 | 🔴 High |
| 狀態 | 📋 PLANNED（研究先行：T0380） |
| 建立時間 | 2026-10-04 22:04 (UTC+8) |
| 決策 | D127 |

## 背景與動機

使用者要求（2026-10-04 第五十二 session）：**WSL 相關設定都應自動化**——允許從 Windows 未安裝 WSL 開始，自動安裝並設定成適用環境；或已安裝但環境不符時自動修正設定，**詢問允許後執行**。

觸發點：BUG-087 修復後實機驗收，精靈第 1-5 步通過，第 6 步出現 NAT 警告（BUG-089 誤判），且塔台檢查時 `Ubuntu-24.04` 已是 `Stopped`——服務裝好後若無 `wsl.exe` 連線，WSL 會閒置關閉發行版，bat-server 隨之停止（**假設，待 T0380 證實**）。

目前精靈只「偵測 → 失敗時給文字提示」，使用者需自行處理 WSL 安裝、發行版、systemd、網路模式、常駐等環境前提。

## 使用者裁決（D127）

| 題目 | 裁決 |
|------|------|
| 拆法 | PLAN + **研究先行**（T0380），研究完再拆實作單 |
| 同意模型 | **列清單一次同意**：精靈先偵測，列出所有將變更項目（可勾選），使用者確認後一次執行 |
| WSL 未安裝 | **全自動，含重開機後接續**：自動提權安裝 WSL / 發行版；需重開機時保存精靈進度，開機後回 BAT 從斷點繼續 |

## 範圍（自動化環節清單，細節由 T0380 定案）

| # | 環節 | 偵測 | 自動修正（需同意） | 影響面 |
|---|------|------|-------------------|--------|
| 1 | WSL 本體 | `wsl --status` / exit code（T0378 已區分） | `wsl --install --no-distribution`（提權；可能需重開機；Windows 功能 VirtualMachinePlatform） | 全機 |
| 2 | WSL 版本 | `wsl --version` | `wsl --update` | 全機 |
| 3 | 發行版 | `wsl -l -v` | `wsl --install -d Ubuntu-24.04 --no-launch` + 非互動建立預設使用者 | 新增發行版 |
| 4 | WSL2 版本 | `wsl -l -v` VERSION | `wsl --set-version <distro> 2` | 該發行版 |
| 5 | systemd | `systemctl is-system-running` / `/etc/wsl.conf` | 寫 `[boot] systemd=true` → `wsl --terminate <distro>` | 該發行版（重啟） |
| 6 | 網路模式 | 可靠判定方式（BUG-089） | `.wslconfig` `[wsl2] networkingMode=mirrored`（保留既有內容）→ `wsl --shutdown` | **全機所有發行版** |
| 7 | 常駐（keep-alive） | 發行版閒置後是否被關閉 | 方案待研究（`.wslconfig` idle timeout / BAT 持有長駐 `wsl.exe` / 登入時排程啟動…） | 視方案 |
| 8 | linger | `loginctl show-user -p Linger`（T0378） | `loginctl enable-linger <user>`（T0378 已做） | 該使用者 |

## 設計原則

- **先偵測、後清單、一次同意**；未勾選的項目不執行，精靈以「略過（可能影響連線）」繼續
- 影響全機的動作（安裝 WSL、改 `.wslconfig`、`wsl --shutdown`、重開機）在清單中明確標示影響範圍，例如「將關閉所有執行中的 WSL 發行版」
- 改 `.wslconfig` 必須保留既有鍵值與註解，只增改目標鍵；寫入前備份
- 提權動作走 UAC（`EnableLUA=0` 環境則已提權）；child_process 遵守 CLAUDE.md（`execFile` / `spawn` + array args、白名單、timeout）
- 重開機接續：精靈進度持久化 + 開機後恢復入口（機制待研究）
- 每個修正動作冪等，可重試、失敗不回滾前步（沿用 D126）

## 交付階段（暫定，T0380 後修訂）

1. **Phase 0**：T0380 研究
2. **Phase 1**：BUG-089 網路模式判定修正 + 常駐問題修正（直接影響目前已裝好環境的使用者）
3. **Phase 2**：已安裝環境的偵測 → 清單 → 一次同意 → 自動修正（環節 4-8）
4. **Phase 3**：從零安裝（環節 1-3）+ 重開機接續
5. 每階段走實機驗收（含 NSIS 安裝版）

## 不在範圍

- Docker / SSH 精靈（另議）
- 非 Ubuntu 發行版的自動安裝（偵測既有發行版仍支援）
