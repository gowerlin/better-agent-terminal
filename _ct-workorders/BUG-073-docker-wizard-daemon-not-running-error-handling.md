---
schema_version: 1
schema_kind: bug
id: BUG-073
title: Docker setup wizard：Docker daemon 未運作時錯誤訊息純技術，無 actionable 引導
status: VERIFY
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
| 狀態 | 🔍 VERIFY（T0336 ✅ FIXED `a8b2363` @2026-04-28 03:21 — 待人工 smoke：關 Docker Desktop 開 docker wizard 確認看到「下載 Docker Desktop」按鈕；通過後 → CLOSED） |
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
