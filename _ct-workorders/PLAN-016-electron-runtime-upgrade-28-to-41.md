# 📋 PLAN-016:Electron runtime 28.3.3 → 41 升級

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-016 |
| **狀態** | 🔄 IN_PROGRESS（Phase 1 + Phase 2 完成，等 runtime VERIFY；Phase 3 暫緩）|
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

**Phase 1**:EXP-ELECTRON41-001(worktree 試做)— 已派發
**Phase 2**:若 EXP CONCLUDED → 派實作 T####(正式合併到 main)
**Phase 3**:順便帶 PLAN-005(electron-builder 26)— native module 重建已完成,builder 升級走同 EXP 尾聲

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
