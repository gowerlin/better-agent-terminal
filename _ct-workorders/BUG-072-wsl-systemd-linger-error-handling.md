# BUG-072 — WSL setup wizard：systemd linger 啟用失敗時錯誤訊息不友善 + 連帶 bat-server.service timeout

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-072 |
| 標題 | WSL wizard 跑到 systemd linger 啟用步驟時拋 `Could not enable linger: No such device or address`，連帶下游 `Timed out waiting for bat-server.service to become active`。錯誤訊息對使用者無 actionable 引導。 |
| 嚴重度 | 🟡 Medium（功能受阻但有 workaround；錯誤訊息純粹技術性，使用者不知道下一步） |
| 可重現 | 偶爾（依 WSL distro / systemd 啟用狀態 / loginctl 可用性而定） |
| Workaround | 使用者手動在 WSL 跑 `loginctl enable-linger $USER`（普通使用者不會） |
| 狀態 | 🐛 OPEN |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 使用者（PLAN-030 完工後實機跑 WSL wizard，screenshot #7） |
| 影響範圍 | WSL wizard 的 linger 啟用 step / systemd service 啟動 step（具體檔案待調查） |
| Root cause | 候選：(1) WSL distro 沒裝完整 systemd（chrooted 啟動）/ (2) loginctl 不可用 / (3) 使用者帳號未綁 systemd-logind / (4) WSL2 + systemd 啟用順序問題 |
| 相關 PLAN | PLAN-007（WSL deployment 路徑）/ PLAN-030 actions slot 設計可改善這場景的 UX |
| 相關 BUG | BUG-071（同一 wizard 流程，前置 step 失敗就先撞 BUG-071） |
| Release target | 視 BUG-071 修復策略一起決定 |

## 現象

### 觸發步驟

1. WSL wizard 跑到第 5 步「寫入 systemd 使用者服務」（write-systemd-unit）或同階段
2. 拋 `Unable to enable linger automatically: Could not enable linger: No such device or address`
3. 連帶第 6 步「啟動伺服器服務」timeout：`Timed out waiting for bat-server.service to become active`

### 預期行為

- 偵測 linger 啟用失敗時，顯示**人話**錯誤 + actionable 引導：
  - 「無法自動啟用 systemd user lingering（WSL2 distro 限制）」
  - 「請在 WSL 中執行：`sudo loginctl enable-linger $USER` 後重試」
  - 或自動 fallback：每次連線時臨時啟動 bat-server（不依賴 linger）
- 「重試」按鈕應**有意義** — 提示使用者執行 `loginctl enable-linger` 後再重試

### 不在範圍

- 不修 WSL distro 本身的 systemd 啟用問題（環境問題）
- 不重新設計 wizard step 順序

## 後續處理

塔台建議：
1. 與 BUG-071 同期評估（同 wizard 流程，使用者驗收會看到一連串錯誤）
2. 改善方向：
   - **A** 偵測 linger fail → 提示使用者命令 + 「我已執行，重試」流程
   - **B** 不依賴 linger，改用 ssh tunnel 連線時臨時 spawn bat-server
   - **C** Hybrid：嘗試 linger，失敗則 fallback B

> WSL systemd 環境多樣，建議先研究 BAT 既有 WSL deployment spec（PLAN-007 spec § C 區段）了解原始設計後再拍板
