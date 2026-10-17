---
schema_version: 1
schema_kind: bug
id: BUG-073
title: Docker setup wizard：Docker daemon 未運作時錯誤訊息純技術，無 actionable 引導
status: CLOSED
closed_at: "2026-09-02T15:49:04+08:00"
verified_at: "2026-09-02T15:49:04+08:00"
verified_by: field-evidence
severity: medium
---
# BUG-073 — Docker setup wizard：Docker daemon 未運作時錯誤訊息純技術，無 actionable 引導

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-073 |
| 標題 | Docker wizard 第 1 步「偵測目標環境」在 Docker daemon 未運作時拋原生 docker CLI 錯誤訊息（`error during connect... pipe/docker_engine: The system cannot find the file specified`），使用者完全不知道要安裝 Docker Desktop 或啟動它 |
| 嚴重度 | 🟡 Medium（功能受阻，但根因是使用者環境問題；錯誤訊息對非技術使用者不友善） |
| 可重現 | 100%（任何沒裝 Docker Desktop 或 Docker daemon 沒啟動的使用者開 Docker wizard 都會撞） |
| Workaround | 安裝並啟動 Docker Desktop 後重試（普通使用者不知道從錯誤訊息推到這步） |
| 狀態 | 🚫 CLOSED（2026-09-02 就地結案 — field evidence，非人工 smoke；見文末結案紀錄）|
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 使用者（PLAN-030 完工後實機跑 Docker wizard，screenshot #8） |
| 影響範圍 | `electron/docker-detect.ts`（推測，待確認） / Docker wizard 第 1 步 detect-env step |
| Root cause | Worker 把 Docker CLI 原生 error message 直接 propagate 到 wizard UI，沒做「Docker daemon 未運作」這個常見情境的偵測與友善提示 |
| 相關 PLAN | PLAN-007（Docker deployment 路徑） |
| 相關 BUG | BUG-072（同類 — wizard 錯誤訊息不友善 family） |
| Release target | 視 BUG-071 修復策略一起評估 |

## 現象

### 觸發步驟

1. 開 BAT v0.4.1
2. 不啟動 Docker Desktop（或乾脆沒裝）
3. Profile config → `+ 更多 ▼` → 「+ Docker Profile」
4. Wizard 第 1 步「偵測目標環境」**立即失敗**
5. 錯誤訊息：`error during connect: this error may indicate that the docker daemon is not running: Get "http://%2F%2F.%2Fpipe%2Fdocker_engine/v1.51/info": open //./pipe/docker_engine: The system cannot find the file specified.`

### 預期行為

偵測 Docker daemon 連線失敗時，wizard 顯示**人話**：

```
❌ 未偵測到 Docker daemon

可能原因：
• Docker Desktop 未安裝 → [前往下載 Docker Desktop]
• Docker Desktop 已安裝但未啟動 → 請啟動 Docker Desktop 後重試
• Docker daemon 在非預設位置 → 進階設定（連結到設定頁）

[重試]  [取消]
```

技術 error 隱藏到「顯示詳細錯誤」可展開區塊。

### 根因 hypothesis

Worker 在 docker-detect 用 `docker info` CLI，失敗時直接把 stderr 拋出。沒有：
- Pre-flight 檢查 `docker` binary 是否存在
- 解析 stderr 對 daemon-not-running 模式（`pipe/docker_engine` / `Cannot connect to the Docker daemon` 等）做特化處理
- 提供 download / start Docker Desktop 的引導

## 後續處理

塔台建議：與 BUG-072 / BUG-074 一起派 **Wizard Error UX overhaul** 工單群（或 PLAN-031）統一處理。

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
