# T0240 — 實作:EXP-GPUWHIS-001 T-D Squash merge 合入主線 + worktree 清理

## 元資料

- **編號**:T0240
- **類型**:impl(git 操作 + 主線驗證)
- **狀態**:✅ DONE
- **開始時間**:2026-04-23 02:30 (UTC+8)
- **完成時間**:2026-04-23 02:34 (UTC+8)
- **派發模式**:`--mode on --interactive`(Worker 可問 Build/測試環境 / commit 訊息細節)
- **優先級**:🟡 Medium
- **Sizing**:S(30-60 min,git 操作為主 + build 驗證)
- **建立時間**:2026-04-23 02:40 (UTC+8)
- **前置條件**:
  - T0237 ✅ DONE(T-A)
  - T0238 ✅ DONE(T-B)
  - T0239 ✅ DONE(T-C)
  - D077 ✅(Option 1 + Squash + 刪除 worktree 決策)
- **關聯**:
  - EXP-GPUWHIS-001 🧪 EXPLORING → 📊 CONCLUDED(本工單完成後)
  - PLAN-004 🔄 IN_PROGRESS(Phase 1 完成後可進一步評估 Phase 2)
  - `_ct-workorders/_spec-gpu-whisper-2026-04.md` §7 T-D
- **互動限制**:每次提問上限 3 個;可詢問 build 細節 / commit 訊息格式
- **預估時間**:30-60 分鐘
- **Renew 次數**:0

---

## Scope

將 `exp/gpu-vulkan-poc` worktree 上的 3 個 PoC commits **squash merge** 回主線 `main`,commit 一個 feature commit,驗證主線可建置,最後刪除 worktree + branch。

**涉及 commits**(來自 worktree,不合併後保留歷史)：
- `bd27732` [T0237 PoC Vulkan] swap whisper-node-addon → @kutalia/whisper-node-addon@1.1.0
- `2080880` [T0238 T-B] electron-builder: add @kutalia/whisper-node-addon to asarUnpack
- `eba79b1` feat(voice): runtime GPU detection + CPU fallback strategy [T0239 T-C]

---

## 執行步驟

### Step 1:預先檢查

```bash
# 確認 main 乾淨
git status
# 確認在 main
git branch --show-current
# 確認 worktree 存在且 branch 有 3 個 commits
git worktree list
git log --oneline main..exp/gpu-vulkan-poc
```

### Step 2:Squash merge

```bash
git merge --squash exp/gpu-vulkan-poc
# 驗證 staging 狀態(所有 T-A/B/C 改動應在 index)
git status
git diff --cached --stat
```

### Step 3:Commit feature 訊息

commit 訊息建議格式(Worker 可調整,保留核心元素):

```
feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)

透過 @kutalia/whisper-node-addon 1.1.0 引入 Vulkan GPU 加速,
跨 Windows/Linux 零環境配置,有 GPU 走 Vulkan、無 GPU 走 CPU,
舊 Pascal 世代 GPU(如 GTX 1050 Ti)可透過 Settings force-cpu 覆蓋。

整合涵蓋:
- 套件替換:whisper-node-addon → @kutalia/whisper-node-addon@1.1.0
- electron-builder:asarUnpack 補 @kutalia/whisper-node-addon
- Runtime detection:electron/gpu-detector.ts(vulkan loader 靜態探測)
- UI:VoiceSettingsSection「GPU 加速」section(狀態顯示 + auto/force-cpu radio)
- Unit tests:tests/gpu-detector.test.ts(13/13)

硬體建議:RTX 30/40 系列或同等 fp16/matrix-core GPU 可得顯著加速;
Pascal 世代 GPU 建議走 CPU 模式(Settings override)。

追溯:
- EXP-GPUWHIS-001 (vulkan-first-integration)
- T0236 研究 (f6a2720)
- T0237 T-A PoC (worktree bd27732)
- T0238 T-B packaging (worktree 2080880)
- T0239 T-C detection (worktree eba79b1)
- Decisions: D075 Vulkan-first / D076 硬體瓶頸接受 / D077 Squash merge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### Step 4:主線 build 驗證

```bash
# 必做:TypeScript + Vite build
npx tsc --noEmit
npx vite build

# 推薦:跑 gpu-detector 單元測試
npx tsx tests/gpu-detector.test.ts

# 可選(視 Worker 環境):npm run dev smoke
```

**若 build / test 失敗 → Renew**(保留 main 的 squash commit 不 amend,另開 hotfix 工單)。

### Step 5:刪除 worktree + branch

```bash
# 從 main branch 操作
git worktree remove ../bat-gpu-vulkan-poc
git branch -D exp/gpu-vulkan-poc

