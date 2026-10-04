---
schema_version: 1
schema_kind: bug
id: BUG-089
title: WSL 精靈把 Mirrored 網路模式誤判為 NAT（default route 含 `via` 即判 NAT 的啟發式不成立）
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-04T22:04:14+08:00"
updated_at: "2026-10-04T22:04:14+08:00"
impact:
  - setup-wizard-wsl
links:
  fix_workorder: null
  research_workorder: T0380
  plan: PLAN-035
  related: [BUG-087, BUG-071]
---

# BUG-089 — WSL 網路模式誤判為 NAT

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（警告文字誤導使用者去改已正確的設定；連線測試若依此改用 distro IP 可能反而失敗） |
| 可重現 | 推定 100%（Mirrored 模式下 default route 一般帶 gateway）；**由程式碼閱讀 + 使用者環境推定，未在 distro 內實測 `ip route`** |
| **狀態** | 📂 OPEN（併入 T0380 研究確認，修復隨 PLAN-035 實作單） |
| 回報者 | 使用者截圖（2026-10-04，本機 build 0.5.9-pre.4 含 T0379，WSL 精靈第 6 步「取得 TLS 指紋」） |

## 現象

- 精靈第 6 步顯示警告：`WSL is using NAT networking. Switch to mirrored mode or be ready to replace localhost with the distro IP if connect-test fails.`
- 使用者 `%USERPROFILE%\.wslconfig` 實際為：

  ```ini
  [wsl2]
  networkingMode=Mirrored
  [experimental]
  hostAddressLoopback=true
  bestEffortDnsParsing=true
  ```

- WSL 版本 2.7.13.0

## 程式碼證據

- `electron/wsl-detect.ts:220-239` `detectNetworkMode()`：執行 `ip route show default`，字串含 ` via ` 即回 `'nat'`，只有無 `via` 而有 ` dev ` 才回 `'mirrored'`
- Mirrored 模式鏡像主機網卡與路由表，default route 通常為 `default via <主機閘道> dev eth0 ...` ⇒ 一律落入 `'nat'`
- 呼叫端：`src/components/setup-wizard/steps/wsl/install-server-bundle.ts:107`

## 待 T0380 確認

1. Mirrored 模式下 distro 內 `ip route show default` 的實際輸出
2. 可靠判定方式：`wslinfo --networking-mode`（WSL 2.x 內建）、讀 `.wslconfig`、或其他
3. 使用者機器是否「設定了但尚未生效」（`.wslconfig` 修改後需 `wsl --shutdown`）——若是，正確行為應是提示重啟而非叫使用者改設定

## 附帶 UX 觀察（低優先，併入 PLAN-035）

- 右側面板「目前步驟」下方有一行 `目前步驟...`，疑似未替換的佔位字
- 警告內容為英文，未走 i18n
