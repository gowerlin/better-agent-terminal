# 工單 T0022-prep-gitignore-refinement-and-audit

## 元資料
- **編號**：T0022-prep
- **類型**：Infra Chore（gitignore refinement + audit + pre-commit hook）
- **狀態**：DONE
- **優先級**：🔴 高（阻塞 T0022 和未來所有 chore(tower) commit）
- **建立時間**：2026-04-11 16:55 (UTC+8)
- **開始時間**：2026-04-11 17:01 (UTC+8)
- **完成時間**：2026-04-11 17:11 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0021（已 DONE）
- **後續工單**：T0022（阻塞中，本工單完成後解除）
- **目標子專案**：（單一專案）

## 工作量預估
- **Session 建議**：🆕 新 session（乾淨 context，純 infra 工作）
- **預估時間**：30-60 分鐘
- **複雜度**：低-中（純檔案操作 + 稽核 + 簡單 bash hook）

## Session 建議
新 session 執行。本工單不涉及 npm install 或大型依賴，應該能在 BAT 終端順利執行（若要觀察 BAT 相容性留到 T0022）。

## 背景

### 問題源頭
T0021 sub-session 在執行 `chore(tower)` commit 時發現：
```
.gitignore:21  _ct-workorders/
```
整個塔台目錄被 `.gitignore` 排除，需要 `git add -f` 強制加入才能 commit。這個規則與 **L014（塔台 state 檔案構成原子 commit 群組）** 直接衝突，並造成三個結構性問題：

1. ❌ **L014 失效**：未來所有 `chore(tower)` commit 都踩同樣陷阱
2. ❌ **跨機器同步失效**：拉 repo 到另一台機器拿不到工單和塔台狀態
3. ❌ **Sub-session 盲點**：工單模板沒提醒 `-f`，sub-session 容易迷失

### 策略決定（塔台 + 使用者對齊後）
採用 **「預設公開、明確保密」** 的細化規則：
- 塔台目錄整體進 repo（類別 1：工程日誌有 open source 價值）
- 明確排除敏感內容子目錄和後綴（類別 2：研究草稿 / 私人內容 / 敏感資料）
- 加一層輕量 pre-commit hook 做關鍵字 WARN（不 block）

### 為什麼不用其他方案
- **獨立 Forgejo private repo**：成本過高、workflow 複雜、跨網路受限
- **保留現狀 + workaround**：技術債累積，L014 永久有特例
- **本地外 sync**：失去 git 原生歷史和 atomic commit 能力

完整決策過程見 `_tower-state.md` 的 16:40 checkpoint。

## 任務指令

### BMad 工作流程
不適用（infra chore）

### 前置條件
1. ✅ T0021 已完成
2. ✅ 當前未 commit 的 `_ct-workorders/T0021-...md`（sub-session 填的回報區）可以先放著不動，本工單會一起處理
3. ✅ 分支：`main`

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前 `.gitignore:21`**：`_ct-workorders/`（需要改）
- **`_ct-workorders/reports/`**：存在且已有內容（bat-agent-orchestration-research.md 等）
- **塔台目錄內容**：T*.md、_tower-state.md、_learnings.md、_tower-config.yaml、BUG-*.md、reports/

### 任務目標

#### Goal 1：稽核 `_ct-workorders/` 內容（產出稽核報告，不動檔案）

寫入 `_ct-workorders/reports/tower-dir-audit-2026-04-11.md`（注意：`reports/` 會被新 .gitignore 排除，所以稽核報告本身不進 repo，保留本地）。

**稽核檢查項目**（對 `_ct-workorders/` 內所有檔案做 grep，排除 `reports/`）：
1. **密碼 / Token / Secret**：正規表達式關鍵字
   - `password[ =:]`、`passwd[ =:]`
   - `api[_-]?key[ =:]`
   - `token[ =:]`
   - `secret[ =:]`
   - `bearer\s+[a-zA-Z0-9]`
2. **本機絕對路徑**（可能含使用者名稱）
   - `C:\\Users\\`、`C:/Users/`
   - `/Users/[^/]+/`（macOS 形式）
   - `/home/[^/]+/`（Linux 形式）
