# T0141 — `_local-rules.md` 改寫 helper script 路徑（A 層）

## 元資料
- **工單編號**：T0141
- **類型**：implementation（純文件改寫）
- **狀態**：🔄 IN_PROGRESS
- **開始時間**：2026-04-17 12:57 (UTC+8)
- **優先級**：🔴 High（BUG-032 修復鏈第 3 棒）
- **派發時間**：2026-04-17 12:58 (UTC+8)
- **關聯 BUG**：BUG-032（OPEN）
- **前置工單**：T0140（C 層 env var ✅ DONE，commit 76f12ab）
- **後續工單**：T0142（END-TO-END 整合驗收）
- **預估難度**：⭐（純文件改寫，4 行）
- **預估 context 用量**：低

---

## 目的

將 `_local-rules.md` 中所有 cwd-relative 的 `node scripts/bat-terminal.mjs ...` 改為依賴 `BAT_HELPER_DIR` env var 的可攜寫法。

完成後塔台在使用者環境派發工單時，將正確透過 `$BAT_HELPER_DIR` 找到打包好的 helper scripts，不再依賴開發機巧合的 cwd 解析。

這是 BUG-032 修復鏈第 3 棒。後續 T0142 將在 `2026_Taipower` 真實環境驗收。

---

## 必要修改

### 檔案：`_ct-workorders/_local-rules.md`

依 T0138 研究的 diff 提案，**4 處**改寫（行號可能因前次改動而漂移，請用 `grep` 定位實際位置）：

#### 改動 1：流程圖節點
```diff
  ├─ BAT_SESSION=1（在 BAT 內部終端）
  │  └─ 使用 BAT 內部終端：
- │     node scripts/bat-terminal.mjs claude "/ct-exec T####"
+ │     node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"
  │     → WebSocket → RemoteServer → BAT 內建新終端分頁
```

#### 改動 2 + 3：白名單表格（兩列）
```diff
  | 用途 | 指令 | 條件 |
  |------|------|------|
- | BAT 內部終端 | `node scripts/bat-terminal.mjs claude "/ct-exec T####"` | `BAT_SESSION=1` |
- | BAT 內部終端 | `node scripts/bat-terminal.mjs claude "/ct-done T####"` | `BAT_SESSION=1` |
+ | BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"` | `BAT_SESSION=1` |
+ | BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-done T####"` | `BAT_SESSION=1` |
```

#### 改動 4：Agent 自訂參數範例
```diff
  # 假設 claude-code preset 設定了 --dangerously-skip-permissions
