# T0329 — Research BUG-075 Root Cause（shell pref 失效 + MSYS path rewrite 雙 regression）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0329 |
| 類型 | research（root cause 偵察 + git log diff + reproduce isolation） |
| 所屬 | BUG-075 — BAT terminal shell pref + MSYS path rewrite regression |
| 狀態 | 📋 PENDING（待派發） |
| 建立時間 | 2026-04-27 13:05 (UTC+8) |
| 派發時間 | （待塔台派發；下個 session 起手） |
| Sizing | M（estimate 30-60 min wall；3 phase 偵察 + reproduce + candidate fix 提案） |
| 依賴 | BUG-075 / BUG-060 closed 工單（T0281 fix `fad2978`）/ `scripts/bat-terminal.mjs` 現況 |
| 後續 | 拍板後拆 1-2 張 fix 工單（symptom A / symptom B 或合併） + 1 張 regression test 工單 |
| 互動旗標 | `--mode ask --interactive`（允許 Worker 在 hypothesis 收斂時提問澄清） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取 + git log） |
| `affects_files` | `_ct-workorders/T0329-*.md`（自身回報區） + 可能更新 `BUG-075-*.md`（補根因確認） |

## 背景

BUG-060 (`fad2978`, T0281, 2026-04-26 13:20) 修復 YOLO 鏈式派發 shell preference 失效。22 小時後 (2026-04-27 13:00) 再現同族症狀**外加** MSYS path rewrite 第二症狀，塔台派發 T0328 完全斷鏈。

兩症狀觀察：

| 症狀 | 描述 |
|------|------|
| **A** shell pref 失效 | 「default 終端沒照設定用 git bash」（user 報告） |
| **B** MSYS rewrite | `/ct-exec T0328` 在 codex agent 內變成 `C:/Program Files/Git/ct-exec T0328`，被當 binary 拒絕執行 |

## 研究目標

回答以下 4 個核心問題：

1. **症狀 A 與 B 是否同根因？** 還是兩個獨立 regression（A 是 BUG-060 fix 回滾 / B 是新引入的 MSYS path 處理問題）？
2. **症狀 A 根因？** BUG-060 fix `fad2978` 是否還在？被覆蓋還是被條件 short-circuit？
3. **症狀 B 根因？** `/ct-exec T0328` 在哪一層被 path-rewrite？bat-terminal.mjs / electron child spawn / agent CLI / Git Bash MSYS conversion?
4. **Candidate fix 提案？** 對 A 和 B 各給 1-2 個 candidate fix，含 regression test 設計

## 範圍（3 Phase + 1 收斂）

### Phase A：Git log 偵察

**A.1 Commit history 比對**

```bash
# T0281 fix commit 之後到 HEAD 的所有 commits
git log fad2978..HEAD --oneline -- scripts/bat-terminal.mjs electron/pty-manager.ts electron/terminal-*.ts src/components/Terminal/*

# 候選 regression commit 篩選
git log fad2978..HEAD --grep="terminal\|shell\|spawn\|msys\|path" --oneline
```

**紀錄項**：
- 影響 `bat-terminal.mjs` / terminal spawn / shell preference resolution 的 commits
- 影響 path / env / MSYS handling 的 commits
- 任何看似「重構 terminal 模組」的 commits（高風險）

**A.2 BUG-060 fix 落點驗證**

讀取 `fad2978` 的 commit diff：

```bash
git show fad2978
```

**確認**：
- T0281 修在哪個檔案 / 哪個函式
- 修改邏輯是什麼（如 `resolveShellPreference()` 補了 fallback）
- 該邏輯目前在 main 還在嗎？被改過嗎？

### Phase B：Reproduce isolation

**B.1 症狀 A 獨立復現**

關掉 BAT，重啟，第一張派發測試：

```bash
node scripts/bat-terminal.mjs --notify-id <id> --workspace <id> --mode ask --interactive --agent default --prompt "/ct-exec T0001"
```

觀察：
- 開啟的終端 shell 是 git bash 還是 PowerShell？
- 與 BAT Settings 中的 default shell 是否一致？

若**第一張就錯** = BUG-060 fix 已失效（H1 證實）
若**第一張對、第二張錯** = L103 fallback bug 重新引入（H2 候選）
若**全程都對但 prompt rewrite 錯** = 純症狀 B，A 是誤判

**B.2 症狀 B 獨立復現**

