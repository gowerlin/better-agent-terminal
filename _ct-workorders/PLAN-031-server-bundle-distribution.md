---
schema_version: 1
schema_kind: plan
id: PLAN-031
title: Server Bundle Distribution（含 ARM64 Linux 支援）
status: IN_PROGRESS
priority: high
created_at: "2026-04-27T00:53:00+08:00"
---
# PLAN-031 — Server Bundle Distribution（含 ARM64 Linux 支援）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-031 |
| 標題 | Setup Wizard install-server-bundle step 從 placeholder throw 補完整 distribution path（installer 內建 + runtime fallback download + 三平台 + ARM64 Linux + version pinning） |
| 優先級 | 🔴 High（BUG-071 阻擋全部使用者實機跑 wizard） |
| 類型 | 技術改善 + 架構調整（涉及 release pipeline / runtime download / wizard step 三子系統） |
| 狀態 | 🔄 IN_PROGRESS（Sprint 1-5 主體 11 工單已 DONE @session 35；剩 T0324 user dogfood + T0326 升級 UI） |
| 建立時間 | 2026-04-27 00:53 (UTC+8) |
| 報告者 | 使用者（dogfood PLAN-030 完工後實機跑 WSL wizard） |
| Release target | v0.5.0（從容做，配合 PLAN-032 wizard error UX 一起 ship） |
| 相關 BUG | BUG-071（root cause owner） |
| 相關 PLAN | PLAN-007（remote dev support，本應交付完整 wizard）/ PLAN-032 候選（wizard error UX，BUG-072/073/074） |
| 上游交付 | T0283 ✅（3 平台 build pipeline + 獨立 workflow + arm64 linux + arm64 darwin），artifact store 已就緒，缺 GitHub Release publish + BAT runtime consumption |

## 動機 / 背景

### 觸發事件

PLAN-030 完工後使用者實機跑 v0.4.1 WSL Setup Wizard，第 4 步「安裝 BAT 伺服器套件」必炸，錯誤訊息：

> Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.

### Root cause（BUG-071 已盤點）

1. **Worker 在 `install-server-bundle.ts` 留 placeholder throw**：找不到 tarball 即硬性失敗
2. **Reference 寫錯**：placeholder 訊息引用的 T0282 實際是 `ssh-path-translator-and-config-parser`，不是 download flow。**真正的 client-side distribution flow 從未有對應工單**
3. **build pipeline 已 OK（T0283 DONE）**：3 平台 tarball CI 跑得通，但只進 GitHub Actions artifact store，**沒接到 GitHub Release**，BAT runtime 也沒消費 artifact 的程式碼路徑
4. **三平台同 pattern**：WSL / SSH / Docker 三個 install-bundle step 共用同一個 placeholder throw 模式（檔案：`src/components/setup-wizard/steps/{wsl,ssh,docker}/install-server-bundle.ts`）

### ARM64 Linux 必納入的真實場景

使用者擁有 **NVIDIA DGX Spark GB10**（ARM aarch64 Linux），是 BAT remote dev 的真實 target hardware。Spark 不會跑 BAT desktop（BAT 是 client），但會作為 SSH/Docker remote target 跑 server bundle。所以：

- BAT host（Windows / macOS / Linux） × Server arch（linux-x64 / linux-arm64 / darwin-arm64）= **9 個 cell 的支援矩陣**
- 其中 BAT host=Linux 雖然 niche，但 BAT 已支援 Linux desktop build，所以矩陣理論完整
- **arch detection** 必須在 wizard 取得 remote arch（透過 SSH `uname -m` / WSL `uname -m` / Docker `arch`）後挑對應 tarball

### 為何要獨立 PLAN（不純 PLAN-007 follow-up）

- 涉及 **3 個獨立子系統**：(1) release pipeline / electron-builder / GitHub Release publish；(2) BAT runtime download（網路、進度、SHA256、retry）；(3) install-bundle step 三平台統一改寫
- 影響 **release process**（v0.5.0 起 BAT 與 server bundle 版本耦合策略）
- ARM64 Linux 既有 build 但無 distribution，獨立 PLAN 才追得到完整交付
- PLAN-007 已 DONE，視為**補完整 spec**比 reopen 整個 PLAN-007 乾淨

## 目標（驗收條件，PLAN 級）

### 必達