3. **IP 地址與主機資訊**
   - `192\.168\.\d+\.\d+`
   - `10\.\d+\.\d+\.\d+`
   - `localhost:\d+`（若出現在非文件段落）
4. **Email 地址**
   - `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`
5. **SSH Key 片段**
   - `-----BEGIN`、`ssh-rsa AAAA`、`ssh-ed25519 AAAA`

**稽核報告格式**：
```markdown
# Tower Directory Audit Report
日期：2026-04-11
範圍：_ct-workorders/（排除 reports/）
執行者：Sub-session T0022-prep

## 掃描結果

### 1. 密碼 / Token / Secret
- 命中數：N
- 位置：<file>:<line>
- 判斷：<FALSE_POSITIVE / REAL_CONCERN>
- 建議：<無需動作 / 移至 .private/ / 手動遮罩>

### 2. 本機路徑
（同上結構）

### 3. IP 與主機
（同上結構）

### 4. Email
（同上結構）

### 5. SSH Key
（同上結構）

## 總結
- 整體狀態：<CLEAN / HAS_FINDINGS / NEEDS_REVIEW>
- 可以進 Step 2（改 .gitignore）：<YES / NO>
- 若 NO，原因與建議：<...>
```

**重要**：本 sub-session **不自動移動或修改任何檔案**。稽核只是產出報告，最終處理由使用者決定。若報告顯示 `CLEAN` 或僅 `FALSE_POSITIVE`，則直接進 Step 2。若有 `REAL_CONCERN`，則 STOP 並回報塔台。

#### Goal 2：改 `.gitignore`（細化規則）

**舊規則**（要移除或修改）：
```gitignore
_ct-workorders/
```

**新規則**（取代舊規則）：
```gitignore
# 塔台目錄：預設公開工程日誌 + 明確排除敏感內容
_ct-workorders/reports/
_ct-workorders/.private/
_ct-workorders/*.draft.md
```

**要求**：
- 保留 `.gitignore` 其他規則不變
- 新規則加註解說明策略意圖
- 不要改動其他排除規則（`node_modules/`、`dist/`、`release/` 等）

#### Goal 3：建立 `_ct-workorders/.private/` 目錄

- 新建 `_ct-workorders/.private/.gitkeep`（雖然整個 `.private/` 被 .gitignore 排除，但為了讓 sub-session 和使用者知道有這個目錄的存在，建議至少有一個說明檔）
- 等等，既然 `.private/` 被 gitignore 完全排除，`.gitkeep` 也進不了 repo
- **替代方案**：在 `_ct-workorders/` 下建立 `.private.README.md`（這個檔案可進 repo），內容為：
  ```markdown
  # .private/ 目錄說明

  此目錄用於存放**不應進入 git repo 的塔台敏感內容**。

  ## 使用時機
  - 存放使用者個人思考草稿
  - 敏感資料（客戶資訊、內部基礎設施等）
  - 未經整理的討論記錄

  ## Git 狀態
  `.private/` 整個目錄被 `.gitignore` 排除（見 `.gitignore` 塔台目錄規則）。

  ## 如何使用
  1. 建立 `_ct-workorders/.private/` 目錄
  2. 將任何敏感內容放入此目錄
  3. Git 不會追蹤此目錄內任何檔案

  ## 跨機器同步
  由於 `.private/` 不進 repo，跨機器時需另行同步（例如手動 copy 或使用 Syncthing）。
  ```
- 同理處理 `reports/`：若 `reports/.README.md` 不存在，建立一個說明檔（可進 repo）

#### Goal 4：建立簡單 pre-commit hook

