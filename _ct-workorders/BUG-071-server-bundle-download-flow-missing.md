---
schema_version: 1
schema_kind: bug
id: BUG-071
title: Setup Wizard install-server-bundle 步驟硬性失敗：server bundle tarball 自動取得流程未實作
status: OPEN
severity: high
---
# BUG-071 — Setup Wizard install-server-bundle 步驟硬性失敗：server bundle tarball 自動取得流程未實作

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-071 |
| 標題 | WSL/SSH/Docker setup wizard 的 install-server-bundle 步驟在 `userData/bat-server-bundles/` 找不到 tarball 即硬性拋錯，**完全沒有自動下載 / installer 內建 tarball 的流程**。使用者必須手動丟 tarball 才能跑完 wizard。 |
| 嚴重度 | 🔴 High（使用者無法用 wizard 完成 WSL/SSH/Docker remote profile 安裝；BAT remote feature 對普通使用者實質不可用） |
| 可重現 | 100%（只要 `userData/bat-server-bundles/` 沒有 tarball 都會炸；installer 不含、無自動下載 → 100% 觸發） |
| Workaround | 手動下載 `bat-server-linux-x64-v*.tar.gz` 放到 `userData/bat-server-bundles/`（普通使用者不知道做這事） |
| 狀態 | 🐛 OPEN |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 使用者（PLAN-030 完工後實機跑 WSL wizard） |
| 影響範圍 | `src/components/setup-wizard/steps/wsl/install-server-bundle.ts:36` / `src/components/setup-wizard/steps/ssh/install-server-bundle.ts`（同模式） / Docker 也類似（待確認） |
| Root cause | Worker 在 install-bundle step 留 placeholder：`throw new Error('Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.')`。但 T0282 實際是 `ssh-path-translator-and-config-parser`（reference 寫錯），真正應該負責 download / installer 內建的工單未明確指派或未完成 |
| 相關 PLAN | PLAN-007（remote dev support，本應交付完整 wizard）/ 無歸屬 follow-up PLAN |
| Release target | 待評估 — v0.4.2 patch 或 v0.5.0；視修復策略 |

## 現象

### 觸發步驟

1. BAT v0.4.1 NSIS installer 安裝
2. 開啟 BAT → Profile config → `+ 更多 ▼` → 「+ WSL Profile」
3. Setup Wizard 跑到第 4 步「安裝 BAT 伺服器套件」
4. **必炸**：「Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.」

### 預期行為（候選方案）

#### 方案 A：installer 內建 tarball（簡單但 installer 變肥）
- electron-builder 把 `bat-server-linux-x64-v*.tar.gz` 一起打包進 NSIS / dmg
- 安裝後第一次啟動 → 解壓到 `userData/bat-server-bundles/`
- 缺點：installer +~50MB，但所有 platform 都帶 linux tarball

#### 方案 B：首次 wizard 啟動時從 GitHub release 下載
- install-bundle step 找不到 tarball 時，從 `https://github.com/.../releases/download/v0.4.x/bat-server-linux-x64-v0.4.x.tar.gz` 下載到 userData
- 含進度條 + 錯誤處理（網路 fail / GitHub down）
- 缺點：要 server architecture 白名單 + offline 場景無解

#### 方案 C：Hybrid（推薦）
- installer 內建（首次體驗最佳）+ wizard 找不到時 fallback 從 release 下載（升級 BAT 後 server bundle 升級）
- 平衡 installer 大小與 offline 可用性

### 失敗 step 的 actions（T0309 落地）

screenshot 顯示重試/跳過/編輯設定/取消 4 個按鈕**正確顯示** — PLAN-030 T0309 actions slot 設計成功。但對本 BUG 而言：
- 重試：無意義（tarball 沒被自動取得，重試也找不到）
- 跳過：不能跳（後續 step 依賴此 tarball）
- 編輯設定：無設定可編
- 取消：使用者唯一能做的事

## 後續處理

塔台建議下個 session：
1. 派研究工單調查 PLAN-007 spec 中 server bundle 取得流程的原始設計
2. 拍板採方案 A / B / C
3. 拆 1-3 張實作工單

> 是否歸入新 PLAN（如 PLAN-031 server-bundle-distribution）由塔台下次評估
