---
schema_version: 1
schema_kind: bug
id: BUG-082
title: 跨專案工單前綴（CP-/CT-）被結構化派工路徑拒收，且四處 ID 規則彼此不一致
status: FIXED
severity: high
reproducibility: always
created_at: "2026-09-01T22:42:56+08:00"
updated_at: "2026-09-01T22:56:52+08:00"
fixed_at: "2026-09-01T22:56:52+08:00"
fix_commit: 956c0f9
workaround: |
  改用 --prompt 自由文字模式派工（已由 BMad-Guide 塔台實測 exit 0）：
  node "$BAT_HELPER_DIR\bat-terminal.mjs" --notify-id <id> --workspace <uuid> \
       --cwd <repo root> --mode ask --agent default --prompt "/ct-exec CP-T0113"
  代價：繞過結構化參數，Worker 收到自由文字而非 skill/workorder 欄位。
impact:
  - bat-terminal
  - control-tower-panel
  - agent-command
  - cross-project-dispatch
links:
  source_advisory: "BMad-Guide 塔台跨塔台 ADVISORY（2026-09-01）— 存檔於上層 repo _ct-workorders/_handover-2026-09-01-bat-workspace-default-opinion.md（本 repo 無此檔）"
  fix_workorder: T0360
  related_workorders:
    - T0359
    - T0137
  related_bugs:
    - BUG-031
  related_files:
    - scripts/bat-terminal.mjs
    - electron/main.ts
    - src/types/control-tower.ts
    - src/utils/control-tower-launch.ts
tags:
  - cross-project
  - workorder-id
  - validation
  - dispatch
  - internal-inconsistency
---

# BUG-082 — 跨專案工單前綴被結構化派工路徑拒收

## Metadata

| 欄位 | 值 |
|------|-----|
| **狀態** | ✅ FIXED（待 runtime 驗收）|
| **嚴重度** | high |
| **重現性** | always |
| **回報來源** | BMad-Guide 塔台跨塔台 ADVISORY（2026-09-01） |
| **建立時間** | 2026-09-01 22:42 (UTC+8) |

## 現象

### 預期

Control Tower 的 `references/cross-project-coordination.md`「命名規則」明訂跨專案協調工單**強制**使用前綴（`CP-T0001-description.md`）。BAT 的結構化派工模式（`--skill` + `--workorder`）應能派發這類工單。

### 實際

```
node "$BAT_HELPER_DIR\bat-terminal.mjs" ... --skill ct-exec --workorder CP-T0113
→ Error: Invalid --workorder value: 'CP-T0113' (expected T followed by digits)
→ EXITCODE=1
```

⇒ 整個 CT 生態的跨專案工單（COORDINATED / DELEGATE）都無法用結構化模式派工。

## 根因：四個元件對「工單 ID 格式」有四種答案

塔台 2026-09-01 讀碼驗證：

| 位置 | 規則 | `CP-T1148` | `CT-T001` |
|------|------|-----------|----------|
| `scripts/bat-terminal.mjs:224` | `/^T\d+$/` | ❌ | ❌ |
| `electron/main.ts:540` `buildControlTowerSkillPrompt` | `/^T\d+$/` | ❌ | ❌ |
| `src/types/control-tower.ts:188,204` 面板 parser | `/^(?:CP-)?T\d+/` | ✅ | ❌ |
| `src/utils/control-tower-launch.ts:49` 面板按鈕派工 | 無驗證 | ✅ | ✅ |
| `scripts/migrate-ct-frontmatter.mjs:35` | 已處理 `CT-T###` | ✅ | ✅ |

### 由此產生的三個可觀察症狀

1. **同一顆 BAT，UI 按鈕能派、helper 不能派**
   T0359 已讓面板 parser 支援 `CP-T####`（含 `CP-T1148` fixture 測試），但 CLI 結構化路徑仍拒收。

2. **本 repo 熱區的 `CT-T001-delegate-bat-routing-skill-update.md` 面板不認**
   `isWorkOrderFile('CT-T001-...')` 回 `false`（parser 硬編碼只認 `CP-`），該工單在 Control Tower 面板中不顯示。

3. **只修 helper 會把失敗往後推一層（回報方讀不到的資訊）**
   `bat-terminal.mjs` 放行後，main process `buildControlTowerSkillPrompt` 仍回 `null`
   → `[agent-command] invalid prompt payload` warn → 終端建立失敗。
   回報方僅讀 helper 原始碼，無法得知這層。**修復必須同時涵蓋兩層。**

## 修復方向

統一為 `^(?:[A-Z]{2,4}-)?T\d+$`（對齊 CT 的「2–4 字元大寫英文前綴」規則），四處對齊。

## 相關

- 修復工單：T0360
- 同批附帶：B-2 stderr 提示（`--workspace` 未帶時）+【4】renderer 未知 workspaceId 行為調查
- 塔台裁決：B-1（漏帶 `--workspace` 時改取 `BAT_WORKSPACE_ID`）**暫緩**，綁定【4】調查結論

---

## 修復紀錄（2026-09-01 22:56 UTC+8）

**T0360 FIXED** — commit `956c0f9`（9 files, +557/-12）。四處統一為 `^(?:[A-Z]{2,4}-)?T\d+$`。

### 塔台獨立複驗（未採信 Worker 自述）

| 項目 | 結果 |
|------|------|
| 四處 regex 統一 | ✅ 已確認；`grep '\^T\d'` 於四檔案 **零殘留** |
| `npm run test:unit` | ✅ 40 files / **507 passed**（基線 483，+24） |
| helper 拒收 | ✅ `cp-t1` / `TOOLONG-T1` → exit 1 + 新錯誤訊息 |
| helper 接受 | ✅ `CP-T0113` 通過驗證並進入連線階段 |
| B-2 提示 | ✅ 未帶 `--workspace` 時三行提示出現；帶了則消失 |

### 🔴 runtime 驗收阻塞（CLOSED 前必解）

安裝版 BAT 仍為**修復前**版本，故 runtime 派工 smoke 現在**必然失敗**：

- `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs`（2026-05-24 20:29）仍含舊訊息 `(expected T followed by digits)` — A1 未生效
- `resources\app.asar`（同時間）為修復前 bundle — A2 未生效

⇒ **本 BUG 需 rebuild + reinstall 後才能 runtime 驗收**。此為 BAT 長期存在的
「source 已修但 installed bundle 落後」情境（2026-05-24 曾於 bug tracker parser 修復時遇到同一問題）。

### Part C 調查結論（供 ADVISORY B-1 決策）

未知 workspaceId **安全但不可觀測**：renderer `workspace-store.ts:333-340` 靜默 fallback 到 active
workspace，全鏈路零驗證；`App.tsx:458` 的 debug log 印的是請求值而非落點，會誤導。
⇒ B-1 不被否決，但若採納應同批補 workspace miss 訊號（建議另開單）。
