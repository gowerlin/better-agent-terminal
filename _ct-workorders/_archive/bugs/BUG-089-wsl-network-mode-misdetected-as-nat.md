---
schema_version: 1
schema_kind: bug
id: BUG-089
title: WSL 精靈把 Mirrored 網路模式誤判為 NAT（default route 含 `via` 即判 NAT 的啟發式不成立）
status: CLOSED
fix_commits: [bf41706]
fixed_at: "2026-10-04T22:55:27+08:00"
severity: medium
reproducibility: always
created_at: "2026-10-04T22:04:14+08:00"
updated_at: "2026-10-04T23:46:46+08:00"
impact:
  - setup-wizard-wsl
links:
  fix_workorder: T0383
  research_workorder: T0380
  plan: PLAN-035
  related: [BUG-087, BUG-071]
---

# BUG-089 — WSL 網路模式誤判為 NAT

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（警告文字誤導使用者去改已正確的設定；連線測試若依此改用 distro IP 可能反而失敗） |
| 可重現 | 100%（T0380 於發行版內實測證實） |
| **狀態** | 🚫 CLOSED（2026-10-04 23:46 實機：WSL 精靈第 6 步無 NAT 誤報，`wslinfo` = mirrored） |
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

## T0380 證實（2026-10-04 22:10，發行版內實測）

```
$ wslinfo --networking-mode    → mirrored
$ ip route show default        → default via 192.168.88.254 dev eth1 proto kernel metric 271
```

- Mirrored 會鏡像主機路由表，default route 一定帶閘道 ⇒ route 啟發式在 Mirrored 下必錯
- 使用者的 Mirrored **已經生效**，純粹是判定錯誤
- 可靠判定：`wslinfo --networking-mode`（WSL 2.0.4+）；另讀 `.wslconfig` 的 declared 值比對，區分「設了但沒生效」
- NAT 模式不需要強制改成 Mirrored（`localhostForwarding` 預設開啟）；警告文字需改寫並走 i18n（`install-server-bundle.ts:302`、`connect-test.ts:369`）

## FIXED 證據（2026-10-04 22:57 UTC+8，塔台驗收 T0383）

- 修復 commit：`bf41706`：`detectNetworkMode()` 改用 `wsl -d <distro> -- wslinfo --networking-mode`，**移除 route 啟發式**；唯讀解析 `.wslconfig` `[wsl2] networkingMode` 為 `declared`；以 Windows build（≥ 22621）判斷是否支援 Mirrored；回傳 `{ actual, declared, mirroredSupported }`
- 警告全面走 i18n：`mirrored` / `unknown` 不警告；`nat` 說明 localhost 仍可連、不需修改；`declared=mirrored, actual=nat` 依 build 區分「需 `wsl --shutdown`」或「Windows 不支援」；NAT 專屬建議改到連線測試失敗後才顯示
- 附帶 UX 已修：「目前步驟...」是 `SetupWizardShell.tsx` 把標題 key 拿來拼 `...`，改為 `wizard.running`（執行中…）
- 附帶：`fetch-fingerprint.ts` 移除 `?? 9876` fallback（T0382 殘留）
- 塔台複驗：`npm run test:unit` **888 passed / 61 files**（853 → 888）、`npx vite build` exit 0、`tsc --noEmit` **40**；範圍外 2 處（`wizard-runner.ts` 型別 1 行、`SetupWizardShell.tsx` 1 行）已檢視，屬必要
- Worker 本機 runtime：`detectNetworkMode('Ubuntu-24.04')` → `{"actual":"mirrored","declared":"mirrored","mirroredSupported":true}`
- 待：打包版目視（警告不再出現、「執行中…」）
- 文件待對齊（Phase 2）：`docs/wsl-deployment.md:216`、`docs/plan-007-release-checklist.md:59`
