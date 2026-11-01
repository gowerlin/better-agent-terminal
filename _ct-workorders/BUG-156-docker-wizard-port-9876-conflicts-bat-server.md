---
schema_version: 1
schema_kind: bug
id: BUG-156
title: "Docker 設定精靈的容器埠固定 `127.0.0.1:9876`，與 BAT 自己的 RemoteServer 預設埠衝突，「Create new」預設設定下應該必定失敗"
status: CLOSED
fixed_at: "2026-10-18T18:49:54+0800"
fixed_by: T0649
fix_commit: "99abe9a1"
severity: medium
reproducibility: always（T0649：本機 `127.0.0.1:9876` 由 BAT 佔用、socket bind `EADDRINUSE` 實測；未實際跑 `docker run`）
created_at: "2026-10-18T18:33:43+0800"
impact:
  - docker-setup-wizard
links:
  discovered_in: "T0646（`/remote/docker` 頁依程式碼改寫時發現，回報區「給塔台的後續建議」第 2 點）"
  related: [T0646, T0649, T0129]
---

# BUG-156 — Docker 精靈與 BAT RemoteServer 搶 9876

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（Docker 路線在預設設定下無法完成；WSL / SSH 不受影響） |
| 可重現 | 必現（T0649 socket 實測；本機無 Docker daemon，未實際跑 `docker run`） |
| **狀態** | 🚫 CLOSED（2026-11-01 塔台依 R-G003 結案）；原 ✅ FIXED（T0649 `99abe9a1`：Create new 由主行程挑埠 9877–9976、避開 RemoteServer 埠與已佔用埠；Use existing 沿用容器公開的埠；附帶修正 Use existing 一律連 9876 的問題。待有 Docker Desktop 的環境實機驗收） |

## 現象（T0646 程式碼追蹤）

- `src/components/setup-wizard/docker-flow.ts` `DEFAULT_SERVER_PORT = 9876`；`electron/docker-lifecycle.ts` 以 `DOCKER_PUBLISH_HOST`（`127.0.0.1`）公開容器埠。
- BAT 啟動時自動開 RemoteServer（T0129），`electron/main.ts` `REMOTE_PORT_DEFAULT = 9876`，bind `localhost` → `127.0.0.1:9876`。
- 預期：Docker 精靈「Create new」可以在預設設定下完成。實際（推論）：`docker run -p 127.0.0.1:9876:…` 因埠已被 BAT 佔用而失敗，精靈停在啟動容器那一步。
- 使用者目前唯一的繞法是到「設定 > 進階 > 遠端存取 > 伺服器 Port」改 BAT 的埠（已開的分頁仍記著舊埠）。網站 `/remote/docker` 已寫明此限制。

## 修正方向（T0649，由 Worker 實機確認後定案）

- 參考 WSL 的挑埠邏輯（`electron/wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit`）：避開 BAT 自己的伺服器埠與已佔用埠；升級 / 重跑沿用原埠。
- 不改 BAT RemoteServer 的預設埠（會影響所有既有分頁 env 與 helper）。

## 結案（2026-11-01T19:39:30+0800，BAT 第一百零三 session 塔台）

- 依全域 R-G003（測試環境實測）：本機選 port：T0742 `e2e/t0742-docker-port-pick.spec.ts` PASS ×2；Docker 側：T0743（`60419cc2`；source build 0.7.2-pre.8 + `server-bundle-v0.7.2-pre.8` + WSL Docker 29.1.3，隔離實例，各連跑 2 次全綠） D1 publish 埠 ≠ RemoteServer 埠且只綁 127.0.0.1、D2「沿用既有容器」遇 RemoteServer 埠 / 未發佈埠時拒絕且不動容器。
- closed_reason: verified
