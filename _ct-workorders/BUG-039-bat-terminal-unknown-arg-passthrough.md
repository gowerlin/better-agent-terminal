# BUG-039-bat-terminal-unknown-arg-passthrough

## 元資料
- **編號**：BUG-039
- **標題**：`bat-terminal.mjs` 未識別參數靜默 passthrough，觸發意外開終端副作用
- **狀態**：CLOSED
- **嚴重度**：🟡 Medium
- **建立時間**：2026-04-18 13:45 (UTC+8)
- **關閉時間**：2026-04-18 14:45 (UTC+8)（塔台直接 CLOSED，使用者已看過修復內容，Q1.A 決策）
- **回報者**：使用者（BMad-Guide 塔台 CP-T0095 派發流程前意外觸發）
- **影響版本**：當前 main

## 現象

**可重現**：100%

**重現步驟**：
```bash
node scripts/bat-terminal.mjs --help
```

**預期**：顯示 CLI 使用說明
**實際**：新終端被建立，標題為 `"--help"`（script 把 `--help` 當成要執行的指令）

## 根因推測（待 Worker 確認）

`bat-terminal.mjs` 參數解析可能採「剝除已知 flag → 剩餘 argv 作為要執行的命令」策略，未做未識別 `--flag` 的防呆。

## 風險分析

1. **違反 CLI 慣例**：Node / npm / git / claude / 大部分 CLI 都支援 `--help`
2. **塔台派發時打錯參數 → silent failure**：例如 `--nofity-id`（拼錯 `--notify-id`）會被當成要開的終端命令，靜默失敗
3. **靜默失敗增加運維排查困難**：終端被開了但使用者不知為何
4. **BAT 白名單派發的整體可靠性**受影響

## 建議修復（優先順序）

| 優先 | 項目 | 說明 |
|------|------|------|
| **P0** | 無後接 claude 命令時 error 不開終端 | 核心防呆：至少一個非 flag 參數作為要執行的命令，否則 exit 1 |
| **P1** | 未識別 `--` 參數 error | 非白名單 flag（非 `--notify-id` 等）一律報錯 |
| **P2** | 補 `--help` / `-h` 輸出 usage | 符合 CLI 慣例，避免誤操作 |
| **P3** | 補 `--version` 輸出 | 可選，利於除錯時識別版本 |

## 實際觸發情境（使用者提供）

BMad-Guide 塔台 CP-T0095 派發流程前，塔台想看 help 釐清 workspace 參數機制，誤觸此行為開了名為 `"--help"` 的垃圾終端（使用者手動關閉）。

**主派發未受影響**：CP-T0095 + CP-T0096 均正常完成。

## Workaround（暫時）

使用者自行記得不要對 `bat-terminal.mjs` 加 `--help`；打錯參數時觀察終端是否意外開啟並手動關閉。

## 相關檔案

- `scripts/bat-terminal.mjs`（主檔）
- 可能波及：`scripts/bat-notify.mjs`（若採相同 passthrough pattern，建議一併檢查）

## 相關單據

- BUG-030 ✅ CLOSED（Git Bash MSYS2 路徑污染，`bat-terminal.mjs` 相關但已修）
- CT-T001（BMad-Guide 塔台）— 實際觸發 session 的上下文
- PLAN-020（yolo 模式）— 本 bug 修復後應加入 yolo 派發白名單參數的嚴格校驗

## 備註

- **非阻塞 PLAN-020**：但 PLAN-020 工單 5 驗收（yolo 跑 PLAN-018）前應優先修掉，避免 yolo 自動派發時踩到 silent failure
- **建議先派研究確認修復面積**（若 `bat-notify.mjs` 也有相同問題，合併修復）

---

## 回報區

> 以下由 sub-session 填寫（修復時），請勿在指揮塔 session 中編輯

### 修復 commit

- `2abcd0f` — fix(scripts): add arg validation to bat-terminal.mjs (BUG-039)
- `b00012d` — fix(scripts): add arg validation to bat-notify.mjs (BUG-039)

### 修復範圍

- **P0 ✅**：無後接命令時報「No command specified」+ exit 1，不開終端
- **P1 ✅**：未識別 `--flag` 一律報錯 + exit 1（含 Levenshtein edit-distance ≤2 的 did-you-mean 建議）
- **P2 ✅**：`--help` / `-h` 輸出完整 usage（含 options + examples），exit 0
- **P3 ✅**：`--version` 讀 `package.json` 輸出 `bat-terminal.mjs v<version>`（目前 `v1.0.0`），exit 0
- **波及 ✅**：`bat-notify.mjs` 同類問題確認存在（未識別 flag 會被當成 message 一部分），一併修

### 驗證方式

本工單於 T0171 sub-session 執行時已驗證 P0-1/P0-2/P1-1/P1-2/P1-3/P2-1/P2-2/P3-1 + N-help/N-h/N-version/N-unknown/N-typo/N-empty/N-mutex 全數通過。Output 證據保留在 T0171 回報區。

**使用者重測指令（任選幾個）**：
```bash
node scripts/bat-terminal.mjs              # 應：Error: No command specified
node scripts/bat-terminal.mjs --help       # 應：顯示 usage，不開終端
node scripts/bat-terminal.mjs --nofity-id x cmd   # 應：did you mean '--notify-id'?
node scripts/bat-notify.mjs --version      # 應：bat-notify.mjs v1.0.0
```

### VERIFY / CLOSED 時間

- FIXED：2026-04-18 14:41 (UTC+8)
- CLOSED：待使用者驗收後填入