在 git bash 直接打：

```bash
echo "/ct-exec T0328"  # 看是否被 rewrite
node -e "console.log(process.argv)" /ct-exec T0328  # node 接到的 argv 是什麼
```

確認 path rewrite 發生在哪一層（shell 環境 / node spawn / electron IPC / agent CLI 內部）。

**B.3 環境變數調查**

檢查：
- `MSYS_NO_PATHCONV` 在 BAT 開的終端中有設嗎？
- BAT spawn child terminal 時傳了什麼 env？
- agent CLI（codex）對 `/...` 開頭的 prompt 有特殊處理嗎？

### Phase C：Hypothesis 評分

針對 BUG-075 列的 6 個候選 H，每個給：

| H | 描述 | 證據（支持） | 證據（反對） | 信心度 (0-1) |
|---|------|-------------|-------------|-------------|
| H1 | BUG-060 fix `fad2978` 回滾 | （Phase A.2 結論） | | |
| H2 | 新 commit 引入 regression | （Phase A.1 結論） | | |
| H3 | shell pref store 損壞 | | | |
| H4 | bat-terminal.mjs 沒做 MSYS_NO_PATHCONV | （Phase B.3 結論） | | |
| H5 | codex agent 自身 path 處理 bug | | | |
| H6 | terminal env 沒設 MSYS_NO_PATHCONV=1 | | | |

收斂為**最高信心 H 組合**（可能 1+ 個 H 同時成立）。

### Phase D：Candidate fix 提案

針對收斂後的 H 組合，給 candidate fix：

**對症狀 A**（shell pref 失效）：
- Fix-A1：（依根因設計）
- Regression test：BAT spawn 後第一張 + 第二張 + 第三張 shell preference 一致性 e2e

**對症狀 B**（MSYS path rewrite）：
- Fix-B1：bat-terminal.mjs spawn 時設 `env.MSYS_NO_PATHCONV='1'`（如果是 H6）
- Fix-B2：spawn child terminal 時 prompt 用 base64 / heredoc 包覆避免 shell 解析
- Regression test：模擬 git bash 環境跑 `/ct-exec T0001`，驗證 prompt 不被 mangle

## 拍板項（給塔台）

回報區「拍板項」段落列出**至少 3 項**：

- D候選：症狀 A 與 B 是否合併修（一張 fix 工單）還是分開（兩張）
- D候選：regression test 範圍（unit / integration / e2e）
- D候選：fix 是否獨立 hotfix release（v0.4.2.1）還是併入 v0.4.3 PLAN-032 release

## 驗收條件

回報區必含：

- ✅ Phase A：commit history 比對表 + BUG-060 fix 落點現況
- ✅ Phase B：症狀 A / B 獨立復現結果（含實際 stdout 引用）
- ✅ Phase C：6 H 評分表 + 收斂結論
- ✅ Phase D：對症狀 A / B 各給 ≥1 candidate fix + regression test 設計
- ✅ 拍板項列表（≥3 項）

## 互動模式

`--mode ask --interactive`，最多 3 輪。Worker 在以下情境**應**詢問塔台：

- Reproduce 過程中發現第三個症狀（不在 A/B 範圍）
- 6 H 全部低信心（<0.3），需新 H 候選
- Fix 跨多個子系統（terminal manager / settings store / agent CLI 對接）需大手術

## 參考資料

- BUG-075: `_ct-workorders/BUG-075-bat-terminal-shell-pref-and-msys-path-rewrite-regression.md`
- BUG-060 (CLOSED): `_ct-workorders/BUG-060-yolo-dispatch-shell-preference-not-applied.md`
- T0281 fix commit: `fad2978`
- L103: `_ct-workorders/_learnings.md` § L103 — BAT 內部終端 yolo 派發 shell preference 第二張起 fallback bug 模式
- 派發 script: `scripts/bat-terminal.mjs`

---

## 回報區（Worker 填）

### 完成摘要
（Worker 填）

### Phase A：Git log 偵察
（Worker 填）

### Phase B：Reproduce isolation
（Worker 填）

### Phase C：Hypothesis 評分
（Worker 填）

### Phase D：Candidate fix 提案
（Worker 填）

### 拍板項
（Worker 填）

### 互動紀錄
（Worker 填）

### OOS but justified（如有）
（Worker 填）

---

**狀態**：📋 PENDING
