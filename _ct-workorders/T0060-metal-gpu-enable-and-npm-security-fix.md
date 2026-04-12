# 工單 T0060-metal-gpu-enable-and-npm-security-fix

## 元資料
- **工單編號**：T0060
- **任務名稱**：macOS Metal GPU 啟用 + npm 短期安全修復
- **狀態**：DONE
- **建立時間**：2026-04-12 20:11 (UTC+8)
- **開始時間**：2026-04-12 20:14 (UTC+8)
- **完成時間**：2026-04-12 20:18 (UTC+8)

## 工作量預估
- **預估規模**：小-中（1 行 code + npm 升級 + overrides）
- **Context Window 風險**：低

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### 背景

T0058 發現 macOS Metal 已在 prebuilt binary 但被 `use_gpu: false` 關閉。
T0059 確認 27 個 npm 漏洞中有 ~12 個可低風險修復。

本工單合併兩項：Part 1 啟用 Metal，Part 2 短期安全修復。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）
- T0058 回報區（GPU 分析）
- T0059 回報區（npm audit 分析）

---

### Part 1：啟用 macOS Metal GPU（1 行改動）

**修改檔案**：`electron/voice-handler.ts`

找到 `use_gpu: false`（約第 330 行），改為：

```ts
use_gpu: process.platform === 'darwin',  // macOS prebuilt 已含 Metal；Win/Linux 無 GPU lib 會自動 fallback CPU
```

**Commit**：
```
feat(voice): enable Metal GPU acceleration on macOS for Whisper inference
```

---

### Part 2：npm 短期安全修復

依 T0059 推薦的 Step 1-3，按順序執行：

#### Step 1：升級 claude-agent-sdk（修 2 moderate）
```bash
npm install @anthropic-ai/claude-agent-sdk@latest
```
確認 `@anthropic-ai/sdk` 升到 >=0.81.0。

#### Step 2：添加 overrides（修 ~6 transitive high/moderate）

在 `package.json` 的 `overrides` 區塊添加（合併到既有 overrides，不覆寫）：
```json
"hono": ">=4.12.12",
"@hono/node-server": ">=1.19.13",
"lodash-es": ">=4.18.1",
"langium": ">=4.2.2"
```

然後：
```bash
npm install
```

#### Step 3：升級 mermaid（可能修 chevrotain 鏈）
```bash
npm install mermaid@latest
```

#### 驗證
```bash
npm audit
npx vite build
```

確認：
- 漏洞數從 27 降低
- build 通過
- 無功能回歸

**Commit**：
```
fix(deps): upgrade claude-agent-sdk and add overrides for security vulnerabilities
```

---

### 預期產出
- 2 個 atomic commit（Metal + npm security）
- 修改：`electron/voice-handler.ts`、`package.json`、`package-lock.json`

### 驗收條件
- [x] `use_gpu` 改為 platform 判斷
- [x] `npm audit` 漏洞數明顯下降（目標：從 27 降到 ~15 以下）→ 實際降至 14
- [x] `npx vite build` 通過
- [x] 語音辨識功能仍正常（邏輯不變，Win/Linux 仍 false → CPU fallback）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
**Commit 1（Metal GPU）**：`3985007`
- `electron/voice-handler.ts` line 434：`use_gpu: false` → `use_gpu: process.platform === 'darwin'`

**Commit 2（npm security）**：`f63761c`
- 升級 `@anthropic-ai/claude-agent-sdk@0.2.104`（帶入 `@anthropic-ai/sdk@0.81.0`）
- `package.json` overrides 添加：`hono >=4.12.12`、`@hono/node-server >=1.19.13`、`lodash-es >=4.18.1`、`langium >=4.2.2`
- 升級 `mermaid@11.14.0`
- 執行 `npm audit fix`（非 breaking）

### npm audit 結果
| | 修復前 | 修復後 |
|---|--------|--------|
| Total | 27 | **14** |
| High | 16 | **8** |
| Moderate | 7 | **2** |
| Low | 4 | 4 |

降低 48%，超越目標（~15 以下）。殘餘 14 = Electron 本身（需 Phase 2 升版）+ whisper-node-addon build chain（cmake-js/tar，dev-only）。

### 遭遇問題
無。`npm audit fix --force` 跳過（會破壞 electron-builder），僅用非 breaking 路徑。

### 回報時間
2026-04-12 20:18 (UTC+8)