# 驗證清理完成
git worktree list
git branch --list exp/*
```

### Step 6:更新 EXP-GPUWHIS-001 狀態

手動編輯 `_ct-workorders/EXP-GPUWHIS-001-vulkan-first-integration.md`:
- 狀態 🧪 EXPLORING → 📊 CONCLUDED
- 補填「最終結論」段(Phase 1 完成摘要 + main commit hash)
- 補填 T-D 產出段

### Step 7:提交 metadata + EXP 狀態 commit

```bash
git add _ct-workorders/EXP-GPUWHIS-001-vulkan-first-integration.md \
        _ct-workorders/T0240-impl-expgpuwhis001-td-squash-merge-main-cleanup.md
git commit -m "chore(ct): T0240 DONE — EXP-GPUWHIS-001 Phase 1 CONCLUDED"
```

---

## 成功判準(**5 項全部達成**)

1. **main 增加 1 個 feature commit**(訊息含 `feat(voice): GPU acceleration via Vulkan`)
2. **Build 通過**:`npx tsc --noEmit` + `npx vite build` 皆 exit 0
3. **gpu-detector 測試通過**:13/13
4. **Worktree + branch 皆刪除**:`git worktree list` / `git branch --list exp/*` 無殘留
5. **EXP-GPUWHIS-001 狀態 CONCLUDED**:檔案更新 + 最終結論填寫

---

## 停損條件

- ❌ Squash merge 有衝突(理論上不應有,本 worktree 從 main 拉出且 main 未改相關檔案)
  - **行動**:Renew,附衝突檔案清單;不強行 resolve,等塔台評估
- ❌ Build / test 失敗
  - **行動**:**不 amend 已 squash 的 commit**,另開 hotfix 工單;保留問題細節到本工單回報區
- ❌ Worktree 刪除失敗(鎖定 / 檔案佔用)
  - **行動**:Renew,使用者可能需要先關閉 worktree 開啟的程式

---

## 產出要求

1. **main commit hash**(squash merge 後)
2. **Build + test 結果 log**
3. **Worktree cleanup 確認**(`git worktree list` 輸出)
4. **EXP-GPUWHIS-001 檔案更新 diff**
5. **回報區**:上述 + 互動紀錄 + 風險發現 + 下一步建議

---

## 回報區(Worker 填寫)

### 完成狀態
DONE

### 產出連結
- main commit hash:`cb65614`(feat: GPU acceleration via Vulkan)
- Build 結果:`npx tsc --noEmit` ✅ 乾淨 / `npx vite build` ✅ 4 個階段全過(client + main + preload + terminal-server)
- Test 結果:`tests/gpu-detector.test.ts` 13/13 passed(0.99s)
- Worktree cleanup:
  - `git worktree remove ../bat-gpu-vulkan-poc` ✅
  - `git branch -D exp/gpu-vulkan-poc` ✅(was eba79b1)
  - `git worktree list` 僅剩主 worktree、`git branch --list 'exp/*'` 僅剩 `exp/bug012-scrollOnOutput` / `exp/builder26`(非本 EXP 範圍)
- EXP-GPUWHIS-001 狀態變更:🧪 EXPLORING → 📊 CONCLUDED,補填 T-D 產出段 + 最終結論段

### 5 項成功判準達成情況
1. feature commit:✅ `cb65614` 含 `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)`
2. Build:✅ `tsc --noEmit` + `vite build` 皆 exit 0
3. Test:✅ 13/13 gpu-detector tests passed
4. Worktree + branch 刪除:✅ 兩者皆清理,`git worktree list` / `git branch --list exp/*` 無殘留
5. EXP CONCLUDED:✅ 檔案狀態 EXPLORING → CONCLUDED,最終結論段落填寫完整(假設驗證 / main 增加成果 / PLAN-004 更新建議 / 追溯鏈)

### 互動紀錄
無(fire-and-forget,0 互動、0 Renew,所有步驟按工單執行步驟順序完成)

### 風險 / 阻塞 / 意外發現
- **零衝突 squash merge**:exp/gpu-vulkan-poc 從 main 拉出後 main 未改相關檔案,merge --squash 一次成功無 conflict,符合工單預期
- **未簽到的主線 CRLF 警告**:git merge 過程報 `LF will be replaced by CRLF` 於 T0240 自身工單 md(屬於 Windows Git 標準行為,無實質影響)
- **殘留 exp/\* 分支**:main 上仍有 `exp/bug012-scrollOnOutput` / `exp/builder26`,屬於本 EXP 範圍外的歷史實驗,不在 T0240 清理 scope,無動作
- **建議觀察**:`poc-bench/` 的三個 cjs 腳本合入主線,保留做未來新 GPU 硬體的基準測試,但若半年內無新硬體實測則可考慮移入 `_archive/` 降低主線噪音

### 下一步建議
- [x] 版號 bump + CHANGELOG(Q4.B 延後項,可建新工單)→ 推薦塔台建 T0241 做版號 + CHANGELOG + Homebrew tap 同步
- [x] PLAN-004 狀態更新(Phase 1 完成,Phase 2 評估)→ 推薦塔台手動更新 PLAN-004 Phase 1 DONE 欄位 + 重新評估 Phase 2 的 CUDA 通路必要性
- [ ] 未來新 GPU 硬體(RTX 30/40 或同等 fp16)實測記錄 → 可在使用者升級後單開 EXP-GPUWHIS-002 驗證 10x CPU 目標
- [ ] 無需 Renew

### 回報時間
2026-04-23 02:34 (UTC+8)

---

**建立者**:Control Tower(第二十一 session,2026-04-23 02:40)
**派發指令**(塔台自用):
```
派發 T0240 --mode on --interactive
```