- AC-1：使用者用 v0.5.0 NSIS / dmg / AppImage installer 安裝後，**首次跑 WSL/SSH/Docker setup wizard 不需手動丟 tarball**，install-bundle step 能完成
- AC-2：Wizard 能 detect remote arch（x86_64 / aarch64），自動挑 `linux-x64` 或 `linux-arm64` tarball
- AC-3：DGX Spark GB10（aarch64 Linux）是有效 SSH remote target，server bundle 能跑起來
- AC-4：Tarball 來源有 SHA256 校驗（避免 MITM 與檔案損毀）
- AC-5：Tarball 與 BAT renderer/main 版本對齊（version pinning），版本不符時 wizard 給明確錯誤訊息
- AC-6：Offline 場景有合理 fallback（installer 內建 baseline tarball；無網路時可繼續用 baseline）
- AC-7：三平台 (WSL/SSH/Docker) install-bundle step 共享同一份 distribution 邏輯，不重工
- AC-8：v0.5.0 release pipeline 自動 publish server bundle 到 GitHub Release（不只 Actions artifact store）

### 期望

- AC-9：BAT 升級時，server bundle 自動升級提示（既有 remote profile 的 server 可選擇升）
- AC-10：私有部署 / fork 有 fallback URL 可配（不強綁 anthropics/better-agent-terminal）
- AC-11：Installer size 衝擊有上限（目標：linux + arm64 tarball 共佔 < 80MB，installer 增量 < 50%）

## 拆單方向（待 T0313 研究工單細化）

> ⚠️ 以下為塔台粗略構想，**最終拆單以 T0313 research 結論為準**

### Sprint 1：方案拍板 + 設計

- T0313（研究）— PLAN-031 方案評估 + 三平台現況盤點 + 拆單建議

### Sprint 2：Distribution Infra（方案 A / C 部分）

- T03xx — GitHub Release publish flow（server bundle pipeline 接 GitHub Release）
- T03xx — Electron-builder extraResources 整合 server bundle tarball（installer 內建）
- T03xx — Tarball SHA256 manifest 產生 + 校驗

### Sprint 3：Runtime Download Flow（方案 B / C 部分）

- T03xx — BAT runtime download module（含進度、retry、SHA256 校驗）
- T03xx — Arch detection IPC（WSL/SSH/Docker 三平台 `uname -m` / `arch`）
- T03xx — Version pinning 邏輯（BAT version → server bundle URL）

### Sprint 4：Install-Bundle Step 統一改寫

- T03xx — WSL install-bundle step 改寫（消費 distribution module）
- T03xx — SSH install-bundle step 改寫（消費 distribution module + arch detection）
- T03xx — Docker install-bundle step 改寫（同上）

### Sprint 5：E2E 驗收

- T03xx — 三平台 e2e 測試（含 ARM64 Linux 一條 path，使用者 DGX Spark 實機驗收）
- T03xx — Offline / 網路 fail 場景驗收
- T03xx — v0.5.0 release dogfood

## 風險 / 待釐清

- **Installer size**：3 平台 server bundle tarball 加總 size 待量測（T0283 build 完才知）。若 > 100MB 則方案 A 不可行
- **GitHub Rate Limit**：anonymous download 60 req/hr，若使用者跑過多次 wizard 可能踩到。需考慮 fallback URL 或 token-based download
- **Auto-update 衝突**：BUG-059 已停用 embedded claude CLI auto-update。Server bundle auto-update 是否同樣需停用？（傾向是，避免 client 端意外更新 server 端）
- **DGX Spark 雙 GPU 影響**：linux-arm64 server bundle 包含 native modules（@lydell/node-pty, @img/sharp, better-sqlite3），arm64 prebuilt 是否齊全 T0283 已驗
- **Worktree 環境限制（T0283 PARTIAL 註記）**：Windows worktree 缺 arm64/darwin native sub-package，本機驗證需 CI matrix 才能跑全 3 platform

## 排程

- **2026-04-27**：PLAN-031 PLANNED + T0313 派發
- **T0313 完成後**：拍板方案 → 拆 Sprint 2-5 工單
- **2026-05 中旬目標**：Sprint 2-3 完成（infra ready）
- **2026-05 月底目標**：Sprint 4-5 完成 + v0.5.0 ship

## 備註

- BUG-072 / BUG-073 / BUG-074（wizard error UX 三 BUG）獨立成 PLAN-032，與本 PLAN 平行進行（同一個 wizard 改善 batch，但 root cause 不同：本 PLAN 是 distribution，PLAN-032 是 error UX）
- 本 PLAN 結案後，BUG-071 自動 → CLOSED
