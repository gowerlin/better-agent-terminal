# 工單 T0087 — Agent 模式攔截 /login 命令 + BUG-001 結案

| 欄位 | 值 |
|------|-----|
| **狀態** | DONE |
| **開始時間** | 2026-04-13 13:59 UTC+8 |
| **優先** | 中 |
| **類型** | feat + chore |
| **開單時間** | 2026-04-13 13:50 UTC+8 |
| **完成時限** | 本 session |
| **相關票號** | BUG-001, PLAN-006 |

---

## 🎯 目標

在 Agent V1/V2 模式的 **prompt 輸入欄**，攔截 `/login` 命令：
1. 阻止命令送出給 Agent
2. 顯示 inline 提示文字引導使用者用正確方式登入
3. BUG-001 根因已釐清（使用情境誤用），隨本工單結案

---

## 📋 背景

**BUG-001 根因釐清**：
- 原始 bug 報告：登入相關問題（高嚴重度，已標 VERIFY）
- 實際情況：使用者在 **Agent V1/V2 模式的 prompt 輸入欄** 輸入 `/login`，但此欄位是送給 Claude Agent 的，不是 Claude Code CLI
- 正確做法：在終端機（已有完整 CLI）輸入 `/login` → 正常運作
- 結論：BAT 本身無 bug，為使用情境誤用 → 以 UX 改善取代 bug 修復

**功能需求**：
- 攔截範圍：Agent V1/V2 模式的 prompt 輸入欄（非終端機輸入）
- 攔截條件：使用者送出的訊息等於 `/login`（可 trim 後比對）
- 攔截行為：阻止送出 + 顯示 inline 提示
- 終端機 CLI 登入：**完全不受影響**
- 擴展性：架構上預留未來攔截其他 CLI 命令的空間（如 `/logout`、`/doctor`）

**提示文字**：
```
/login 需在 Claude Code CLI 模式下執行。
請關閉 Agent 模式後，在終端直接輸入 /login。
```

---

## 🔍 前置調查（Sub-session 必做）

在實作前先調查以下檔案，了解 prompt 輸入欄的送出流程：

```bash
# 找 Agent 模式的 prompt 輸入元件
grep -r "v1\|v2\|agent.*prompt\|prompt.*agent\|AgentInput\|PromptInput\|sendMessage\|handleSubmit" \
  src/ --include="*.tsx" --include="*.ts" -l

# 找輸入欄的 onSubmit / handleSend 相關邏輯
grep -r "onSubmit\|handleSend\|sendMessage\|handleKeyDown" \
  src/components/ --include="*.tsx" -l
```

重點找：
1. Agent V1/V2 模式下，prompt 輸入欄的元件名稱
2. 送出訊息前的處理函數（送出前攔截的最佳位置）
3. 是否已有 inline error/info 訊息的 UI pattern 可複用

---

## ✅ 任務清單

### Part A：功能實作

#### A1. 找到正確攔截位置

在 prompt 輸入欄的送出函數中，找到送出前的處理邏輯。

**攔截邏輯**（加在送出前）：
```typescript
// 可擴展的 CLI 專屬命令清單（架構預留）
const CLI_ONLY_COMMANDS = ['/login'] // 未來可加 '/logout', '/doctor' 等

function isCliOnlyCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase()
  return CLI_ONLY_COMMANDS.some(cmd => trimmed === cmd)
}

// 在 handleSubmit / sendMessage 中加入攔截
if (isCliOnlyCommand(userInput)) {
  setCliCommandWarning(
    '/login 需在 Claude Code CLI 模式下執行。\n請關閉 Agent 模式後，在終端直接輸入 /login。'
  )
  return // 阻止送出
}
```

#### A2. 顯示 inline 提示

在輸入欄附近（下方或旁邊）顯示提示文字：
- 樣式：警告色（amber/yellow），輕量 inline，不遮擋操作
- 清除時機：使用者修改輸入內容時自動清除
- 若專案已有 inline warning UI pattern，優先複用

**參考 UI**（若需自行加）：
```tsx
{cliCommandWarning && (
  <div className="text-amber-500 text-sm mt-1 px-2">
    {cliCommandWarning}
  </div>
)}
```