**位置**：`scripts/hooks/pre-commit`（repo 內，會進 commit）
**安裝方式**：一次性 `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

**Hook 內容規格**（純 bash，Windows Git Bash 可跑）：
1. 取得 `git diff --cached --name-only` 列出 staged files
2. Filter 出 `_ct-workorders/` 下的檔案（排除 `reports/` 和 `.private/`）
3. 對這些檔案 grep 以下關鍵字（case-insensitive）：
   - `password[ =:]`
   - `api[_-]?key[ =:]`
   - `bearer\s+[a-zA-Z0-9]{10,}`
   - `-----BEGIN (RSA |OPENSSH )?PRIVATE KEY`
4. 若命中：
   - `echo` 警告訊息，列出檔案和行號
   - **exit 0**（不 block）
   - 讓使用者自行決定是否放行
5. 若無命中：靜默通過（exit 0）

**簡化版腳本參考**（sub-session 可調整）：
```bash
#!/bin/bash
# Tower directory pre-commit WARN hook
# 檢查 _ct-workorders/ 新增內容是否含敏感關鍵字
# 發現時 WARN 不 block

staged=$(git diff --cached --name-only | grep '^_ct-workorders/' | grep -v '^_ct-workorders/reports/' | grep -v '^_ct-workorders/\.private/')

if [ -z "$staged" ]; then
  exit 0
fi

warnings=0
for f in $staged; do
  if [ -f "$f" ]; then
    hits=$(grep -nEi '(password[ =:]|api[_-]?key[ =:]|bearer [a-zA-Z0-9]{10,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY)' "$f")
    if [ -n "$hits" ]; then
      echo "⚠️  [tower-hook] 可能的敏感內容於 $f:"
      echo "$hits"
      warnings=$((warnings + 1))
    fi
  fi
done

if [ $warnings -gt 0 ]; then
  echo ""
  echo "⚠️  [tower-hook] 共發現 $warnings 個檔案可能含敏感內容"
  echo "⚠️  [tower-hook] 本 hook 不會阻擋 commit,請使用者自行確認"
  echo "⚠️  [tower-hook] 若確認無問題,請繼續 commit"
fi

exit 0
```

**驗證 hook 運作**：
1. 安裝 hook 到 `.git/hooks/pre-commit`
2. 建立暫存測試檔：`echo 'password=test123' > _ct-workorders/.test-hook.md`
3. `git add _ct-workorders/.test-hook.md`
4. `git commit -m "test: hook trigger"` — 觀察 WARN 輸出
5. `git reset HEAD` + 刪除測試檔（不要留測試 commit）

#### Goal 5：記錄 L016 到 `_learnings.md`

在 L014 之後、「## 記錄格式模板」之前插入 L016：

```markdown
## L016 - 2026-04-11 — 塔台目錄 git 管理:「預設公開、明確保密」細化策略

**觸發條件**:新專案啟動塔台時,決定 `_ct-workorders/` 是否進 git repo

**反模式 A**:`_ct-workorders/` 整個進 .gitignore
- 問題:L014 失效、跨機器同步失效、chore(tower) commit 要 `git add -f`

**反模式 B**:整個目錄直接進 repo,無任何過濾
- 問題:研究草稿 / 個人思考 / 敏感資料外洩風險

**推薦模式**:「預設公開、明確保密」細化規則
1. 塔台目錄整體進 repo(類別 1:工程日誌,對 open source 有價值)
2. 排除 `_ct-workorders/reports/`(類別 2:研究草稿)
3. 排除 `_ct-workorders/.private/`(類別 2:敏感內容專用)
4. 排除 `_ct-workorders/*.draft.md`(類別 2:草稿後綴)
5. 簡單 pre-commit hook WARN 檢查密碼 / API key / SSH key(不 block)

**為什麼**:
- 類別 1(_tower-state、_learnings、T*.md)是工程資產,對未來維護者和社群有價值
- 類別 2 有專門目錄/後綴/hook 保護
- L014 自然運作,不需 `-f` workaround
- 跨機器同步透過 git pull 自然接手

**套用時機**:
1. 每個新專案啟動塔台,第一個工單就建立細化的 .gitignore
2. 若發現專案已啟動塔台但 .gitignore 排除整個塔台目錄,立即開 prep 工單修正

**數據點**:
- 本專案 T0021 暴露 `.gitignore:21` 排除 `_ct-workorders/` 的陷阱
- T0022-prep 實作細化規則,解決 L014 衝突
- 跨機器 continuity 是 global 晉升機制的核心設計意圖

