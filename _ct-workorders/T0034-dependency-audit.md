# 工單 T0034-dependency-audit

## 元資料
- **工單編號**：T0034
- **任務名稱**：package.json 依賴套件版本盤點 + 升級風險評估
- **狀態**：DONE
- **建立時間**：2026-04-12 11:15 (UTC+8)
- **開始時間**：2026-04-12 11:13 (UTC+8)
- **完成時間**：2026-04-12 11:18 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔍 **Pure Investigation**（無 code 修改，無 git commit except 報告）

## 工作量預估
- **預估規模**：**小**（15-25 min）
- **Context Window 風險**：低
- **降級策略**：無需降級，純文字報告

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：與 T0033-A 平行跑，互不干擾

---

## 任務指令

### 前置條件

**必讀**：
1. `package.json`（dependencies + devDependencies 完整清單）

**不要讀**：
- `_tower-state.md`、任何 T0033 工單
- source code（本工單只看依賴版本，不看用法）

### 任務

#### Step 1：收集版本資訊

跑以下指令：

```bash
npm outdated --json 2>/dev/null || npm outdated
```

記錄：current version / wanted / latest / 差距

#### Step 2：分類分析

把每個套件分類到以下表格：

**分類定義**：

| 等級 | 定義 | 行動 |
|------|------|------|
| 🔴 Critical | 有已知安全漏洞 (CVE) 或停止維護 | 建議立即升級 |
| 🟡 Major | 落後 1+ major version，API 可能有 breaking change | 評估升級計劃 |
| 🟢 Minor | 落後 minor/patch，向後相容 | 安全升級，風險低 |
| ⚪ Current | 已是最新或接近最新 | 不需動作 |

#### Step 3：風險評估

對每個 🔴 和 🟡 套件：
- 說明 breaking changes（從 changelog / release notes）
- 評估升級對 BAT 的影響範圍
- 標記是否需要 code 修改

特別注意：
- **Electron** 版本 — 影響整個 app runtime，升級需仔細驗證
- **xterm.js** (`@xterm/xterm`) — 5.5.0 是否有更新版？decoration API 有沒有改？
- **React** / **react-dom** — major version 差異影響整個 UI 層
- **Vite** — build toolchain，minor 通常安全
- **TypeScript** — 型別檢查可能更嚴格

#### Step 4：升級建議

產出一份分層建議：
1. **Safe batch**（🟢）：可以一次 `npm update` 的低風險套件
2. **Staged upgrades**（🟡）：需要單獨測試的 major 升級
3. **Hold**（🔴 有風險或不建議升級的）：說明原因
4. **Security fixes**：優先處理的安全相關升級

### 預期產出

**單一檔案**：`_ct-workorders/reports/T0034-dependency-audit.md`

結構：

```markdown
# T0034 — 依賴套件版本盤點

## 盤點時間：YYYY-MM-DD

## 總覽
- 總套件數：N
- 🔴 Critical：N
- 🟡 Major：N
- 🟢 Minor：N
- ⚪ Current：N

## 詳細清單

### dependencies
| 套件 | 目前版本 | 最新版本 | 差距 | 等級 | 說明 |
|------|---------|---------|------|------|------|
| ... | ... | ... | ... | ... | ... |

### devDependencies
（同上格式）

## 升級建議

### Safe batch（可立即 npm update）
（列表）

### Staged upgrades（需單獨測試）
（列表 + 每個的 breaking change 摘要）

### Hold（暫不升級）
（列表 + 理由）

### Security fixes
（若有 CVE，列出 + 建議）

## 風險摘要
（一段話總結整體健康度和建議優先序）
```

### 驗收條件
- [ ] 產出 `_ct-workorders/reports/T0034-dependency-audit.md`
- [ ] 包含所有 dependencies + devDependencies
- [ ] 每個套件有版本比對和等級分類
- [ ] 🔴 和 🟡 套件有具體風險說明
- [ ] 有明確的升級建議（safe batch / staged / hold）
- [ ] **無任何 code 修改**
- [ ] **無 npm install / npm update**（只查不改）

### 執行注意事項
- **只查不改**：不要跑 `npm update`、`npm install`、或修改 `package.json` / `package-lock.json`
- **不要升級**：本工單只產出報告，實際升級由塔台決策後另派工單
- **npm audit 可選跑**：`npm audit --json` 可以看安全漏洞，結果附在報告中

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- **報告路徑**：`_ct-workorders/reports/T0034-dependency-audit.md`
- **總套件數**：48（dependencies: 23、optionalDependencies: 5、devDependencies: 20）
- 🔴 Critical：5（electron、electron-builder、@anthropic-ai/claude-agent-sdk、vite、whisper-node-addon）
- 🟡 Major：14（含 @xterm/xterm 6.0.0、react 19、typescript 6、uuid 13 等）
- 🟢 Minor/Patch：8（可安全 npm update）
- ⚪ Current：21

**npm audit**：27 漏洞（high: 16、moderate: 7、low: 4）——主要來自 electron 28 的 17 個 CVE

### Git 摘要
- 報告 commit SHA：（尚未 commit，待塔台決定）
- `git status --short`：
  - `?? _ct-workorders/T0034-dependency-audit.md`
  - `?? _ct-workorders/reports/T0034-dependency-audit.md`

### 遭遇問題
無

### 回報時間
2026-04-12 11:18 (UTC+8)