#### A3. 確認終端機不受影響

- 確認攔截邏輯**只在 Agent prompt 輸入欄生效**
- 終端機的按鍵輸入路徑不應觸及此邏輯

### Part B：BUG-001 文件結案

#### B1. 更新 BUG-001 文件

**`_ct-workorders/BUG-001-*.md`**（先 Glob 找正確檔名）
- 狀態：`VERIFY` → `CLOSED`
- 加入結案記錄：
  ```
  **結案日期**：2026-04-13
  **結案說明**：根因釐清為使用情境誤用（Agent 模式 prompt 輸入 /login）
  **處置**：非 BAT bug，以 UX 改善取代（T0087 攔截提示功能）
  ```

#### B2. 更新 Bug Tracker

**`_ct-workorders/_bug-tracker.md`**
- BUG-001：`VERIFY` → `CLOSED`
- 統計：VERIFY -1，CLOSED +1

### Part C：PLAN-006 取消

#### C1. 更新 PLAN-006 文件

**`_ct-workorders/PLAN-006-scrollbar-ux-improvement.md`**
- 狀態：目前狀態 → `DROPPED`
- 加入取消記錄：
  ```
  **取消日期**：2026-04-13
  **取消原因**：Alt buffer 模式無 scrollbar 為 terminal 標準行為（非 bug）。
               使用者誤判為缺陷，確認後取消此計劃。
  ```

#### C2. 更新 _backlog.md（若有 PLAN-006 相關條目）

若 `_backlog.md` 有 PLAN-006 的待辦，一併移除或標記取消。

### Part D：建置驗證 + 提交

#### D1. 建置確認

```bash
npx vite build
# 確認無 TypeScript 錯誤
```

#### D2. 提交

```bash
git add src/         # 修改的元件
git add _ct-workorders/_bug-tracker.md
git add _ct-workorders/BUG-001-*.md
git add _ct-workorders/PLAN-006-scrollbar-ux-improvement.md
git add _ct-workorders/T0087-intercept-login-in-agent-mode.md

git commit -m "feat(agent): 攔截 Agent 模式 /login 命令並提示 CLI 登入

- Agent V1/V2 prompt 輸入 /login 時顯示 inline 提示，阻止送出
- 新增 CLI_ONLY_COMMANDS 清單，架構上預留未來擴展
- BUG-001 結案：根因為使用情境誤用，非 BAT bug
- PLAN-006 取消：alt buffer 無 scrollbar 為標準 terminal 行為"
```

---

## 🔍 驗證標準

- [ ] Agent V1/V2 模式下輸入 `/login` → **不送出**，顯示提示文字
- [ ] 提示文字正確：「/login 需在 Claude Code CLI 模式下執行...」
- [ ] 修改輸入內容後提示文字消失
- [ ] 終端機輸入 `/login` → **正常送出**（不受影響）
- [ ] `npx vite build` 無錯誤
- [ ] BUG-001 在 `_bug-tracker.md` 狀態為 CLOSED
- [ ] `PLAN-006-scrollbar-ux-improvement.md` 狀態為 DROPPED，有取消記錄
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 14:07 UTC+8

**攔截位置**（找到的元件/函數名稱）：`ClaudeAgentPanel.tsx` → `handleSend()` 函數（~line 1125），與現有 `/resume`、`/logout`、`/whoami` 等攔截同層級

**是否複用現有 inline warning UI**：否，新建 `.claude-cli-warning` CSS class（amber 色、12px、pre-line）

**Build 結果**：✅ `npx vite build` 成功，無 TypeScript 錯誤

**Commit hash**：23adead

**異常或決策**：
- `handleInputChange` 的 `useCallback` 依賴陣列為空 `[]`，使用無條件 `setCliCommandWarning(null)` 避免 stale closure 問題
- 攔截邏輯使用 `trimmed.toLowerCase()` 比對，大小寫不敏感

**統計更新後**：
- BUG-001：CLOSED ✅
- PLAN-006：DROPPED ���
- VERIFY bugs：0（預期 0）✅
- CLOSED bugs：4（預期 4）✅