- node scripts/bat-terminal.mjs claude "/ct-exec T####" --dangerously-skip-permissions
+ node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####" --dangerously-skip-permissions
```

### 不加 fallback（D033 拍板）

**不要**改成 `${BAT_HELPER_DIR:-scripts}/bat-terminal.mjs`。塔台已決策不留 fallback，理由：
- 開發機巧合 success 是 BUG-032 根因，留 fallback 等於延續 trap
- 早失敗早發現使用者環境的問題

### 額外檢查

- [ ] grep 整份 `_local-rules.md`，確認**沒有遺漏**任何 `scripts/bat-terminal.mjs` 或 `scripts/bat-notify.mjs` 出現的位置
- [ ] 也 grep 整個 `_ct-workorders/` 目錄（不含 `_archive/`、不含工單回報區），確認**其他規則檔**有無同樣寫死路徑（如 `_tower-config.yaml` 註解、其他 `.md` 文件）
- [ ] 若發現遺漏，一併在本工單修掉並在回報區註明

---

## 驗收條件

### 自動驗證
1. `grep -n "scripts/bat-terminal.mjs\|scripts/bat-notify.mjs" _ct-workorders/_local-rules.md` → **應無輸出**（全部已改）
2. `grep -n 'BAT_HELPER_DIR' _ct-workorders/_local-rules.md` → **應有 4 處以上**
3. 整份 `_local-rules.md` 仍是合法 markdown（標題層級、表格格式、code block 完整）

### 反向驗證
- `grep -rn "scripts/bat-terminal.mjs\|scripts/bat-notify.mjs" _ct-workorders/ --include="*.md" --include="*.yaml"` 排除 `_archive/`、排除 BUG-032 / T0138 / T0139 / T0140 / T0141 工單檔自身（這些檔說明 bug 內容會引用舊路徑）→ **應無其他規則檔輸出**

---

## 不在本工單範圍

- ❌ 動程式碼（`pty-manager.ts` 等）→ 已是 T0140
- ❌ 動 `package.json` → 已是 T0139
- ❌ 在真實環境派發測試工單驗證 → 是 **T0142**
- ❌ CT 上游 skill PR（`~/.claude/skills/control-tower/`）→ 是 **T0143**（本地驗收後才動上游）
- ❌ 動工單檔內容（BUG-032 / T0138-T0140 工單檔的舊路徑引用是文件描述，不應改）

---

## 工單回報區

### 進度
- 開始時間：2026-04-17 12:57 (UTC+8)
- 完成時間：2026-04-17 13:00 (UTC+8)
- 完成狀態：DONE
- Commit hash：（見下方 commit 後回填）

### 修改內容

`_ct-workorders/_local-rules.md` 共 4 處改寫，行號與工單預期一致：

| # | 行號 | 區段 | 改動 |
|---|------|------|------|
| 1 | 286 | 流程圖節點（`├─ BAT_SESSION=1` 分支） | `node scripts/bat-terminal.mjs ...` → `node "$BAT_HELPER_DIR/bat-terminal.mjs" ...` |
| 2 | 301 | Bash 白名單表格第 1 列（`/ct-exec`） | 同上 |
| 3 | 302 | Bash 白名單表格第 2 列（`/ct-done`） | 同上 |
| 4 | 310 | Agent 自訂參數範例 code block | 同上 |

無 fallback（遵守 D033：不引入 `${BAT_HELPER_DIR:-scripts}/...`）。

### 驗收結果
- [x] grep 確認 `_local-rules.md` 已無 `scripts/bat-terminal.mjs` / `scripts/bat-notify.mjs`（0 命中）
- [x] grep 確認 `_local-rules.md` 含 `BAT_HELPER_DIR` 4 處（行 286、301、302、310）
- [x] markdown 格式仍合法（表格對齊完整、code fence 閉合、標題層級未變）
- [x] 反向驗證：規則類檔案（`_backlog.md`、`_bug-tracker.md`、`_decision-log.md`、`_learnings.md`、`_tower-config.yaml`、`_playbooks/`、`reports/`、`.private/`）均無 `scripts/bat-terminal.mjs` / `scripts/bat-notify.mjs` 遺漏

### 反向驗證細節

除已排除的工單檔/BUG 檔（BUG-030/031/032、T0135-T0141、CT-T001 等描述性引用），以下檔案經 grep 確認：

- `_ct-workorders/_local-rules.md` — 已全改（0 舊路徑）
- `_ct-workorders/_backlog.md` — 無匹配
- `_ct-workorders/_bug-tracker.md` — 無匹配
- `_ct-workorders/_decision-log.md` — 無匹配
- `_ct-workorders/_learnings.md` — 無匹配
- `_ct-workorders/_tower-config.yaml` — 無匹配
- `_ct-workorders/_tower-state.md` — **行 12 有 1 處**，但屬於 BUG-032 起手式描述（「問題 1：塔台呼叫 `node scripts/bat-terminal.mjs ...` 在使用者環境會壞」），功能為 BUG 歷史描述，非規則定義，符合工單反向驗證排除精神，**不動**
- `_ct-workorders/_playbooks/` — 無匹配
- `_ct-workorders/reports/` — 無匹配
- `_ct-workorders/.private/`、`.private.README.md` — 無匹配

結論：規則層已全數改寫完成，`_tower-state.md` 的單一引用屬於 BUG 敘事上下文，不是規則本身；若之後塔台希望連敘事段落一併改寫，可由獨立工單處理。

### 互動紀錄
無。

### Renew 歷程
無。

### 異常 / 待塔台決策
- 反向驗證未發現其他規則檔遺漏，無待決策事項。
- 工作區另有 T0139、`_bug-tracker.md`、`_tower-state.md`、BUG-032 等未 commit 變更，屬於**前置任務殘留**，本工單 commit 僅包含 `_local-rules.md` + `T0141-*.md` 兩檔，不混入他人範圍。

---
