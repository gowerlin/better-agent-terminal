# ✅ PLAN-016：Electron runtime 28.3.3 → 41 升級（DONE）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-016 |
| **狀態** | ✅ DONE（Phase 1 ✅ D049 / Phase 2 ✅ D051 / Phase 3 ✅ D055 via PLAN-005） |
| **完成時間** | 2026-04-18 05:30 (UTC+8) |
| **優先級** | 🔴 High |
| **提出時間** | 2026-04-18 (UTC+8) |
| **提出人** | 塔台(D048,T0159 研究結論) |
| **預估規模** | 中大(4-8h EXP,native modules 重建為主要變數) |
| **類型** | 安全性升級 + 技術債 |

---

## 動機 / 背景

T0159 研究揭露關鍵事實:
- Electron 28.3.3 **已於 2024-06-11 EOL**,距今近 2 年無官方 security patches
- 當前 latest stable: Electron 43(官方支援 41/42/43)
- Chromium M120 → M146/M150(兩年的 CVE 無修復路徑)
- Node runtime 18.18.2 → 24.x(native module ABI 全面改版)

## 目標版本決策

**Electron 41**(N-2,類 LTS 角色)
- 理由:穩定已 1+ 個月、社群回報多、native module prebuilts 齊備、EoL 2026-08-25(約 4 個月保護期)
- 備案:Electron 43(若 EXP 順利且追求最長 EoL 窗口)

## Native Modules 相容性風險表

| 模組 | 當前版本 | Electron 41 風險 |
|------|---------|------------------|
| `better-sqlite3@12.9.0` | ✅ 有官方 prebuilt(>95% 信心) |
| `@lydell/node-pty@1.1.0` | 🟡 中度風險 — 需 EXP 驗證,必要時 fallback `node-pty-prebuilt-multiarch` |
| `whisper-node-addon@1.0.2` | 🔴 **最大風險** — README 只提 Electron 25,可能需手動 rebuild 或改 fork |
| `sharp@0.34.5` | ✅ 無風險(optional dep,且官方支援 Electron) |

## 關鍵警訊(T0159 發現)

git log `b5b3d1a`(2026-04-12 一次性大批 npm 升級) → `d8ee82a` revert(+7557/-813 行)。**鐵律:EXP 必須單獨 worktree,不可合併 PLAN-005/001**。

## 實施策略

**Phase 1**：EXP-ELECTRON41-001（worktree 試做）— ✅ CONCLUDED（commit `ef3624f`，D049）
**Phase 2**：EXP 合併到 main + runtime 驗收 — ✅ DONE（T0160 `e7eab33` + T0161 `9d734a8` + BUG-038 CLOSED，D051，03:01）
**Phase 3**：順便帶 PLAN-005（electron-builder 26）— ✅ DONE（EXP-BUILDER26-001 CONCLUDED + merge `75bb77f`，D055，05:25）

## 執行結果（2026-04-18 閉環）

**三 Phase 時間軸**：
- 02:16 EXP-ELECTRON41-001 CONCLUDED（27 分鐘完成，vs 原估 4-8h）
- 02:33 T0161 BUG-038 FIXED（ELECTRON_RUN_AS_NODE pollution）
- 03:01 Phase 2 閉環（使用者 runtime UAT 通過，D051）
- 05:25 Phase 3（PLAN-005）閉環（D055，使用者 Step 5.4 installer 驗收通過）

**Success Criteria 驗收（6/6）**：
1. ✅ `npm install` 無錯 — T0160 + EXP-BUILDER26-001 Step 3
2. ✅ Native modules rebuild 成功 — ABI 145 better-sqlite3 + @lydell/node-pty 驗證
3. ✅ `npm run dev` 啟動主視窗 — T0161 修復後驗證（D051）
4. ✅ `npm run build:dir` 可打包 — EXP-BUILDER26-001 Step 5.2
5. ✅ BAT core flows smoke test — D051 + EXP-BUILDER26-001 Step 5.4
6. ✅ 無 regression — 使用者 05:25 確認 CT panel / 終端 / Sidebar / IPC 全綠

**最終狀態**（2026-04-18 主線）：
- Electron: 28.3.3 → 41.2.1（Node 24、Chromium M146）
- electron-builder: 24.13.3 → 26.8.1
- npm audit: 27 → 3（Group C WONTFIX）
- CLAUDE.md: Electron Runtime + Build Toolchain 兩段完整記錄
- 相關決策: D047（派 T0159）/ D048（建 PLAN）/ D049（Phase 1 閉環）/ D050（VSCode self-lock 發現）/ D051（Phase 2 閉環）/ D055（Phase 3 via PLAN-005）

## 關聯單據

- **研究來源**:T0159 DONE(commit `4e5af2f`)
- **相關 PLAN**:
  - PLAN-005(electron-builder 24→26)— 綁定在 PLAN-016 Phase 3 尾聲順便做
  - PLAN-001(Vite 5→6)— 不綁定,延後獨立評估
- **相關決策**:D047(派發 T0159)/ D048(本 PLAN 建立)

## 塔台決策

- **決定**:立即進入 Phase 1(EXP worktree 試做)
- **建議時機**:即刻(D048,使用者選項 [A])
- **並行性**:可與 PLAN-014 Phase 3 Git GUI 主線並行(獨立 worktree)
- **Success criteria**(EXP → CONCLUDED 門檻):
  1. `npm install` 無錯
  2. 所有 native modules rebuild 成功(特別是 whisper-node-addon)
  3. `npm run dev` 可啟動主視窗
  4. `npm run build:dir` 可打包 unpacked
  5. 手動 smoke test:BAT terminal 開啟 / workspace 切換 / PTY 輸入 / Control Tower panel / Git Graph panel
  6. 無 regression 於 BAT core flows
