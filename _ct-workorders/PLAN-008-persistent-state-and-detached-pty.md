# 📋 PLAN-008：持久化狀態 + PTY 進程脫鉤架構

## 元資料
- **票號**：PLAN-008
- **狀態**：✅ DONE（Phase 1: T0096, Phase 2: T0106~T0113）
- **優先**：高
- **登記時間**：2026-04-13 15:30 UTC+8
- **相關工單**：T0093（調查）

---

## 問題描述

BAT 關閉或閃退後，所有 UI 狀態與終端進程消失，使用者需要手動重建工作環境。

---

## 目標

1. **全狀態持久化**：工作區佈局、tab、終端排列、捲動歷史、Agent session ID
2. **即時 + 定時儲存**：每次操作立即寫入；定時保底避免寫入遺漏
3. **啟動復原詢問**：重啟時詢問「是否恢復上次工作區？」
4. **PTY 進程脫鉤**：終端子進程不隨 BAT 主進程關閉而死亡
5. **孤兒回收機制**：未在 N 分鐘內重連的 PTY 進程自動清理
6. **跨平台**：Windows / macOS / Linux 均支援，runtime 自動偵測平台選用對應 IPC 機制

---

## 技術範疇

### Layer 1：狀態持久化

| 狀態類型 | 儲存內容 |
|---------|---------|
| 工作區 | 名稱、路徑、排列順序 |
| Tab | 類型（終端/Agent/面板）、工作目錄、標題 |
| 終端排列 | 分割方向、面板比例 |
| 捲動歷史 | scroll buffer（限制最大行數） |
| Agent session | `sdkSessionId`、對話摘要、最後活動時間 |
| UI 偏好 | 當前選中 workspace、側欄狀態等 |

**儲存位置**：`userData/bat-state.json`（透過 electron-store 或直接 fs.writeFile）

### Layer 2：PTY 進程脫鉤

**核心問題**：node-pty 預設父子進程耦合，主進程死亡時子進程一併死亡。

**解法方向**（待調查確認）：
- **方案 A**：獨立 Terminal Server 進程（獨立 Node.js 進程管理所有 PTY，BAT 透過 IPC/socket 通訊）
- **方案 B**：tmux / screen 作為 PTY 後端（BAT 只是 tmux client，終端實際跑在 tmux 裡）
- **方案 C**：OS-level 進程脫鉤（`detached: true` + `unref()`，搭配 Unix socket 重連）

### Layer 3：孤兒回收

- PTY 進程記錄 PID + 最後活動時間戳到 `bat-pty-registry.json`
- BAT 啟動時掃描 registry，對超過 TTL（如 30 分鐘）的進程發送 SIGTERM
- 正常重連後從 registry 移除
- 進程自然死亡時（命令執行完畢）自動清理 registry

---

## 架構決策（T0093 調查後確認）

| 決策 | 選擇 | 說明 |
|------|------|------|
| IPC 策略 | `child_process.fork` | 零設定，非密集場景足夠 |
| scroll buffer | 1000 行 | 約 100KB/terminal |
| Server idle 超時 | 30 分鐘 + 可 config | 設定鍵由實作決定 |
| 狀態 schema | 擴充現有 windows.json | 無需新建 bat-state.json |
| Agent 會話 | 主進程保留（B1） | sdkSessionId resume，無 API 費用風險 |
| Remote 整合 | 暫不整合（B） | 預留架構彈性，未來可接入 |
| Phase 順序 | Phase 1 先獨立執行 | 快速改善現有體驗，不等 Server |

## 執行計畫

| Phase | 工單 | 內容 | 狀態 |
|-------|------|------|------|
| 0 | T0093 | 調查現有架構 + 三方案評估 | ✅ DONE |
| 1 | T0096 | 定時保底儲存 + UI 佈局持久化 | 📋 TODO |
| 2 | TBD | Terminal Server 獨立進程 + fork IPC | 📋 待開單 |
| 3 | TBD | PtyManager 改為 Server Proxy | 📋 待開單 |
| 4 | TBD | 重連邏輯（啟動偵測 + buffer 重播） | 📋 待開單 |
| 5 | TBD | 孤兒回收 + TTL 清理（30min，可 config） | 📋 待開單 |
| 6 | TBD | 啟動復原提示 UI | 📋 待開單 |

---

## 狀態流轉

| 時間 | 狀態 | 說明 |
|------|------|------|
| 2026-04-13 15:30 | PLANNED | 塔台登記，等 T0093 調查結果 |
