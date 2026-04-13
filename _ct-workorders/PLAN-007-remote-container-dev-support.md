# PLAN-007 — 遠端 / 容器開發支援研究

## 元資料

| 欄位 | 內容 |
|------|------|
| **PLAN 編號** | PLAN-007 |
| **標題** | BAT 遠端 / 容器開發環境支援（SSH / WSL / Docker） |
| **狀態** | 💡 IDEA |
| **建立時間** | 2026-04-13 10:42 (UTC+8) |
| **優先級** | 🟡 Medium（研究性質，非緊急） |

---

## 構想描述

**核心概念**：BAT 在 Host 宿主機執行，但能讓 AI Agent 在不同的執行環境中操作：

| 目標環境 | 連線方式 | 說明 |
|---------|---------|------|
| 遠端主機 | SSH | BAT → SSH → 遠端機器，在遠端跑 AI Agent |
| WSL 子系統 | WSL interop | BAT → WSL，在 Linux 環境跑 AI Agent |
| Docker 容器 | Docker CLI / API | BAT → docker exec，在容器內跑 AI Agent |

**使用情境**：
- 開發環境在 Docker 容器內（避免汙染 host）
- 遠端 GPU 主機跑 AI（本機只是前端介面）
- WSL 用 Linux toolchain 但 UI 在 Windows 端
- 多專案隔離：每個專案對應一個容器

---

## 研究方向

### Phase A：可行性研究（最先做）

1. **SSH 支援**
   - Claude Agent SDK 能否指定 SSH tunnel 作為執行環境？
   - 或由 BAT 建立 SSH 連線，再把 agent 的 stdio 橋接到遠端？
   - 參考：VS Code Remote SSH 的架構

2. **WSL 支援**
   - `wsl.exe -e` 指令執行 agent
   - 路徑對應（Windows path ↔ WSL path）
   - BAT 如何取得 WSL 環境的檔案系統

3. **Docker 支援**
   - `docker exec -it <container> claude` 橋接到 BAT
   - 或 BAT 內建 Docker API 選取容器
   - 容器內需預裝 claude CLI

### Phase B：技術選型
- 直接用 Node.js `child_process`（ssh、wsl、docker 指令）
- 或用 SSH2 library（`ssh2` npm）做更完整的 SSH 支援
- BAT 的 IPC 架構如何擴充支援「遠端 session」

### Phase C：UX 設計
- 工作區清單新增「連線類型」欄位（Local / SSH / WSL / Docker）
- 新增連線設定（host、port、user、key 路徑 / container name）
- 連線狀態顯示（connected / disconnected / error）

---

## 相依功能

- T0078（在 VS Code 開啟）— 遠端工作區需考慮 VS Code Remote 的整合
- 工作區清單 UI — 需擴充連線類型欄位

---

## 下一步（執行前需決定）

1. 研究 Claude Agent SDK 是否支援「遠端執行環境」或只能跑在本機
2. 確認 BAT 現有 terminal session 建立邏輯，評估擴充難度
3. 先做 MVP（一種連線方式）還是一次設計通用框架？

---

## 備注
- 此為研究計劃，實作前需先完成可行性研究工單
- 優先順序：SSH ≥ Docker > WSL（依使用頻率估計）
- 安全考量：SSH key 管理、容器權限隔離需納入設計
