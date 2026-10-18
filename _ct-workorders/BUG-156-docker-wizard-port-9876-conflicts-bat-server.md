---
schema_version: 1
schema_kind: bug
id: BUG-156
title: "Docker 設定精靈的容器埠固定 `127.0.0.1:9876`，與 BAT 自己的 RemoteServer 預設埠衝突，「Create new」預設設定下應該必定失敗"
status: FIXING
severity: medium
reproducibility: always（程式碼推論，未實機重現）
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
| 可重現 | 程式碼推論為必現；未實機跑 `docker run` |
| **狀態** | ⏳ FIXING（T0649） |

## 現象（T0646 程式碼追蹤）

- `src/components/setup-wizard/docker-flow.ts` `DEFAULT_SERVER_PORT = 9876`；`electron/docker-lifecycle.ts` 以 `DOCKER_PUBLISH_HOST`（`127.0.0.1`）公開容器埠。
- BAT 啟動時自動開 RemoteServer（T0129），`electron/main.ts` `REMOTE_PORT_DEFAULT = 9876`，bind `localhost` → `127.0.0.1:9876`。
- 預期：Docker 精靈「Create new」可以在預設設定下完成。實際（推論）：`docker run -p 127.0.0.1:9876:…` 因埠已被 BAT 佔用而失敗，精靈停在啟動容器那一步。
- 使用者目前唯一的繞法是到「設定 > 進階 > 遠端存取 > 伺服器 Port」改 BAT 的埠（已開的分頁仍記著舊埠）。網站 `/remote/docker` 已寫明此限制。

## 修正方向（T0649，由 Worker 實機確認後定案）

- 參考 WSL 的挑埠邏輯（`electron/wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit`）：避開 BAT 自己的伺服器埠與已佔用埠；升級 / 重跑沿用原埠。
- 不改 BAT RemoteServer 的預設埠（會影響所有既有分頁 env 與 helper）。
