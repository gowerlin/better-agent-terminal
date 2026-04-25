# BUG-059 — Packaged BAT 內 embedded `claude.exe` 觸發 auto-update 失敗導致 binary missing

## 元資料

- **編號**：BUG-059
- **狀態**：🐛 OPEN
- **嚴重度**：🔴 **High**（packaged 用戶端 worker session 整條鏈路斷）
- **建立時間**：2026-04-25 (待補精確時間，使用者 chat 報告約 2026-04-24 02:25 觀測殘留)
- **發現來源**：使用者實機觀測（chat #00:46 ~ #01:55，#02:25 殘留檔截圖）
- **可重現**：✅ 使用者重現多次（pwsh + claude CLI worker session 場景）
- **環境**：Windows 11，packaged BAT，路徑 `C:\Users\si_is\AppData\Local\Programs\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe`
- **workaround**：手動把 `claude.exe.old.<timestamp>` rename 回 `claude.exe`，或在 BAT Settings → Advanced → Claude Runtime 切到 **system**（PLAN-027 機制）

## 關聯

- **BUG-055**：相同根因類型（Windows 無法 rename 執行中 exe + 沒清理舊檔），但 scope 完全不同
  - BUG-055 = dev/install time，`node_modules` 殘留，🟢 Low → ⛔ WONTFIX
  - BUG-059 = packaged + runtime，可用性中斷，🔴 High
  - **建議**：BUG-055 從 WONTFIX 重新評估（待 T0250 結論，可能合併修復策略）
- **PLAN-027**：Claude Runtime Selection（embedded vs system），workaround 路徑
- **CLAUDE.md `Claude Runtime Selection` 段落**：embedded 應鎖在 `@anthropic-ai/claude-code ^2.1.111`
- **package.json**：`@anthropic-ai/claude-code ^2.1.111`（npm 實際安裝 2.1.113）
- **BUG-053/054/056/058**：同屬 packaged install 路徑/檔案完整性類問題群

## 現象

1. 使用者開新 pwsh 視窗跑 `/ct-exec T####`（Worker session）
2. Worker 完成回報「T0001 完成」
3. 隨後 BAT 嘗試 spawn 下一張 worker → 報錯：
   ```
   Error: Claude Code native binary not found at
   C:\Users\si_is\AppData\Local\Programs\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe.
   Please ensure Claude Code is installed via native installer or specify a valid path with options.pathToClaudeCodeExecutable.
   ```
4. 該目錄下實際檔案變成 `claude.exe.old.1777048824048`（240,202 KB），原 `claude.exe` 不見了

## 推測根因鏈（待 T0250 驗證）

1. BAT spawn embedded claude CLI 跑 worker
2. claude CLI 內建 auto-update 觸發（檢查到新版）
3. claude CLI 把當前 binary 重新命名為 `claude.exe.old.<timestamp>`（避開 Windows in-use file lock）
4. 嘗試下載 / 寫入新版 `claude.exe` → **失敗**
   - 可能因素：app.asar.unpacked 路徑寫入權限、簽章驗證、並行 spawn race、網路、Code Signing、UAC
5. 失敗後**沒有 rollback**（沒把 `.old.<ts>` 改回 `claude.exe`）
6. 後續 spawn 找不到 `claude.exe` → 鏈路斷

> 與 BUG-055 共通：Windows in-use rename + 沒清理舊檔
> 差異：BUG-055 發生在 npm install hook（dev），BUG-059 發生在 runtime（packaged 用戶端）

## 影響面

- **直接**：所有 Windows BAT 使用者跑 worker session 都可能命中（embedded runtime 預設）
- **不可逆**：Worker 跑完才壞，下一張直接無法 spawn，使用者層級無自動恢復
- **連鎖**：YOLO 模式下塔台連續派工會全部失敗（未來 worker session 全 spawn 失敗）
- **跨平台未驗**：macOS/Linux 用 npm global install 機制相似，但檔案系統 in-use 行為不同（POSIX 允許 unlink 開啟中的檔案），需 T0250 確認是否同樣有風險

## 嚴重度判定理由

🔴 **High**（不到 Critical 因為有 workaround）：
- 影響核心功能（worker session 鏈路）
- 影響面廣（所有 Windows packaged 用戶 + embedded runtime）
- 用戶層級無法自動修復（需手動 rename 或切 runtime）
- 跟 BAT release pipeline 直接相關（每次 release 都可能觸發新一輪 update 災難）

## 下一步

- 派 **T0250 研究工單** 定位精確根因 + 驗證修復方向
- T0250 結論出來後派修復工單（預期 1-2 行 spawn env 注入或 config 強制）
- 修復後重新評估 BUG-055（是否合併方案）

## 回報區（Worker 填寫）

<!-- 尚未派工，T0250 研究結論將寫入此區 -->

---

**建立者**：Control Tower（Session 25，2026-04-25）
**決策**：D086 — 開 BUG-059 + T0250，cross-ref BUG-055（待重評估）