**候選晉升**:🔴 candidate: global(跨專案強烈推薦)

---

```

### 執行步驟

1. **環境確認**
   - `cd` 到專案根目錄
   - `git status` — 預期看到未 commit 的 T0021 回報區更新
   - `git log --oneline -3` 確認 T0021 的兩個 commits 還在（`f75b1c8` + `7bc856e`）

2. **Goal 1：稽核**
   - 建立 `_ct-workorders/reports/tower-dir-audit-2026-04-11.md`
   - 按規格執行 grep 掃描
   - 填寫報告
   - 若命中需要人工判斷 → **STOP 並回報塔台**
   - 若 CLEAN 或 FALSE_POSITIVE only → 繼續

3. **Goal 2：改 .gitignore**
   - 用 Edit 工具精準替換 `_ct-workorders/` 為細化規則
   - 加註解

4. **Goal 3：建立說明檔**
   - 建立 `_ct-workorders/.private.README.md`
   - 建立 `_ct-workorders/reports/.README.md`（若不存在）

5. **Goal 4：建立 pre-commit hook**
   - 建立 `scripts/hooks/pre-commit`
   - 執行一次性安裝：`cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
   - 執行驗證流程（建立測試檔 → commit 觀察 WARN → reset）

6. **Goal 5：記錄 L016**
   - 用 Edit 插入 L016 到 `_learnings.md`

7. **產生 2 個 atomic commits**
   - **Commit 1**：`chore(infra): refine tower directory gitignore + pre-commit hook`
     - `.gitignore`
     - `scripts/hooks/pre-commit`
     - `_ct-workorders/.private.README.md`
     - `_ct-workorders/reports/.README.md`（若新增）

   - **Commit 2**：`chore(tower): record L016 + close T0021 handover + dispatch T0022-prep`
     - `_ct-workorders/_learnings.md`（L016）
     - `_ct-workorders/_tower-state.md`（16:xx checkpoint）
     - `_ct-workorders/T0021-commit-bug006-hotfix-and-tower-state.md`（sub-session 回報區）
     - `_ct-workorders/T0022-prep-gitignore-refinement-and-audit.md`（本工單）

   **注意**：稽核報告在 `reports/` 內被新 .gitignore 排除，**不要** `git add` 它。保留本地供使用者檢視。

   **驗證**：Commit 2 不再需要 `git add -f`（這本身是驗證細化規則成功的指標）

8. **最終驗證**
   - `git status` — working tree clean（除了 reports/ 內的稽核報告）
   - `git log --oneline -5` — 看到 4 個塔台相關 commits
   - `git check-ignore _ct-workorders/_tower-state.md` — 應該**無輸出**（表示不再被 ignore）
   - `git check-ignore _ct-workorders/reports/tower-dir-audit-2026-04-11.md` — 應該**有輸出**（表示仍被 ignore）
   - `git check-ignore _ct-workorders/.private/test.md` — 應該**有輸出**

### 不動範圍
- ❌ 不實作 T0022（Playwright infra）
- ❌ 不 push 到 origin
- ❌ 不動 `_ct-workorders/reports/` 內的現有檔案
- ❌ 不做 `git rebase` / `git filter-branch` / 任何歷史重寫
- ❌ 不引入 Husky / lint-staged / 任何 npm pre-commit framework
- ❌ 不改任何程式原始碼（`src/`）
- ❌ 不讓 pre-commit hook 變成 BLOCK（只 WARN）
- ❌ 不動 `package.json`（hook 用獨立 install 方式）

### 驗收條件
1. ✅ 稽核報告存在於 `_ct-workorders/reports/tower-dir-audit-2026-04-11.md` 並填寫完整
2. ✅ `.gitignore` 細化規則正確（`reports/`、`.private/`、`*.draft.md` 被排除，主要塔台檔案未被排除）
3. ✅ `scripts/hooks/pre-commit` 存在且可執行
4. ✅ Pre-commit hook 在驗證流程中成功觸發 WARN（但不 block）
5. ✅ `_ct-workorders/.private.README.md` 存在
6. ✅ `_learnings.md` 新增 L016
7. ✅ 兩個 atomic commits 產生（順序：`chore(infra)` → `chore(tower)`）
8. ✅ Commit 2 **不需要** `git add -f`（驗證細化規則成功）
9. ✅ `git check-ignore` 驗證通過
10. ✅ Working tree 最終 clean（除稽核報告在 reports/ 內）

