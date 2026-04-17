# 💡 PLAN-003：npm audit 殘餘漏洞（Electron 核心依賴鏈）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-003 |
| **狀態** | 🔄 IN_PROGRESS（Group B 實作中，T0163 派發） |
| **優先級** | 🟢 Low（13 漏洞全部 dev-only，無 runtime 攻擊面） |
| **提出時間** | 2026-04-12 (UTC+8) |
| **重新評估** | 2026-04-18 (UTC+8)（T0162 研究 + D052 決策後） |
| **提出人** | 塔台（T0059 npm audit 調查，T0060 部分修復後殘留） |
| **預估規模** | 中（vite 5→8 多 major 跳躍 + 3 個 plugin 連動升級） |
| **類型** | 安全 / 技術債 |
| **研究工單** | T0162（DONE，commits `edf913a` + `8be4e5a` + `51201d1`，含 Phase 2 Renew #1） |
| **實作工單** | **T0163**（Group B — vite 5→7 路徑 A，PENDING） |
| **關聯決策** | D052（混合策略：Q1-A 暫緩 + Q2-B vite 升級 + Q3-B WONTFIX） / **D053（路徑選擇：A 保守 stable vite 7）** |

---

## 動機 / 背景（歷史脈絡）

T0060（2026-04-12）透過 claude-agent-sdk 升級 + npm overrides 將漏洞從 27 個降至 17 個（減少 37%）。

原計畫「剩餘 14 個漏洞需 Electron 28→41 breaking change 才能修復」→ Electron 41 於 2026-04-18 升級完成（D051），觸發本 PLAN 重新盤點（T0162）。

---

## 當前狀態（2026-04-18 T0162 重新盤點）

`npm audit` = **13 個漏洞**（0 critical / 7 high / 2 moderate / 4 low），比 T0060 時期減少 4 個。
**全部無 runtime 攻擊面**（dev-time / build-time / postinstall only）。

### 漏洞分組與處置決策（D052）

| 群組 | 數量 | 涉及套件 | 決策 | 理由 |
|------|------|---------|------|------|
| **A** | 9 | electron-builder 鏈（@tootallnate/once、http-proxy-agent、builder-util、electron-publish、app-builder-lib、dmg-builder、electron-builder-squirrel-windows、electron-builder、tar 子集） | **⏸ 暫緩（等 PLAN-005）** | electron-builder 26 升級屬 PLAN-005 範圍，D049 暫緩維持有效；盲升可能影響 NSIS / DMG / auto-update |
| **B** | 2 | vite 5.4.21、esbuild 0.21.5 | **🔄 升 vite 5→7**（T0163 實作中，D053 路徑 A） | vite 5 線已無 patch；dev server path traversal + SSRF 需處理 |
| **C** | 2 | whisper-node-addon → cmake-js → tar | **🚫 WONTFIX** | tar 僅 postinstall/模型下載用，runtime 無暴露；上游 whisper-node-addon 無乾淨升級路徑（0.0.1 指向為反向建議，強拉 tar 7 會破壞 native build） |

### Group B 實作計畫（T0163，路徑 A）

**T0162 Phase 2 Renew #1 已解決 3 個 OQ**：
1. ✅ `vite-plugin-electron 0.29.1` stable 支援 vite 7/8；`vite-plugin-electron-renderer 0.14.6` 無 peer 限制（Phase 1 peer 判斷不精確）
2. ⏭ `electron-vite` 評估：遷移成本過高（config 全改寫），**不採用**
3. ✅ vite 5→7 改動小（`splitVendorChunkPlugin` / `transformIndexHtml` 若有）；5→8 重磅（Oxc/Rolldown + CJS interop）

**塔台決策 D053：採路徑 A（保守 stable vite 7）**

**T0163 實作範圍**：
- `vite: ^5.0.0 → ^7.x` + `@vitejs/plugin-react: ^4.x → ^5.0.0`
- `vite-plugin-electron: ^0.28.8 → ^0.29.1`（stable）
- `vite-plugin-electron-renderer: ^0.14.6`（無變）
- `vite.config.ts` migration（依 grep 結果處理 `splitVendorChunkPlugin` / `transformIndexHtml`）
- CLAUDE.md 更新（新增 Build Toolchain 段）
- 主要功能 smoke test（1B / 2B 範圍）

**預估 Worker time**：3-5h（D053 路徑 A）

**未來升級目標**：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後排新 PLAN）

### Group A 文件化

依 D052，Group A 的 9 個漏洞在 PLAN-005（electron-builder 24→26）實作時一併解決。PLAN-005 目前維持 💡 IDEA（等 Electron 41 主線穩定 1-2 輪）。

### Group C WONTFIX 文件化

| 漏洞 | WONTFIX 理由 |
|------|-------------|
| `tar <=7.5.10`（6 個 GHSA，含 CVSS 8.2、8.8 高分） | 僅 postinstall 階段用於下載 whisper 模型；bundle 不打包 tar；runtime 無攻擊面 |
| `cmake-js 7.4`（繼承 tar） | 僅 native compile 階段使用 |
| `whisper-node-addon 1.0.2 → 0.0.1` 的 audit 建議 | 0.0.1 是**降級**（更舊版本），屬 npm audit 錯誤指向；強拉 tar 7 會破壞 cmake-js peer（peer 鎖 ^6.2.0） |

若未來 whisper-node-addon 上游發布支援 tar 7 的新版，可重評估。

---

## 預期效益

- Group B 實作後：vite dev server SSRF / path traversal 漏洞消除（2 個）
- Group A 隨 PLAN-005 實作後：9 個 electron-builder 鏈漏洞消除
- Group C WONTFIX：不計入「待修」範圍，保持帳面清爽

## 相關單據

- **研究工單**：[T0162](T0162-research-npm-audit-post-electron41-remediation.md)（DONE）
- **相關 PLAN**：PLAN-005（Group A 統一處理載體）
- **實作工單**：[T0163](T0163-plan-003-group-b-vite-5-to-7-upgrade.md)（PENDING，D053 路徑 A）

## 塔台決策（當前）

- **Group A**：暫緩，依 PLAN-005
- **Group B**：進行中（T0163 派發，D053 採路徑 A vite 7）
- **Group C**：WONTFIX，本段文件化即為紀錄
- **本 PLAN 完結條件**：Group B 實作工單 DONE + 漏洞數降至 Group A + Group C 剩餘
