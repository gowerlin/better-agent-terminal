---
schema_version: 1
schema_kind: bug
id: BUG-072
title: WSL setup wizard：systemd linger 啟用失敗時錯誤訊息不友善 + 連帶 bat-server.service timeout
status: CLOSED
closed_at: "2026-09-02T15:49:04+08:00"
verified_at: "2026-09-02T15:49:04+08:00"
verified_by: field-evidence
severity: medium
---
# BUG-072 — WSL setup wizard：systemd linger 啟用失敗時錯誤訊息不友善 + 連帶 bat-server.service timeout

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-072 |
| 標題 | WSL wizard 跑到 systemd linger 啟用步驟時拋 `Could not enable linger: No such device or address`，連帶下游 `Timed out waiting for bat-server.service to become active`。錯誤訊息對使用者無 actionable 引導。 |
| 嚴重度 | 🟡 Medium（功能受阻但有 workaround；錯誤訊息純粹技術性，使用者不知道下一步） |
| 可重現 | 偶爾（依 WSL distro / systemd 啟用狀態 / loginctl 可用性而定） |
| Workaround | 使用者手動在 WSL 跑 `loginctl enable-linger $USER`（普通使用者不會） |
| 狀態 | 🚫 CLOSED（2026-09-02 就地結案 — field evidence，非人工 smoke；見文末結案紀錄）|
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

---

## 結案紀錄（2026-09-02 15:49 UTC+8）— CLOSED

**結案依據：現場實績（field evidence），非人工 smoke。**

| 項目 | 內容 |
|------|------|
| 修復落地 | 2026-04-28（見上方 fix commit） |
| 已上線版本 | `v0.5.0-pre.x` → `v0.5.8`（2026-05-24 發布）→ `v0.5.9-pre.1/2` |
| 實際使用期 | 自 `v0.5.8` 起約 **101 天**（2026-05-24 → 2026-09-02） |
| 期間回饋 | **零** —— 除 `v0.5.9` 系列自身修的問題（BUG-082）外，無任何相關回報 |
| 使用者裁決 | 2026-09-02「版本差太多，v0.5.8 實際上線使用很久，除 0.5.9 修改的問題外沒有其他反應回饋，可以就地結案」 |

### ⚠️ 證據強度聲明（誠實記錄）

本次結案建立在**負面訊號的缺席**（沒有人回報問題），**不等同**工單原定的人工 smoke 驗收
（正面確認修復行為符合預期）。兩者證據強度不同，本紀錄不將其混同。

採納理由：修復已隨多個 release 上線逾三個月，屬 setup wizard 錯誤路徑（低頻但使用者可見），
若修復無效或引入回歸，此期間應已出現回報。在無新訊號的情況下持續掛 VERIFY 只是帳面負債。

**後續**：日後若實際踩到相關問題，**另開新 BUG 單**，不重開本單。