### 失敗處理

STOP 並回報塔台的情境：
1. 🛑 稽核發現 `REAL_CONCERN`（需要人工決策敏感內容處理方式）
2. 🛑 Pre-commit hook 無法觸發 WARN（bash 語法問題或 Windows Git Bash 相容性問題）
3. 🛑 Commit 2 仍需要 `git add -f`（細化規則未生效）
4. 🛑 其他未預期錯誤

## Sub-session 執行指示

### 學習鉤子
若遇到以下情況，記錄到「學習鉤子候選」：
- Windows Git Bash 執行 bash hook 的編碼或換行符問題
- `git check-ignore` 的 exit code 與輸出的實際意義混淆
- `.gitignore` 規則中 `*.draft.md` 與目錄規則的互動
- Pre-commit hook 無法讀取 staged content（LF/CRLF 差異）

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 稽核結果：HAS_FINDINGS（全為 FALSE_POSITIVE，無 REAL_CONCERN）
- 新增 / 修改檔案清單：
  - `.gitignore`
  - `scripts/hooks/pre-commit`
  - `_ct-workorders/.private.README.md`
  - `_ct-workorders/reports/.README.md`
  - `_ct-workorders/_learnings.md`（新增 L016）
  - `_ct-workorders/_tower-state.md`（新增 17:11 checkpoint）
  - `_ct-workorders/T0022-prep-gitignore-refinement-and-audit.md`（本工單回報）
  - `_ct-workorders/T0021-commit-bug006-hotfix-and-tower-state.md`（承接前次待提交變更）
- Commit 1 hash + message：`2ff0606 chore(infra): refine tower directory gitignore + pre-commit hook`
- Commit 2 hash + message：<待本次 chore(tower) commit 產生>

### 稽核報告摘要
共命中 29 筆（密碼/Token 3、本機路徑 17、IP/主機 3、Email 3、SSH Key 3），皆為規格文字、路徑/版本字串或公開 noreply 信箱等可解釋內容，判定為 FALSE_POSITIVE。未發現憑證、私鑰片段或需要即刻隔離的 REAL_CONCERN，因此可以進入 `.gitignore` 細化步驟。

### Pre-commit hook 驗證結果
```
[tower-hook][WARN] potential sensitive content in _ct-workorders/.test-hook.md:
1:password=test123
[tower-hook][WARN] found 1 file(s) with potential sensitive content
[tower-hook][WARN] this hook does NOT block commit; please review manually
```

### `git check-ignore` 驗證結果
```
git check-ignore _ct-workorders/_tower-state.md                → <no output>
git check-ignore _ct-workorders/reports/tower-dir-audit-2026-04-11.md → _ct-workorders/reports/tower-dir-audit-2026-04-11.md
git check-ignore _ct-workorders/.private/test.md               → _ct-workorders/.private/test.md
git check-ignore _ct-workorders/test.draft.md                  → _ct-workorders/test.draft.md
```

### 互動紀錄
無

### 遭遇問題
- 首版規則使用 `_ct-workorders/reports/` + `!_ct-workorders/reports/.README.md` 時，Git 仍視為 ignored；後續改為 `_ct-workorders/reports/*` + 例外規則後正常。

### 學習鉤子候選
- `.gitignore` 若直接忽略整個目錄，單純 `!子檔案` 可能無法生效；需改用「忽略目錄內容 `dir/*` + 例外檔案」模式。
- `git check-ignore` 對「未被忽略」情境是無輸出（非錯誤），回報格式應明確標示 `<no output>` 以免誤判。

### sprint-status.yaml 已更新
不適用（專案無 sprint-status.yaml）

### 回報時間
2026-04-11 17:11 (UTC+8)
