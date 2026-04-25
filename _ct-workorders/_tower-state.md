# Tower State — better-agent-terminal

> 最後更新:2026-04-26 03:25(**第二十八 session 收工快照:PLAN-007 Phase B Phase 1 全部 5 張落地(T0268-T0272 ✅ DONE 0 失敗 0 Renew 0 互動),累計 ~80 min wall vs 估 32-72h(差 24-50 倍)。批次 *archive 41 張 + *sync + *evolve(GP099/GP100 寫 Global、L-cand-098/099/100 + L101/L102 寫 Project)。worktree commit chain `81f58d3 → dec6184 → 26eb10d → 42eab95 → 4e6a174 → 1fbb0bd`。下次起手:派 T0273 WslPathTranslator(Phase 2 第一張)。**)

---

## 🛏 本 Session 收工快照(第二十八 session,2026-04-26 00:14-03:25,~3h 11min,PLAN-007 Phase 1 完成 + 大批歸檔 + 學習萃取)

### 本輪時間線(收工版,完整 28 session)

**Part A:Phase B 起手(00:14-00:45,30 min,T0268)**
1. **00:14**(起手):session 27 退場後重啟,Fast Path 載入 session 27 快照,使用者「繼續」推進 PLAN-007 Phase B
2. **00:15**(對齊):worktree 命名選 [A] 預設 → 建立 `git worktree add ../bat-plan-007 -b feature/plan-007-remote-dev`
3. **00:15-00:18**:塔台清理 session 27 殘留 — `bat-headless-spike/` 4K 空目錄,Windows handle lock 留待 reboot
4. **00:18-00:25**:寫 T0268 工單 + commit;Step 11 修正(Worker 不寫 worktree 工單檔)
5. **00:25**(config):**`*config auto_session on --project`**(從 off 改回 on),commit `d12f2a9`
6. **00:25-00:34**:T0268 派發(yolo + no-interactive)→ ✅ DONE 9 min wall,worktree commit `81f58d3`,12 tests
7. **00:34-00:42**:塔台同步主線 metadata,commit `d5abe1a`
8. **00:45**:context 高,寫中段快照,session 重啟

**Part B:重啟 + 批次清理(00:42-00:55,~13 min)**
9. **00:42**:Fast Path 載入中段快照
10. **00:45-00:50**:**`*archive A`**(批次 41 張歸檔)— 22 工單 + 9 CT-T + 6 BUG + 4 PLAN → `_archive/`,熱區 74 → 33,commit `575a053`
11. **00:50-00:55**:**`*sync`**(重建 _bug-tracker.md / _backlog.md)— BUG 熱區只剩 2 張(BUG-055/059),Backlog 8 張 active(3 IDEA / 3 PLANNED / 2 IN_PROGRESS)

**Part C:Phase 1 連發 4 張(00:55-03:15,~2h 20min,T0269-T0272)**
12. **00:53-01:11**:**`*config auto_session yolo`**(session-level)→ T0269 派發 → ✅ DONE 14 min,worktree commit `dec6184`,48 contract tests,主線 sync `529efc6`
13. **01:12-01:24**:**T0270 自主派發**(YOLO)→ ✅ DONE 10 min,worktree commit `26eb10d`,19 tests(channel set 校正:fs:changed 字串非物件 / workspace:* 排除 / git:status repo-relative 排除),主線 sync `3f08385`
14. **02:26-02:48**:**T0271 自主派發**(YOLO)→ ✅ DONE 22 min,worktree commit `42eab95`(+ report `4e6a174`),tarball 123.76 MB linux-x64 / 257 檔 / whisper grep 0 / AC4 反向測試 ✅,主線 sync `1be74c7`
15. **02:53-03:15**:**T0272 自主派發**(YOLO,Phase 1 capstone)→ ✅ DONE ~25 min,worktree commit `1fbb0bd`,6 contract tests + bundle layout B + secrets/remote-server/certificate plain-Node 相容性擴 3 檔,主線 sync `a080e5b`

**Part D:Phase 1 收工(03:15-03:25,~10 min)**
16. **03:15**:塔台 Phase boundary 自主暫停 → 提示 [A] 繼續 Phase 2 / [B] *evolve / [C] 收工
17. **03:18**:使用者選 **B → C**(*evolve 後收工)
18. **03:18-03:23**:**`*sync`**(熱區 37 張驗證,索引無變動);**`*evolve`** mixed mode → GP099(估時偏差 24-50 倍)+ GP100(YOLO 13 連發)寫 Global,L-cand-098/099/100(Worker 自決邊界 / 容忍邊界 / Phase 收尾觸發)+ L101(plain-Node 相容 3 檔)/ L102(Bundle layout B)寫 Project
19. **03:25**:寫本 session 收工快照

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **Worker 工單** | T0268-T0272 5 張 ✅ DONE(0 失敗 0 Renew 0 互動) |
| **Worktree commit chain** | `c9373ff → 81f58d3(T0268) → dec6184(T0269) → 26eb10d(T0270) → 42eab95(T0271) → 4e6a174(T0271 report) → 1fbb0bd(T0272)` 全部 on `feature/plan-007-remote-dev` |
| **PLAN-007 Phase 1 收尾** | 5 張(targetOS schema → PathTranslator → RemoteClient middleware → server bundle → headless factory)完整落地;Phase 1 / 5 完成 |
| **批次歸檔** | 41 張(22 T + 9 CT-T + 6 BUG + 4 PLAN)→ `_archive/`,熱區 74 → 33 → 37(本 session 加 5)|
| **學習萃取** | Global +2(GP099/GP100,GP 總數 100)/ Project +5(L-cand-098/099/100 + L101/L102) |
| **Config 變更** | `auto-session off → on`(project,commit `d12f2a9`)→ `yolo`(session-level,未存檔) |
| **Commits 主線**(時間序) | `1299119`(T0268 創建)/ `d12f2a9`(config)/ `d5abe1a`(T0268 sync)/ `chore session 28 mid snapshot`(63b8bdb 起手)/ `575a053`(*archive 41 張)/ `*sync` rebuild / `af34369`(T0269 創建)/ `529efc6`(T0269 sync)/ `1be74c7`(T0270 創建合併 sync)/ `3f08385`(T0270 sync)/ `1be74c7`(T0271 創建)/ `1be74c7`(T0271 sync)/ `a080e5b`(T0272 sync)|
| **Worker 主動超出範圍**(總計 7 項) | T0268: IPC type / setter ×8 / 4 tests;T0270: channel set 校正;T0271: 移 Windows claude.exe(278→124 MB);T0272: secrets/remote-server/certificate plain-Node 相容擴 3 檔 |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time(全 session) | ~3h 11min | 00:14-03:25 |
| Worker 工單 DONE | 5 / 5 | T0268-T0272 全綠 |
| Worker 累計 wall | ~80 min | 9+14+10+22+25(全部 spec-frozen impl)|
| 估 vs 實差距 | 24-50× | 估 32-72h 實 80 min |
| Renew 次數 | 0 / 5 | |
| FAILED 次數 | 0 / 5 | |
| 互動觸發 | 0 / 5 | yolo + no-interactive |
| YOLO 自主派發 | 4 次 | T0269-T0272(T0268 手動派,後續 chain) |
| 塔台 commits 主線 | ~14 | 含 archive / sync / config / metadata sync |

### 下 session pending(優先序)

1. 🟢 **派 T0273** — WslPathTranslator + wsl-path 純函數整合(Phase 2 第一張,M sizing,但依 GP099 預期 wall 10-25 min)
2. 🟢 **可並行 T0274** — WSL setup wizard steps 1-4(L sizing,依 T0271)
3. 🟢 **歸檔下批候選**(達 04-28 起):T0268-T0272(本 session)+ BUG-055/059 + T0250-T0259 + EXP-HEADLESS-001
4. 🟢 v0.3.0/v0.3.1 release 觀察 / Phase 1 C3 runtime 驗收 / PLAN-021/028 / Phase 2 CUDA(全部 session 26-27 殘留)
5. 🟢 手動清 `bat-headless-spike/` 4K 殘留(reboot 或 cmd.exe `rmdir`)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:確認 worktree `../bat-plan-007` 仍存在(`git worktree list`),HEAD 應為 `1fbb0bd`(T0272 DONE)
3. **優先序 2**:派 T0273(spec doc §8 藍圖卡 + spec §2.2 已凍結 framework + L101 plain-Node 相容 3 檔資訊)
4. **塔台規則繼續**:D089 worktree 策略不變,Phase 2 沿用 yolo + no-interactive(本 session 13 連發零異常已證高效)
5. **編號起始**:T0273 / BUG-060 / PLAN-029 / D090 / EXP-WSL-MIRRORED-001(spike 候選依 T0263 §B)
6. **預期 Phase 2 4 張(T0273-T0276)累計 wall ≤ 90 min**(GP099 校準後)

### 本 session 教訓

1. **Phase boundary 是天然 *evolve 觸發點** — L-cand-100 已記。比起每張 *evolve(成本高)或 session 結束才 *evolve(候選散),Phase 收尾甜蜜點。
2. **YOLO 鏈式對 impl 同樣有效** — GP100 已記。13 連發跨 research / impl 兩 type 零異常。
3. **spec-frozen impl 估時表完全失效** — GP099 已記。Phase 2 工單估時應改 30 min 而非 sizing 表。
4. **Worker 主動超出範圍是常態,不是例外** — L-cand-099 已記。預期 Phase 2 每張會有 1-3 項。
5. **批次 *archive 是清熱區的核心動作** — 本 session 一次性 41 張,熱區 74→33,搜尋成本驟降。下次達門檻立刻跑。

### 本 session 成就

- 🏆 **PLAN-007 Phase 1 整段完成** — 從 schema → translator framework → middleware → server bundle → headless factory,1 day 內 5 張 0 失敗
- 🎉 **GP 達 100 條里程碑**(GP099/GP100 寫入 Global)
- 🎉 **YOLO 13 連發零異常**(session 27 8 張 research + session 28 5 張 impl)
- 🎉 **熱區大瘦身**(74→33→37,*archive 一次處理 41 張)
- 🎉 **估時觀念校準**(spec-frozen impl wall 接近 research speed,後續 Phase 2/3/4 工單規劃可大幅壓縮)

---

## 🛏 前 Session 中段快照(第二十八 session 前段,2026-04-26 00:14-00:45,~30 min,PLAN-007 Phase B 起手 + T0268 完成 + context 高重啟)

### 本輪時間線

1. **00:14**(起手):session 27 退場後重啟,Fast Path 載入 session 27 快照,使用者「繼續」推進 PLAN-007 Phase B
2. **00:15**(對齊):worktree 命名選 [A] 預設 → 建立 `git worktree add ../bat-plan-007 -b feature/plan-007-remote-dev`(HEAD = `c9373ff`)
3. **00:15-00:18**:塔台清理 session 27 殘留 — `bat-headless-spike/` 4K 空目錄,Windows handle lock(Device or resource busy),內容已空,4K 不阻擋,留待 reboot 或 cmd.exe `rmdir`
4. **00:18-00:25**:寫 T0268 工單檔(spec doc §2.1 + §6 C-2 為依據),commit 主線 `1299119`;Step 11 修正(Worker 不寫 worktree 工單檔,塔台同步主線)
5. **00:25**(config):**`*config auto_session on --project`**(從 off 改回 on),commit `d12f2a9` — 理由:PLAN-007 Phase B worktree 階段恢復自動派發,個別工單仍可 `*config yolo` 覆寫
6. **00:25-00:34**:T0268 派發(yolo + no-interactive,fire-and-forget)→ Worker 在 worktree 執行 → ✅ DONE 9 min wall,worktree commit `81f58d3`,12 tests passed(4 migration + 7 narrowing + 1 exhaustive)
7. **00:34-00:42**:塔台同步主線 T0268 metadata,commit `d5abe1a` — 完整 AC 驗收 8/8 + Worker 主動超出範圍項記錄(IPC type 同步 / ProfileManager.update 擴 8 setter / 多寫 4 tests)
8. **00:45**:使用者「塔台 context 高,快照重啟」→ 寫本快照

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **Worker 工單** | T0268 ✅ DONE(9 min wall,worktree commit `81f58d3`,6 files / +396 / -8) |
| **Worktree** | `../bat-plan-007` on `feature/plan-007-remote-dev`,HEAD `81f58d3`(c9373ff base + T0268 commit) |
| **Config 變更** | `auto-session: off → on`(project layer,commit `d12f2a9`) |
| **塔台清理** | `bat-headless-spike/` 殘留偵測(4K 鎖定,留待手動清) |
| **Commits 主線**(本 session 新增) | `1299119`(T0268 創建)/ `d12f2a9`(config)/ `d5abe1a`(T0268 metadata sync) |
| **Commits worktree**(本 session 新增) | `81f58d3`(T0268 feat:profile schema + migration + inline prompt + tests) |
| **修改檔**(worktree) | `electron/profile-manager.ts`(+132/-1)/ `electron/main.ts`(+1/-1)/ `electron/preload.ts`(+6/-2)/ `src/types/electron.d.ts`(+15/-1)/ `src/components/ProfilePanel.tsx`(+66)/ `tests/profile-manager-migration.test.ts`(+179 新檔) |
| **修改檔**(主線) | `_ct-workorders/T0268-*.md` / `_ct-workorders/_tower-config.yaml` |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time(全 session) | ~30 min | 00:14-00:45,含 worktree 對齊 + config 變更 + 塔台 sync |
| Worker 工單 DONE | 1 / 1 | T0268,零失敗零 Renew |
| Worker wall | 9 min | 00:25-00:34(估 4-8h,落差 30 倍) |
| Worker 主動超出範圍 | 3 項 | IPC type 同步 / ProfileManager.update 擴 setter / 多寫 4 tests |
| 互動觸發 | 0 / 1 | disabled fire-and-forget |
| 塔台 commits | 3 | T0268 創建 / config / metadata sync |

### 下 session pending(優先序)

1. 🟡 **派 T0269** — PathTranslator interface + IdentityTranslator + contract test scaffold(Phase 1 第二張,依 T0268 schema,建議 wall 估 30-60 min impl + 30 min tests)
2. 🟡 **派 T0271** 可與 T0269 並行 — Server bundle pipeline (linux-x64) baseline,無 schema 相依
3. 🟢 **`*sync` + `*evolve`** — session 27/28 累積學習候選(GP-cand-A/B/C/D/E + L-cand-A/B + 本 session L-cand「估時偏差 30 倍」),T0269 後一次跑
4. 🟢 **批次歸檔候選** — 達門檻(session 25 8 BUG / session 26 T0255-T0259 / session 27 T0260-T0267)
5. 🟢 **手動清 `bat-headless-spike/` 4K 殘留** — reboot 或 cmd.exe `rmdir` 處理
6. 🟢 v0.3.0/v0.3.1 release 觀察 / Phase 1 C3 runtime 驗收 / PLAN-021/028 / Phase 2 CUDA(全部 session 26 殘留)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:確認 worktree `../bat-plan-007` 仍存在(`git worktree list` 應該見到)
3. **優先序 2**:派 T0269 — 寫工單(範圍見 spec doc §8 藍圖卡)→ commit 主線 → 派發(auto-session=on 會自動處理)→ Worker 在 worktree 內執行
4. **塔台規則繼續**:D089 worktree 策略不變(主線僅 hotfix + 工單 metadata,code 都在 worktree branch)
5. **編號起始**:T0269 / BUG-060 / PLAN-029 / D090 / EXP-NODE-SEA-001 或 EXP-WSL-MIRRORED-001
6. **Worker 估時校正**:impl 工單若 spec 凍結 + 既有 codebase 結構吻合,實際 wall 接近研究速度(10-30 min),不要照 4-8h 估

### 本 session 學習候選

#### 強候選 Global

- **GP-cand-本 session**:**impl 工單估時偏差 30 倍,因 spec 凍結 + codebase 吻合**。T0268 估 4-8h,實際 9 min。GP-cand 句:「impl 工單若(1)scope 完全凍結(spec doc §X)(2)既有 codebase 結構吻合 spec 假設(3)無外部依賴新增 → 實際 wall 接近 research 速度(10-30 min)」。
- **GP-cand**:**Worker 主動補 IPC type 同步 + 測試覆蓋 + setter 擴充**這類「scope 邊緣補強」對 PLAN 推進極有價值。塔台不需明示,Worker 邊執行邊補。可寫成 GP「Worker 邊緣補強的容忍邊界」(明顯有助於後續工單的補強允許,scope creep 的不允許)。

#### Project 候選

- **L-cand**:BAT profile schema 是 flat structure,加 optional 欄位零阻力。後續 PLAN-007 工單(translator factory 註冊 / wizard step / metadata UI)都可放心擴。
- **L-cand**:Worker 在 worktree 工作但 update main 工單 metadata(IPC type 同步是這裡),需要明示「main metadata 由塔台 sync,Worker 只回報」避免雙寫衝突。本工單已預先說明,Worker 遵守。

### 本 session 教訓

1. **Worktree workorder 模式驗證可行** — Worker 順利在 `../bat-plan-007` 內 cd / npm install / impl / test / commit feature branch,主線零污染。D089 第一次實戰通過。
2. **auto-session config 切換要記** — session 27 收工時 config 是 off,本 session 改回 on,commit message 標註原因避免下次困惑。
3. **Worker estimate 校正** — 之前 spec 出來 estimate 都偏高(基於「實作 + debug + edge case」想像),T0268 證 spec-frozen impl 接近 research speed。
4. **塔台 metadata sync 是必要 step** — Worker 完成後塔台手動更新主線工單檔(狀態 / 時間 / commit hash / report),這是 worktree 模式的固定 overhead(~3-5 min/張)。下次工單明示「Worker 不動主線工單檔」(已在 T0268 守則中),避免雙寫衝突。

### 本 session 成就

- 🎉 **PLAN-007 Phase B 第一張落地** — D089 worktree 策略首次實戰,Worker 9 min 完成 schema + migration + UI + 12 tests
- 🎉 **Worker 主動補強三項** — IPC type / setter / tests,塔台未指示但結果更紮實
- 🎉 **estimate 30 倍偏差揭露** — impl 工單在 spec-frozen + codebase-fit 條件下接近 research speed,這是後續 22 張工單的重要校準

---

## 🛏 前 Session 退出快照(第二十七 session,2026-04-25 21:30-23:35,~2h 5min,PLAN-007 Phase A research 全部完成 + PLANNED 升級)

### 本輪時間線

1. **21:30**(起手):Fast Path 載入 session 26 退場快照,使用者要求啟動 PLAN-007「支援遠端開發(WSL/Docker/SSH + BAT remote Mode)」,需求對齊 Q1.A(Phase A 全研究)Q2.A(框架翻轉:BAT terminal client/server 拆分,server 跨環境)Q3.塔台規劃 Q4.塔台規劃詳細
2. **21:30-21:45**:塔台規劃序列 → T0260 scoping 派發前對齊 → 使用者「一張回來再一張」+ `*config auto_session yolo` + D 模式(每張完成塔台 pause 等檢視) + 1 立即派
3. **21:45-21:51**:T0260 ✅ DONE(6 min,commit `9e9d1dd`)— 4 環境拆單建議卡 + topology 矩陣 + 揭露 server-side 0 deps 假設
4. **21:51-22:18**:T0261 EXP-HEADLESS-001 spike 派發前塔台規劃調整(原 T0261 BAT-remote 強化改為 spike,證可行性錨點)→ 工單寫完 → worktree `../bat-headless-spike` 建立 → spike DONE 29 min(commit `8040e49` 主線 / `17ac525` worktree)→ AC1-AC8 全綠 + EXP CONCLUDED → server-side 0 個 app.* / electron deps 驗證
5. **22:18-22:30**:worktree 清理(branch 刪 / 磁碟殘留 permission denied 留待後處理) + 塔台規劃調整(EXP-HOST-DISPATCH 砍掉,T0262 縮 scope 到 server-side only)
6. **22:30-22:42**:T0262 server-side spec ✅ DONE(6 min,commit `6477cf9`)— 7 節 + 工程量上修 1-2 天 → 3-5 週(W1-W5 直接實作 + S1-S4 spike + 後續分批);T0263 WSL research ✅ DONE(5 min,commit `afb34a0`)— 7 節 + path translation 純字串 + WSL1 不支援
7. **22:42-22:51**:T0263 主動建議插入 T0264 共通抽象 → 塔台接受並調整序列 → T0264 ✅ DONE(5 min,commit `92af5c7`)— 6 節跨 4 環境共通 spec 凍結
8. **22:51-23:10**:T0265 Docker research ✅ DONE(5 min,commit `055d8e2`)— 8 節 + base image bookworm-slim + 3 個 Docker EXP child;T0266 SSH research ✅ DONE(16 min,commit `496fba4`)— 9 節最複雜 + 8 個 RFC 浮現 + 7 個 cross-cutting risks
9. **23:15-23:25**:T0267 spec consolidation ✅ DONE(10 min,spec commit `f1934f9` + workorder commit `a388c11`)— 832 行 spec doc 落地 + 8 RFC 拍板 + 23 張實作藍圖 T0268-T0290 + PLANNED 升級檢核表 7/8 ✅
10. **23:30**:塔台執行 PLAN-007 元資料更新(💡 IDEA → 📋 PLANNED,commit `5e42553`)→ 拍板依據 T0267 + spec commit `f1934f9`
11. **23:35**:使用者「收工,下次回來在 worktree 推進 PLAN-007,主線保留隨時 hotfix 需求,worktree 等 PLAN-007 全部完成再合併」→ 記 D089

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **PLAN 升級** | PLAN-007 💡 IDEA → 📋 PLANNED(commit `5e42553`)— 框架翻轉「AI Agent 跨環境執行」→「BAT terminal server 跨環境部署 + client 連線」 |
| **Research 工單** | T0260/T0262/T0263/T0264/T0265/T0266/T0267 共 7 張 ✅ DONE |
| **Spike** | T0261 EXP-HEADLESS-001 ✅ CONCLUDED(server-side 0 deps 錨定) |
| **Spec 文件** | `_ct-workorders/_spec-remote-dev-support-2026-04.md`(832 行,9 節結構) |
| **RFC 拍板** | 8 個(C-1~C-7 + D-SSH-6),全部 closed |
| **實作藍圖** | 23 張(T0268-T0290,5 Phase,22-30 工程日 → 含風險係數 30-40d) |
| **決策** | D089(本 session 新增,PLAN-007 Phase B worktree 策略) |
| **Commits 本 session 新增**(時間序) | `9e9d1dd`(T0260)/ `2a9a906`(T0260 meta)/ `8040e49`(T0261 spike)/ `f9aa64f`(T0261 meta)/ `6477cf9`(T0262)/ `53bd102`(T0262 meta)/ `afb34a0`(T0263)/ `bb6d722`(T0263 meta)/ `92af5c7`(T0264)/ `190d9a3`(T0264 meta)/ `055d8e2`(T0265)/ `a1ce0af`(T0265 meta)/ `496fba4`(T0266)/ `88daa06`(T0266 meta)/ `f1934f9`(spec doc)/ `a388c11`(T0267)/ `5e42553`(PLAN-007 PLANNED) |
| **修改檔** | `_ct-workorders/T0260-T0267-*.md`(8 張工單)/ `_ct-workorders/EXP-HEADLESS-001-*.md` / `_ct-workorders/_spec-remote-dev-support-2026-04.md`(新增) / `_ct-workorders/PLAN-007-*.md` |
| **worktree** | `../bat-headless-spike`(EXP-HEADLESS-001 用,branch `exp/headless-server-spike` 已刪;磁碟目錄殘留 permission denied,待手動清) |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time(全 session) | ~2h 5min | 21:30-23:35,含對齊 + Worker pause review |
| Worker 累計 wall | ~82 min | T0260(6)+ T0261(29)+ T0262(6)+ T0263(5)+ T0264(5)+ T0265(5)+ T0266(16)+ T0267(10) |
| Worker 工單 DONE | 8 / 8 | 零失敗 |
| Renew 次數 | 0 / 8 | 零 Renew |
| FAILED 次數 | 0 / 8 | 零失敗 |
| 互動觸發 | 0 / 8 | YOLO + interactive enabled 但 Worker 全程零互動 |
| YOLO 自主派發 | 7 次 | T0261-T0267(T0260 起手手動派,後續鏈式) |
| 塔台主動規劃調整 | 4 次 | (1)T0261 改 spike(2)T0262 砍 EXP-HOST-DISPATCH 縮 scope(3)插入 T0264 共通抽象(4)接受 D-SSH-6 命名修正 |
| Worker 主動建議採納 | 3 次 | T0261 結論翻轉「server-side 1-2 天 → 3-5 週」/ T0263 建議插 T0264 共通抽象 / T0266 建議改 SshPathTranslator |
| spec doc 行數 | 832 | 落在 800-1500 目標區間 |
| 平均 Worker wall / 工單 | ~10 min | 大幅低於原估 60-120 min |

### 下 session pending(優先序)

1. 🟡 **建立 PLAN-007 Phase B worktree** — 依 D089,建議 `git worktree add ../bat-plan-007 -b feature/plan-007-remote-dev`(命名待塔台對齊使用者偏好,可能 `feat/remote-dev` / `phase/plan-007` 等)
2. 🟡 **派 T0268** — Phase 1 第一張(targetOS profile schema + migration,M sizing 4-8h,無依賴),在 worktree 內執行
3. 🟢 **`*sync` 重建索引** — PLAN-007 PLANNED 變動需反映到 `_backlog.md`,順便處理 BUG/EXP 狀態同步(<1 min)
4. 🟢 **`*evolve` 批次萃取** — 本 session 高度密集的學習候選(見下方「學習候選」段)
5. 🟢 **可選:斷點重評估** — D089 worktree 策略意味 Phase B 期間主線只接 hotfix,塔台需要在每張 worktree 工單 DONE 後評估是否該回主線檢查 hotfix backlog
6. 🟢 **批次歸檔候選** — session 25 8 張 BUG CLOSED + session 26 T0255-T0259(達門檻 04-26+ 起;已過)+ session 27 T0260-T0267(達 04-27+)
7. 🟢 **手動清 `bat-headless-spike` 磁碟殘留** — `/d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-headless-spike/` permission denied,等鎖解後 `rm -rf` 或重啟系統
8. 🟢 **使用者親自跑 dev / packaged 實機驗收 Phase 1 C3**(session 26 pending 仍在)
9. 🟢 **v0.3.0/v0.3.1 release 後續觀察**(session 25-26 pending)
10. 🟢 PLAN-021 IN_PROGRESS / PLAN-028 PLANNED / T0153 PARTIAL / Phase 2 CUDA 評估

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:對齊使用者 worktree 命名偏好 → 建立 `../bat-plan-007`(或使用者指定名)→ 切過去 → 開新 sub-session
3. **優先序 2**:T0268 派發(在 worktree 內)— 工單沿用 PLAN-007 spec doc §8 藍圖卡細則,塔台先寫完整工單檔
4. **優先序 3**:第 1-2 張 worktree 工單 DONE 後跑 `*sync` + `*evolve`(本 session 累積學習候選 + PLAN 狀態 propagation)
5. 下 session 新單編號起始:**T0268 / BUG-060 / PLAN-029 / D090 / EXP-NODE-SEA-001 或 EXP-WSL-MIRRORED-001**(spike 候選依 T0267 §B)
6. **編號特殊註記**:T0268-T0290 已預留為 PLAN-007 Phase B 實作工單(藍圖卡見 spec doc §8),不要佔用為其他 PLAN 工單

### D089 — PLAN-007 Phase B Worktree 策略

**決策**:Phase B 全程在 worktree 內推進,主線保留隨時 hotfix 容量。

**規格**:
- worktree 分支命名:`feature/plan-007-remote-dev` 或類似(下 session 對齊)
- worktree 路徑:`../bat-plan-007` 或類似
- 合併條件:**Phase 5 T0290 DONE 才考慮 PR 回主線**(全部 5 Phase 23 張工單完成 + e2e smoke 綠)
- 主線在 PLAN-007 期間只接 hotfix(BUG / 緊急 PLAN)
- 跨 commit 同步:worktree 定期 `git merge origin/main`(rebase 或 merge,下 session 對齊)避免 drift

**理由**(使用者表述):
- PLAN-007 工程量 30-40 工程日,大塊變動不應綁主線 release cadence
- 主線 release(version bump / hotfix)期間 worktree 仍可推進
- 完成後一次性大 PR review,清晰 traceable

**實作影響**:
- 塔台派工要明確標「在 worktree 執行」
- Worker 在 worktree 跑,主線只接 hotfix 工單
- 塔台 meta 工單(PLAN 元資料 / spec doc 修正)走主線(避免 worktree 與主線兩份不同步)
- 每階段 commit 都是 worktree 內 commit(`feature/plan-007-remote-dev` 分支),非主線

**風險**:
- worktree drift(若主線有大變動 BAT codebase 改動)
- 合併衝突在 Phase 5 收尾時集中爆發
- Worker 容易誤把 worktree 工單寫到主線(需在工單明示「affects_files: worktree path」)

### 本 session 學習候選(待 `*evolve` 批次萃取)

#### 強候選 Global

- **GP-cand-A**(高度可能晉升):**「scoping → spike → 共通抽象 → 細節展開 → 彙整」5 階段研究模式**。本 session T0260 → T0261 → T0264(中插)→ T0263/T0265/T0266 → T0267 完整走完一輪,8 張工單 ~82 min wall,零 Renew 零 FAILED。對「大型未知 PLAN」(>20 工程日 + 多環境 / 跨層級)極度有效。比 GP083「先研後修 ROI 極高」更上一層的「先 scoping 再研究」結構。
- **GP-cand-B**:**Worker 主動建議插入工單時的塔台採納原則**。本 session T0263 / T0266 兩次主動建議(插 T0264 / 改 SshPathTranslator),塔台均採納。判斷準則「Worker 在執行中浮現的洞察 > 塔台事前規劃」當證據鏈完整時,塔台應彈性調整序列。GP084 研究型工單三要素的延伸。
- **GP-cand-C**:**YOLO 鏈式派發在純 research 工單的高效率**。8 張工單 ~10 min/張,大幅低於原估 60-120 min/張。原因:research 不寫 code,Worker 靠讀 + 寫 spec 即可,YOLO + interactive enabled 但 Worker 自決 = 最佳組合。對比 impl 工單(T0258 cherry-pick 20 min)亦顯示 research 工單天生快。
- **GP-cand-D**:**Spec doc 落地工單(T0267)的特殊授權慣例**。一般 research 禁止寫工單外檔,但彙整工單例外允許寫 `_spec-*.md`(F-24 慣例),且仍維持「不寫 source code」紅線。模式可複製到其他 PLAN 的彙整階段。
- **GP-cand-E**:**塔台規劃中途調整的成本極低**。本 session 4 次調整(T0261 改 spike / T0262 縮 scope / T0264 中插 / 命名修正),Worker 對工單檔變更無反彈(讀完即執行)。意味著研究工單階段塔台可保留高度彈性,不需鎖死預先規劃。

#### Project 候選

- **L-cand-A**:**BAT remote 已七成完成 client/server 拆分**(T0260 / T0261 結論),secrets.ts strategy 已落地。意味未來 BAT-remote 相關 PLAN 起點高,不需重做基礎研究。
- **L-cand-B**:**worktree 殘留磁碟清理問題**。`bat-headless-spike` 目錄因 node_modules locked 無法清,git 已斷註冊但檔案占空間。下次 EXP 結束前需先確認 process release 才能清。

### 本 session 教訓

1. **規劃預估與實際 wall 落差大**(估 60-120 min/張 vs 實際 ~10 min/張)— 純 research 工單應重訂預估基準。下次寫 research 工單估時欄位用「20-40 min wall + 60-180 min context cost」雙軸。
2. **Worker 估時口徑跨類型混用易誤判**— T0260 spike 工單 Worker 給「10-14h」其實是「實作工時」,塔台原想接受時被工程量上修糾正。下次工單 metadata 「預估 wall time」應明確標註「研究 wall(讀+寫)」vs「實作工時」。
3. **塔台 D 模式 + YOLO 自主派發共存**運作良好 — D 模式 = 每張完成 pause 給 user review;YOLO = 鏈式派發。看似衝突但實作上 pause 在「下一張派出前」,user 可中斷或讓塔台繼續,順暢。

### 本 session 成就

- 🎉 **單 session 完成 PLAN-007 Phase A 全研究** — 8 張 research + 1 spike + spec doc + PLANNED 升級,~2h 5min 全 session(Worker 累計 ~82 min)
- 🎉 **完整研究方法論驗證** — scoping → spike → 共通 → 環境細節 → 彙整,5 階段全跑完零 Renew
- 🎉 **Worker 連續 ~10 min/張 高效率** — 純 YOLO + interactive enabled,設計分支 100% Worker 自決
- 🎉 **8 RFC 全拍板 + 23 實作藍圖 + 832 行 spec doc** — PLAN-007 從 IDEA 變成可執行藍圖,工程量明確(30-40 工程日)
- 🎉 **D089 worktree 策略確立** — 大型 PLAN 與主線解耦,hotfix 路徑保留

---

## 🛏 前 Session 退出快照(第二十六 session,2026-04-25 14:55-21:25,~6h 30min,T0255 Phase 1 C3 中斷恢復閉環)

### 本輪時間線

1. **14:55**(前 session 收工):session 25 BUG-059/055 雙閉環,使用者註記「因系統資源不足,Worker 已暫停工單,紀錄 check-point,等我重開機再繼續」
2. **(中間 session 留下中斷現場)**:T0255 Phase 1 C3 cherry-pick 鏈執行到 #5(220b093 open external links),git 處 cherry-pick paused mid-conflict,UU 標記在 ClaudeAgentPanel.tsx + CodexAgentPanel.tsx 但 working tree 已無 conflict markers(使用者已手解採 ours 但未 git add),main.ts 有 staged +13 行,T0255 工單檔 untracked 但已寫 CHECKPOINT 段
3. **20:15**(本 session 起手):Fast Path 載入 → 偵測中斷狀態(UU + M + ??)→ 塔台給 4 選項面板(A 續/B 棄/C 偵察/D 看工單)→ 使用者選 C,並 `*config auto_session yolo`(僅本 session)
4. **20:15-20:26**:**T0257 research 11 min ✅ DONE**(commit `8d2a440`)— 純偵察工單禁所有寫操作,4 件事盤點:cherry-pick 進度(#1-#4 done / #5 paused)、UU 檔 stage 1/2/3 vs WT 比對(揭露「已手解未 add」隱形狀態)、main.ts staged diff 概覽、CHERRY_PICK_HEAD 指向確認。結論:選項 A 強推,工作樹狀況良好
5. **20:30-20:50**:**T0258 implementation 20 min ✅ DONE**(YOLO + interactive enabled)— 續做 cherry-pick 鏈 #5 收尾(`git add + cherry-pick --continue`)+ #6/#7/#8 + version.json。Worker 全程零互動自主處理(#6 empty commit + trailer / #7 丟棄 autoCompactWindow / #8 git auto-merge)。Commits `302a065` `4c1de15` `8b07399` `f96eb35` `acc4a81` + 〈chore T0255+T0257+T0258 trace〉
6. **20:55-20:46**:**T0259 verification 6 min ✅ DONE**(commit `3f090c9`)— vite build exit 0 + tsc 跑出 37 errors 但 baseline diff 校驗(checkout `302a065^` 同 37 errors)→ 確認 cherry-pick 鏈零新增。AC1 採折衷跑 `npm run compile` 而非 full build(避開 NSIS),明確標註偏離原因
7. **21:10**:塔台自主處理 T0258 工單檔元資料 commit gap → commit `964c4bd`(auto_commit=ask 詢問使用者後執行)
8. **21:15-21:25**:`*evolve` 批次萃取 → 提案 6 條(4 global + 2 project)→ 使用者「全照建議」→ 寫入 + commits `c3a0a25`(BAT _learnings.md) + `37097c1`(control-tower-data/learnings/patterns.md)

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **母工單閉環** | T0255 ✅ DONE(Phase 1 C3 8/8 cherry-pick + version.json bump,從中斷現場恢復) |
| **本 session Worker 工單** | T0257 ✅ DONE(research 11 min)/ T0258 ✅ DONE(implementation 20 min)/ T0259 ✅ DONE(verification 6 min) |
| **`*evolve` Global 晉升** | GP095(中斷恢復 research-first 偵察)/ GP096(cherry-pick empty commit + trailer)/ GP097(verification baseline diff)/ GP098(工單元資料 commit gap systemic) |
| **`*evolve` Project 新增** | L101(YOLO + interactive 但零互動)/ L102(verification 工單必明示 build 層級) |
| **決策** | 無新 D(本 session 沿用既有原則,YOLO 自主決策走 GP083+L106 線索) |
| **Commits 本 session 新增**(時間序) | `302a065` `4c1de15` `8b07399` `f96eb35` `acc4a81`(T0258 cherry-pick #5-#8 + version.json)/ 〈chore T0255+T0257+T0258 trace〉/ `3f090c9`(T0259)/ `964c4bd`(T0258 meta sync)/ `c3a0a25`(BAT learnings)/ control-tower-data `37097c1`(global patterns) |
| **修改檔** | `electron/main.ts`(setWindowOpenHandler + will-navigate)/ `src/components/ClaudeAgentPanel.tsx`(empty net-zero)/ `src/components/CodexAgentPanel.tsx`/ `electron/claude-agent-manager.ts`(contextWindow sync + fork-session abort)/ `version.json` lastSyncCommit bump / `_ct-workorders/T0255/T0257/T0258/T0259-*.md` / `_ct-workorders/_learnings.md` / `~/.claude/control-tower-data/learnings/patterns.md` |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time | ~6h 30min | 14:55-21:25(含使用者對話 / *evolve 提案討論) |
| 純 Worker wall | ~37 min | T0257(11)+ T0258(20)+ T0259(6) |
| Worker 工單 DONE | 3 / 3 | 零失敗 |
| Renew 次數 | 0 / 3 | 零 Renew |
| FAILED 次數 | 0 / 3 | 零失敗 |
| 互動觸發 | 0 / 3 | T0258 enabled 但 Worker 全程零互動(L101 證據) |
| YOLO 自主派發 | 3 次 | T0257 → T0258 → T0259 鏈,塔台自主依 T0257 報告 → T0258 邏輯下一步 → T0259 build 驗收 |
| 塔台自主 commit | 1 | T0258 元資料同步(`964c4bd`,auto_commit=ask 詢問後) |
| 預估 vs 實際 | T0258 估 40-60 min → 實際 20 min(GP069 yolo 壓縮再驗證) |

### 下 session pending(優先序)

1. 🟡 **使用者親自跑 dev / packaged 實機驗收 Phase 1 C3** — 4 個 cherry-pick(尤其 #5 external link 行為 + #7 contextWindow label 即時切換 + #8 fork-session transcript 持久化)需 runtime 驗收
2. 🟢 **batch 歸檔候選** — session 25 8 張 BUG CLOSED + session 26 T0255-T0259 完成,等 `archive_days: 2` 門檻(BUG-055/058/059 達 04-26+,T0255-T0259 達 04-27+)
3. 🟢 **v0.3.0/v0.3.1 release 後續觀察** — GitHub Release + Homebrew tap 狀態
4. 🟢 **Phase 2 CUDA advanced tier 評估** — 待 EXP-GPUWHIS-002 硬體升級實測
5. 🟢 **backlog 🟢 Low** — PLAN-002/007/015/026
6. 🟢 PLAN-021 IN_PROGRESS(等 dev smoke)
7. 🟢 PLAN-028 PLANNED(BAT dogfood CT v4.4)
8. 🟢 T0153 PARTIAL(Git GUI spike,擱置)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:詢問使用者 Phase 1 C3 runtime 驗收結果 — 若 OK 則 Phase 1 全部閉環,可進 Phase 2;若有 regression 則開 BUG 單分流
3. **優先序 2**:批次歸檔(達門檻時)
4. 下 session 新單編號起始:**T0260 / BUG-060 / PLAN-029 / D089 / EXP-[TOPIC]-002+**
5. **編號異常注意**:_learnings.md L100 之後本 session 直接跳 L101(GP 編號 GP094 → GP095 連續無跳號),正常

### 本 session 成就

- 🎉 **中斷恢復零成本** — research-first(T0257 11 min)精準揭露「已手解未 add」隱形狀態,T0258 直接續做 ~20 min,vs 預估 40-60 min 省一半
- 🎉 **YOLO 自主鏈式派發** — T0257 → T0258 → T0259 三張連續派發,使用者僅 1 次決策(*evolve 確認 + auto_commit 確認 1 次),其餘塔台自主走「邏輯下一步」
- 🎉 **`*evolve` 一次萃取 6 條** — 4 條強候選 Global 通則(中斷恢復 research-first / cherry-pick empty trailer / baseline diff / 元資料 commit gap),都跨專案可用
- 🎉 **GP083 線索再次驗證** — 「先研後修 ROI 極高」這次特化為「中斷恢復也走 research-first」,GP095 為其變體子型

### 本 session 教訓

1. **工單元資料 commit gap 是 systemic 問題** — T0258/T0259 都觀察到「Worker 收尾 commit 後 lint 才改 IN_PROGRESS → DONE,WT 有 metadata 漂移」。GP098 已記入,下次工單模板「最終 commit step」應加 double-check loop
2. **Verification 工單必明示 build 層級** — `npm run build` 在 BAT 含 NSIS electron-builder,5-10 min 估時不夠跑完。L102 + GP097(baseline diff)兩條合用作為 verification 工單模板修正方向
3. **YOLO + interactive enabled 不等於「Worker 必須問」** — T0258 enabled 但 Worker 全程零互動,證明 Worker 邊界判斷力可從 repo 內挖明確線索(L101)。下次重客製 cherry-pick 工單可先試 disabled fire-and-forget,失敗再升 enabled

---

## 🛏 前 Session 退出快照(第二十五 session,2026-04-25 09:30-12:31,~3h,BUG-059/055 修復鏈閉環)

### 本輪時間線

1. **~09:30**(起手):使用者觀測 packaged BAT 內 embedded `claude.exe.old.<ts>` 殘留 + `claude --version` 觸發 update,binary missing → BUG-059 OPEN(🔴 High,packaged 用戶端 worker session 整條鏈路斷)
2. **~09:35**(對齊):BUG-055 重評估(原 WONTFIX,T0235 過程中觀測殘留)→ 與 BUG-059 cross-ref,疑似同根因 install hook 走 auto-update path
3. **~09:35-09:40**(D086 決策):開 BUG-059 + T0250 反組譯研究工單,cross-ref BUG-055 待重評估
4. **09:40-09:55**:**T0250 研究 13 min ✅ DONE**(commit `2d5db28`)— 反組譯 `node_modules/@anthropic-ai/claude-code/cli.js` 找出 auto-update flow 把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>` 然後 `npm install -g` 到使用者 npm prefix(不在 BAT 路徑)。BUG-055 同根因確認。方案 A 推薦:在 BAT 所有 spawn 路徑無條件注入 `DISABLE_AUTOUPDATER=1`(env flag 由 native installer 自我關閉,但 npm-global 路徑仍受影響)
5. **~10:00**(D087 決策):採方案 A,派 T0251 單檔多點修改(`pty-manager.ts` 三處 envWithUtf8 + `claude-agent-manager.ts` constructor)+ CLAUDE.md 補「Embedded claude auto-update 停用」段落
6. **10:08-10:15**:**T0251 修復 7 min ✅ DONE**(commit `426d6fc`)— `electron/pty-manager.ts` + `electron/claude-agent-manager.ts` env 注入 4 處 + `CLAUDE.md` 文件章節。Worker 自報 build green,AC1 靜態通過,AC2/AC3 待 runtime 驗收(commit `42abda5`)
7. **~10:23**(meta update):`f572a06` BUG-055/059 status update + T0250 完成時間修正
8. **~10:23-12:27**:packaged installer 重建 + 使用者實機驗收(AC1 build green ✅ / AC2 `claude --version` 不觸發 update ✅ / AC3 spawn 後無 `.old.*` 殘留 ✅ / AC4 worker session 鏈路完整 ✅ / AC5 dev `.old.*` 連帶解除 ✅)
9. **12:27-12:31**(D088):**BUG-059 + BUG-055 一同 🚫 CLOSED**(commit `3101c6b`),session 25 收工條件達成

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **BUG 閉環** | BUG-059 🚫 CLOSED + BUG-055 🚫 CLOSED(原 WONTFIX → REOPEN → CLOSED,連帶閉環 D088) |
| **研究工單** | T0250 ✅ DONE(13 min,反組譯 cli.js,根因 + 方案 A) |
| **修復工單** | T0251 ✅ DONE(7 min wall,單檔多點 env 注入,fire-and-forget,零 Renew) |
| **決策**(本 session 新增) | D086 / D087 / D088 共 3 條 |
| **Commits**(本 session 新增) | `2d5db28`(T0250)/ `426d6fc`(T0251 fix)/ `42abda5`(T0251 worker report)/ `f572a06`(meta update)/ `3101c6b`(BUG CLOSED 收工) |
| **修改檔** | `electron/pty-manager.ts` / `electron/claude-agent-manager.ts` / `CLAUDE.md`(Embedded claude auto-update 停用章節) + `_ct-workorders/T0250-*.md` / `T0251-*.md` / `BUG-055-*.md` / `BUG-059-*.md` |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time | ~3h(含驗收等待) | 09:30-12:31 |
| Worker 工單 DONE | 2 / 2 | T0250(13 min)+ T0251(7 min) |
| 平均 Worker wall | 10 min | (13+7)/2 |
| Renew 次數 | 0 / 2 | 零 Renew |
| FAILED 次數 | 0 / 2 | 零失敗 |
| 一次研究即定根因 | 1 | T0250 反組譯直接找出 update flow |
| 一次修復即達成 AC | 1 | T0251 單檔多點修改,AC1-5 全綠 |

### 下 session pending(優先序)

1. 🟢 **`*evolve` 批次萃取 L067-L070** — session 25 候選(L067 反組譯研究神速 / L068 install hook 與 auto-update 同根因模式 / L069 spawn env flag 防御性修復通則 / L070 WONTFIX → REOPEN 觸發條件)
2. 🟡 **v0.3.0/v0.3.1 release 後續觀察** — GitHub Release + Homebrew tap 狀態,使用者已 push,塔台可被動等回報
3. 🟢 **Phase 2 CUDA advanced tier 評估** — 待 EXP-GPUWHIS-002 硬體升級實測
4. 🟢 **backlog 🟢 Low** — PLAN-002/007/015/026
5. 🟢 PLAN-021 IN_PROGRESS(等 dev smoke)
6. 🟢 PLAN-028 PLANNED(BAT dogfood CT v4.4)
7. 🟢 T0153 PARTIAL(Git GUI spike,擱置)
8. 🟢 **批次歸檔候選** — 熱區 8 張 BUG 全 CLOSED + 19 張 T DONE,等 `archive_days` 門檻(BUG-055/058/059 為 04-24/25 閉環需等 04-26+)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:`*evolve` 批次萃取 L067-L070(session 25 候選,有 4 條候選)
3. **優先序 2**:批次歸檔(等 04-26+ 達 `archive_days: 2` 門檻)
4. 下 session 新單編號起始:**T0252 / BUG-060 / PLAN-029 / D089 / EXP-[TOPIC]-002+**

### 本 session 成就

- 🎉 **熱區 8 張 BUG 全數 🚫 CLOSED 首次達成** — BAT 專案歷史首次零 open BUG 狀態
- 🎉 **T0250 反組譯神速** — 13 min 直接從 `cli.js` 找出 auto-update flow,L106 三要素再次驗證(BUG 描述含現象特徵 + 假設清單 + 建議前置檔)
- 🎉 **T0251 fire-and-forget 7 min** — 單檔多點 env 注入,Worker 零互動零 Renew,`DISABLE_AUTOUPDATER=1` 同時解 BUG-059(packaged)+ BUG-055(dev)兩條
- 🎉 **WONTFIX → REOPEN → CLOSED 完整閉環** — BUG-055 反證 WONTFIX 決策可在新證據下重評估,L070 候選

### 本 session 教訓

1. **WONTFIX 決策應留 reopen trigger** — BUG-055 原 WONTFIX(單次觀測 + 有 workaround),session 25 因 BUG-059 連帶反證 install hook 同根因,REOPEN 後一同閉環。教訓:WONTFIX 不是 final,應在元資料補「reopen trigger」欄位記錄重評估條件
2. **反組譯是研究型工單高效武器** — 當套件本身行為違反文件預期時,直接讀 `cli.js` 比測試假設快 5-10 倍。L067 候選(`*evolve` 批次)
3. **Spawn env flag 是防御性修復通則** — 當無法控制套件內部 auto-update 行為時,在所有 spawn 路徑無條件注入 disable env 是最 robust 的方案(vs. patch 套件 / 自行重打包)。L069 候選

---

## 🛏 前 Session 退出快照(第二十四 session,2026-04-23 16:30 ~ 2026-04-24 02:15,BUG-058 chain + v0.3.1 hotfix release)

### 本輪時間線

1. **04-23 16:30**(起手):使用者打包 v0.3.0 NSIS 後實機觀測 — `$BAT_HELPER_DIR` 缺 `_bat-*.mjs` helper scripts(yolo 派發鏈斷),BUG-058 OPEN(🔴 High,session 23 v0.3.0 release 後立即 regression)
2. **17:30**:T0246 研究結論(commit `f4aa535`)— 根因定位於 `package.json` `extraResources.filter` 白名單漏列,只 bundle 部分 helper(L107 候選 — release 過程缺 NSIS 完整重裝實機驗收)
3. **17:35-17:46**(D084):**T0247 fix-and-forget 11 min ✅ FIXED**(commit `a460d8b`,filter 改 glob 白名單 `_bat-*.mjs` 包全)
4. **19:05**(預防):**T0248 ✅ DONE**(commits `a73a965` + `1009154`)— 新增 `scripts/verify-helper-bundle.js` 靜態掃描 `scripts/*.mjs` 的 relative `.mjs` import,比對 `extraResources[].filter` 涵蓋,不通過則 abort build(防 helper bundle drift)+ CLAUDE.md「Packaging / Release 前置檢查」章節更新
5. **19:27-19:33**:**T0249 v0.3.1 release prep ✅ DONE**(commits `eca8ab6` chore + `02d8bb2` v0.3.1 hotfix)— CHANGELOG + bump 0.3.0 → 0.3.1 + commit,使用者 push + tag 觸發 GitHub Actions release
6. **20:43**:`44a180c` refactor terminal — 移除 hardcoded `--continue` / `--dangerously-skip-permissions`,對齊 PLAN-027 system claude runtime 路線
7. **04-24 02:15**(D085):**BUG-058 🚫 CLOSED**(commit `b0b8128`)— v0.3.1 GitHub Actions release(`02d8bb2`)NSIS installer 實測 `$BAT_HELPER_DIR` 含 4 個 `.mjs` helper,使用者驗收通過

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **BUG 閉環** | BUG-058 🚫 CLOSED(~10h wall 含 release 等待,純 work 約 2h) |
| **研究工單** | T0246 ✅ DONE(根因定位於 filter 白名單漏列) |
| **修復工單** | T0247 ✅ FIXED(11 min,filter glob)+ T0248 ✅ DONE(預防 verify-helper-bundle.js)+ T0249 ✅ DONE(release prep) |
| **決策** | D084 / D085 共 2 條 |
| **Release** | **v0.3.1 hotfix**(commit `02d8bb2` + GitHub Actions release,使用者 push) |
| **Commits**(本 session 新增) | `f4aa535`(T0246)/ `a460d8b`(T0247 fix)/ `a73a965` `1009154`(T0248 預防)/ `eca8ab6` `02d8bb2`(T0249 release)/ `44a180c`(terminal refactor)/ `b0b8128`(BUG-058 CLOSED docs) |
| **修改檔** | `package.json` extraResources.filter / `scripts/verify-helper-bundle.js`(新增) / `scripts/build-version.js`(require chain) / `CLAUDE.md` Packaging 章節 / `CHANGELOG.md` / `electron/terminal/*.ts`(refactor) |

### 下 session pending → 全部由 session 25 處理

(已於 session 25 起手立即接 BUG-059)

### 本 session 教訓

1. **packaging filter 變更要靜態檢查** — `extraResources.filter` 是 glob 白名單,新增 helper 容易漏列。L108 候選:filter 變更時觸發 verify-helper-bundle.js 強制檢查
2. **release 必須跑完 GitHub Actions 實機驗收** — session 23 的 v0.3.0 在打包前未實測 NSIS 完整路徑,BUG-058 在 release 後 30 min 內被使用者實機回報。L101 三度驗證
3. **預防工單與修復工單應該同 session 處理** — T0247 修 + T0248 預防同 session 完成,確保 release prep 包含完整修復鏈,避免漏防御層

---

## 🛏 前 Session 退出快照(第二十三 session,2026-04-23 11:48-16:02,~4h 10min,v0.3.0 首次正式版 release + session 22 pending 清盤)

### 本輪時間線

1. **11:48**(起手):Fast Path 啟動(快照 <7 天)→ 塔台報告 session 22 退場快照 + 下 session pending 優先序
2. **11:48-11:53**:使用者「依塔台建議」→ 塔台判斷派 T0243(BUG-056 預防對策,M sizing)→ 透過 BAT 內部終端 `bat-terminal.mjs --mode on --no-interactive` 派發
3. **11:53-11:58**:**T0243 Worker 5 min 神速交付**(commit `005132f`)— Step 1/2/3 全綠:`scripts/verify-native-modules.js` fail-fast + CI `npm ci` + verify step + CLAUDE.md `Packaging / Release 前置檢查` 章節 + CHANGELOG unreleased 條目;實機四組驗證(正/負/恢復/require chain),跨平台評估三平台共用無需分化,零 Renew,fire-and-forget
4. **11:58**:T0243 DONE,塔台接受 + 記 `934a8f7` meta update;3 項意外發現(`.github/` gitignore 誤分類、CI `npm ci` 已存在、副作用 require 刻意)評估完成
5. **~12:00-14:00**:執行 `*evolve` 批次萃取 session 22 學習候選 — 使用者選項 A「依建議分類」→ Global layer 5 條(GP083 先研後修 ROI / GP084 研究型工單三要素 / TG014 Electron NSIS 驗收 / TG015 Squash merge + node_modules / TG016 Native addon default 變動)+ Project layer 2 條(L092 Worker Step 合併準則 / L093 BAT zombie 進程)→ commit `64c2c6f`
6. **~14:10**:**塔台自主處理 T0243 意外發現 #1** — `.gitignore` line 40 `.github/` 誤混入「AI agent configs」區塊(該區塊本意僅忽略 `.claude/` / `.gemini/`),移除後 future `git add .github/...` 無需 `-f` flag → commit `39a59be`
7. **~14:30**:**塔台自主處理 PLAN-004 狀態更新** — 元資料歷程補齊 EXP-GPUWHIS-001 CONCLUDED + squash merge `cb65614` + BUG-057 `translate` 修復;Phase 2 CUDA advanced tier 必要性評估記錄(Vulkan 已涵蓋跨 vendor,GTX 1050 Ti Pascal 無 fp16 支援,暫緩 Phase 2 待 EXP-GPUWHIS-002 硬體升級後實測)→ commit `c546a0a`
8. **~15:00**:**v0.3.0 release 需求對齊** — Q1.C(minor bump from v0.2.x pre-release)/ Q2.All(涵蓋 session 21/22/23 + earlier unreleased)/ Q3.A(塔台直接起草 CHANGELOG)
9. **15:00-15:30**:塔台確認版號狀態 — 釐清 `gh` CLI 預設指向 upstream `tony1223` 誤會後,確認 `gowerlin/better-agent-terminal` fork 最新 GitHub Release = `v0.2.6-pre.1`(session 22 收工 commit `4f02c4a`),v0.3.0 語意 = **fork 首次正式版**(之前 v0.0.x / v0.2.x 全 pre-release)
10. **15:30-15:43**:CHANGELOG audit — 補 3 項 [Unreleased] 遺漏(Vulkan GPU / BUG-056 fix 說明 / BUG-057 fix)+ rename `[Unreleased]` → `[0.3.0] — 2026-04-23 — Multi-Agent Runtime, Supervisor Mode & GPU Voice Acceleration` + 新增空 `[Unreleased]` 頂層 + `package.json` + `package-lock.json` 1.0.0 → 0.3.0(同步 orphaned manifest 到 tag 序列)→ commit `2942a9d`
11. **15:43**:建立 annotated tag `v0.3.0`(本地)
12. **16:00**:使用者回報已 push + 自行處理 GitHub Release action → 塔台不介入
13. **16:02**:退場快照收工

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **Worker 工單** | T0243 ✅ DONE(5 min wall,零 Renew,fire-and-forget) |
| **塔台自主處理**(4 項) | `*evolve` 批次 7 條 / `.gitignore` 清理 / PLAN-004 狀態更新 / v0.3.0 release |
| **Release** | **v0.3.0 首次正式版**(commit `2942a9d` + annotated tag `v0.3.0`,本地建立,使用者 push) |
| **`*evolve` Global 晉升** | GP083 先研後修 ROI / GP084 研究型工單三要素 / TG014 Electron NSIS 驗收 / TG015 Squash merge + node_modules / TG016 Native addon default 變動 |
| **`*evolve` Project 新增** | L092 Worker Step 合併準則 / L093 BAT zombie 進程 |
| **決策** | 無新 D(session 23 執行型,沿用 D083 / D084 未開) |
| **Commits**(本 session 新增) | `005132f`(T0243 impl)/ `934a8f7`(T0243 meta)/ `64c2c6f`(evolve)/ `39a59be`(gitignore)/ `c546a0a`(PLAN-004)/ `2942a9d`(v0.3.0 release)+ tag `v0.3.0` |
| **修改檔**(使用者可見) | `scripts/verify-native-modules.js` 新增 / `.github/workflows/pre-release.yml` / `.gitignore` / `package.json` / `package-lock.json` / `CHANGELOG.md` / `CLAUDE.md` |
| **修改檔**(塔台 meta) | `_ct-workorders/T0243-*.md` / `_ct-workorders/_learnings.md` / `_ct-workorders/PLAN-004-*.md` / `~/.claude/control-tower-data/learnings/patterns.md` / `~/.claude/control-tower-data/learnings/tech-gotchas.md` |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time | 4h 14min | 11:48-16:02(含使用者對話等待) |
| Worker 工單 DONE | 1 / 1 | T0243(5 min wall) |
| Renew 次數 | 0 / 1 | 零 Renew |
| FAILED 次數 | 0 / 1 | 零失敗 |
| 塔台自主處理項 | 4 項 | `*evolve` / gitignore / PLAN-004 / release |
| 使用者糾正次數 | 2 | (1) 我說 v0.3.0 是從 0.0.x 往上 → 使用者澄清 fork 脫鉤 upstream,v0.x 獨立序列 (2) 我誤判本 session context 已累積 2.5h 建議收工 → 使用者糾正「這是剛開的 session」(存 feedback memory) |
| 粒度判斷準確度 | 塔台自主處理 4 項皆 <5 行且無邏輯變動 | 符合粒度判斷樹 |

### 下 session pending(優先序)

1. 🟡 **v0.3.0 release action 驗收** — 使用者手動處理 GitHub Release + Homebrew tap,塔台下 session 起手可確認是否成功(`gh release view v0.3.0 --repo gowerlin/better-agent-terminal`)
2. 🟡 **Phase 2 CUDA advanced tier 評估** — 待 EXP-GPUWHIS-002(未來硬體升級實測)有明確 ROI 證據再啟動;若使用者回報 fp16 GPU 上 Vulkan 效能不足可優先評估
3. 🟢 **backlog 其他 🟢 Low** — PLAN-002/007/013/014/015/026(Vite upgrade / remote container / installer force kill / VSCode extension / refactor dual render path / etc.)
4. 🟢 **CT v4.4.0 GA 後 Pull Layer 1**(session 20 原優先序,非阻塞)
5. 🟢 **EXP-GPUWHIS-002** — 未來硬體升級後實測 10x CPU 目標
6. 🟢 PLAN-021 IN_PROGRESS(等 dev smoke)
7. 🟢 PLAN-028 PLANNED(BAT dogfood CT v4.4,等 GA)
8. 🟢 T0153 PARTIAL(Git GUI spike,擱置)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:確認 v0.3.0 GitHub Release 狀態(使用者已 push,Release action 由使用者處理;塔台可被動等使用者報告,或起手時主動 `gh release view` 確認)
3. **優先序 2**:若 v0.3.0 release 順利,session 23 交付鏈完整閉環,可轉進 backlog 🟢 Low 項目或等待新需求觸發
4. 下 session 新單編號起始:**T0246 / BUG-058 / PLAN-029 / D084 / EXP-[TOPIC]-002+**

### 本 session 成就

- 🎉 **v0.3.0 首次正式版 release** — BAT fork 脫鉤 upstream 後的 stable baseline,CHANGELOG 完整記載 Multi-Agent Runtime + Supervisor Mode + GPU Voice Acceleration 三大主題
- 🎉 **Session 22 pending 全清** — T0243 預防對策閉環(Worker 5 min)+ 4 項塔台自主處理,無殘留事項進入下 session
- 🎉 **`*evolve` 批次萃取一次 commit 7 條** — 含 3 條強候選 Global 通則(Electron 打包驗收 / npm squash merge / native addon default 變動),直接跨專案可用
- 🎉 **塔台職責堅守** — 全程無越權讀 code / 改 code(僅讀工單回報、meta 檔案、CHANGELOG 等文件),Worker 1 張工單完成所有 code-touching 工作

### 本 session 教訓

1. **Fast Path 恢復時別把上 session 的 wall time 當成本 session 成本** — 存入 `feedback_session_boundary_confusion.md` memory,下次起手時跳過此錯誤
2. **`gh` CLI 預設指向可能不是使用者 fork** — 本專案 `gh repo view` 回 `tony1223/better-agent-terminal`(upstream),實際使用者 fork 是 `gowerlin/better-agent-terminal`;涉及 Release / Tag 操作要明確指定 `--repo gowerlin/better-agent-terminal`
3. **版號討論必先確認 tag 序列 + GitHub Release 狀態** — 本次若盲信 `git tag` 最大值(v2.1.48-pre.1 是繼承自 upstream 的 orphan tag)會建錯版號,需雙軌確認:本地 tag + GitHub Release

---

## 🛏 前 Session 退出快照(第二十二 session,2026-04-23 03:05-05:35,~2.5h,連環救火)

### 本輪時間線

1. **03:05-03:08**(起手):Fast Path 啟動 → 使用者截圖回報 BAT 打包版啟動崩潰 `Cannot find module '@kutalia/whisper-node-addon'` → 塔台判定 🔴 High regression from `cb65614`
2. **03:08**(對齊):Q1.B/Q2.A/Q3.C → 建 BUG-056 + T0241 research + D078
3. **03:17-03:30**:**T0241 研究 13 min ✅ DONE**(commit `526b7c1` 類等,Worker 交付 H6 結論反轉塔台 H1-H5 全數假設)— 根因 = main repo 從未 `npm install`,NSIS installer 本質不含 `@kutalia`
4. **03:35**(拆單):D079 Q1.C/Q2.B/Q3.C → 建 T0242(修復)+ T0243(預防,排隊)
5. **03:55-04:34**:**T0242 修復 39 min ✅ FIXED**(commit `e46932e`,零 source diff,僅 `npm install` + rebuild + NSIS 重裝驗收)— 使用者 Vulkan loader ✅ 截圖驗收
6. **04:34**:🎉 BUG-056 🚫 CLOSED + D080
7. **04:45**(第二 regression):使用者立即回報語音辨識繁中被翻譯為英文 → `*bug` 流程 → 建 BUG-057(Q1.A/Q2.A/Q3/Q4 精準對齊 → 塔台強懷疑 H2 `translate: true` 誤啟用)
8. **04:50**(對齊):使用者授權「其他塔台規劃」→ D081 A/A/A 路線(先研後修 + BUG-057 優先 + XS sizing)→ 建 T0244
9. **05:16-05:25**:**T0244 研究 9 min ✅ DONE**(commit `526b7c1`)— 根因 H2 確認:@kutalia default `translate: true`(舊套件 false),voice-handler 整檔零 `translate` 字串,H1/H3/H4/H5 全排除
10. **05:28**:D082 吸收 → 建 T0245 單行 fix
11. **05:25-05:35**:**T0245 修復 10 min ✅ FIXED**(commit `b2124b5`,`voice-handler.ts:462` 單行 `translate: false`)— 使用者雙情境(zh + auto)runtime 驗收通過
12. **05:35**:🎉 BUG-057 🚫 CLOSED + D083 → session 22 收工條件達成

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **BUG 閉環** | BUG-056 🚫 CLOSED(1h29min)+ BUG-057 🚫 CLOSED(50min) |
| **研究工單** | T0241 DONE(13 min,H6)+ T0244 DONE(9 min,H2 確認)— 兩次皆反轉 / 排除塔台假設 |
| **修復工單** | T0242 DONE(39 min,零 source diff,`npm install` + NSIS 重裝)+ T0245 DONE(10 min,1 行 diff) |
| **延後工單** | T0243 TODO(BUG-056 預防對策,M sizing,延下 session) |
| **決策** | D078 ~ D083 共 6 條 |
| **Commits**(本 session 新增) | `e46932e`(T0242) / `526b7c1`(T0244) / `b2124b5`(T0245) / 多筆塔台 meta |
| **修改檔** | `electron/voice-handler.ts`(1 行)+ `node_modules/`(npm install 產物)+ 多個 `_ct-workorders/` |

### 本 session 效率統計

| 指標 | 值 | 備註 |
|------|------|------|
| Wall time | 2h 30min | 03:05-05:35 |
| Worker 工單 DONE | 4 / 4 | T0241/T0242/T0244/T0245 |
| 平均 Worker wall | 17.8 min | 13+39+9+10=71 min |
| Renew 次數 | 0 / 4 | 零 Renew |
| FAILED 次數 | 0 / 4 | 零失敗 |
| 塔台假設反轉次數 | **5 + 4 = 9** | T0241 反轉 H1-H5;T0244 排除 H1/H3/H4/H5 |
| 塔台預估準確度 | 修復 sizing 全中(XS-S) | 研究 sizing 皆低估(實際更快) |

### 下 session pending(優先序)

1. 🟡 **T0243 派發** — BUG-056 預防對策(build fail-fast + CI `npm ci` + CLAUDE.md),`--mode on`,M sizing,60-90 min
2. 🟡 **T0246+ 版號 bump** — 原 session 21 預留(改編號),含 CHANGELOG + Homebrew tap
3. 🟡 **PLAN-004 狀態更新** — Phase 1 DONE 標記,Phase 2(CUDA advanced tier)必要性重新評估(Vulkan 零配置已涵蓋跨 vendor,session 21 記錄)
4. 🟢 **`*evolve` 批次萃取** — L101-L106 候選(多條 Global 強候選)
5. 🟢 **CT v4.4.0 GA 後 Pull Layer 1**(session 20 原優先序,非阻塞)
6. 🟢 **EXP-GPUWHIS-002** — 未來硬體升級後實測 10x CPU 目標

### 不急項目

- 🔄 PLAN-021 IN_PROGRESS(等 dev smoke)
- 💡 backlog 其他 🟢 Low(PLAN-002/007/013/014/015/026)
- T0153 PARTIAL(Git GUI spike,擱置)
- PLAN-028 PLANNED(BAT dogfood CT v4.4,等 GA)

### 恢復指引(下 session 起手)

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:T0243 派發(BUG-056 預防對策,M sizing,獨立非阻塞);派發模式建議 `--mode on` 非互動
3. **優先序 2**:T0243 DONE 後執行 `*evolve` 批次萃取 L101-L106(特別是 L101/L102 Global 強候選,跨專案通用 Electron 打包通則)
4. **優先序 3**:T0246+ 版號 bump(若 release pipeline 穩定)
5. 下 session 新單編號起始:**T0246 / BUG-058 / PLAN-029 / D084**

### 本 session 學習候選(待 `*evolve` 批次萃取)

- **L101**(🌐 Global 強候選):**packaging 驗收必須涵蓋「NSIS installer 完整重裝路徑」**;`dir/` mode、`zip` smoke、`ELECTRON_RUN_AS_NODE=1 probe.js` 皆非 production 等價。只有「完整卸載舊版 → 跑 .exe installer → 檢查 resources/ 落地 → 啟動 UI」整條 path 綠才算 installer 可 release
- **L102**(🌐 Global 強候選):**squash merge 只更新 `package.json` / `package-lock.json`,不同步 `node_modules/`**;合入後打包前必須 `npm ci` / `npm install`。CI pipeline 需強制此步驟
- **L103**(🌐 Global 候選,已多次驗證):**先研後修 ROI 極高**;T0241(13 min)反轉 5 個假設、T0244(9 min)確認 H2,兩次研究皆避免誤派。精準對齊三要素:現象特徵區分 + 假設清單 + 建議前置檔
- **L104**(🏠 Project 候選):**Worker Step 合併決策品質**;T0242 Worker SKIP Step 2 + 合併 Path A→B 有充分理由(VSCode 單例鎖),對照 D062「Worker 無狀態原則」此處合理。輸出判定準則
- **L105**(🏠 Project 候選,BAT 專屬):**打包版啟動失敗 zombie 進程殘留**;3 個 `BetterAgentTerminal.exe` uninstall 前未清,Windows installer 可強制覆蓋
- **L106**(🌐 Global 強候選):**研究型工單神速交付三要素**;(1) BUG 描述含現象特徵(區分原因空間,如「精確翻譯 vs 拼音」);(2) 塔台提供假設清單(H1-HN 含支持證據);(3) 建議前置檔(Worker 知道去哪裡看)。無此三者 Worker 需自行探索假設空間,耗時 2-3 倍
- **L107 候選**(🌐 Global 候選):**套件升級 default 行為變動**是隱性 regression 源頭;`@kutalia/whisper-node-addon` 將 `translate` default 從 `false` 改為 `true`,升級方無文件化。應用:升級 native addon 時檢查 default params 文件或 grep `defaultParams`

### 本 session 教訓

1. **T0238 packaging 驗收偽陽性**:用 `ELECTRON_RUN_AS_NODE=1 probe.js` 繞過 Electron asar resolver 是假驗收(L101)
2. **T0239/T0240 Squash merge 後缺煙測**:合入 main 後應先跑「packaged install 煙測」再派版號 bump,本輪少了這一層(L102)
3. **套件升級隱性 default 變動**:@kutalia 將 translate 設為 true 作為 default 無文件標示,只能靠 grep `defaultParams` 發現(L107)
4. **使用者精準描述加速診斷**:BUG-057 使用者提供「精確翻譯為英文(非拼音)」直接收斂 H2,節省大量假設測試(L106 三要素之一)

### 本 session 成就

- 🎉 **單 session 內兩連 regression 閉環**:從使用者截圖回報到完整修復,平均每個 bug 75 min 閉環
- 🎉 **Worker 效率破紀錄**:4 工單平均 17.8 min wall,零 Renew 零 FAILED
- 🎉 **塔台職責堅守**:全程不讀 code,透過工單回報區吸收 Worker 靜態分析結論,決策基於證據鏈
- 🎉 **L103 先研後修 ROI 第三次驗證**:session 22 內兩次(T0241/T0244)皆反轉假設,若盲修會浪費 30-60 min 且可能誘發新 bug

---

## 🚨 本 Session 開場事件(第二十二 session,2026-04-23 03:05~)— 收工後保留備查

### Fast Path 啟動後立即觸發緊急 bug

- **03:05**:使用者上傳截圖 — BAT 打包版啟動即崩潰 `Cannot find module '@kutalia/whisper-node-addon'`,require stack 指向 `app.asar\dist-electron\main.js:1:810`
- **03:07**:塔台完成事件判定 — 🔴 High regression from `cb65614`(EXP-GPUWHIS-001 Phase 1 squash merge),T0238 packaging 驗收偽陽性(probe.js 繞過 Electron asar resolver)
- **03:08**:需求對齊 Q1.B(pause T0241 版號 bump)/ Q2.A(開 BUG-056 + research)/ Q3.C(dir + NSIS 雙路徑驗收)→ 建 BUG-056 + T0241 + D078

### 本 session 教訓候選

- **L101 候選**:packaging 驗收必須涵蓋「NSIS installer 完整重裝路徑」,不能只跑 `ELECTRON_RUN_AS_NODE=1 probe.js`(Node 模式直跑會繞過 Electron main process 的 asar integration resolver)。T0238 全綠 vs 打包後崩潰是明確反例 — 候選 Global 升級(跨專案通用:Electron 打包驗收通則)
- **L102 候選**:squash merge EXP 到 main 時,應優先派一張「packaged install 煙測工單」而非立刻派版號 bump。D077 squash merge 後直接走到 T0241 版號 bump pending,漏了 packaging 煙測這層

---

## 🛏 前 Session 退出快照(第二十一 session,2026-04-23 00:12-02:45,~2.5h,高產出 session)

### 本輪時間線

1. **00:12-00:15**(恢復):Fast Path(快照 <7 天)→ CT 交接摘要(v4.4.0 release pipeline)→ 澄清:BAT 只需檢查是否要配合 CT 新模式 → 擬回覆 CT「BAT 無強制改動」→ 交接作廢
2. **00:15-00:27**(熱區清理):BUG-050 VERIFY → CLOSED(使用者驗收) / PLAN-024 DROPPED(BUG-050 閉環後不需要)/ PLAN-025 DROPPED + T0228 CANCELLED(移交 CT v4.4 上游統一實作)/ BUG-055 OPEN → WONTFIX(單次觀測 + 有 workaround)
3. **00:27-00:50**(PLAN-004 啟動):選項 B 平行 research,需求對齊 Q1.B/Q2.D/Q3.A → 建 T0236 research 工單 `--mode on --interactive`
4. **00:53-01:05**:**T0236 Worker 12 min 神速交付**(commit `f6a2720` + `28fa867`)— 技術選型報告 `_spec-gpu-whisper-2026-04.md`(360 行),結論**翻轉原假設**:CUDA-first + Vulkan fallback → Vulkan-first + CUDA 未來 advanced tier
5. **01:10**:🚨 YOLO 斷點 C(Worker 跨 PLAN 建議走 EXP)→ 使用者拍板 C→A 序:先記 D075,再建 EXP-GPUWHIS-001
6. **01:15**:派 **T0237 T-A**(L sizing,`--mode on --interactive`)→ Worker 13 min(commit `bd27732`)→ 🟡 PARTIAL 停損 #2 觸發(perf 0.99x CPU,根因 GTX 1050 Ti Pascal 無 fp16)
7. **01:35**:🚨 YOLO 斷點 B(Renew #1 = yolo_max_retries: 1 閾值)→ 使用者「保留成果,硬體升級時自動開啟支援」→ Q1.A 推進 T-B/C/D 合入主線
8. **01:40**:記 D076 + T0237 PARTIAL → DONE(塔台接受)+ 派 **T0238 T-B**(M sizing)
9. **02:03**:T0238 Worker 18 min(commit `2080880`)→ ✅ 4/4 全綠 — NSIS 291 MB + asarUnpack + `ELECTRON_RUN_AS_NODE=1 probe.js` 驗證 packaged Vulkan runtime
10. **02:08-02:33**:派 **T0239 T-C**(M sizing)→ Worker 25 min(commit `eba79b1`)→ ✅ 5/5 全綠 + 0 互動 + 0 Renew — `gpu-detector.ts` 203 行 + Settings UI + 13/13 tests
11. **02:40**:記 D077 + 派 **T0240 T-D**(S sizing)→ Worker 4 min(commit `e760b48`,main `cb65614`)→ ✅ 5/5 全綠 — Squash merge + build 三連綠 + worktree 清理 + EXP-GPUWHIS-001 📊 CONCLUDED
12. **02:45**:退出快照收工

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **熱區清理** | 5 張:BUG-050(🧪→🚫 CLOSED)/ BUG-055(🐛→⛔ WONTFIX)/ PLAN-024(📋→🚫 DROPPED)/ PLAN-025(📋→🚫 DROPPED 移交 CT)/ T0228(📋→🚫 CANCELLED) |
| **新 Research** | T0236 ✅ DONE(12 min,技術方向翻轉) |
| **新 EXP** | EXP-GPUWHIS-001 📊 CONCLUDED(Vulkan-first 整合實驗) |
| **新 Impl 工單** | T0237/T0238/T0239/T0240 全 ✅(T-A/B/C/D 四張 Phase 1) |
| **決策** | D075 Vulkan-first 翻轉 / D076 T-A PARTIAL 接受(硬體瓶頸)/ D077 Squash merge |
| **主線 feature** | `cb65614` `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)` |
| **新檔** | `electron/gpu-detector.ts`(203 行)+ `tests/gpu-detector.test.ts`(155 行,13/13)+ `_spec-gpu-whisper-2026-04.md`(研究報告 360 行)+ 5 張工單檔 |
| **commits**(session 內) | 15+ 個塔台 meta + Worker feature commits |

### 下 session pending(優先序)

1. 🟡 **T0241 版號 bump + CHANGELOG + Homebrew tap**(Q4.B 延後項,GP036 v1.1 minor/patch bump 流程)
2. 🟡 **PLAN-004 狀態更新** — Phase 1 DONE,Phase 2(CUDA advanced tier)在 Vulkan 零配置優勢下**必要性待重新評估**(已 Kutalia 涵蓋跨 vendor)
3. 🟢 **CT v4.4.0 GA 後 Pull Layer 1**(session 20 原優先序 Step 1,非阻塞)
4. 🟢 **EXP-GPUWHIS-002** — 未來使用者升級 RTX 30/40 / Ada / RDNA3 / Arc 等 fp16 GPU 後實測 10x CPU 目標驗證

### 不急項目

- 🔄 PLAN-021 IN_PROGRESS(等 dev smoke)
- 💡 backlog 其他 🟢 Low(PLAN-002/007/013/014/015/026)
- T0153 PARTIAL(Git GUI spike,擱置)
- PLAN-028 PLANNED(BAT dogfood CT v4.4,等 GA)

### 恢復指引

1. Fast Path 載入本快照
2. **優先序 1**:T0241 版號 / CHANGELOG(如需發 release)
3. **優先序 2**:PLAN-004 狀態整理(Phase 1 DONE 標記 + Phase 2 重新評估)
4. 下 session 新單編號起始:**T0241 / BUG-056 / PLAN-029 / D078 / EXP-(依 topic 另開)**

### 本 session 學習候選(待 `*evolve` 萃取)

- **L094 Worker 神速交付模式**:T0236 12 min / T0240 4 min / T0237/8/9 13/18/25 min — 塔台精準 scope + 明確停損 + spec 連結讓 Worker 可 fire-and-forget,0 互動(T0239/T0240)或極少互動(T0237)仍達成高品質
- **L095 研究工單反轉原假設的價值**:T0236 翻轉雙軌 → Vulkan-first 是**最有 ROI 的 12 min**。前研 T0058(2026-04-12)假設已過時,若直接派 impl 會走錯方向 3-5 天;先跑 research 省下大量 downstream 成本
- **L096 硬體瓶頸 vs 套件缺陷的判定**:T-A 停損 #2 觸發時,Worker 提供雙根因分析(套件完美 + 硬體 Pascal fp16 瓶頸)讓塔台能正確接受 PARTIAL 推進 T-B/C/D。若 Worker 只報「perf 不達標」未分析根因,容易誤判為套件問題 → ABANDONED
- **L097 Squash merge vs regular merge 的 EXP 歷史保留**:D077 決策 squash 保留 3 commit hash(bd27732/2080880/eba79b1)到 D 日誌 → 未來需對照 T-A/B/C 細節仍可查 reflog / 重建 branch;main 歷史乾淨 bisect 友善
- **L098 use_gpu: true auto-detect + 靜態 vulkan loader 探測 hybrid 模式**:T-C Q1=A+hybrid 方案(不引入 systeminformation 重依賴 + 不 spawn probe subprocess)比純 explicit probe 輕量 10x,仍能生成完整 UI hint。通用 pattern 候選

### 本 session 教訓

- **L099 使用者指示釐清的 cost**:開場「交接摘要」被誤讀為執行請求,Q1 作用域確認才發現實際需求是「BAT 檢查是否需配合 CT」。**教訓**:接收到複雜交接時,先做 1 輪作用域澄清再承諾工作,可省下誤派 CP-DELEGATE 工單的成本
- **L100 YOLO 斷點系列實證**:本 session 觸發斷點 C(T0236 Worker 建議走 EXP)+ 斷點 B(T0237 Renew #1 達閾值)皆**正確暫停**等使用者拍板 — 與 SKILL.md 規格完全一致。斷點機制是 dogfood 成果,不是擋路

---

## 🛏 本 Session 退出快照(第二十 session,2026-04-22 20:25-21:00,~35 min,短 session)

### 本輪時間線

1. **20:25-20:30**(恢復):Fast Path(快照 <7 天)→ BUG-055 登記請求
2. **20:30-20:35**:BUG-055 建立(`claude.exe.old.XXX` 殘留,🟢 Low / 🐛 OPEN / 只出現一次 / 有 workaround);`_bug-tracker.md` 增量更新
3. **20:35-20:40**:`*sync` 全量重建兩個 tracker(補齊 session 17-19 drift,BUG-048/051/052/053/054 CLOSED 登記 + PLAN-027 DONE)
4. **20:40-20:50**:`*archive` 批次歸檔 **101 張**(15 BUG + 11 PLAN + 75 T/EXP),熱區 126 → 25 張(80% 壓縮);遭遇 Git Bash CRLF 解析 bug,改用預寫 shell script 以 LF 繞過
5. **20:50-20:55**:真相發現 — 使用者問「CT v4.4 Phase 1 對端是否已接手」,查 `D:\ForgejoGit\BMad-Guide\` parent repo 發現**對端 2026-04-22 12:10→22:40 自主完成 Phase 1-2 全部** + T0108 bonus(8 commits 已 push `origin/dev-main`);BAT 的 D074「接手派發」從未執行
6. **20:55-21:00**:`_cross-references.md` + `_decision-log.md` D074 過時標記 + 塔台建議 C+D(Dogfood + Pull Layer 1,不派 Phase 3-4)→ 使用者接受 → 收工

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **新單** | BUG-055 🐛 OPEN(SDK install hook 殘留) |
| **歸檔** | **101 張**(15 BUG + 11 PLAN + 75 T/EXP)→ `_archive/{bugs,plans,workorders}/` |
| **Tracker 重建** | `_bug-tracker.md`(熱區 4 張)/ `_backlog.md`(熱區 12 張)|
| **跨專案** | `_cross-references.md` T0099-T0104 ✅ DONE 登記 + D074 strikethrough;`_decision-log.md` D074 加過時標記(session 20)|
| **真相** | D074 從未執行;對端 BMad-Guide 自主推進 Phase 1-2 完畢(commit `9ba3c8a`/`678d5a2`/`a9c5967`/`0de4e2b`/`c3a4282`/`a61c066`/`4b274e7`/`ebb7a63`/`41298e3`)|
| **決策方向** | 下 session 走 **C + D**:Pull BMad-Guide Layer 1 → Dogfood 新 template v3.7 → 回饋對端作 Phase 3 設計輸入 |

### 三個 pending(下 session 優先序,session 21 起手)

1. 🟡 **Step 1(D):Pull BMad-Guide Layer 1 v4.4.0-dev** → BAT 本地(10-15 min)
2. 🟡 **Step 2(C):Dogfood 一張真實工單** — 候選 BUG-055 修復 / PLAN-025 Auto-session(用新 template v3.7 完整填 intervention_type/affects_files/spec_level_check/memory_overrides)
3. 🟡 **Step 3:CT-T011 REVIEW 類型回饋** → 對端 Phase 3 (T0105) 設計輸入

### 不急項目

- 🐛 BUG-050 🧪 VERIFY(等 PLAN-025 結案)
- 📋 T0228 TODO(PLAN-025 integration)
- 🔄 PLAN-021 IN_PROGRESS(等 dev smoke)
- 💡 backlog 其他 🟢 Low

### 恢復指引

1. Fast Path 載入本快照
2. **優先序 1**:Pull Layer 1 → Dogfood → 回饋對端(Step 1→2→3)
3. **避免**:不要再派 CT-T011/T012 DELEGATE(對端節奏自行推進 Phase 3-4)
4. 下 session 新單編號起始:**T0236 / BUG-056 / D075 / PLAN-029**

### 本 session 教訓

- **L092 跨專案狀態查核 before 決策派發**:D074 做在 11:50(對端當時 tower state 顯示 CT-T010 未 push),但對端在 12:10 後自主推進。BAT 在 `_cross-references.md` 登記「接手派發」後沒有查 parent repo 實際狀態,差點重複派工。**教訓**:跨專案協調工單在「派發前」必須做一次 parent repo 最新 git log 查核(至少 `git log --oneline -15`),否則 D074 這種「stale decision」會進 decision log 成為雜訊。候選 Global learning。
- **L093 Git Bash CRLF 批次處理 gotcha**:Python 在 Windows 寫 `open('file','w')` 會用 CRLF line endings,bash `while read` 讀到的 `$file` 變數結尾會帶 `\r`,讓 `git mv` 失敗全靜默(已靠 `open('_move_commands.sh','wb')` 用 bytes + `\n` 繞過)。**教訓**:跨平台 shell pipeline 用 Python 產 script 時,一律 binary 模式 + 明確 `\n`。候選 Global learning。

### 本輪時間線

1. **12:05**(恢復):Fast Path,CT-T010 已由對端 Worker yolo 自動交付,吸收 DONE + commit `e362ed1` + 主 PLAN T0098
2. **12:10-12:20**:D074 決策 BAT 接手 Phase 1-4 派發 + `_cross-references.md`/PLAN-028/`_decision-log.md` 更新,commit `9bf8911`
3. **12:12-12:20**:T0229 research 重派(疑停擺)→ Worker 交付,commit `b622b6e`+`df2b685`,拆單 7→5 張
4. **12:35-12:42**:派 **T0230** → Worker 4 min,commit `4894b18`+`63a65e6`
5. **12:50-13:04**:派 **T0231** → Worker 10 min,commit `a767de8`(**方案 A 變體**讀 settings.json 檔)
6. **13:08-13:27**:派 **T0232** → Worker 14 min,commit `a8b3448`,三語 i18n + Toast
7. **13:32-19:03**(含 ~5h 排程延遲):**T0233** Worker 15 min active,commit `307647d9`,28 tests + spike positive + **發現 BUG-053**
8. **19:10-19:15**:使用者 runtime 驗收 → **發現 BUG-054**(切 system 終端版本沒變)
9. **19:15-19:25**:Audit spawn 點發現 main.ts 3 處遺漏 + 使用者主導 Option A 決策(對齊 native)→ 開 BUG-054 + 派 **T0235**
10. **19:34-19:45**:T0235 Worker 11 min,commit `058412a`,使用者驗收通過 → BUG-053/054 CLOSED
11. **19:52-20:06**:派 **T0234** → Worker 9 min,commit `58de14c`,CLAUDE.md + CHANGELOG + UI hint 合併
12. **20:10-20:25**:PLAN-027 ✅ DONE 結案 + 5 條學習萃取 + 退出快照

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **工單** | **7 張 DONE**(T0229/T0230/T0231/T0232/T0233/T0235/T0234)+ CT-T010 DONE 吸收 |
| **PLAN** | **PLAN-027 ✅ DONE**(Phase 1 全閉環,63 min vs R5 估 285 min ~4.5x)|
| **BUG** | BUG-053 🚫 CLOSED + BUG-054 🚫 CLOSED |
| **決策** | D074(BAT 接手 Phase 1-4 派發)|
| **程式碼** | 2 新檔(claude-resolver / claude-runtime-router)+ 7 檔修改 + 28 unit tests |
| **文件** | CLAUDE.md Runtime Selection 40 行 + CHANGELOG + mac/Linux playbook |
| **學習** | GP073 全庫 grep / GP074 settings.json 注入 / GP075 Legacy shim 砍方向(Global)+ L090 preload-d.ts 同步 / L091 Worker 效率 4-5x(Project) |

### 本 session commits(本機累計 18 個,待 push)

```
[本 session 新增 10 個]
90b1381 PLAN-027 ✅ DONE — Phase 1 完全閉環 + BUG-053/054 CLOSED
58de14c T0234 CLAUDE.md + CHANGELOG + UI hint
058412a T0235 hotfix BUG-054/053
307647d9 T0233 tests + spike + playbook
a8b3448 T0232 UI + toast
a767de8 T0231 router + 3 spawn points
63a65e6 T0230 closeout
4894b18 T0230 resolver + settings + IPC
df2b685 T0229 closeout
b622b6e T0229 research report
9bf8911 CT-T010 DONE 吸收 + PLAN-027/028 + D074

[第十七/十八 session 累積 7 個]
56917c6 第十八 session 退出快照
e097629 / bc98063 / ebb6ae2 / 6fcbbaf / d197b60 / 95c2be0
(+ 本收工 commit:_tower-state.md + _learnings.md + GP073/074/075)
```

### 三個 pending(下 session 優先序)

1. 🟡 **CT v4.4 Phase 1 派發**(D074 路徑):T0099-T0101(audit + 快勝,建議 yolo+interactive)→ CT-T### DELEGATE 到 BMad-Guide `dev-main`
2. 🟡 **PLAN-028 dogfood 驗證**:Phase 1 實作後在 BAT 跑 `*sync` / `*evolve --status`,觀察 6 項改良
3. 🟢 **等 Selene 跨平台 playbook 實測**(含 session state 實機驗證,T0233 flag positive theoretical)

### 不急項目

- 🐛 BUG-050 VERIFY(等 PLAN-025 結案)
- 📋 T0228 TODO(PLAN-025 integration)
- 🔄 PLAN-021 IN_PROGRESS(等 dev smoke)
- 🆕 BUG-055 候選:`claude.exe.old.XXX` 殘留(T0235 發現,install hook 問題,非 PLAN-027 範圍)
- 💡 backlog 其他 🟢 Low

### 恢復指引

1. Fast Path 載入本快照(<7 天)
2. **優先序 1**:CT v4.4 Phase 1 派發(或依使用者當下議題)
3. **優先序 2**:若 Selene 已跑 playbook → 吸收回報
4. 下 session 新單編號起始:**T0236 / PLAN-029 / D075 / BUG-055**

### 本 session 學習候選(已處理)

- ✅ GP073(Global):Research spawn-site 盤點全庫 grep
- ✅ GP074(Global):Electron 設定注入「讀 settings.json 檔」變體
- ✅ GP075(Global):Legacy shim 修復決策對齊 native
- ✅ L090(Project):BAT preload + electron.d.ts 同步
- ✅ L091(Project):BAT Worker 效率係數 R5 估 ÷ 實際 ≈ 4-5x

### 本 session 教訓

1. T0229 R4 scope 缺口 → GP073
2. Worker 創新:T0231 方案 A 變體 → GP074
3. UI 驗收 + runtime 驗收是兩個獨立關卡(T0232 通過但 BUG-054 才暴露)
4. 原則對齊 > workaround(BUG-053 Option A 由使用者主導)→ GP075

### 小心假設(續 L089)

PLAN-027 4-5x 效率前提:**Research 先拆細 + yolo+interactive + 成熟架構**。不類推所有專案(見 L091)。

---

## 🛏 第十八 Session 退出快照(2026-04-22 ~09:40-12:05,~2.5 h wall)

### 本輪時間線

1. **09:40**:`/control-tower` Fast Path 恢復(快照 <7 天,免 rescan)
2. **09:41-09:46**:PLAN-027 對齊(Q1-Q7 共 7 題)+ 登記 IDEA
3. **09:46-10:50**:CT-T009 派發 → IN_PROGRESS(Worker ~15 min 交付 v4.3.3)
4. **11:05-11:25**:CT-T009 AC 驗收 DONE + v4.3.3 閉環一條龍(tag+push 指引、Selene guide 交付包、LINE 短訊版)
5. **11:25**:CLT 分析文件(`BMad-Guide/spec/`, ~400 行)討論 → 三專案分工(CT-skill 主導 / BAT + Cooperative 雙 dogfood)
6. **11:25-11:45**:PLAN-028 登記 IDEA + `_cross-references.md` 首建 + CT-T010 DELEGATE 準備
7. **11:46**:CT-T010 派發 → IN_PROGRESS(CT 接手,BAT 任務完成分界)
8. **11:55-12:00**:T0229 research 派發(PLAN-027 啟動工單,non-yolo / interactive)
9. **12:00-12:05**:`*evolve` 萃取 GP071/GP072(Global)+ L089(Project)+ 退出快照

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **工單** | CT-T009 ✅ DONE(v4.3.3 ship)+ CT-T010 🔄 IN_PROGRESS(v4.4.x meta-PLAN 跨專案)+ T0229 🚚 DISPATCHED(PLAN-027 research) |
| **PLAN** | PLAN-027 📐 PLANNED(Claude Runtime)+ PLAN-028 💡 IDEA(BAT dogfood CT v4.4.x) |
| **首建** | `_cross-references.md`(跨專案參照,記錄 CT-T008/T009/T010 + CLT 文件) |
| **學習萃取** | GP071 剪貼簿污染測試指南設計 + GP072 Skill 演進三層分工 + L089 跨專案 DELEGATE 降格模式 |
| **閉環** | v4.3.3 ship 全套(tag+push 指引 + Selene guide 交付包 + LINE 短訊版) |

### 本 session commits(本機累計 8 個,待 push)

```
e097629 T0229 research 派發 — PLAN-027 可行性研究
bc98063 CT-T010 DELEGATE 派發 — CT v4.4.x meta-PLAN + Phase 1-4 骨架
ebb6ae2 PLAN-028 IDEA + _cross-references.md 首建 — BAT dogfood 驗證 CT v4.4.x
6fcbbaf CT-T009 ✅ DONE — AC-1~7 全勾選驗收
d197b60 Selene v4.3.3 測試指南新寫 + 舊 guide 清理 (CT-T009 Worker 交付)
95c2be0 PLAN-027 IDEA — Claude Runtime 選擇機制
(+ 本收工 commit:_tower-state.md + _learnings.md + GP071/GP072 Global)
```

### 三個 pending(下 session 恢復後優先序)

1. 🔴 **等 T0229 Worker 回報**(research,45-90 min,non-yolo,需互動):結論明確 → 派 PLAN-027 Phase 1 實作工單;結論不足 → Renew
2. 🟡 **等 CT-T010 Worker 回報**(CT 側):交付主 PLAN 編號後,回填 PLAN-028 「主導 Repo」欄位 + `_cross-references.md` 主 PLAN hash
3. 🟢 **等 Selene v4.3.3 實測回報**(由 CT 接手,不阻塞 BAT):若需 BAT 整合,CT 會派協作單過來

### 不急項目(backlog 保持,不主動排入)

- 🐛 BUG-050 VERIFY(樣本 10/10 達標,等 PLAN-025 整體結案一起 CLOSE)
- 📋 T0228 TODO(PLAN-025 integration)
- 🔄 PLAN-021 IN_PROGRESS(等 dev smoke)
- 💡 backlog 其他 IDEA / PLANNED 🟢 Low

### 恢復指引(下輪 `/control-tower` 啟動)

1. Fast Path 載入本快照(快照 <7 天)
2. **優先序 1**:檢查 T0229 Worker 回報(若已開 session)
3. **優先序 2**:檢查 BMad-Guide 是否已 push(CT-T010 完成通知)
4. **優先序 3**:等 Selene 實測回報(不主動)
5. 下 session 新工單編號起始:T0230 / PLAN-029 / D074 / BUG-053

### 本 session 學習候選(已於本輪收工時處理)

- ✅ GP071(Global):測試指南需明示可區分預期輸出(剪貼簿污染場景)
- ✅ GP072(Global):Skill 演進三層驗證分工(主導 + 穩定 + 激進 dogfood)
- ✅ L089(Project):跨專案 DELEGATE 連續派發 → 本端塔台降格追蹤中心

### 小心假設(續 L088 / GP070)

跨專案 DELEGATE 連續派發時,本端塔台**絕不複製對端 PLAN 內容到本地 state**,只保留 `_cross-references.md` 追蹤。詳見 L089。

---

## 🛏 前次 Session 退出快照(2026-04-20 ~18:30,第十七 session 收工)

### 本輪時間線(~5 h wall,午後)

1. **13:00-13:30**(30 min):`/control-tower` Fast Path 恢復 → 處理 OSC 52 測試指令補發(給 Selene 再貼一次)→ 使用者切換議題
2. **13:30-13:40**(10 min):`*evolve` 萃取學習候選 — L083(project)+ GP067-GP070(global,含 ⭐ GP070 devcontainer 根因反模式)
3. **13:40-13:55**(15 min):`*sync` 完整重建 — 修正 BUG-050 狀態 drift(FIXING → VERIFY)、PLAN-023 DONE、PLAN-022 IN_PROGRESS、PLAN-025 缺失、tower-state 計數器對齊
4. **14:00-14:10**(10 min):PLAN-022 結案討論 → D073 決策(Step 3 TOFU fallback **不做**,保留 fail-close 安全模型)
5. **14:10**:13 commits push `origin/main`(122870e..2fb4307)
6. **18:01-18:05**(5 min):Selene 回報 OSC 52 測試 → **❌ 穿透失敗確認**(剪貼簿原 LINE copy 內容未被覆蓋 = escape sequence 被容器/Gateway/GoLand terminal 吞掉)
7. **18:15-18:25**(10 min):v4.3.3 規劃對齊(Q1-Q4 四題) → CT-T009 DELEGATE + PLAN-026 IDEA 建立
8. **18:30**:2fb4307..653c068 push,收工

### 本 session 產出

| 類別 | 內容 |
|------|------|
| **學習萃取** | L083 project(flag drift)+ GP067-GP070 global(Renew-lite / skill-repo 分離 / yolo 壓縮 / **⭐ devcontainer 根因反模式**) |
| **Drift 修正** | `_bug-tracker.md` / `_backlog.md` / `_tower-state.md` 三處對齊 |
| **PLAN 結案** | PLAN-022 ✅ DONE(D073,Step 3 不做) |
| **新單據** | CT-T009 DELEGATE v4.3.3(📋 TODO,待派發)+ PLAN-026 IDEA(JB Gateway 剪貼簿 proxy) |
| **Selene OSC 52 結論** | ❌ 穿透失敗,JB Gateway Dev Container **不轉發 OSC 52** escape sequence |

### v4.3.3 規劃決議(CT-T009 — 雙軌交付 [C])

- **CT-T009 v4.3.3 patch**(30-45 min):A 面第 21 條偵測(`test -d /.jbdevcontainer/`)+ A.2 Step 2.5 決策樹(含 Step 2.5.1 子分支)+ C.2.3 第 13 條 OSC 52 支援清單 JB ❌ + CHANGELOG Known Limitations
- **PLAN-026 IDEA**:JB Gateway 剪貼簿 proxy(HTTP daemon via `host.docker.internal` → `pbcopy`)→ 🟢 Low,待 ≥3 人 JB 樣本或 ≥1 月試跑 feedback 再評估
- **誠實範圍定位**(Q4=A):v4.3.3 只解「識別正確 + 訊息清楚」,auto-session 自動化對 JB Gateway **仍不可用**(Gateway 協議本身無新分頁能力 + OSC 52 穿透失敗)

**對齊決議**:Q1=**A**(`--mode yolo`)/ Q2=**C**(清理舊 guide + 新寫 `_guide-selene-v433-jb-gateway-validation.md`)/ Q3=**A**(Gower 手動 tag+push)

### 本 session commits(全部已 push `origin/main`,共 14 個)

```
本 session 新產出(4 個):
653c068 CT-T009 DELEGATE v4.3.3 + PLAN-026 IDEA
2fb4307 PLAN-022 結案 + D073
8dd2616 *sync drift 修正 + 重建 tracker/backlog
4c417ca *evolve L083 寫入

前 session 累積(10 個,本 session 一併 push):
2b18b99 退出快照 — PLAN-025 yolo 三連擊 + CT-T008 v4.3.2 release
cba7d09 CT-T008 Worker 交付 + Selene T0228 測試指南
1e66ab7 CT-T008 建立 — v4.3.2 hotfix DELEGATE
7ffaf87 PLAN-025 yolo 三連擊完成
71f004d T0227 收尾元資料
ba9aa74 T0227 C 面剪貼簿層落地
cbeb117 T0226 B 面指令矩陣落地
901dff2 T0225 偵測層重構
54a9500 PLAN-025 roadmap 建立
aea9373 T0224 研究完成
```

### 候選學習(下輪 *evolve)

| ID | 候選內容 | 觀察來源 |
|----|---------|---------|
| **L089** | 測試指南若要求使用者從通訊軟體複製指令到目標環境執行,Cmd+V 驗證前 host 剪貼簿已被複製動作污染,指南需明示「可區分的預期輸出」(短字串 vs 整段指令長度對比) | 本 session Selene OSC 52 溝通摩擦:Selene 回報「step2 回來 mac 就是剛才 copy 的那行啊」,她誤以為無資料,實則正是穿透失敗的明確證據 |

### 恢復指引(下輪 `/control-tower` 啟動)

1. Fast Path 載入本快照(快照 <7 天)
2. **立即動作優先序**:
   - 🔴 **派 CT-T009**:切到 `D:/ForgejoGit/BMad-Guide/` → `claude "/ct-exec CT-T009"`(yolo 模式)
   - 🟡 **等 Selene v4.3.3 實測**:Worker 交付後,塔台 grep 新 guide 路徑 → 交 Gower → LINE 給 Selene
   - 🟢 **`*evolve` 萃取 L089**:測試指南污染場景的設計教訓
3. **等待項目(自動,不主動)**:
   - Global 學習(GP067-GP070 在 skill 層 `~/.claude/control-tower-data/patterns.md`)→ 等 `claude-brain-sync` auto-sync,或手動 `/brain-patch`
   - Skill 層 `auto-session.md` 改動(PLAN-025 本 session 累計 +520 行)等 auto-sync 同步到 Forgejo
4. **未閉環項目**(非本 session 新增,持續追蹤):
   - 🐛 **BUG-050 VERIFY**(樣本 10/10 達標,等 PLAN-025 整體結案一起 CLOSED)
   - 📋 **T0228 TODO**(PLAN-025 integration,等 v4.3.3 可取得)
   - 🔄 **PLAN-021 IN_PROGRESS**(等使用者 dev smoke 驗收,不阻塞)
   - 💡 Backlog 4 IDEA + 3 PLANNED 🟢 Low(不主動排入)

### 小心假設(沿用 L088 教訓)

任何「devcontainer」「remote container」「dev environment」相關討論,**先問 IDE 與遠端協議**,再動手。已 Global 化為 GP070,適用所有研究/偵測工單。

---

---

## 🛏 前次 Session 退出快照(2026-04-20 ~13:00,等 Selene 回報切換議題)

### 本輪時間線(~2.5 h wall)

1. **10:13-10:47**(34 min):PLAN-025 規劃 + T0224 研究工單(~6.7-10x 壓縮)
2. **10:48-11:15**(27 min):**yolo 三連擊** T0225/T0226/T0227(~6-9x / ~15-20x / ~12-18x)— BUG-050 樣本 7→10/10 達標
3. **11:30-12:02**(32 min):CT-T008 DELEGATE v4.3.2 hotfix(sanitize + release,commit `61dec10`)+ Selene T0228 測試指南產出
4. **12:30-13:00**(30 min):Selene 回報揭露**重大假設失誤**——她是 **JetBrains Gateway + GoLand Dev Container**(不是 VS Code Remote-Containers),v4.3.2 偵測對此情境無識別力
5. **13:00** 切換議題,等 Selene 補 OSC 52 穿透結果

### PLAN-025 狀態

| 工單 | 狀態 | Commit | 備註 |
|------|------|--------|------|
| T0224 research | ✅ DONE | aea9373 | 四面矩陣 + 10 Step 決策樹 + 7 CHECK-LIST + 拆單 + 7 風險 |
| T0225 impl | ✅ DONE | 901dff2 | A.1 20 變數表 + A.2 10 Step + TerminalDetection struct / yolo #8 clean |
| T0226 impl | ✅ DONE | cbeb117 | B 面 17 終端指令 + 失敗偵測 + R6 osascript 緩解 / yolo #9 clean / **~15-20x 紀錄** |
| T0227 impl | ✅ DONE | ba9aa74 | C 面 9 剪貼簿 + OSC 52 規格 + 12 支援清單 / yolo #10 達標 |
| T0228 integration | 📋 TODO | — | **暫緩**,先處理 JB Gateway 偵測缺口 |
| CT-T008 DELEGATE | ✅ DONE(Worker 交付) | 61dec10 | v4.3.2 release commit;tag+push 待 Gower 自處 |

### BUG-050 樣本累積

- 達標 **10/10** 🎯(但採 Q1.B 等 PLAN-025 整體結案再 CLOSE)
- GP042 升 Skill 條件全達(已 Skill 化)

### ⚠️ **重大假設失誤揭露**(L088 候選)

**現象**:v4.3.2 對 Selene 主場景(JB Gateway Dev Container)**幾乎無識別能力**,全部 fallthrough 到 Step 10 Fallback。

**根因**:
- T0224 研究前提把「devcontainer」等同於「VS Code Remote-Containers」
- 未詢問 Selene 實際用哪個 IDE / 遠端協議
- 實際生態:VS Code Remote-Containers / **JetBrains Gateway Dev Container** / Cursor / 純 docker exec / 其他

**從 Selene env + devcontainer.json + Dockerfile 萃取的決定性事實**:
- **IDE**:GoLand 2026.1 aarch64(via JetBrains Gateway)
- **容器基底**:`mcr.microsoft.com/devcontainers/go:1.26-bookworm`(MS 官方 Go devcontainer)— `USER=vscode` 是 MS base image 慣例,**不代表 VS Code**
- **容器運行時**:OrbStack(macOS Apple Silicon)
- **Claude**:**原生 CLI**(Dockerfile line 125),**不是 BAT** → `BAT_SESSION=1` 永遠不存在,Step 0 短路不觸發
- **JB Dev Container 標記目錄**:`/.jbdevcontainer/`(檔案系統,比 env 可靠)
- **關鍵 env 缺失**:❌ 無 `REMOTE_CONTAINERS` / `CODESPACES` / `TERM_PROGRAM` / `IDEA_*` / `JETBRAINS_*` / `GATEWAY_*`
- **可用 process 信號**:`remote-dev-serv` / `jetbrainsd`(parent process 鏈)+ bash `--rcfile /.jbdevcontainer/...`

### v4.3.3 Patch 初步規劃(待 Selene OSC 52 結果確認)

**偵測策略**:不能靠 env,**必須檔案系統 + process**

```
A.1 新增:第 21 條 JetBrains Gateway Dev Container
  主要偵測:test -d /.jbdevcontainer/
  輔助:ps -ef | grep -E "remote-dev-serv|jetbrainsd"
  輔助(弱):$PWD 以 /IdeaProjects/ 開頭

A.2 新增 Step 2.5(在 Step 2 VS Code Remote-Containers 之後,Step 3 SSH 之前):
  [ -d /.jbdevcontainer/ ]
    → JetBrains Gateway Dev Container
    → 子決策依 OSC 52 結果

C.2.3 OSC 52 支援清單:新增 JetBrains Gateway 條目(標 ✅/❌ 依 Selene 結果)
```

**工單拆解依 Selene OSC 52 結果**:
- ✅ 穿透 → 單張 v4.3.3 patch,~30 min
- ❌ 穿透失敗 → research + patch,~60 min(備案:`host.docker.internal` HTTP 剪貼簿 proxy → pbcopy daemon,**超範圍但已備忘**)

### 本 session 學習候選(L084-L088,待 *evolve)

| ID | 候選內容 | 觀察來源 |
|----|---------|---------|
| L084 | 工單建議 flag vs 實際派發 flag 不一致 | T0225/T0226/T0227 連續三次 Worker 回報 |
| L085 | **Renew-lite 有效** — 中途編輯工單,Worker 在執行中讀到更新 | T0225 R4 移交 T0228 成功採納 |
| L086 | skill 層 reference 異動 vs repo commit 分離 | T0225/T0226/T0227 三次;auto-session.md 在 `~/.claude/skills/` 非 repo |
| L087 | yolo 實作工單平均 ~12x 壓縮(條件:研究已收斂 + 實作邊界清楚) | T0225 ~6-9x / T0226 ~15-20x / T0227 ~12-18x |
| **L088** | **「devcontainer」的 IDE assumption 錯誤**(假設 VS Code,實際 JB/Cursor/其他) | PLAN-025 研究前提失誤 — **根因教訓**:需求對齊階段必問「使用者實際 IDE 與遠端協議?」 |

### 待辦事項(下次 session 恢復後)

**依優先級**:

1. 🔴 **等 Selene OSC 52 Cmd+V 結果**(塔台已透過 Gower 送出測試指令,等待中)
2. 🔴 **收到結果 → 產 v4.3.3 patch 工單**(T-JB1 或 T-JB1+T-JB2)
3. 🟡 **Gower 自處 CT-T008 閉環**:`git tag v4.3.2 61dec10 && git push origin dev-main v4.3.2`
4. 🟡 **打包 v4.3.2 skill + 測試指南給 Selene**(附註:指南的 VS Code Remote-Containers 預期不適用 JB,需補 JB 版指南 or v4.3.3 出來後重寫)
5. 🟢 **`*evolve` 萃取 L084-L088**(L088 特別重要 — 根因級教訓)
6. 🟢 **T0228 Selene 整合驗證**(v4.3.3 可取得後)
7. 🟢 **PLAN-025 整體結案**(T0228 通過後可關 + BUG-050 閉環 CLOSE)
8. 🟢 **GP042 已 Skill 化沿用**(本輪 4 張工單再驗證 4 次,模式超穩)

### 本 session 累計 commit(待 push,10 個)

```
cba7d09 CT-T008 Worker 完成 + Selene T0228 測試指南
1e66ab7 CT-T008 建立 v4.3.2 hotfix DELEGATE
7ffaf87 PLAN-025 yolo 三連擊 + BUG-050 樣本達標
71f004d T0227 收尾元資料
ba9aa74 T0227 C 面剪貼簿層
cbeb117 T0226 B 面指令矩陣
901dff2 T0225 偵測層
54a9500 PLAN-025 roadmap
aea9373 T0224 研究
(BMad-Guide monorepo 另有 61dec10 — CT-T008 release commit)
```

### Session 附加產出(非工單,中途建立的指南)

- `_guide-selene-t0228-devcontainer-validation.md`(~430 行,原測試指南,偏 VS Code 假設)
- `_guide-selene-v432-intellij-diagnosis.md`(185 行,中途補的 JB 診斷指南)— 這兩份都需要在 v4.3.3 出來後整合重寫成 JB 版

### 恢復指引(下次 `/control-tower` 啟動)

1. Fast Path 載入本快照(快照 <7 天)
2. **第一動作**:檢查 Gower 是否已收到 Selene OSC 52 結果
   - 收到 → 依結果產 v4.3.3 工單(A.1 新增 + A.2 Step 2.5 + CHANGELOG)
   - 未收到 → 等待,或詢問 Gower 是否要先處理其他待辦
3. **小心假設**:任何「devcontainer」相關討論,先問 IDE 與遠端協議,再動

---

---

## 🎉 本 Session PLAN-025 yolo 三連擊(2026-04-20 10:30-11:15,45 min wall)

**核心戰績**:
- ✅ T0224 research DONE(aea9373,9 min,~6.7-10x)— 四面矩陣 + 10 Step 決策樹 + 7 題 CHECK-LIST + 拆單建議 + 7 條風險
- ✅ T0225 impl DONE(901dff2,10 min,~6-9x)— A.1 20 條變數表 + A.2 10 Step 決策樹 + TerminalDetection struct / yolo #8 clean
- ✅ T0226 impl DONE(cbeb117,6 min,~15-20x ⭐ 紀錄)— B 面 17 終端指令 + 映射介面 + 失敗偵測 + R6 osascript 緩解 / yolo #9 clean
- ✅ T0227 impl DONE(ba9aa74,5 min,~12-18x)— C 面 9 剪貼簿工具 + OSC 52 格式 + 12 支援清單 + 降級鏈 / yolo #10 clean
- ⏳ T0228 integration TODO — Selene devcontainer 主場景驗證(必須 --mode on --interactive,**等 Selene 在線**)

**BUG-050 樣本**:9 → **10/10 達標** 🎯(可 CLOSE,但採 Q1.B 等 PLAN-025 整體結案再閉環)

**關鍵觀察**:
- **L084** 候選:工單建議 flag vs 實際派發 flag 不一致(T0225/T0226/T0227 三次 observe)— skill 需加對齊檢查
- **L085** 候選:**Renew-lite 有效** — T0225 中途編輯工單(R4 移交 T0228),Worker 正確採納,跨執行讀取機制確認
- **L086** 候選:skill 層 reference 異動 vs repo commit 分離 — Worker commit 只含工單,`auto-session.md` 在 `~/.claude/skills/`,依賴 `claude-brain-sync` 同步;三張連擊三次觀察
- **L087** 候選:yolo 實作工單平均 ~12x 壓縮(T0225 ~6-9x / T0226 ~15-20x / T0227 ~12-18x),條件「研究已收斂 + 實作邊界清楚」

**PLAN-025 進度**:3/4 主工單完成,T0228 待 Selene 配合。可選延伸 T0229/T0230 看 T0228 結果。

**下 session 接手動作**:
1. 等 Selene 在線 → 派 T0228(`--mode on --interactive`,覆蓋 session yolo 設定)
2. 或 `*evolve` 萃取本輪 L084-L087 候選
3. 或 `/brain-patch` 同步 skill 層 auto-session.md(T0225/T0226/T0227 累計 +520 行改動)到遠端
4. 或 push 本 session 五個 commit(aea9373/54a9500/901dff2/cbeb117/ba9aa74/71f004d)到 origin

**Skill 層異動提醒**:`~/.claude/skills/control-tower/references/auto-session.md` 本 session 累計被改 3 次(466→623→?→?),最終內容在 skill 層**未 commit 到 Forgejo**,需 `/brain-patch` 或等 auto-sync hook。

---

---

## 🏁 BUG-047 Root 三連環完全結案(2026-04-20,v0.2.4-pre.1 雙人皆驗)

**使用者手動動作**(session 外完成):
- Push `origin main` 至 `be0061b`(第十六 session 快照 commit)
- 打 tag **`v0.2.4-pre.1`** + push → 觸發 GitHub pre-release
- Gower 本機驗 pre.2 同等物(pre.1 前已在第十六 session smoke pass)
- **Rico 回報 v0.2.4-pre.1 驗證正確** → 樣本 2 人跨版本皆閉環

**結案狀態升級**:
| BUG | 第十六 session 結束時 | 2026-04-20 結案後 |
|-----|--------------------|------------------|
| BUG-047 | Gower 單方 CLOSED | **雙人皆驗 CLOSED** |
| BUG-051 | Gower 單方 CLOSED | **雙人皆驗 CLOSED** |
| BUG-052 | Gower Windows CLOSED | **雙人 Windows 皆驗 CLOSED**(macOS/Linux 樣本等自然) |

**版號軌跡**:
- `v0.2.2-pre.1` — BUG-047 原始暴露版本(Gower 實機複現)
- `v0.2.3-pre.1` — T0220/T0221 修復版(Rico 驗仍失敗,觸發第十六 session 翻案)
- **`v0.2.4-pre.1`** — T0222/T0223 修復版(BUG-051/052 合併修)→ **雙人皆驗通過**

**本輪完整戰役總結**(第十四 → 十六 session,~1-2 日跨度):
- 🔴 **3 BUG 全 CLOSED**:BUG-047(root)+ BUG-051(downstream consumer)+ BUG-052(跨平台命名)
- ⚡ **5 張工單**:T0219(PLAN-021)+ T0220 + T0221 + T0222 + T0223,平均 ~6x 壓縮
- 📚 **3 條 Global Pattern 晉升**:GP065(Worker 從套件源碼挖證據)+ GP066(T 修復連擊)+ GP042 UPDATE(42+ hit 升 Skill 條件全達)
- 🏷️ **版號跳 3 版**:v0.2.2 → v0.2.3 → v0.2.4(pre-release 連發)
- 👥 **2 人樣本閉環**:Gower(dev + packaged)+ Rico(packaged 外部驗)

**塔台後續動作**:
- 本 session 剩餘 meta commits(`c33443e` / `773d34d` / `6ea175c`)+ 本結案追加 commit 需 push
- v0.2.4-pre.1 已外發不動
- 下 session 可清 `/ct-evolve --skill worker-time-estimation`(42+ hit 升 Skill 條件全達)

---

## 🎉 第十六 Session 延伸收尾(2026-04-19 23:56,smoke pass)

**使用者換版後回報**:T0223 packaged smoke「測試通過」→ 本 session 所有工單全綠收尾。

**收尾動作**(23:56-00:05 執行):
1. ✅ T0223 PARTIAL → **DONE**
2. ✅ BUG-051 OPEN → **CLOSED**(Gower Windows 親驗即收,不走 VERIFY)
3. ✅ BUG-052 OPEN → **CLOSED**(Windows 驗對代表修對,macOS/Linux 樣本等自然)
4. ✅ `_bug-tracker.md` 重建(Open:2→0, Closed:14→16, Total:17)
5. ✅ BUG-050 樣本 6 → **7**(T0223 `--mode yolo --no-interactive` 全程 clean,無 banner missing / clipboard fallback 觀察),門檻 10 還差 3
6. ✅ `*evolve` 三條 pattern 晉升 Layer 2(global):**GP065**(Worker 從套件源碼挖跨環境 ground truth)、**GP066**(T 修復連擊)、**GP042 UPDATE**(連 42+ hit,升 Skill 條件全達) → commit `773d34d`(L081 本專案 pointer)
7. ⏸️ PLAN-021 dev smoke 驗收暫緩(**D071**)— 使用者識別 UX 體驗設計不佳,另案討論
8. ⏳ 可選 pre.2 tag(一次清 Rico+Gower 三 BUG,使用者未授權,下 session 再議)

**決策日誌**(第十六 session 延伸):
- **D071**:PLAN-021 dev smoke 驗收暫緩 — 使用者在 smoke 清單審視階段識別 UX 體驗設計不佳(T0219 移除 Test 按鈕 + 新增 stopServerConfirm 雖 code 對,但整體 Settings Remote 區塊 UX 仍有改進空間),另案討論後再決定是否再派工單 refactor。PLAN-021 T0218/T0219 code 本身保留(已 commit),不退版

**全 session 總結(BUG-047 翻案連環解完)**:
- 🗓️ 第十四(T0219)→ 第十五(T0220/T0221)→ 第十六(T0222/T0223) **三 session 連環解**
- 🔴 BUG-047(原 root)+ 🟠 BUG-051(consumer)+ 🟡 BUG-052(跨平台命名)**三 BUG 全 CLOSED**
- ⚡ Worker 時間:T0220 3x + T0221 5-8x + T0222 7-13x + T0223 4-7x,**平均 ~6x 壓縮**
- 📊 GP042 累積 **42+ hit**,跨類型(research + code fix)雙面穩固,`/ct-evolve --skill worker-time-estimation` 升級條件達成

---

## 🛏 本 Session 退出快照(2026-04-19 第十六 session,BUG-047 收尾 + BUG-051/BUG-052 雙修連擊 + 斷點 A 暫停)

**退出原因**:T0223 Worker 4 min YOLO code fix 完成(~4-7x 壓縮),回報「部分完成」觸發斷點 A 暫停。Packaged smoke 需使用者實機操作(local build → install → BAT Claude CLI 按鈕實機驗),使用者離線換版,跨界工作完成。

**Session 起手**:2026-04-19 23:20(使用者回報 BUG-047 驗收通過,同時提新 bug 截圖)

**本 session 成果**(~28 min wall,2 工單 + 3 commits + 1 session 快照 commit 待建):

**工單鏈(2 張,research → fix 連擊,沿用第十五 session 模板)**:

- `4ce1d60` + `fc9530a` **T0222 research**(**3 min / est 20-40 min,~7-13x**)— BUG-051 CLI consumer 假設 + dev/packaged 跨平台相容性調查
  - A 面:grep 盤點 6 類 pattern,確認 `WorkspaceView.tsx:684` 為**唯一** BUG-051 launcher 命中點
  - B 面:Windows dev 機實證 `./bin/claude.exe --version` 直接回 `2.1.113`;從 `@anthropic-ai/claude-code/install.cjs` 挖出 `// Always write to bin/claude.exe...no-shebang stub...same pattern as Bun's npm package`,證實**跨平台檔名永遠叫 `claude.exe`**(POSIX 由 `chmodSync 0o755` 賦權,Unix 忽略副檔名)
  - C 面:推薦 α min-diff(1 行),駁回 β(無實質差異)和 γ(單 consumer 過度設計)
  - **附加發現**:`main.ts:1882` + `tests/claude-code-path.test.ts:38,70` 有**第二層 bug**,POSIX 誤假設檔名為 `claude`(實際也是 `claude.exe`),影響 packaged macOS/Linux,**T0221 修復在非 Windows 平台實際沒修好**
  - 必答 7 題 CHECK-LIST 全回答,互動 0 次(額度 3)
  - Mode: `--mode on --interactive`(研究型,允許互動但 Worker 從 install.cjs 強證據直接收斂)

- `42b45b0` **T0223 code fix**(**4 min / est 15-30 min,~4-7x**)— BUG-051 + BUG-052 合併修
  - `WorkspaceView.tsx:684` 移除 `'node'` prefix(BUG-051 主場)
  - `electron/claude-agent-manager.ts:87` 和 `electron/main.ts:1882` 的 `binaryName` 統一為 `'claude.exe'`,拿掉 `process.platform === 'win32' ? ... : ...` 三元(BUG-052)
  - `tests/claude-code-path.test.ts:38,70` POSIX assertion 同步改為 `'claude.exe'`(BUG-052)
  - **驗證**:`npx tsx tests/claude-code-path.test.ts` **4 pass / 0 fail**、`npx vite build` 4 bundle 全綠(main/renderer/preload/terminal-server)、grep 三處 code 修改行內容確認
  - Dev smoke 未跑(按工單降級條款以 unit test + grep 替代)
  - Mode: `--mode yolo --no-interactive` + 斷點 A
  - **單 atomic commit**(對齊 T0221 風格,4 檔合併)

**BUG/PLAN 狀態變更**:
- **BUG-047** VERIFY → 🚫 **CLOSED**(Gower v0.0.16-pre.1 實機 smoke pass,T0221 修復生效)
- **BUG-051** 🆕 建立(🟠 High, OPEN)→ 合併入 T0223 修復,等 packaged smoke
- **BUG-052** 🆕 建立(🟡 Medium, OPEN)→ T0222 附加發現,合併入 T0223 修復,等 packaged smoke
- **T0221** PARTIAL → ✅ **DONE**
- **T0222** ✅ DONE
- **T0223** ⏸️ **PARTIAL**(等 packaged smoke)
- **BUG-050** 樣本仍 6(T0222 `--mode on` 非 yolo;T0223 `--mode yolo` 待使用者確認 clean 後才算 +1,門檻 10 還差 3)

**決策日誌**:
- **D068**:BUG-051 範圍判定 — 使用者選 Q2.C + 「相容 dev server」→ 不走 min-diff 直修,先派研究工單深查所有 consumer 假設 + dev/packaged 跨平台驗證(避免 BUG-047 重演「只驗某面沒驗另一面」)
- **D069**:BUG-051 與 BUG-047 關係 — **不算翻案**(BUG-047 SDK 側 resolve path 已由 T0221 修正,此為 downstream consumer 端 bug),獨立編號追蹤
- **D070**:T0222 Worker 附加發現處理 — 開 BUG-052 獨立追蹤 + T0223 一次修兩處(同族 root cause,min-diff 仍成立 ~2 行 + 2 行 test,避免兩張 T 工單 overhead,沿用 T0221「同 pattern 一併修」品質亮點)

**Worker 品質亮點(T0222 + T0223)**:
- **T0222 Worker**:3 min 完成三面交付,壓縮比 **~7-13x**(研究工單破紀錄;跨類型驗證 GP042,打破先前「research 下限」假設)
- **T0222 Worker**:B 面 Q2/Q4「無 macOS/Linux 機可詢問使用者」— Worker 從 install.cjs 直接讀出「跨平台檔名永遠叫 claude.exe」的**強證據**,省實機驗證;對齊 GP054「三重證據」精神
- **T0222 Worker**:**主動挖出 T0221 遺留的預防性 bug**(BUG-052)— code 看到條件式 ≠ 驗證條件式正確,連 T0221 unit test 也沿用錯誤假設
- **T0222 Worker**:拒絕過度設計,明確推薦 α min-diff,駁回 β/γ,交付分析表直接 driver T0223
- **T0223 Worker**:4 檔一次到位,單 atomic commit,vite build 全綠 + unit test 4/4 pass,完全按工單指令執行(互動 0 次)
- **T0223 Worker**:dev smoke 降級策略使用得當(grep + unit test + build 三重證據替代 BAT UI 互動)

**GP042 累積**:Worker time 連 **40+ hit 再 +2**(T0222 ~7-13x + T0223 ~4-7x),跨類型驗證(research + code fix)雙面穩固。`/ct-evolve --skill worker-time-estimation` 升級條件持續累積。

**未執行項(下 session 接)**:

### 🔴 最高優先(BUG-051/052 收尾前置)

**T0223 packaged smoke**(使用者親驗):

```bash
# 1. local package(不 push tag 避免觸發 CI)
npm run build:dir   # 或 npm run build 產 NSIS

# 2. 啟動 release/win-unpacked/BetterAgentTerminal.exe(或裝 installer)

# 3. 驗 3 點:
#    ✅ Claude SDK Integrated Agent(Opus/Sonnet panel)→ 送「hi」→ 正常回應(BUG-047 regression guard)
#    ✅ workspace → 點「+ Claude CLI」按鈕 → 終端進入 Claude CLI 交互模式(BUG-051 主場)
#    ✅ debug.log 不含 "ERR_UNKNOWN_FILE_EXTENSION" / "Unknown file extension"
```

**Smoke pass 後塔台收尾動作**:
1. T0223 PARTIAL → DONE
2. BUG-051 OPEN → CLOSED(Windows 親驗即收)
3. BUG-052 OPEN → CLOSED(Windows 驗對代表修對,macOS/Linux 樣本等自然)
4. BUG-050 樣本 6 → 7(T0223 YOLO 樣本 clean,門檻 10 還差 3)
5. `*evolve` 收斂本 session 三條 pattern 候選:
   - 「GP054 三重證據擴展」— Worker 主動從套件源碼(`install.cjs`)挖檔而非詢問使用者,跨 T0220/T0222 兩張研究工單驗證
   - 「T 修復連擊 pattern」— T0221 修 A 面 → T0222 挖出 A 面裡的 B 面 → T0223 合併修 B 面(分層拆解,每張工單 <5 min,快於單張大工單)
   - 「Research 工單壓縮下限再探」— T0222 破 ~7-13x,跨類型驗證 GP042 穩固;條件:Worker 能從源碼挖到強證據 → 省實機驗證

**Smoke fail 處理**:
- 貼錯誤 + log → 塔台判 Renew T0223 或翻案重查
- 若「+ Claude CLI」按鈕依然 `ERR_UNKNOWN_FILE_EXTENSION` → 檢查 `WorkspaceView.tsx:684` 在 build 產物中是否真的 rebuild(可能 cache)
- 若 Claude SDK panel 失效(BUG-047 regression)→ 檢查 `claude-agent-manager.ts:87` 的 binaryName 統一是否破壞原本 Windows 路徑(應該不會,因 Windows 原本就是 claude.exe,但需 log 佐證)

### 🟡 中等優先(第十四/十五 session 殘留)

- **dev smoke T0218+T0219 合併驗收**(PLAN-021 閉環前置)— 9 情境核心(見第十四 session 快照)
- **BUG-047/051/052 pre.2 tag**(Rico 同步驗收)— 建議 T0223 smoke pass 後打 v0.2.2-pre.2,一次清三個 BUG 對兩人

### 🟢 低優先

- **GP042 升 Skill** `/ct-evolve --skill worker-time-estimation`(40+2 hit,跨類型驗證更穩固)
- **BUG-050 自然累積**(T0223 YOLO 若 clean 即 +1,門檻 10 → 還差 3)
- **GP063 / GP064 跨專案驗證**

### 📊 下 session 決策點

- Smoke pass → BUG-051/052 雙 CLOSED + `*evolve` 三條 pattern + 可選 BUG-050 CLOSE 評估 + 可選 pre.2 tag
- Smoke fail → T0223 Renew 或翻案(視錯誤類型)
- 若使用者選擇「先做 dev smoke T0218+T0219」→ 優先 PLAN-021 閉環,BUG-051/052 次優先(雖然 BUG-051 High,但 claude-cli preset 有 workaround = 改用 Claude SDK panel)
- 若 smoke pass 且 BUG-050 樣本累積接近門檻 → 下 session 可大膽推 GP042 升 Skill

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status` + `git log`(本 session commit 待使用者授權 push — `4ce1d60`/`fc9530a`/`42b45b0` + 本 session 快照 commit)
3. 下一輪優先級建議:
   - 🔴 **T0223 packaged smoke**(首選,BUG-051/052 收尾前置)
   - 🟡 **dev smoke T0218+T0219**(PLAN-021 閉環,第十四 session 殘留)
   - 🟡 **pre.2 tag**(smoke pass 後一次清 Rico + Gower 的 BUG-047/051/052 三面)
   - 🟢 **GP042 升 Skill**(42+ hit 穩固後可執行)

---

## 🛏 前次 Session 退出快照(2026-04-19 第十五 session,BUG-047 翻案 + T0220/T0221 連擊 + 斷點 A 暫停)

---

**退出原因**:T0221 Worker 5 min YOLO code fix 完成(~5-8x 壓縮),回報「部分完成」觸發斷點 A 暫停。Packaged smoke 需使用者實機操作(local build → install → 實機啟動 SDK prompt),本 session 跨界工作完成,使用者換版後續驗。

**本 session 成果**(~50 min wall,2 工單 + 2 commits + 1 meta commit):

**工單鏈(2 張,research → fix 連擊)**:

- `c9ec6c1` **T0220 research**(**6 min / est 15-30 min,~3x**)— BUG-047 驗收失敗根因調查
  - A 面:實機 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\` 抽查 — 4 子包 × claude.exe 245 MB 全存在 → T0198/T0199 asarUnpack 完全正確
  - B 面定位根因:`claude-agent-manager.ts:83-102` `resolveClaudeCodePath()` `require.resolve('@anthropic-ai/claude-code/cli.js')` — 該檔案在 `@anthropic-ai/claude-code@2.1.113` **根本不存在**(只有 `bin/claude.exe`,無 `main`/`exports`/`cli.js`)→ 兩層 try/catch 都拋 `MODULE_NOT_FOUND` → 回空字串 → `pathToClaudeCodeExecutable` falsy 未傳給 SDK → SDK 自己 resolve 到 `app.asar\` 失敗
  - C 面:T0198 驗證缺口(只驗檔案位置,沒跑 packaged runtime smoke)
  - 產出 3 條 *evolve 學習 pattern 候選
  - Mode: `--mode on --interactive`(非 yolo,允許互動)
  - Worker 互動 1 次:使用者糾正「要找安裝目錄不是 source repo」 → Worker 轉向 A 面實機抽查

- `ada53b7` + `018749b` **T0221 code fix**(**5 min / est 20-40 min,~5-8x**)— BUG-047 Code 層修復
  - `claude-agent-manager.ts` `resolveClaudeCodePath()` 改候選 B(`app.isPackaged` 分支,packaged 走 `process.resourcesPath/app.asar.unpacked/.../bin/claude.exe`,dev 走 `package.json` resolve + `bin/`)+34/-12
  - `main.ts:1882` `claude:get-cli-path` handler 同 bug pattern **一併修**(+14/-4)
  - `tests/claude-code-path.test.ts` 新檔,4 題 assertion 全通過(核心 regression guard:`fs.existsSync(resolvedPath)`)
  - Constructor 加 `assertClaudeCodePathOnce()` warn-only log(SDK 未來升級悄悄刪檔時立即曝光)
  - `package.json` 新增 `test:claude-code-path` script
  - Mode: `--mode yolo --no-interactive`
  - **YOLO 回報約定**:Worker 必回「部分完成」觸發斷點 A(packaged smoke 需使用者實機驗證,code-only 工單不能判 DONE)

**BUG/PLAN 狀態變更**:
- **BUG-047** VERIFY → 🔧 **FIXING**(Gower v0.2.2-pre.1 實機複現) → 等 smoke pass 可升 FIXED
  - 嚴重度升級 🟡 Medium → 🟠 High(樣本 2 人跨版本 Rico pre.1 + Gower pre.2/v0.2.2-pre.1 皆 100% 阻擋)
  - Rico 22:19 貼同錯誤(仍未解)+ SDK 錯誤訊息明示 `options.pathToClaudeCodeExecutable` override API → 直指根因方向
- **T0220 DONE**、**T0221 PARTIAL**(等 smoke)
- **BUG-050** 樣本仍 6(T0220 是 `--mode on` 非 yolo;T0221 `--mode yolo` 待使用者確認 clean 後才算 +1)

**決策日誌**:
- **D066**:BUG-047 驗收失敗處理策略 — 使用者選 Q2-A,退 FIXING + 派研究工單 T0220,**而非直接開修復工單**(根因不明時先研究,避免重蹈 T0198 驗證缺口)
- **D067**:T0221 YOLO 回報策略 — Worker 完成 code + local build + unit test 後必回「部分完成」觸發斷點 A,smoke 必須使用者實機操作。Auto-submit YOLO 適用 code-only 工單,驗收階段必斷點(原則:「可自動化 → YOLO / 需人介入 → 斷點」)

**Worker 品質亮點(T0220 + T0221)**:
- **T0220 Worker**:主動發現 `main.ts:1882` 同 bug pattern(工單只列為「同步檢視」,Worker 判斷屬同根因並在 T0221 範疇內一併修)
- **T0220 Worker**:研究邏輯清晰到產出兩個修復候選 + 三條 *evolve 學習 pattern 建議
- **T0221 Worker**:dev smoke 未跑但**用 unit test `fs.existsSync` 取代**(等效 regression guard,理由充分)
- **T0221 Worker**:Commit 策略主動合併單一 atomic(claude-agent-manager + main.ts + tests + package.json,邏輯屬同一 fix,不宜切割)

**GP042 累積**:Worker time 連 **40+ hit**(T0220 3x + T0221 5-8x),跨類型驗證穩固 — research 工單壓縮比略低(調查有下限),code fix 壓縮比一貫 5x+。`/ct-evolve --skill worker-time-estimation` 升級條件再次累積。

**未執行項(下 session 接)**:

### 🔴 最高優先(BUG-047 收尾前置)

**T0221 packaged smoke**(使用者親驗):

```bash
# 1. local package(不 push tag 避免觸發 CI)
npm run build:dir   # 或 npm run build 產 NSIS

# 2. 啟動 release/win-unpacked/BetterAgentTerminal.exe(或裝 installer)

# 3. 開 Claude Agent V1 panel → 選 Opus/Sonnet → 送「hi」

# 4. 預期:
#    ✅ SDK 正常回應
#    ✅ debug.log 不含 "[ClaudeAgent] resolveClaudeCodePath returned invalid path"
```

**Smoke pass 後塔台收尾動作**:
1. T0221 PARTIAL → DONE
2. BUG-047 FIXING → FIXED → CLOSED(直接 CLOSED,Gower 親驗即收,不需 VERIFY 階段)
3. BUG-050 樣本 6 → 7(T0221 YOLO 樣本 clean,門檻 10 還差 3)
4. `*evolve` 收斂 T0220 C 面三條學習 pattern:
   - 「檔案存在 ≠ 功能驗證」(打包類 fix 標配實機 smoke)
   - 「`require.resolve` 目標檔案需在 test 斷言 `fs.existsSync`」(擋外部 package 升級刪檔)
   - 「dev-only 通過不代表修好」(packaged 環境有 asar/isPackaged 等 dev 看不到的行為)
5. 可選:BUG-050 CLOSED 評估(樣本 7,門檻 10 還差 3;若使用者授權提前 CLOSE 即可)

**Smoke fail 處理**:
- 貼錯誤 + log → 塔台判 Renew T0221 或翻案重查(若 `.unpacked/claude.exe` 不存在則 T0220 A 面結論錯誤,需重新調查 asarUnpack 是否真生效)

### 🟡 中等優先(第十四 session 殘留)

- **dev smoke T0218+T0219 合併驗收**(PLAN-021 閉環前置)— 9 情境核心(見第十四 session 快照)
- **BUG-047 pre.2 tag**(Rico 同步驗收)— 建議 T0221 smoke pass 後打 v0.2.2-pre.2,一次清 Rico + Gower

### 🟢 低優先

- **GP042 升 Skill** `/ct-evolve --skill worker-time-estimation`(40+ hit,跨類型驗證更穩)
- **BUG-050 自然累積**(T0221 YOLO 若 clean 即 +1,門檻 10 → 還差 3)
- **GP063 / GP064 跨專案驗證**

### 📊 下 session 決策點

- Smoke pass → BUG-047 收尾 + `*evolve` 三條 pattern + 可選 BUG-050 CLOSE 評估
- Smoke fail → T0221 Renew 或翻案 T0220(視錯誤類型)
- 若使用者選擇「先做 dev smoke T0218+T0219」→ 優先 PLAN-021 閉環,BUG-047 次優先(雖然 High,但對個人開發者為單機問題)
- 若連 BUG-047 都修好後,下 session 可大膽推 GP042 升 Skill

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status` + `git log`(本 session 所有 commit 待使用者授權 push — `c9ec6c1`/`ada53b7`/`018749b` + 本 session 快照 commit)
3. 下一輪優先級建議:
   - 🔴 **T0221 packaged smoke**(首選,BUG-047 收尾前置)
   - 🟡 **dev smoke T0218+T0219**(PLAN-021 閉環,第十四 session 殘留)
   - 🟡 **BUG-047 pre.2 tag**(smoke pass 後一次清 Rico + Gower)
   - 🟢 **GP042 升 Skill**(40+ hit 穩固後可執行)

---

## 🛏 前次 Session 退出快照(2026-04-19 第十四 session,T0219 code DONE + dev smoke 交棒)

**退出原因**:T0219 code 7 min YOLO 完成(~5x 壓縮),dev smoke T0218+T0219 合併 7+7 情境留給使用者手動執行(免切 context 一次驗收兩張)。

**本 session 成果**(~15 min wall,1 工單 + 2 commits):

**工單鏈(1 張)**:
- `f395225` + `cb2c350` T0219 PLAN-021 UX 簡化(**7 min / est 30-45 min,~5x**)— 移除 Test 按鈕 + state + IPC + port-test.ts(234 行刪除)+ 9 i18n keys × 3 locales;新增 stop server confirm dialog(用既有 `dialog.confirm` bridge,優於工單建議的 `window.confirm`)+ 2 i18n keys × 3 locales(省略 NoConnections key,YAGNI)
  - 9 files changed, +25 / -284
  - Image #4 Port editor render 盤點結論:條件渲染邏輯無 bug,判定 dev HMR 暫時性問題

**BUG/PLAN 狀態變更**:
- **BUG-050** 樣本 **5 → 6** clean(門檻 10,過半)— 樣本 #6(T0219,~22 tool calls)auto-submit / writeResp / CT_MODE 全部 clean
- **PLAN-021** IN_PROGRESS(T0219 code 交付,dev smoke 待跑才能 DONE)
- **T0219 DONE**(Worker YOLO-safe 驗收全通過)

**Worker 品質亮點(T0219)**:
- 主動發現專案既有 `dialog.confirm` bridge(`electron/main.ts:2595`,被 ClaudeAgentPanel/TerminalPanel 共用),選用而非工單預設建議的 `window.confirm()`,風格一致性優先
- YAGNI 原則省略 `stopServerConfirmNoConnections` key(無連線時 return,該 key 無使用場景)
- Commit 策略主動合併單一 atomic(D065 整體 UX 調整不宜切割,而非工單預設 1-2 commit 的保守建議)
- Image #4 盤點精準:Remote section ternary 分流(running vs stopped)完整掃描,確認 Port editor 無額外條件包裹

**GP042 累積**:Worker time 連 **38+ hit**,T0219 5x 壓縮(30-45 min → 7 min)再次驗證。`*evolve --skill worker-time-estimation` 升級條件愈發穩固。

**未執行項(下 session 接)**:

### 🔴 首選:使用者手動 dev smoke(T0218 + T0219 合併驗收)

**T0218 原 7 情境**:
1. 啟動 dev → Settings 改 port 54321 → 重啟 dev → 54321 生效
2. Test 按鈕(**已移除,驗收此情境改為確認 Test 按鈕不存在**)
3. QR 對照:改 port 前後 url 反映新 port
4. 熱切換:改 port Save(不重啟 dev)→ 舊關新開立即可用
5. Active conn 警告:改 port 時顯示連線數
6. BAT 內部終端 `BAT_REMOTE_PORT` env 傳遞 + bat-notify 連新 port
7. port 設回 9876 + 重啟 → 回歸 T0215/T0217 smoke

**T0219 新 7 情境**(含與 T0218 重疊項):
1. Stop 按鈕無連線:Server running + 0 clients → 按 Stop → 無 dialog 直接停止
2. Stop 按鈕有連線:N>0 clients → 按 Stop → 跳 dialog 顯示 count → Cancel 不停止 / Confirm 才停止
3. Test 按鈕不存在(與 T0218 #2 合併)
4. Port editor running 狀態下顯示正常(Image #4 回歸驗收)
5. Hot-switch 不受影響(與 T0218 #4 合併)
6. i18n:en / zh-TW / zh-CN 新 confirm dialog 文案正確
7. 回歸 T0218 全情境照常通過

**合併後核心情境**(去重後):
- [ ] dev server 啟動 + Port editor 顯示(Image #4 回歸)
- [ ] 改 port 熱切換生效 + URL 預覽同步
- [ ] Active conn warning 正確 count(改 port 時)
- [ ] Stop server 無連線 → 無 dialog
- [ ] Stop server 有連線 → dialog 跳出 + Cancel/Confirm 行為正確
- [ ] Test 按鈕完全不存在(移除驗收)
- [ ] BAT 內部終端 + `BAT_REMOTE_PORT` env 傳遞
- [ ] i18n 三語言切換 confirm 文案
- [ ] T0215/T0217 回歸 smoke(bat-notify/bat-terminal 功能)

### 🟢 其他候選(優先級依序)

- 🟡 **BUG-047 pre.2 tag**(Rico 驗收,第九 session 殘留,使用者授權後可打)— 極小
- 🟢 **GP042 升 Skill** `/ct-evolve --skill worker-time-estimation`(⭐ proven 38+ hit,T0219 5x 再驗證)
- 🟢 **BUG-050 自然累積樣本** — 下次 YOLO 派發即自然 +1(門檻 10 → 還差 4 張)
- 🟢 **GP063 / GP064 跨專案驗證** — 下次在其他 repo 遇到類似場景留意

### 📊 下 session 決策點

- 若 dev smoke 全通過 → PLAN-021 DONE(整個 Remote server port settings UI 功能閉環)
- 若 smoke 發現 Image #4 回歸 → 轉 BUG 單追究 HMR vs 條件渲染
- 若 smoke 累積 4+ 張 YOLO 樣本 clean → BUG-050 可 CLOSED(清理 `[T0215-DEBUG-REMOVE]` 3 處)

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status` + `git log`(本 session 所有 commit 待使用者授權 push)
3. 下一輪優先級建議:
   - 🔴 **dev smoke T0218+T0219 合併**(首選,關鍵 blocker,驗收後 PLAN-021 DONE)
   - 🟡 **BUG-047 pre.2 tag**(使用者授權後可打,極小)
   - 🟢 **GP042 升 Skill**(38+ hit 穩固後可執行)

---

## 🛏 前次 Session 退出快照(2026-04-19 第十三 session,T0216/T0217/T0218 三連擊 + 使用者 smoke UX 見解識別 D065 + GP064)

**退出原因**:完成 T0218 DONE + D065 UX 簡化決策 + GP064 Global 學習萃取;T0219(UX 簡化實作)留下 session 以新 context 開工(~30-45 min 估時)

**本 session 成果**(~2h wall,3 工單 YOLO 連擊 + 3 Global 學習 + 3 決策 + 15+ commits):

**工單鏈(3 張,三連擊極速)**:
- `f079979` + `279def5` T0216 PLAN-023 階段 3(**9 min / est 60-120 min,~7-13x**)— FileTree 拆 4 檔(749→460 行,-39%) + FileEntry.pathKey 全面切換 + IPC boundary 注入(preload.ts)
- `c514512` + `f651bf3` T0217 PLAN-022 Step 1+2(**6 min / est 50-65 min,~8-11x**)— bat-terminal + bat-notify fingerprint pinning + 抽共用 `_bat-cert.mjs` helper + 主動修正 PLAN-022 骨架欄位名錯誤 + BAT_SERVER_CERT_PATH env override 測試巧思
- `f3d862c` + `98b9ce0` + `289114f` + `0d651a3` T0218 PLAN-021 Step 1+2+3+4(**11 min / est 150-215 min,~14-20x 本 session 新高**)— Settings UI 自訂 RemoteServer port + IPC + hot-switch + OS-specific 佔用查詢 + 22 i18n keys × 3 locales + smart PARTIAL exit(catch-22 邊界嚴守)

**BUG/PLAN 狀態變更**:
- **BUG-050** FIXING → 🧪 **VERIFY**(階段 1 smoke 場景 1/2 通過 + 5 張 YOLO 樣本 clean)
- **PLAN-023** IN_PROGRESS → **DONE**(階段 1+2+3 全閉環)
- **PLAN-024** 階段 2 **暫緩**(D064)
- **PLAN-021** IDEA → **IN_PROGRESS**(T0218 backend DONE + smoke 6/7 PASS,UI 簡化 D065 交棒 T0219)
- **T0218 DONE**(技術交付 + 核心 smoke 通過)

**決策日誌(3 條)**:
- **D063** BUG-050 階段 1 smoke 通過 → FIXING → VERIFY,觀察 YOLO log
- **D064** BUG-050 階段 2 暫緩:2+ 樣本零異常,保持 VERIFY 待真實問題觸發
- **D065** PLAN-021 UX 簡化:使用者 smoke 揭露 Test 按鈕冗餘,移除 + 停止警告新增 → T0219

**Global 學習萃取(GP042 UPDATE + GP063 + GP064 新建)**:
- **GP042 UPDATE**:Worker time 連 37+ hit,**中規模架構重整 7-13x + 大工單 14-20x 新高**(T0218 11 min / est 150-215 min)
- **GP063**(🟡):IPC boundary 注入 + 結構性子型別 = 重構豁免 consumer audit(T0216 源頭)
- **GP064**(🟡)**新**:UX 反模式 — Error path 已提供回饋時勿加 Test/Preview/Dry-run helper 按鈕
  - 源頭:使用者 T0218 smoke 時主動識別 Test 按鈕冗餘
  - 通用化:Form Submit / Connect / Save / Deploy / Port bind 皆適用
  - 合理情境:`git diff` / `terraform plan` / SQL migration dry-run(提供不同資訊)
  - 反模式情境:Test 只回答「通過/失敗」而動作本身 error path 也回答同樣資訊時
  - 設計自問清單(5 題)+ 多例子 + 保留/移除對照

**BUG-050 YOLO 觀察樣本(5 張,全 clean,質量壓倒數量)**:
- 樣本 #1 T0216:writeResp 結構 100% 正常
- 樣本 #2 T0217:真實 YOLO 工作流 end-to-end 驗證
- 樣本 #3 T0218 PARTIAL auto-submit:大工單壓力測試(~40-50 tool calls)clean
- 樣本 #4 6b 手動 smoke:**熱切換後新終端 bat-notify 跨 port 連線成功**(最強真實場景)
- 樣本 #5 情境 7 回歸 smoke:port 設回 9876 + 重啟 → T0215/T0217 smoke 仍 PASS
- 異常跡象:**0**(5/5 clean)
- 距離 CLOSED 門檻:連續 10+ clean → 已累積 5 張,過半
- 觸發階段 2 啟動條件:異常 payload(未出現)

**Worker 品質亮點(T0217)**:
- 主動修正 PLAN-022 骨架錯誤(`fingerprint256` 假設 → 實際 `fingerprint` persisted;兩欄位 format 同可 `===` 比對)
- 抽共用 helper `_bat-cert.mjs`(避免 GP056 sibling duplication)
- `BAT_SERVER_CERT_PATH` env override 巧思(smoke 不動真實 cert,免「測完必還原」風險)
- Bonus 情境 2b(server-cert-unreadable)主動測試

**未執行項(下 session 接)**:

### 🔴 首選:T0219 PLAN-021 UX 簡化(對齊 D065)

- **範圍**:
  - **移除**:Test 按鈕 + state(`portTestResult`, `portTesting`)+ IPC handler `settings:test-port` + `electron/remote/port-test.ts` OS-specific 查詢(可全刪或只保留 `testPort` helper)+ preload bridge + 9 i18n keys × 3 locales
  - **新增**:停止伺服器前 confirm dialog 顯示「即將中斷 N 個活躍連線」(N = `serverStatus.clients.length`)
  - **保留**:Port editor + Save & hot-switch + rollback + URL preview + 改 port 時的 active conn 警告
  - **附帶驗收**:確認 Image #4 server running 下 Port editor 區塊實際有 render(若 dev HMR 有 gap 需排查)
- **估時**:~30-45 min / 預期 Worker time 5-10 min

### 🟢 其他候選(優先級依序)

- 🟡 **BUG-047 pre.2 tag**(Rico 驗收,第九 session 殘留,使用者授權後可打)— 極小
- 🟢 **GP042 升 Skill** `/ct-evolve --skill worker-time-estimation`(⭐ proven 穩固,37+ hit,T0218 14-20x 新高後場景完整)
- 🟢 **GP063 / GP064 等跨專案驗證** — 下次在其他 repo 遇到類似場景(IPC boundary / 考慮加 Test 按鈕)留意
- 🟢 **BUG-050 自然累積樣本** — 任何 YOLO 派發都是觀察機會;T0219 派發即自然 +1 樣本

### 📊 下 session 決策點

- 若 YOLO 樣本累積到 10+ clean → BUG-050 可 CLOSED(清理 `[T0215-DEBUG-REMOVE]` 3 處)
- 若觀察到異常 payload → 立即轉 FIXING + 啟動 PLAN-024 階段 2

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status`(本 session 已全部 commit,尚待 push 授權)
3. 下一輪優先級建議:
   - 🔴 **T0219 UX 簡化**(首選,對齊 D065,~30-45 min 估時 / 5-10 min Worker time)
   - 🟡 **BUG-047 pre.2 tag**(使用者授權後可打,極小)
   - 🟢 若要累積更多 BUG-050 樣本 → T0219 派發即自然 +1 樣本

### ⚠️ 記憶污染修正紀錄

**2026-04-19 19:50 使用者發問觸發**:「PLAN-008 是甚麼?」→ 發現快照誤記。
- PLAN-008 真實內容:「持久化狀態 + PTY 進程脫鉤架構」,✅ DONE 已歸檔(`_archive/plans/`,Phase 1 T0096 + Phase 2 T0106-T0113 完成)
- 多 session 快照複製貼上「🟢 PLAN-008 中文『高』優先級 polish」是**塔台幻覺**,可能源自誤拼接 PLAN-008 元資料的「優先:高」欄位
- **已修正**:本 session 快照移除該條,不再傳染到下 session

---

## 🛏 前次 Session 退出快照(2026-04-19 第十二 session,BUG-050 Option C 階段 1 方案 A 完成)

**退出原因**:使用者指示「請塔台快照,我佈新板」— 新 server 需重啟 BAT 才能載入,下 session 跑場景 1/2 手動 smoke

**本 session 成果**(~30 min wall,2 工單 + 1 PLAN + 1 commit):

**工單鏈(2 張)**:
- `(待 commit)` T0214 research pty:write silent drop 定位(~8 min / est 20-40 min,**3-5x**)— 6 層 code path + 9 個 silent drop 點盤點 + T0210 錯覺機制(bat-notify 只看 `writeResp.error`)釐清
- `38725e9` T0215 fix 方案 A + 暫時 debug log(~6 min / est 90-120 min,**15-20x**)— `writeWithResult` 新 API + `bat-notify.mjs` 嚴格 `ok === false` 阻斷 + 3 處 `[T0215-DEBUG-REMOVE]` log

**PLAN 新增**:
- **PLAN-024** PLANNED — BUG-050 Option C 雙階段包裹(階段 1 方案 A ✅ 階段 1 代碼交付 / 階段 2 方案 B correlation id 待啟動)

**BUG 狀態**:
- BUG-050:FIXING(階段 1 代碼閘道通過,待 BAT 重啟後場景 1/2 smoke → 決策升 VERIFY)

**Tracker 同步**(解決使用者觀察到「BUG-048 UI 顯示 Open 不同步」):
- `_bug-tracker.md` 重建:BUG-048 從 Open 區正確移到 CLOSED 區,統計 15 張(🔴0 ⏳1 🧪1 🚫13 ⛔0)
- `_backlog.md` 重建:PLAN-024 納入(19 張,💡4 📋3 🔄2 ✅9 🚫1)

**Worker time 極速觀察**(本 session 2 張全壓縮):
- T0214:8 min / est 20-40 min(3-5x,熟區 + Worker 高執行力)
- T0215:6 min / est 90-120 min(**15-20x 壓縮**,T0214 改動清單已定稿 + 照做 + 1 處變數命名衝突主動修)
- GP042「Worker time 連 37+ hit」持續累積,⭐ Skill 升級候選愈發穩固

**Worker 品質亮點**(T0215):
- 主動識別 catch-22(重啟會殺自己的 session → 無法在 session 內跑場景 1/2)
- 正確理解「必須暫停回塔台」條款定義(跑了失敗 ≠ 跑不了)— 未違規未強推
- 變數命名衝突(`payload` 已佔用)主動發現並改名 `writeResult`,不影響語意
- 場景 4 live 跑 3 個 Test(包含反面驗證 T0210 錯覺在舊 server 仍存)

**關鍵技術洞察**(T0214 → T0215 雙工單萃取):

1. **T0210 錯覺機制**:`bat-notify.mjs` 只檢 `writeResp.error`,handler 回 void → client log `result=ok`。silent drop 真正根源 = client 檢查邏輯不完整 + server 回傳協議無結構
2. **6 層 code path 全盤**:bat-notify → remote-server → handler-registry → main.ts registerHandler → pty-manager → terminal-server
3. **9 silent drop 點**:方案 A 涵蓋 #1/#3/#4/#5/#8/#9(~60 行 diff),方案 B 涵蓋 #2/#6/#7(refork race,~80-120 行,階段 2)
4. **useServer 分支的根本限制**:fire-and-forget IPC 無 ack → 樂觀回 `ok: true, reason: 'queued'`,真正覆蓋 refork race 需 correlation id(方案 B)

**未執行項(下 session 接)**:

### 🔴 首選:BAT 重啟 + BUG-050 階段 1 驗收

1. 使用者佈新板(BAT 重啟載入 38725e9 server)
2. 在新 BAT terminal 跑 smoke 場景 1:
   ```bash
   node scripts/bat-notify.mjs --target $BAT_TERMINAL_ID "smoke-1"
   ```
   預期:exit 0 + `writeResp payload={ok:true}` + 塔台 terminal 收到 "smoke-1"
3. 跑 smoke 場景 2:
   ```bash
   node scripts/bat-notify.mjs --target deadbeefdeadbeefdeadbeefdeadbeef "smoke-2"
   ```
   預期:exit 1 + stderr `Error: PTY write failed: pty-not-found`
4. 通過 → BUG-050 FIXING → VERIFY,連續觀察 3-5 張 YOLO 派發的 debug log
5. `[T0215-DEBUG-REMOVE]` 3 處標記供未來 grep 清理

### 🟡 候選待辦

- 🟡 T0214 元資料 commit(派發 / 完成時間與 38725e9 合 push)
- 🟡 **本 session 收尾 commit**:T0214 + T0215 工單元資料 + `_bug-tracker.md` 重建 + `_backlog.md` 重建 + PLAN-024 建檔 + `_tower-state.md` 第十二 session 快照(等使用者授權 push)
- 🟡 BUG-047 pre.2 tag(使用者授權後打)
- 🟢 PLAN-023 階段 3 T0216(FileTree 拆分,~1-2h)
- 🟢 PLAN-022 T0202c fingerprint pinning

### 📊 潛在 `*evolve` 候選(下 session 可萃取)

- **GP 候選**:「client-side silent drop 偵測不完整模式」(bat-notify 只看 error frame,T0210 錯覺機制通用化)
- **GP 候選**:「Worker catch-22 識別」(T0215 session 限制主動暴露,品質優先的展現)
- **GP042 UPDATE**:Worker time 連 37+ hit(T0215 15-20x 為本 session 新高,階段 2 前可考慮升 Skill)
- **L 候選**:「pty:write useServer 分支 fire-and-forget 限制」(本專案特有,correlation id 階段 2 必做)

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status`(本 session commit 待使用者授權 push 後 clean)
3. 下一輪優先級建議:
   - 🔴 **BUG-050 階段 1 BAT 重啟 + smoke 1/2 驗收**(首選,驗收通過後 FIXING → VERIFY)
   - 🟡 觀察 3-5 張 YOLO `[T0215-DEBUG-REMOVE]` log 樣本,判斷方案 B 必要性
   - 🟡 BUG-047 pre.2 tag(使用者授權後)

---

## 🛏 前次 Session 退出快照(2026-04-19 第十一 session,BUG-048 全閉環 + BUG-050 研究完成 + 架構 PLAN-023 + 5 GP/L 批次)

**退出原因**:B 計畫收尾(BUG-048 CLOSED + `*evolve` 6 條 + `_tower-state` 快照 + commit/push)

**本 session 成果**(~2h,7 工單 + 1 BUG 新建 + 1 BUG CLOSED + 1 PLAN 新建):

**BUG-048 修復鏈(7 工單,1.5h 閉環)**:
- `40207a3` T0207 fix Option B(15 min/est 90-120,**6-8x**)— pending bus + expandToPath + FileTreeNode 受控
- T0208 AI 驗收 DONE(15 min)— 14/18 PASS,4 CONCERN(2 MEDIUM + 2 LOW),0 FAIL
- `39c55a3` T0209 fix 3 MEDIUM CONCERN(20-25 min/est 45-60,**2-3x**)— toPathKey + bootstrapConsumedRef
- T0211 research focus 根因(7 min/est 20-40,**3-5x**)— T0209 漏修 selected 比對精準定位
- `5d8812b` T0212 fix selected normalize(2 min/est 10-20,**5-10x**)— 僅 2 處比對
- `f839dc0` T0213 fix deps race + helper(8 min/est 45-60,**5-8x**)— Option A 移除 loading + openFileInFilesTab() 抽離 + 5 處 dispatch 統一
- BUG-048 → CLOSED(使用者 VERIFY 通過)

**BUG-050 雙根因(T0210 研究 DONE,35 min/est 30-60)**:
- 根因 A:Worker LLM skill 一致性 regression(SKILL.md 470+ 行,LLM 省略 Step 0 banner + Step 8.5 bat-notify)
- 根因 B:RemoteServer pty:write silent drop(send=ok 但未真寫 PTY,Q1 使用者證詞)
- 三症狀:banner missing + clipboard fallback + bat-terminal create silent failure
- 推薦 Option C 兩階段修復(階段 1 ~1-2h pty:write 顯性化 + 階段 2 ~4-6h skill 拆分 + enforcement)
- BUG-050 OPEN(待開 PLAN-024 + 派 fix 工單)

**PLAN 新增**:
- PLAN-023 FileTree 架構重整 IN_PROGRESS(階段 1+2 ✅ T0213 完成 / 階段 3 T0215 待決策)

**`*evolve` 批次寫入(3 GP + 1 GP UPDATE + 2 L)**:

🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`:
- **GP060** AI 驗收漏 runtime race(純 code walk 看不出 React useEffect/setState 時序)
- **GP061** 修復鏈累積技術債識別(使用者一句話即升 PLAN)
- **GP062** PARTIAL VERIFY 連環推進原則(BUG-048 7 工單實證)
- **GP042 UPDATE** Worker time 連 35+ hit(本 session 5 連發 + 1 within range,⭐ proven 升 Skill 候選穩固)

🏠 Project `_ct-workorders/_learnings.md`:
- **L079** FileTree useEffect deps race 模式(本專案易再出現,含檢查清單)
- **L080** 塔台 YOLO 模式派發確認債(明確列出問 vs 不問節點)

**重大方法論突破(3 條)**:
1. **AI 驗收的 runtime 限制**(GP060)— React hook 時序問題純 code walk 無法 catch,需明確標記限制 + 補 smoke test
2. **修復鏈技術債主動盤點**(GP061)— 連續 ≥3 張同模組 fix 工單時,塔台應主動列出累積 pattern 並建議 PLAN 升級
3. **PARTIAL VERIFY 連環推進**(GP062)— 不一次包死,每張 diff 集中、Worker time 普遍壓縮 3-10x、commit 全 atomic 可 revert

**YOLO 觀察(本 session)**:
- session 11 連續 T0207/T0208/T0209/T0212/T0213 全部使用者手動貼回報(YOLO auto-submit 失效)
- T0210 揭露雙根因(Worker skill 省略 + server silent drop)
- BUG-050 三症狀(banner missing + clipboard fallback + terminal create silent failure)全鎖定
- bat-terminal.mjs script 層 `result:ok` ≠ 後端真創建,trust chain 完全破口

**未執行項(下 session 接)**:
- 🟡 **BUG-050 Option C 階段 1**(pty:write 顯性化,~1-2h)— PLAN-024 待開
- 🟢 PLAN-023 階段 3 T0215(FileEntry pathKey 分離 + 拆 FileTree.tsx,~1-2h)
- 🟡 BUG-047 pre.2 tag(Rico 驗收,session 9 殘留,使用者授權後可打)
- 🟢 PLAN-022 T0202c fingerprint pinning
- 🟢 PLAN-008 中文「高」優先級 polish
- 🟢 GP042 升 Skill `worker-time-estimation` 候選

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status`(本 session 已 push,無需立即 push)
3. 下一輪優先級建議:
   - 🟡 **BUG-050 Option C 階段 1**(YOLO pipeline 體驗修復,首選)
   - 🟡 BUG-047 pre.2 tag(使用者授權後可打)
   - 🟢 其他零星 polish

---

## 🛏 前次 Session 退出快照(2026-04-19 第十 session,BUG 三連 CLOSED + BUG-049 YOLO 解鎖閉環 + PTY race 分析存檔)

**退出原因**:C 計畫正常收尾(使用者指示 C,下 session 派 T0207 Option B 修復 BUG-048)

**本 session 成果**(~2h,4 工單 + 3 BUG CLOSED + 1 BUG 新建 + 1 研究報告 + `*evolve` 大批次):

**工單鏈(4 張)**:
- `5fe3f6a` T0203 research BUG-042(7 min/est 30-60,**4-8x**)— 四假設突破 Self-inflicted drift
- `85f5743` T0204 fix BUG-042 Option B(3 min/est 10-20,**3-7x**)— 純刪死碼 -28 行,PLAN-019 型別債清零
- `5f10e7e` T0205 fix BUG-049 bat-notify TLS port(6 min/est 5-15,1-2.5x 下緣)— **YOLO pipeline 解鎖**
- `c6d3d97` T0206 research BUG-048(35 min/est 45-90,1.3-2.5x)— 5 觸發點 + 兩現象 100% 證據根因

**BUG 狀態變更(4 張)**:
- 🟢 **BUG-045 CLOSED** — 使用者驗收通過(T0195 + T0196 修復,原截圖回報問題已解,archive 面屬塔台推測延伸)
- 🟢 **BUG-042 CLOSED** — T0204 Option B 純刪死碼(guard 永不觸發 4 個月,runtime 行為不變)
- 🟢 **BUG-049 CLOSED** — T0205 bat-notify MinimalWS TLS port(兩次獨立驗證 end-to-end 跑通)
- 🔴 **BUG-048 OPEN**(研究完成)— T0206 推薦 Option B,下 session 派 T0207 修復

**BUG-049 YOLO end-to-end 首次跑通(里程碑)**:
- 第一次驗證:T0205 完成 Worker auto-submit「T0205 完成」→ 塔台 UI 自動顯示並送出(使用者確認未手動打字)
- 第二次驗證:T0206 完成 Worker auto-submit「T0206 完成」→ 塔台再次無人工干預收到
- PLAN-020 dogfood 以來第一次 YOLO Pipeline 100% 工作
- 真根因:bat-notify.mjs MinimalWS 未隨 T0202a/T0202b 升級(BUG-046 姊妹 script),silent hang
- 歷史追溯:BUG-043「Worker YOLO 偶發失效」CLOSED 決策誤判,真因很可能就是 BUG-049

**研究報告存檔(非工單)**:
- `_report-yolo-pty-race-condition-analysis.md` — Claude CLI 7 項機制盤點 + 4 方案評估(A/B/C/D)+ 塔台階段建議 + 使用者洞察「PTY buffer 不可分辨人類 vs Worker」

**`*evolve` 批次寫入(4 GP + 1 UPDATE + 3 L)**:

🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`:
- **GP056** Duplicated 程式碼的 sibling fix 漏修(BUG-046 → BUG-049 模式)
- **GP057** Self-inflicted drift — 第四根因假設(BUG-042 四假設突破)
- **GP058** 偶發症狀複測正常不等於根因消除(BUG-043 追溯實證)
- **GP059** Dogfood-driven bug discovery(PLAN-020 實證)
- **GP042 UPDATE** Worker time 30+ hit(⭐ proven,建議升 Skill 候選)

🏠 Project `_ct-workorders/_learnings.md`:
- **L076** bat-notify.mjs / bat-terminal.mjs MinimalWS duplication(PLAN-023 候選)
- **L077** PTY input buffer 無法分辨人類 vs Worker(BAT YOLO trade-off)
- **L078** BUG-043 真根因追溯(CLOSED 誤判,呼應 GP058)

**重大方法論突破(3 條)**:
1. **第四根因假設**(Self-inflicted drift)— 同 fork 內 commit A 實作 + commit B refactor 漏清 call site,與前三假設(Dead code / Upstream drift / Planned 未完成)明確區隔
2. **偶發症狀不等於根因消除** — CLOSED 決策需附根因證據,複測「正常」可能只是觸發另一條隱藏成功路徑
3. **Dogfood 催 bug 原理** — 機械化執行把「偶爾會動」的 bug 逼成「100% 失敗」,強迫優先級提升

**YOLO 歷程追加**(本 session):
- `[~10:14] 啟動` Fast Path 快速恢復(快照 ~14h)
- `[~10:26-10:33] T0203` research 派發(使用者手動貼「T0203 完成」= BUG-049 未修前症狀最後一次)
- `[~10:36] BUG-045 CLOSED` 使用者驗收
- `[~10:42] *bug` BUG-048 建立(暫不修)
- `[~10:45-10:48] T0204` fix BUG-042 Option B 完成
- `[~10:50] BUG-042 CLOSED`
- `[~10:52-11:02] T0205` fix BUG-049(使用者問「T0203 notify 沒到」→ 塔台翻 log 定位)
- `[~11:05] BUG-049 CLOSED` 第一次 YOLO pipeline 跑通(使用者確認)
- `[~11:08] _report-yolo-pty-race-condition-analysis.md` 存檔(非 PLAN)
- `[~11:12] *evolve` 4 GP + 1 UPDATE + 3 L 批次
- `[~11:14] git push` 6 commits(L071 解除)
- `[~11:27-11:32] T0206` research BUG-048 完成(Worker auto-notify 第二次驗證 ✅)
- `[~11:36] 收尾` session 10 snapshot + 本次 commit + push

**未執行項(下 session 接)**:
- 🟡 **BUG-048 修復(T0207 Option B)** — Worker 推薦,est 1.5-2h,範圍明確:pending queue + 新增 FileTree `expandToPath()` API
- 🟢 Option C follow-up 工單(5 處 CT Panel dispatch 抽 `openFileInFilesTab()` helper,獨立另開)
- 🟡 BUG-047 pre.2 tag(使用者授權 → `release new pre tag version`→ Rico 驗收)
- 🟡 PLAN-022 T0202c fingerprint pinning(非緊急)
- 🟢 PLAN-008 中文「高」優先級 polish

**恢復指引**(下次 `/control-tower` 啟動時):

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status`(本 session 已 push,無需立即 push)
3. 下一輪優先級建議:
   - 🟡 **BUG-048 派 T0207 Option B 修復**(首選,研究已完成,範圍明確)
   - 🟡 BUG-047 pre.2 tag(使用者授權後可打)
   - 🟡 PLAN-022 fingerprint pinning(安全對齊,可 dogfood YOLO)
   - 🟢 其他零星 polish

---

## 🛏 前次 Session 退出快照（2026-04-19 第九 session,雙重翻案閉環 BUG-046 + packaging 雙修 BUG-047）

**退出原因**：C 計畫收尾全數完成（BUG-046 CLOSED + PLAN-022 建檔 + `*evolve` + commit + push + `_tower-state.md` 快照）

**本 session 成果**（~1h 37min,7 工單 + 2 PLAN + 2 BUG 閉環/VERIFY + 10 commits push）：

**BUG-047 修復鏈（Rico 回報 packaged app 裝機即壞）**：
- `e619b81` T0198 @anthropic-ai 子包 asarUnpack(4min/est 25-40,6-10x)— `claude.exe` ~246MB 進 `.unpacked/`
- `5de178e` T0199 預防性 @lydell/node-pty asarUnpack(4min/est 15-25,4-6x)— `conpty.node` 進 `.unpacked/`
- BUG-047 狀態:OPEN → VERIFY（等 Rico 裝 pre.2 實機驗收）
- 翻案發現:Rico 診斷「code 側 path rewrite」錯,真因在 packaging `asarUnpack` pattern 漏列 platform subpackage

**BUG-046 修復鏈（雙重翻案,TLS protocol mismatch）**：
- `29cd124` T0200 dispatcher defense PARTIAL(14min)— try/catch + timeout log + unhandledRejection handler,**發現 MinimalWS.close bug**
- `b37297c` T0201 research TLS 假設(3min/est 15-25,5-8x)— 三重交叉驗證確立
- `380fa3c` T0202a close reject 獨立防禦(8min/est 5-10,正常)— silent hang → `connect-closed-before-upgrade` clear error
- `831234b` T0202b MinimalWS 升 wss:// TLS(4min/est 15-25,4-6x)— **yolo 派發鏈解鎖**
- BUG-046 狀態:OPEN → CLOSED
- 真根因:PLAN-018 T0182 升 https.createServer,dispatcher 留 net.createConnection → TLS FIN close → MinimalWS 不 reject → silent exit 0

**新 PLAN（2 張）**：
- PLAN-021 Settings UI 自訂 RemoteServer port（IDEA,🟢 Low）— 從 BUG-046 討論衍生
- PLAN-022 Dispatcher fingerprint pinning（PLANNED,🟡 Medium,T0202c 候選）— PLAN-018 安全對齊延伸

**`*evolve` 批次寫入（3 Global + 1 update + 1 Project candidate）**：

🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
- **GP053** 雙重翻案方法論 — 時序→反例證偽→grep→再反例→真因
- **GP054** TLS protocol mismatch silent hang 三要素(協議不對稱 + server fail-close + client close-without-reject)
- **GP055** Dispatcher trust chain 4 層分層防禦(close reject + error handler + timeout wrapper + unhandledRejection global)
- **GP042 UPDATE** Worker time 連 27 hit(本 session 6 連發,T0202b 含實機 smoke 仍 4-6x)

🏠 Project `_ct-workorders/_learnings.md`：
- **L075** SNI RFC 6066 不接受 IP literal(Node.js tls.connect edge case,candidate:global)

**重大方法論突破**：
1. **雙重翻案停手原則**:翻案 ≥2 次強制 research 工單,避免 assumption stacking
2. **Worker time 含 runtime 驗證仍高壓縮**:T0202b 含實機 terminal smoke 仍 4-6x,顛覆「runtime 驗證無法壓縮」假設
3. **Dispatcher trust chain 4 層設計**:任何 Promise-based 連線客戶端都該具備,缺一則產生 silent fail

**YOLO 歷程追加**（本 session 關鍵事件）：
- `[01:44] 啟動` Fast Path 快速恢復(快照 14min)
- `[01:48-01:52] T0197` Rico 精準診斷但真因翻案(code 側無責,packaging 側)
- `[01:59-02:03] T0198` packaging 主修,`.exe` 246MB 進 `.unpacked/`
- `[02:14-02:18] T0199` 預防性 @lydell,兩行 glob 對稱
- `[02:28-02:42] T0200` dispatcher defense,意外發現 MinimalWS.close bug(翻案 token 假設)
- `[02:47-02:50] T0201` research 3min 確立 TLS 假設(三重證據)
- `[02:54-03:02] T0202a` close reject,silent hang 時代結束
- `[03:08-03:12] T0202b` TLS 升級 + SNI edge case(isIpLiteral 偵測)— **yolo 派發鏈解鎖**
- `[03:15-03:21] 收尾` PLAN-022 建檔 + `*evolve` 5 條 + commit + push 10 commits + `_tower-state.md` 快照

**未執行項（下次接)**：
- 🟡 BUG-047 打 pre.2 tag → Rico 驗收(packaging 鏈 T0198+T0199 + BUG-046 修復鏈 T0202a+T0202b 皆待實機驗)— 使用者授權後執行 `release new pre tag version`
- 🟡 PLAN-022 T0202c fingerprint pinning(非緊急,PLAN-018 安全對齊,~1-2h)
- 🟢 BUG-042 TerminalPanel dead call 調查
- 🟢 BUG-045 archive 面(CT skill v4.4 演進,非本 repo 範圍)
- 🟢 PLAN-008 中文「高」優先級 polish
- 🔵 `e498e3a fix(locales)` commit 來源待確認(非本鏈派發,使用者可能自己改)

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照(v4.3.0,距啟動時間 <7d 適用)
2. **第一動作**:確認 `git status`（本 session 已 push 10 commits,L071 警告解除,無需立即 push）
3. 下一輪優先級:
   - 🟡 BUG-047 pre.2 tag(使用者授權 → 執行 `release new pre tag version`)
   - 🟡 PLAN-022 fingerprint pinning(安全對齊,可 dogfood yolo 派發)
   - 🟢 其他零星 bug 或 polish

---

## 🛏 前次 Session 退出快照（2026-04-19 第八 session,UI 封存 toggle 修復 + 用戶 Rico 回報 BUG-047）

**退出原因**：A 計畫收尾完成（`*evolve` + `_tower-state.md` 快照 + push 待執行）

**本 session 成果**（~2.5h,3 工單 + 4 BUG 新建 + 2 BUG 閉環）：

**T0194-T0196 鏈完整閉環**（PLAN-未編號 — UI 封存 + parser 容錯）：
- `de40ecf` T0194 研究（10min/est 30-45min,3-4.5x）— BUG-044/045 根因精準定位 + D 區段拆單建議 [B]
- `b6469ba` T0195 parser table 容錯（5min/est 20-30min,4-6x）— BUG-045 parser 面 closed,13/13 unit tests 全綠
- `bc37c71` T0196 UI archive toggle（**8min/est 2-2.5h,15-19x 創歷史新高**）— parseBugFile/parsePlanFile + 兩 loader + useEffect lazy load,smoke test 35/35 BUG + 4/4 PLAN 全解析

**4 張新 BUG 建立**：
- 🟢 BUG-044 CLOSED — CT Panel 封存 toggle no-op（T0196 修復,使用者複測通過）
- 🟢 BUG-045 半閉環 — parser 面 closed（T0195）,archive 面 OPEN（skill 層演進）
- 🔴 BUG-046 OPEN — BAT dispatcher silent fail（翻案：原假設「T0193 regression」,真因疑 token mismatch + waitForMessage 缺 try/catch + bat-scripts.log 被 truncate）
- 🟡 BUG-047 OPEN — Claude SDK path 未處理 app.asar.unpacked（用戶 Rico 標竿級回報,V1 裝機即壞）

**2 張 BUG 閉環**：
- ✅ BUG-043 CLOSED — 複測通過,疑前期觀察為 BUG-046 副作用誤判（dispatcher 阻擋 + 手動派發不注入 CT_MODE → banner 缺失）
- ✅ BUG-044 CLOSED — T0196 修復通過

**`*sync` × 2**:
- 第 1 次（00:55）— 重建 _bug-tracker.md（5 OPEN）+ _backlog.md（PLAN-019 ✅ DONE 上索引）
- 第 2 次（01:25）— BUG-043/044 閉環 + BUG-047 上 OPEN section,共 12 張（4 OPEN / 8 CLOSED）

**`*evolve` 批次寫入（5 條 + 1 update）**：

🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
- **GP050** 工單元資料格式漂移會讓 parser silent fail（多格式容錯規則）
- **GP051** BUG 翻案方法論 — 時序 ≠ 因果,grep 證據優先（zero-evidence 翻案）
- **GP052** 用戶 reverse-engineer 式高品質 BUG report 模式（Rico 標竿）
- **GP042 UPDATE** Worker time 連 21 hit,T0196 創 15-19x 新高 → 升 ⭐ proven

🏠 Project `_ct-workorders/_learnings.md`：
- **L070** 研究工單規模爆擊暫停門檻（前後 session 對照實證）
- **L071** 本 repo 多次 session 累積 commits 未 push 風險（連兩 session 觸發）
- **L074** Diagnostic logging 自身要驗證寫入路徑（log 被 truncate 是症狀）

**重大方法論發現**：
1. **BUG 翻案三段式**：時序假設 → 反例證偽 → grep 翻案（BUG-046 走完整鏈）
2. **Worker time 高壓縮普及性**：UI 修復也能 15-19x（T0196 顛覆「UI 不可預測」假設）,條件:範本明確 + 範圍對稱 + 不涉及架構決策
3. **用戶 reverse-engineer report 跳過研究階段**：Rico 對照式診斷直接給根因 → 塔台寫修復方向工單,省 30-60 min 研究

**未執行項（下次接）**：
- 🟡 **本 repo push 未執行**（L071 觸發,連兩 session 警告)→ 本 session 結束**必須**push
- 🟢 BUG-046 修復（dispatcher silent fail,需專門 session）
- 🟢 BUG-047 修復（asar.unpacked path,trivial,Rico 配合驗 pre.2）
- 🟢 BUG-045 archive 面（CT skill v4.4 演進,非本 repo 範圍）
- 🟢 BUG-042 TerminalPanel dead call 調查
- 🟢 PLAN-008 中文「高」優先級 polish（T0195 衍生發現,非阻擋）

**YOLO 歷程追加**（本 session）：
- `[~00:11] 啟動` Fast Path 快速恢復（快照 <2h）
- `[00:14-00:32] *bug` 連發 BUG-044/045（使用者截圖回報）+ T0194 yolo 派發失敗 → BUG-046 翻案三段式
- `[00:33-00:52] T0194` 手動派發成功（BUG-046 阻擋 yolo,fallback 手動）— 研究 10min,3-4.5x
- `[00:55] *sync` 第 1 次（PLAN-019 上 DONE）
- `[00:55-01:00] T0195` 手動派發 → 完成 5min,4-6x
- `[01:02-01:23] T0196` 手動派發 → 完成 8min,**15-19x 新高**
- `[~01:22] *bug` BUG-047 用戶 Rico 標竿回報（建檔不修）
- `[01:25] *sync` 第 2 次 + BUG-043/044 CLOSED
- `[~01:30] *evolve` 5 + 1 update 批次寫入

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照（v4.3.0）
2. **第一動作 push 確認**:`git log origin/main..HEAD`,若有領先 → 立即 push（L071）
3. 下一輪優先級:
   - 🔴 BUG-046 dispatcher 修復（影響 yolo 派發鏈,手動 fallback 已驗證但長期不可接受）
   - 🟡 BUG-047 asar.unpacked path 修復（Rico 等驗 pre.2,範圍明確 trivial）
   - 🟢 BUG-042 / PLAN-008 polish

---

## 🛏 前次 Session 退出快照（2026-04-19 第七 session,PLAN-019 收尾 + BAT 診斷儀表）

**退出原因**：使用者「收工」。PLAN-019 技術目標達成(tsc 133 → 2),剩 `*evolve` 和 push 下次接。

**本 session 成果**（~2h,9 工單 + 2 BUG + 1 PLAN DONE）：

**PLAN-019 — TypeScript 技術債 DONE**：
- `987137b` T0186 Cluster 1 ElectronAPI types(8min,133→60)
- `708af69` T0187 Cluster 2 Domain types PARTIAL(7min,60→46)
- `766135c` T0188 Cluster 3 null narrowing(9min,46→39)
- `012a583` T0189 Cluster 5 implicit any NO-OP(2min,被 Cluster 1/2 連帶清)
- `0ab85d3` T0190 Cluster 4 unused symbols(9min,39→26)
- `2956192` T0191 Cluster 6/7/8 收尾(10min,26→2;順帶修 UpdateNotification 真實 bug)
- `53c050b` PLAN-019 DONE 文件收尾

**BAT 診斷儀表（BUG-043 支柱）**：
- `c32a2e9` T0192 scripts 端 log(`_bat-logger.mjs` + bat-terminal/notify NDJSON)
- `2950800` T0193 Electron 端 log(`remote-logger.ts` + terminal IPC 雙軌鏡像)
- log 位置:`%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`
- 核心訊號:`reusedExisting`(ptyManager.isAlive 在 create 前取樣)+ customEnv 白名單

**新 BUG**：
- 🐛 **BUG-042 OPEN** — TerminalPanel 呼叫不存在的 WorkspaceStore action(PLAN-019 Cluster 2 邊界發現)
- 🐛 **BUG-043 OPEN** — Worker YOLO 偶發失效(T0189/T0191/T0192 3 次再現,儀表已裝等樣本)

**L061/GP042 Worker time 第 15-18 hit**(本 session 新增 6 次,累計 20+):
- 文件/型別/診斷類實證 0.2-0.3x 壓縮係數
- **Playbook 候選強化**:工單預估 × 0.3(覆蓋文件/型別/診斷類)

**未執行項（下次接）**：
- 🟡 **`*evolve` 未跑**:L070(研究工單規模爆擊暫停門檻)/ L071(盤點路徑/欄位誤標)/ L072(技術假設需驗證)/ GP cluster 順序(定義層先、使用層後)— 需答分流(通用/本專案/不確定)
- 🟡 **本 repo 未 push**:本 session 多 commits + 前 session PLAN-018 的 commits 皆未 push
- 🟢 BUG-042 調查 TerminalPanel dead call 是 planned 未完成還是遺忘
- 🟢 BUG-043 等自然樣本,撈 log `reusedExisting` 值指向根因

**YOLO 歷程追加**（本 session 關鍵事件）:
- `[~22:00] 啟動` Fast Path 快速恢復(快照 <2h)
- `[22:02] 派發` T0185 研究(yolo OK,規模爆擊 flag 133 vs ~20)
- `[22:14-22:32] T0186` yolo OK
- `[22:34-22:41] T0187` PARTIAL + WorkspaceStore 邊界 pause → BUG-042
- `[22:43-22:57] T0188` yolo OK
- `[22:59-23:03] T0189` **無 banner(BUG-043 第 1 次再現)**
- `[23:05-23:16] T0190` yolo OK(翻案觀察)
- `[23:18-23:30] T0191` yolo OK,PLAN-019 技術目標達成(26→2)
- `[23:32-23:44] T0192` **無 banner(第 2 次再現)** — scripts log 儀表建立
- `[23:48-23:57] T0193` yolo OK — Electron log 儀表建立
- `[~00:00-00:02] 收尾` PLAN-019 DONE + BUG-042/043 建檔 + commit 53c050b
- **規律結論**:互動與失效無相關性,疑 race / terminal 生命週期狀態

**恢復指引**（下次 `/control-tower` 啟動時）:

1. Fast Path 載入本快照(v4.3.0)
2. 下一輪優先級:
   - 🟡 `*evolve` 先答分流,寫入 L070-L072 + GP cluster 順序
   - 🟡 push 本 repo(git push origin main)+ 驗證 monorepo skill 同步
   - 🟢 BUG-042 調查或 BUG-043 等樣本
3. 若「BAT yolo 又失效」→ 立刻 `grep reusedExisting %APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`,撈 customEnv 鏈

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第六 session，PLAN-018 + v4.3.x 收尾）

**退出原因**：主線任務全部完成（PLAN-018 資安加固三張 + CT-T005/T007 skill 治理 + 跨 repo rename + skill sync）。本 session 壓縮執行 16x（估 ~13h、實際 ~80min）。

**本 session 成果**（~80min，5 工單 + 2 ops）：

**PLAN-018（資安加固，DONE）**：
- `6b9de1f` T0182 — TLS + fingerprint pinning + safeStorage（12min/估 5.5h，27x）
- `b12690f` T0183 — path sandbox + image cap（12min/估 1-2h，5-10x，12 unit tests）
- `c7c7fb3` T0184 — brute-force + reconnect backoff + mutex（8min/估 1-1.5h，7-11x，15 unit tests）
- version.json → `5d9f486`（upstream 追平）

**Skill 治理（v4.3.x，DONE）**：
- `3d851a2` CT-T005 — 塔台 skill `--mode` flag + Worker YOLO banner（11min/估 35min）
- `0c2b938` CT-T005 fix — Step 0 YOLO banner 只在 BAT 環境顯示
- `23719c0` CT-T005 docs — CHANGELOG 補 Step 0 BAT gating 說明
- `3de0840` CT-T007 — 版號治理（frontmatter + 面板 + *sync 一致性檢查）
- `cc7e689` chore — 目錄 rename BMad-Control-Tower-v4.2.0 → v4.3.0
- Tag **v4.3.1** 打在 cc7e689（additive，保留既有 v4.3.0）
- Push dev-main + tag 完成
- 8 skill sync 到 `~/.claude/skills/` 完成，所有 frontmatter `version: "4.3.0"`

**閉環事件**：
- ✅ BUG-041 CLOSED（Phase 2.4 實作完成，v4.3.0 dogfood 通過）
- ✅ PLAN-018 DONE（資安三張全綠）
- ✅ v4.3.0/v4.3.1 正式發布（monorepo `BMad-Control-Tower-v4.3.0/`）

**L061/GP042 Worker time 連 14 hit（升 ⭐ proven）**：
- 本 session 新增 5 次全部 3-27x 壓縮
- 累計 14 次（全部 3-27x）
- Playbook 候選：研究報告先行 → 實作壓縮率 0.1-0.2x 常態

**`*evolve` 批次寫入**（5 條）：
- 🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
  - **GP042 UPDATE**（Worker time 連 14 次實證，升 ⭐ proven）
  - **GP048** 版號治理 SSOT（frontmatter + 面板 + *sync 一致性檢查）
  - **GP049** 跨 repo rename 安全模式（pre-flight + additive tag + lock retry）
- 🏠 Project `_ct-workorders/_learnings.md`：
  - **L068** 塔台自主 ops 執行邊界
  - **L069** Upstream sync 設計分歧以權威規格為準

**`*sync` 結果**：
- T/CT-T：40 張（28 DONE）
- BUG：6 張（全 CLOSED）
- PLAN：15 張（1 DONE 新增：PLAN-018）
- EXP：2 張（1 CONCLUDED）
- ⚠️ 部分工單元資料格式不一致（狀態欄位解析失敗）→ L070 候選：metadata 格式自動化正規化（延後，不阻擋）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照（面板預期顯示 **v4.3.0**，不再 v4.1）
2. 塔台派發預期帶 `--mode yolo` flag
3. Worker `/ct-exec` 啟動顯示 🚨 YOLO MODE ACTIVE banner（不再降級提示）
4. 下一輪可選：
   - 實機驗收 PLAN-018（TOFU / QR / brute-force wscat / path sandbox 跨機）
   - 處理既有 tsc --noEmit 技術債（PLAN-019 IDEA）
   - 實機驗收 v4.3.0/v4.3.1 新 skill（檢查 `*sync` 版號一致性輸出）

**待處理事項**：
- 🟡 本 repo（better-agent-terminal）本 session 多 commits 未 push（PLAN-018 三張 + 可能的 meta 改動）
- 🟡 Monorepo 已 push（包含 CT-T005/T007 + rename + v4.3.1 tag）
- 🟡 L070 候選：工單 metadata 格式正規化（不同工單狀態欄位格式不一，*sync 解析失敗）

**YOLO 歷程追加**（本 session）：
- `[~20:05] 啟動` 塔台 Fast Path 恢復，*rescan 更新快照
- `[20:12-20:24] 派發+完成` T0182 — TLS 大張，yolo 閉環首次 5.5h 估時完成
- `[20:36-20:48] 派發+完成` T0183 — path sandbox 並行
- `[20:52-21:00] 派發+完成` T0184 — PLAN-018 收官
- `[21:05] Renew #1` CT-T005 加 YOLO banner 需求
- `[21:16] 建立` CT-T007 版號治理工單（Q&A 觸發）
- `[21:19-21:30] 派發+完成` CT-T005（跨 repo DELEGATE）
- `[21:34-21:40] 派發+完成` CT-T007（跨 repo DELEGATE）
- `[~21:45] ops 執行` 使用者授權塔台自主 rename + tag + push + sync
- `[~21:50] *evolve+*sync` 5 條 learning 寫入 + 索引摘要更新

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第五 session，雙 BUG 閉環 + PLAN-018 拆分）

**退出原因**：*resume 實例驗證目標達成（v4.3.0 Worker skill dogfood PASS），T0182-T0184 工單已備妥但不派發（避免 context 溢出），下 session 接著派 T0182。

**本 session 成果**（~1.5h，8 個 commits）：
- `23d75f3` T0175 DONE（研究報告）
- `6282ea0` T0176 DONE（BAT env 注入）
- `7e1af84` BUG-041 OPEN
- `149153c` CT-T004 DONE
- `51a4a71` BUG-040 FIXED 狀態更新
- （`fb1b095` T0179 DONE — Phase 2.1 研究）
- （`8558b73` T0180 DONE — Phase 2.2 BAT CT_MODE/CT_INTERACTIVE 注入）
- （`83e5986` T0180 回報補 commit hash）
- （`4dbed7d` CT-T006 DONE — Phase 2.3 v4.3.0 Worker skill，monorepo）
- （`4822dbd` T0181 DONE — PLAN-018 拆分研究報告）
- **待 commit**：BUG-040/041 CLOSED 狀態、T0182/T0183/T0184 工單、本快照、L067 project learning、GP044-047 global patterns

**閉環事件**（本 session 主線）：
- ✅ **BUG-040 CLOSED**（Phase 1 完結，workspace 錯派修復，CT-T004 v4.2.2）
- ✅ **BUG-041 CLOSED**（Phase 2.1-2.3 完結，Worker 無狀態化 v4.3.0；Phase 2.4 CT-T005 DISPATCHED 但不阻塞 CLOSED）
- ✅ **PLAN-018 拆分研究** — T0181 產出 T0182/T0183/T0184 完整規格（GP044 標竿）
- ✅ **v4.3.0 Worker skill dogfood PASS** — T0181 派發時升級提示正確顯示，fallback ask 模式運作

**L061/GP042 Worker 估時係數連六 hit**：
- T0175: 6 min / 30 est (5x)
- T0176: 6 min / 30-45 est (6-7.5x)
- T0179: 15 min / 60-90 est (4-6x)
- T0180: 5 min / 30 est (6x)
- CT-T006: 6 min / 30 est (5x)
- T0181: 9 min / 60-120 est (7-13x)
- **累計 9 次實證**（加 T0168/T0169/T0170/T0172），GP042 強化升 🟢
- Playbook 候選：工單預估工時 × 0.2 係數（文檔/規格類）

**塔台決策（PLAN-018 Q1/Q2/Q3，使用者採 Worker 推薦）**：
- **Q1.A**：`safeStorage` Linux fallback plaintext + warn
- **Q2.A**：bind-interface tailscale 無介面 fail-closed error
- **Q3.是**：ProfilePanel fingerprint 首次連線允許空白 + TOFU

**`*evolve` 批次寫入**（6 條）：
- 🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
  - **GP042 UPDATE**（Worker time 連 9 次實證，升 🟢）
  - **GP044** 研究型工單品質標竿（精確行號 + 三欄 AC + diff 片段）
  - **GP045** 研究報告 grep 覆蓋率缺口與 Worker 自補現象
  - **GP046** 技術債 Phase 分階段插隊 pipeline
  - **GP047** 「禁止 X」設計約束的 grep 命中空驗證
- 🏠 Project `_ct-workorders/_learnings.md`：
  - **L067** payload-pty-env 管線半成品為 BUG-040 技術債根源

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 確認 `auto-session: yolo` + `yolo_max_retries: 1` + `auto_commit: on` 仍生效
3. 下一輪優先級：
   - 🔴 **T0182** TLS + fingerprint pinning + safeStorage（5.5h，PLAN-018 第一張，派發即開工）
   - 🟡 **CT-T005** DISPATCHED 待執行（跨 repo，補完 yolo 閉環最後一片拼圖，完工後 v4.3.0 Worker 不再顯示升級提示）
   - 🟢 T0183 + T0184（PLAN-018 剩餘 2 張，依賴 T0182 完成）
4. PLAN-018 完成路徑：
   - Day 1：T0182（5.5h，序列）
   - Day 2：T0183（1-2h 並行）+ T0184（1-1.5h，等 T0182）+ version.json sync 到 `5d9f486`
   - T0184 DONE → PLAN-018 IN_PROGRESS → DONE
5. CT-T005 若使用者決定派發：切到 `BMad-Control-Tower/BMad-Control-Tower-v4.2.0/` repo，開新 session `/ct-exec CT-T005`

**待處理事項**：
- 🟡 本地多 commits 未 push（塔台這端 4 個 + monorepo `4dbed7d`/`4822dbd` 已 push 到 Forgejo dev-main）
- 🟡 下 session 派 T0182 前，建議先 review 研究報告 §C（5.5h 工時大 + 雙端測試）
- 🟡 `_tower-state.md` YOLO 歷程區段本 session 未即時追加事件（整批於本快照總結）

**YOLO 歷程追加**（本 session 摘要，詳見各事件）：
- `[19:43-19:52] 派發+完成` T0181 research — v4.3.0 dogfood 首例，升級提示正確顯示（斷點 A regex 通過）
- `[19:43] dogfood 觀察 #1` Worker 啟動訊息：「⚠️ 塔台未傳 `--mode` flag，降級為 ask」
- `[19:35] BUG-041 CLOSED` 使用者決定核心完工即結案（CT-T005 DISPATCHED 不阻塞）
- `[19:22] 完成` CT-T006 DONE `4dbed7d` — v4.3.0 Worker skill 無狀態化，10/10 AC，D062 grep 命中空驗證
- `[19:01] 完成` T0180 DONE `8558b73` — BAT `--mode` / `--interactive` env 注入
- `[18:52] 完成` T0179 DONE `fb1b095` — yolo flag 傳遞協定研究（620 行報告）
- `[18:22] BUG-040 CLOSED` 使用者確認跨 workspace 實測通過
- `[*evolve+*resume 後]` 6 條 learning 寫入、T0182-T0184 工單建立、本快照更新

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第四 session，Phase 1.1 完成）

**退出原因**：使用者重新 build + 部署新版，驗收 T0176 的 AC-1~AC-6（需 app 重啟才能驗）。

**本 session 成果**（~30 min，2 commits 未 push）：
- `23d75f3` T0175 DONE（BAT_WORKSPACE_ID 注入研究報告，6 min 完成／預估 30）
- `6282ea0` T0176 DONE（BAT 端 env 注入實作，6 min 完成／預估 30-45）
- D062 寫入決策日誌（**Worker 無狀態原則** — BUG-040/041 修復的共同設計依據）
- BUG-041 建立（yolo gap 現狀記錄，Phase 2 前保持 OPEN）

**Phase 1（BUG-040 修復）進度**：
- ✅ **Phase 1.1** — T0176（BAT 端 env 注入）Worker 自測 AC-7 編譯通過，12 處改動、5 files
- ⏸ **AC-1~AC-6 使用者驗收**（本輪暫停點）：需重新 build + 重啟 BAT + 開新塔台 session 跑 `echo $BAT_WORKSPACE_ID`
- 📋 **Phase 1.2** — CT-T004 DELEGATE（塔台 skill 加 `--workspace`）：等 AC 通過才派

**dogfood 實證結果**：
- ✅ BUG-041（yolo gap）**已確證** — T0176 完成後 Worker 走 Step 11 剪貼簿，使用者手動打「T0176 完成」通知塔台
- 🔍 BUG-040（workspace 錯派）— Worker commits 落在正確 repo，未觀察到顯性錯派（待 AC-3 跨 workspace 測試驗證）
- 📊 L061 連續再實證 — T0175/T0176 都是 6 min 完成（研究報告細緻度 × Worker 熟悉度）

**Learning 候選累積**（Phase 1 CLOSED 後 `*evolve` 批次）：
- **L067**：研究型工單品質標竿（T0175 模板化：精確行號 + diff + AC 對照）— Global 候選
- **L068**：研究報告 grep 覆蓋率缺口（應 full grep 而非選擇性摘要，T0175 漏列 WorkspaceView.tsx 2 處）— Global 候選
- **L069**：payload-pty-env 管線半成品為 BUG-040 技術債根源（跨層欄位應一次貫通）— Project 候選

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台啟動時自動檢查 `echo $BAT_WORKSPACE_ID`：
   - **非空**（uuidv4 格式）→ 部署成功，提醒使用者完成 AC-2~AC-6 驗收
   - **空字串** → 部署失敗或未生效（檢查：使用者是否 build 完重啟？是否開新 session？）
3. 依使用者 AC 驗收結果決策：
   - **AC-1~AC-6 通過** → 派 **CT-T004** DELEGATE（塔台 skill 加 `--workspace "$BAT_WORKSPACE_ID"`）→ Phase 1.2 啟動
   - **AC 失敗** → T0176 退回 FIXING，重派修復工單
4. CT-T004 閉環 → BUG-040 FIXED → VERIFY（使用者實測跨 workspace）→ CLOSED
5. BUG-040 CLOSED 後啟動 Phase 2：派 T0179 研究 BUG-041 yolo gap

**待處理事項**：
- 🟡 本地 2 commits 未 push（`23d75f3` T0175 + `6282ea0` T0176）— 使用者決定 push 時機
- 🟡 `*sync` 重建 `_bug-tracker.md` 納入 BUG-041（本 session 未做，下 session 可一起處理）
- 🟡 上 session 遺留 2 commits（`c73a23b` + `49444ed`）仍未 push

**下一輪優先級**：
- 🔴 **AC-1~AC-6 驗收**（使用者操作 → 回報結果）
- 🔴 **CT-T004 DELEGATE**（AC 通過後立即派）
- 🟡 Phase 2 BUG-041 啟動（Phase 1 CLOSED 後）
- 🟢 BUG-040 與 BUG-041 均遵循 D062 原則

**YOLO 歷程追加**（本 session）：
- `[17:08] 派發` T0175 research（BAT env 注入設計）— yolo 自動派發成功
- `[17:14] 完成` T0175 DONE — Worker 自填回報區，system-reminder 偵測檔案修改
- `[17:20] Phase 0` D062 決策記錄 + BUG-041 開單 + Plan C 精細化
- `[17:31] 派發` T0176 implementation（BAT env 注入實作）
- `[17:37] 完成` T0176 DONE — **BUG-041 確證**（Worker 走 Step 11 剪貼簿，使用者手動通知）
- `[17:40] 暫停` 等 AC-1~AC-6 使用者驗收（本 session 自然同步點，非斷點觸發）

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第三 session，收工）

**退出原因**：使用者主動收工（本 session 成果豐厚，到達自然結束點）。

**本 session 成果**（~1h，2 個 commit）：
- `c73a23b` CT-T003 PARTIAL（Worker 完成規格修改 + CHANGELOG）
- `49444ed` 塔台自主 commit（session 收尾批次：CT-T003 DONE + *evolve + *archive + config）
- **2 commits 未 push**（使用者自行決定）

**完整閉環事件**：
- ✅ CT-T003 DONE（yolo spec drift 閉環，v4.2.1 tag 發布在 `1d02727`，生產塔台 sync 驗證通過）
- ✅ `*evolve` 批次萃取 L057-L066（9 條 → Global GP038-043 六條 + Project L062/L063/L065/L066 + L064 閉環註記）
- ✅ `*archive --dry-run` 測試（L066 發現 IDEA 節點活躍引用鎖現象）
- ✅ Config 收尾（`archive_days: 1→7`, `auto_commit: ask→on`）
- ✅ YOLO 歷程追加 5 條事件（[派發]/[部分完成]/[完成]/[evolve]/[archive-test]）

**Learning 管線升級**：
- Global: +6 GP（GP038-043）— GP039/GP042 直接升 🟢（2+ 次實證）
- Project: +3 L（L062/L063/L066）+ L064/L065 補充
- 新發現：L066 歸檔引用鎖現象（CT 通用 learning 候選）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台讀 `_tower-config.yaml` → `auto-session: yolo` + `auto_commit: on` 皆啟用，警語面板應自動顯示
3. 熱區仍有 50 張單據（`archive_days: 7` 預設下，下次歸檔需 2026-04-25 後才有新候選）
4. BUG-040 OPEN 仍待處理（workspace 錯派，T0173 研究結論已在）
5. PLAN-018 PAUSED（Remote 資安加固，可 `*resume` 接回）

**下一輪候選**（優先級待定）：
- 🔴 **BUG-040** — bat-terminal workspace 錯派（T0173 研究已完成，可直接派實作工單）
- 🟡 **PLAN-018** — Remote 資安加固（PAUSED 中，yolo mode 實戰驗證完畢可接回）
- 🟢 **PLAN-004** — GPU Whisper 加速（Win/Linux）
- 🟢 **PLAN-009** — Sprint 儀表板 UI
- 🟢 **PLAN-019** — TypeScript 債務清理

**待處理事項**：
- 🟡 本地 2 commits 未 push（`c73a23b`, `49444ed`）— 使用者決定何時 push
- 🟡 global `~/.claude/control-tower-data/patterns.md` 已追加 GP038-043（非 git repo，無需 commit，但跨機器同步機制未知）
- 🟡 CT v4.2.1 tag 已 push 到 Forgejo `sxnas:gower/BMad-Guide.git`

---

## 🛏 前前次 Session 退出快照（2026-04-18 下半場第二 session，Phase 0-1 完結）

**退出原因**：T0174 Phase 0-1 跑完，Phase 2-6 context 空間不足，下 session 繼續。

**本 session 成果**（4 個 commit）：
- `f7672f6` PLAN-020 yolo mode 閉環 meta (5/6)
- `37e421c` BUG-040 OPEN
- `746b4a6` T0173 新建 + T0174 改寫為三步方案 Step 1-2
- `4ec9056` yolo config 持久化（auto-session: on → yolo, yolo_max_retries: 1）

**T0174 進度**：
- ✅ Phase 0 前置自檢（6/6 全綠，含「`BAT_TOWER_TERMINAL_ID` 空是正常」判定修正）
- ✅ Phase 1 啟用觀察（警語面板完整 + 持久化）
- 📋 Phase 2-6 待下 session

**Learning 候選新增**：
- **L063**：`yolo-mode.md` 啟動警語規格未涵蓋 session-only vs persisted 差異提示（UX 缺口）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台讀 `_tower-config.yaml` 發現 `auto-session: yolo` → **自動顯示 YOLO MODE ACTIVE 警語面板**（這是 Phase 1 的 session-to-session 延續驗證）
3. 若 user 說「繼續 T0174」或「跑 Phase 2」→ 直接派 T0173（BUG-040 研究）為首張 dogfood 場景
4. 派發命令（yolo 模式，BAT 內部終端）：
   ```
   node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T0173"
   ```
5. 觀察點：派發面板完整、1-2s 緩衝、BAT 新分頁開啟、`bat-notify.mjs --submit` 送 Enter（Worker 不用手按）

**下 session 執行計畫**：
1. 觀察塔台啟動時 yolo 警語是否自動顯示（Phase 1 延續驗證）
2. 派 T0173 → Phase 2-3（派發面板 / BAT 整合 / Worker 自動回報）
3. T0173 DONE → Phase 4 下一張判定觀察（預期：無明確下一張，塔台應報「yolo 工作隊列清空」）
4. Phase 5 斷點 C 實測（使用者打字「停」）
5. Phase 6 驗證 `_tower-state.md` 新增 YOLO 歷程區段

**T0174 剩餘 Phase 規格**：見 `T0174-dogfood-yolo-mode-plan018.md`（Phase 0-1 回報已填）。

**dogfood 結束後收尾**：
- 評估是否回滾 `auto-session: yolo → on` + 移除 `yolo_max_retries`（視實測結果）
- T0174 DONE → PLAN-020 整體 DONE
- `*evolve` 萃取 L057-L063

**Learning 候選累積**（下次 `*evolve` 處理）：
- **L057**：跨專案 DELEGATE 長時差異 + Renew 前置驗證（F-11 守衛價值）— D061 實戰
- **L058**：對方塔台自行吸收 pattern（CP-T0094/95 = CT-T001 先例複製）
- **L059**：BUG 觀察對照表證據法（BUG-040 兩次事件對照推根因方向）
- **L060**：條件式拆單策略（T0167 Q2 未決時「三分支平行」讓工單 1 不阻塞）
- **L061**：Worker 實際工時遠低於估時（T0168=7min/T0169=4min/T0170=6min/T0172=2min 連續）
- **L062**：對方塔台實作比 Worker 草稿更嚴謹（yolo 硬鉤子失敗不跑 Step 11，狀態重複避免）

---

## 🎉 本 Session 成就（2026-04-18 下半場）

**PLAN-020 yolo autonomous mode**：插隊 + 閉環 ~3.5h（原估 7-11h，含 CT 跨專案整合 + 對方塔台自行吸收加速）

**產出**：
- 7 張本專案工單 DONE（T0166-T0172）
- 1 張跨專案 DELEGATE DONE（CT-T002，v4.2.0 tag 落地）
- 2 張本地草稿檔 + 1 份研究報告
- 1 PLAN + 3 決策 + 2 BUG（039 CLOSED / 040 OPEN）
- 對方塔台 v4.2.0 發布（`~/.claude/skills/` 已同步）

---

## 🔄 本 Session 焦點（2026-04-18 12:18）— PLAN-020 yolo 模式插隊（D059）

**插隊原因**：使用者觀察 `auto_session: on` 反向通道（Worker→塔台）未觸發，提出 `yolo` 模式提案 — Worker 自動送出 + 塔台自主決策多工單。

**關鍵技術發現**：
- ✅ `scripts/bat-notify.mjs` 已存在（雙管道：UI toast + pty:write 預填）
- ✅ `scripts/bat-terminal.mjs` 已存在（開新 Worker terminal）
- ❌ 當前塔台 session `BAT_TOWER_TERMINAL_ID=`（空字串）— 推測是 on 反向不觸發的根因
- ❌ `pty:write` 不送 `\r`（只預填，使用者仍要手按 Enter）

**對齊結果（Q1-Q3）**：
- Q1.B：開 PLAN-020 + 立刻派研究工單
- Q2.B：skill + BAT 同時改（整合 bat-notify 基礎設施）
- Q3.C：PLAN-018 冷凍，yolo 完成後用 PLAN-018 剩下 4 張工單作驗證

**已建立**：
- 📋 PLAN-020 🔴 High — yolo autonomous mode
- ✅ T0167 research DONE（2026-04-18 12:25-12:39，14 分鐘，含 1 輪互動）
- 📊 `_report-plan-020-yolo-feasibility.md`（Worker 研究報告）
- 📝 D059 + D060 決策已記錄

**T0167 關鍵結論**（糾正假設）：
- env 注入鏈路**完整**（`BAT_TOWER_TERMINAL_ID` 實測有值）
- 真正根因：ct-exec Step 8.5 標「可選/靜默跳過」+ `pty:write` 不加 `\r` + Step 11 剪貼簿蓋過 Step 8.5
- 5 張條件式拆單，已收斂為單一分支（D060 採 Q2.A）

**對齊結果（Q1-Q3）**：
- Q1.A：接受 Worker 5 張拆單建議
- Q2.A：資訊來源採研究工單 D 區段（D060）
- Q3.B：先 commit meta 批次，再派工單 1

### PLAN-020 進度
- ✅ **T0168** DONE（12:53-13:00，7 分鐘，commit `c4b2a19`）— `bat-notify.mjs --submit`
- ✅ **T0169** DONE（13:01-13:05，4 分鐘，commit `488ad93`）— Worker skill 草稿
- ✅ **T0170** DONE（13:15-13:21，6 分鐘，commit `ff678cc`）— Tower skill 草稿
- ✅ **CT-T002** DONE（13:27-15:08，跨 3 session）— 技術實作 `bfc4ba5` + 對方塔台已吸收（CP-T0094/95）+ Renew #2 補 v4.2.0 tag
- ✅ **T0171** DONE（13:50-14:41，51 分鐘，commits `2abcd0f`/`b00012d`/`604e154`）— BUG-039 修完
- ✅ **CT-T002 Renew #2** DONE（14:55-15:08）— v4.2.0 tag 已打於 `d65f451` 並 push 成功
- 🔄 **T0172** 派發中（14:55）— 驗證 yolo skill sync（並行 CT-T002）
- 📋 **T0173** TODO（已建單）— BUG-040 研究（純讀碼 research，1-1.5h）→ T0174 dogfood 首張場景
- 📋 **T0174** TODO（已改寫為三步方案 Step 1-2，30-45min 觀察）— yolo 機制 dogfood（Step 3 併入 PLAN-018 `*resume`）

### CT-T002 Renew 歷程
- #1（13:55）push Forgejo + snapshot → Worker F-11 守衛觸發（前提失真，對方塔台已吸收）
- #2（14:55）補打 v4.2.0 tag → 單一動作收尾

### 插隊 BUG
- 🚫 **BUG-039** 🟡 Medium CLOSED（14:45，Q1.A 直接關閉）— `bat-terminal.mjs --help` silent passthrough 已修
- 🐛 **BUG-040** 🟡 Medium OPEN — `bat-terminal.mjs` workspace 錯派（疑似 BUG-031 regression，Q2.B 不阻塞）

### T0169 關鍵產出
- Worker 4 分鐘完結，遠低於 1-1.5h 估時
- 4 種狀態字串鎖定：`T#### 完成` / `部分完成` / `失敗` / `需要協助`
- FIXED → 完成；BLOCKED → 需要協助（併入三類簡化塔台 regex）
- 硬鉤子 yolo 下失敗**阻斷工單 DONE**，避免塔台死鎖
- 相容性：舊版 BAT（無 --submit）自動降級為 on + 警告

### T0168 驗收摘要
- A1/A3/A4/A5 全綠（程式碼驗證 + 互斥檢查實測）
- **A2 待使用者實機互測**（雙終端 A/B 送 `echo ok` 驗證 `\r` 生效）— 子 session 自測會污染自己 stdin，Worker 合理跳過
- B1 空字串由既有檢查擋下，B2 用 `/[\r\n]$/` 防雙重結尾

### 最大編號更新
- 工單：T0169（+2，T0168 + T0169）
- PLAN：PLAN-020
- 決策：D060

---

## ⏸ PAUSED — PLAN-018 Remote 資安加固（2026-04-18 07:52 冷凍）

**冷凍點**：T0166 研究 DONE，12 項衝突盤點完成，正對齊 Q1（派發順序）/ Q2（C1/C2/C3 決策時機）
**恢復條件**：PLAN-020 yolo 完成驗收後，`*resume` 回復 PLAN-018
**資料完整性**：`_report-plan-018-remote-security-port.md` 已產出，可直接接續

---

## 🔄 上輪 Session 焦點（2026-04-18 07:52）— PLAN-018 啟動（D059 對齊）

**對齊結果**（Q1-Q6）：
- **Q1.A**：先派研究工單（T0166，~2h）
- **Q2.B**：拆 4 張實作工單（TLS+fingerprint / sandbox / brute-force / 整合測試）
- **Q3.A**：實作用 EXP worktree（`exp/remote-security`，TOPIC=RMTSEC）
- **Q4.C**：整天範圍（6-10h 整包）
- **Q5.B**：研究純靜態分析，不實測打包
- **Q6.A**：每張工單完成回塔台對齊再派下一張

**T0166 已派發**（auto-session: on，已透過 BAT 內部終端開新 session）：
- 產出：`_report-plan-018-remote-security-port.md`
- 內容：4 大面向分析 + 衝突清單 + 4 張實作工單拆單建議 + 依賴順序圖
- 執行位置：主線（純讀碼）

### 下一步（使用者回塔台時）
1. Worker 完成 T0166 → 回報「T0166 完成」
2. 塔台審 `_report-plan-018-remote-security-port.md` → 決策拆單方案
3. 指導 `git worktree add ../better-agent-terminal-remote-security -b exp/remote-security`
4. 建立 EXP-RMTSEC-001（🧪 EXPLORING 統籌）+ 派第 1 張實作工單

### 最大編號更新
- 工單：T0166（+1）
- 待決策：EXP-RMTSEC-001 尚未正式建立

---

## 🔄 上輪 Session 焦點（2026-04-18 07:10）— Upstream v2.1.42+ 同步決策（D058）

---

## 🔄 本 Session 焦點（2026-04-18 07:10）— Upstream v2.1.42+ 同步決策（D058）

**研究工單 T0164 閉環**（2026-04-18 06:49 → 07:08，19 分鐘）：

- **範圍**：upstream `tony1223/better-agent-terminal` 自 `8d23e6e` 後 13 commits（v2.1.42 → v2.1.46-pre.1）
- **分類結果**（實質 11 包）：cherry-pick 2 包 / 移植 1 包 / skip 4 包
- **產出報告**：`_report-upstream-sync-v2.1.42-plus.md`
- **關鍵補充**：使用者指示 C1.1 必須先升 SDK/CLI 再加 Opus 4.7 builtin（否則 `model-not-supported`）
- **D058 決策**：採方案 [A] — T0165 Phase 1 cherry-pick（~2h，本輪執行）+ PLAN-018 Phase 2 remote 資安加固（6-10h，下週）

### 衍生工單狀態
- **T0165** ✅ DONE（07:40 使用者驗收通過）— Phase 1 cherry-pick 閉環
  - C1.1 = `84c2930` Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh
  - C1.2 = `59a26f8` remote workspace:load + profile fix (upstream `0bc3bc1` cherry-pick)
  - prep = `47bce0c` CT bookkeeping
  - `version.json` 推進 `8d23e6e → 0bc3bc1`，version 改為 `2.1.45`
  - `CLAUDE.md` 新增 Claude Agent SDK / CLI 小節
- **PLAN-018** 📋 PLANNED 🔴 High — Remote 資安加固（TLS + fingerprint + sandbox + anti-bruteforce），排下週
- **PLAN-019** 💡 IDEA 🟢 Low — TypeScript 技術債清理（T0165 順帶發現 ~20 tsc errors）

### 下一步
1. ~~派發 T0165~~（✅ 已完成）
2. ~~T0165 runtime 驗收~~（✅ 已完成）
3. 本輪 CT bookkeeping meta commit（`_decision-log` / `_backlog` / `_tower-state` / PLAN-018/019）
4. PLAN-018 排下週，實作階段再拆 T####
5. PLAN-019 等有空檔再議

### 待處理事項（沿用上輪）
1. ⏸ Worktree 清理：`git worktree remove --force ../better-agent-terminal-builder26 && git branch -d exp/builder26`
2. 🟡 6+ commits 待 push（加上 T0164/T0165/PLAN-018/D058 commit，可能 8+）
3. 💡 `*evolve` 萃取仍在進行中（L039-L056 共 18 條候選）

---

## 🔄 上輪 Session 焦點（2026-04-18 05:30）— 安全升級日完結

**本日集中升級三部曲 + PLAN-016 全案閉環**：

| PLAN | 內容 | 閉環時間 | 關聯 |
|------|------|---------|------|
| **PLAN-016** ✅ | Electron 28.3.3 → 41.2.1 | 05:30 | 三 Phase 全綠（D047→D056） |
| **PLAN-005** ✅ | electron-builder 24.13.3 → 26.8.1 | 05:25 | PLAN-016 Phase 3 載體（D054/D055） |
| **PLAN-003** ✅ | npm audit 殘餘漏洞（三 Group） | 05:25 | Group A=PLAN-005 / B=T0163 / C=WONTFIX |

### 本日累積成果
- **npm audit**：27 → 3（減少 88.9%，剩 Group C WONTFIX）
- **依賴版本**：Electron 41.2.1 + electron-builder 26.8.1 + vite 7.3.2 + Node 24 + Chromium M146
- **EoL 窗口**：Electron 41 EoL 2026-08-25（約 4 個月保護期），下次主升級 Q3 2026 評估 Electron 43+
- **CLAUDE.md**：Electron Runtime + Build Toolchain 段完整記錄
- **相關 commits（2026-04-18 單日）**：17 個 + 本輪 D056 meta commit
- **本輪 unpushed**：5 commits（含本輪 D056 meta）

### Learning 候選（本日累積 15 條，L039-L056）
- **L039-L041**（Phase 2 期間）：Electron IDE self-lock 陷阱 + 雙軌驗證
- **L044-L048**（T0162/T0163/EXP-BUILDER26-001）：研究分階段 + Worker 續接 + EXP worktree 實證
- **L049-L053**（PLAN-005 閉環）：wall-clock vs Worker time + CONCLUDED-PENDING 中間狀態
- **L054-L056**（PLAN-016 閉環）：安全升級日模式 + Success Criteria 具體化 + 跨 PLAN 依賴元資料

### 待處理事項
1. ⏸ Worktree 清理：`git worktree remove --force ../better-agent-terminal-builder26 && git branch -d exp/builder26`（等 file lock 釋放後執行）
2. 🟡 **6+ commits 待 push**（由使用者決定時機）
3. 📦 **本輪歸檔完成**（2026-04-18 05:45）：37 張搬入冷區（29 T 工單 + 6 BUG + 2 PLAN），豁免 T0149/T0150/T0154/BUG-034/PLAN-012 共 5 張（Active 引用）
4. 💡 **正在進行 `*evolve`** — 萃取本輪 18 條 learning
4. 📋 **下一輪工作候選**（優先級待定）：
   - PLAN-004 🟡 GPU Whisper 加速（Win/Linux）
   - PLAN-009 🟡 Sprint 儀表板 UI
   - PLAN-014 🟡 BAT 內建 Git 圖形介面（方向 B）
   - 剩餘 🟢 Low：PLAN-002 / PLAN-007 / PLAN-013 / PLAN-015
5. 🟢 **無 High/Critical 待處理項**（升級相關 High 全結案）

---

## 🔄 上輪 Session 焦點（2026-04-18 05:25，歷史追溯）

**PLAN-005 / PLAN-003 全案閉環**（~3 小時集中升級 session）：

### 依賴升級三部曲（連續閉環）
1. **T0163** ✅ DONE（04:18，commit `83ae7cf`）— vite 5.4.21 → 7.3.2 + 3 plugin 連動，PLAN-003 Group B 閉環
2. **EXP-BUILDER26-001** 📊 CONCLUDED（05:25，merge commit `75bb77f`）— electron-builder 24.13.3 → 26.8.1，PLAN-003 Group A 閉環
3. **PLAN-003 整體** ✅ DONE — Group A + Group B + Group C WONTFIX 全數完結

### 閉環成果
- **npm audit**：13 → 3（僅剩 Group C whisper-node-addon → cmake-js → tar WONTFIX 鏈）
- **電子依賴現狀**：vite 7.3.2 + electron 41.2.1 + electron-builder 26.8.1（全部最新 stable）
- **CLAUDE.md Build Toolchain 段**：完整記錄 vite 7 + electron-builder 26 migration notes
- **使用者 Step 5.4 Installer 手動驗收通過**：CT panel / 終端機 / Sidebar / IPC 全綠

### 本輪 commits（4 個 unpushed）
- `83ae7cf` chore(deps): vite 5→7（T0163）
- `ca8057b` chore(ct): T0163 DONE + PLAN-005 launch（D054）
- `75bb77f` Merge EXP-BUILDER26-001（no-ff）
  - `f79f735` chore(deps): electron-builder 24→26
  - `d146c9a` chore(ct): commit hash 回填
  - `f105eb9` chore(ct): Worker 收尾
- **本輪 meta commit 待建立**（EXP + PLAN × 2 + tower-state + backlog + D055）

### Learning 候選（下次 `*evolve` 評估晉升）
- **L046-L053** 累積 8 條，涵蓋：續接中斷 Worker / EXP worktree 實證 / auto-session 組合 / Worker time vs wall-clock 估時 / schema breaking 處理 / CONCLUDED-PENDING-X 中間狀態

### 待處理事項
1. ⏸ Worktree 清理：`git worktree remove ../better-agent-terminal-builder26 && git branch -d exp/builder26`（塔台可執行）
2. 📋 下一輪候選（使用者決定）：
   - PLAN-004 🟡 GPU Whisper 加速
   - PLAN-009 🟡 Sprint 儀表板 UI
   - PLAN-014 🟡 BAT 內建 Git 圖形介面（方向 B）
   - PLAN-016 🔴 Electron Phase 3（暫緩中）
3. 🟡 4 commits 待 push（由使用者決定時機）
4. 💡 下次 `/ct-evolve --playbook` 可評估 L049/L050/L052 晉升為 global playbook

---

## 🔄 上輪 Session 焦點（2026-04-18 04:25，歷史追溯）

**T0163 DONE 閉環**：
- vite 5.4.21 → 7.3.2 + 3 plugin 連動（commit `83ae7cf`，13 分鐘完成）
- npm audit 13 → 11（esbuild SSRF + vite path traversal 2 moderate 清除）
- CLAUDE.md Build Toolchain 段寫入
- Smoke test 10/10 checklist 全綠（dev/HMR/CT panel/terminal/IPC/build）
- **執行過程特殊事件**：前任 Worker 在 Step 5 前中斷（自 kill），續接 Worker 從 Step 1 盤點驗證接手到 Step 8 收尾，無資料損失
- **PLAN-003 Group B ✅ DONE**

**PLAN-005 啟動（D054）**：
- **執行方案**：使用者對齊 A/C/C/A
  - Q1-A：立刻動，趁 vite 升級工具鏈熱度
  - Q2-C：**EXP worktree 模式**（`exp/builder26`），主線零污染
  - Q3-C：Windows 完整打包 + macOS/Linux YAML dry-run（無 macOS 機器）
  - Q4-A：`electron-builder: ^24.0.0 → ^26.8.1`（npm audit 指向版本）
- **派發 EXP-BUILDER26-001**（🧪 EXPLORING，4-6h）
- **完結路徑**：CONCLUDED → merge 回主線 → PLAN-005 DONE → PLAN-003 Group A 關閉 → PLAN-003 整體 DONE

**使用者執行計畫**（本 session 結束後）：
1. 塔台批次 commit 本輪 meta（T0163 meta + PLAN-005 / PLAN-003 更新 + D054 + tower-state + EXP-BUILDER26-001）
2. 使用者執行 `git worktree add ../better-agent-terminal-builder26 -b exp/builder26`
3. 進入 worktree 目錄，開新 sub-session 輸入 `/ct-exec EXP-BUILDER26-001`
4. Worker 完成後回塔台說「EXP-BUILDER26-001 CONCLUDED」或「ABANDONED」或「卡關：<原因>」

---

## 🔄 舊 Session 焦點（2026-04-18 03:58，歷史追溯）

**T0162 全 phase 完成**：
- Phase 1 DONE（commit `edf913a`，11 分鐘）— 漏洞盤點 13 個全 dev-only，D052 混合策略
- Phase 2 DONE（commits `8be4e5a` + `51201d1`，實耗 7 分鐘）— 3 個 OQ 全解：
  1. ✅ vite-plugin-electron 0.29.1 stable 支援 vite 7/8（Phase 1 peer 判斷不精確已修正）
  2. ⏭ electron-vite 遷移成本過高，不採用
  3. ✅ vite 5→7 改動小；5→8 重磅（Oxc/Rolldown + CJS）

**塔台 D053 決策：路徑 A（vite 7 stable）**
- 使用者選擇：A，對齊 1B/2B/3A
- 理由：漏洞清除相同，路徑 B 吃 beta + CJS interop + Oxc/Rolldown 新引擎風險，production app 保守為上
- 下次升 vite 8 等 `vite-plugin-electron@1.0.0` GA 脫離 beta（6-12 個月後）

**T0163 派發**（📋 PENDING，3-5h）：
- vite 5→7 + 3 plugin 連動 + vite.config migration + CLAUDE.md Build Toolchain 段 + 主要功能 smoke test + 獨立 commit（3A）

**使用者執行計畫**：塔台 meta commit 後，開 sub-session `/ct-exec T0163` 執行實作。

---

## 🛏 前次 Session 退出快照（2026-04-18 03:43，歷史追溯）

**退出原因**：使用者移回 BAT 內 sub-session 繼續 T0162 Phase 2（Worker 已於 03:43 領取 Renew #1 指示，狀態 IN_PROGRESS）。塔台 session 先結束避免 context 膨脹，等 Worker 完成 Phase 2 後再恢復決策。

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（快照 <24h，無需 `*rescan`）
2. 檢查 T0162 狀態：
   - 若 Worker Phase 2 回報完成 → 讀「Phase 2 回報（Renew #1）」區段 → 塔台決策派實作工單 or 再 Renew
   - 若仍在 IN_PROGRESS → 使用者應已完成 Phase 2，提示「T0162 Phase 2 完成了嗎？」
3. 若需派實作工單 → 下一張是 **T0163**（vite 5→8 升級 + plugin 連動）
4. 若需要，處理尚未 commit 的 6 個 meta 檔（見下方清單）

**當前狀態凍結**：
- **T0162** 🔄 IN_PROGRESS（Phase 1 DONE commit `edf913a` / Phase 2 Worker 起動 03:43）
- **PLAN-003** 📋 PLANNED（3-group 策略 D052，Group B 等 Phase 2 結論）
- **PLAN-001** 🚫 DROPPED（被 PLAN-003 Group B 吸收）
- **D052** 已寫入（混合策略 + PLAN-001 DROPPED 副作用）
- **最大編號**：T0162 / BUG-038 / PLAN-016 / D052 / EXP-ELECTRON41-001

**未 commit 清單**（6 檔，等 T0162 完全結案一起 commit）：
```
 M _ct-workorders/PLAN-001-vite-v5-to-v6-upgrade.md         (DROPPED 註記)
 M _ct-workorders/PLAN-003-npm-audit-remaining-vulnerabilities.md (3-group 策略)
 M _ct-workorders/T0162-research-npm-audit-post-electron41-remediation.md (Renew #1 指示)
 M _ct-workorders/_backlog.md                               (PLAN-001 → Dropped)
 M _ct-workorders/_decision-log.md                          (D052)
 M _ct-workorders/_tower-state.md                           (本檔)
```

**建議 commit 訊息**（T0162 完全結案時，含 Phase 2 產出 + 實作工單派發）：
```
chore(ct): T0162 renew + PLAN-003 3-group strategy (D052)

- T0162 Phase 1 DONE (13 vulns all dev-only), Renew #1 resolves
  vite plugin peer compatibility OQs
- PLAN-003: IDEA -> PLANNED with 3-group strategy
  - Group A (9 electron-builder chain): defer to PLAN-005
  - Group B (vite/esbuild): upgrade vite 5->8 (impl workorder)
  - Group C (whisper/tar): WONTFIX (postinstall-only, no runtime)
- PLAN-001 (vite v5->v6): DROPPED, absorbed by PLAN-003 Group B
- D052: mixed strategy decision + PLAN-001 drop side-effect
```

**使用者執行計畫**（本 session 結束後）：
1. 回 BAT 內 sub-session（Worker 已在跑 T0162 Phase 2，狀態 IN_PROGRESS 03:43）
2. 等 Worker 完成 Phase 2（~15-30 分鐘），查看「Phase 2 回報（Renew #1）」
3. Phase 2 完成後，回塔台說「T0162 Phase 2 完成」→ 塔台決策派 T0163 實作工單

---

## 🔄 本 Session 焦點（2026-04-18 03:40，退出前凍結）

**T0162 Renew #1 已派**（PLAN-003 Group B 實作前置探測）：
- Phase 1 DONE（commit `edf913a`，11 分鐘）— 漏洞盤點 + D052 混合策略
- Phase 2（Renew #1）待 Worker 接續 — 解 3 個 Open Questions：
  1. vite-plugin-electron / vite-plugin-electron-renderer 的 npm registry peer 支援版本
  2. electron-vite 替代評估（僅在 OQ1 顯示無 plugin 支援時觸發）
  3. vite 6/7/8 migration breaking changes 摘要
- 預估 15-30 分鐘
- Renew 後塔台依結論派**實作工單**（vite 5→8 升級 + plugin 連動 + smoke test，4-8h，若改 electron-vite 加 2-4h）

**告知 sub-session Worker**：回 BAT 內 terminal 的 sub-session，告訴 Worker「**T0162 重讀工單**」以載入 Renew #1 補充指示。

---

## 🎉 前置閉環（2026-04-18 03:01）

**成果摘要**：
使用者關閉 VSCode 在外部 Windows Terminal 重跑 `npm install` 解除 EBUSY 鎖定 → `npm run build` 產出 Windows NSIS installer（electron=41.2.1）→ 手動重裝測試通過。PLAN-016 Phase 2 + BUG-038 閉環完成。

**狀態轉移**：
- **T0160** ✅ DONE（runtime 驗收通過，原 follow-up 註記更新）
- **T0161** FIXED → **✅ DONE**（執行期驗證勾選）
- **BUG-038** FIXED → **🚫 CLOSED**（元資料補關閉時間 + 驗收結果）
- **PLAN-016 Phase 2** 完結，Phase 3（electron-builder 24→26）依 D049 暫緩
- 新決策 **D051** 記錄閉環

**塔台 meta 批次 commit 範圍**（本次收工）：
- `_tower-state.md`：02:55 退出快照更新 + tooltip typo 修正（build:win → build，5 處）
- `_decision-log.md`：D050 body typo 修正（2 處）+ 新增 D051
- `_bug-tracker.md`：BUG-038 移入 CLOSED section + 統計更新 (8 → 9)
- `BUG-038-*.md`：狀態 FIXED → CLOSED + 關閉時間 + 驗收結果
- `T0161-*.md`：狀態 FIXED → DONE + 執行期驗證結果
- `T0160-*.md`：follow-up 註記更新（阻擋 → 通過）

**Learning 候選升級**（待 `*evolve` 寫入）：
- **L040**（🟢 global 候選，跨專案通用）：Electron-based IDE self-lock 陷阱 — D051 實戰驗證 candidate 升 🟢 reliable
- **L041**（🟡 本專案 playbook 候選）：repo 層 + runtime 層雙軌驗證 — D051 實戰驗證，候選升 🟢

---

## 🗄️ 前次 Session 退出快照（2026-04-18 00:55）

**退出原因**：BUG-037 全鏈路閉環完成，塔台推薦等 PLAN-014 Phase 3 Tα3+ 再動 PLAN-015 refactor（避免架構 churn）

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（<24h 有效）
2. `git log -1` 應為 `2def77a`（chore(ct) BUG-037 follow-up）— 未 push，等使用者決定推送時機
3. 本 session 4 個 commit（`378a124` / `fbcf2d2` / `ad6f9e8` / `2def77a`）尚未 push
4. 下一輪起點候選：PLAN-014 Phase 3 Tα3（若 roadmap 已定義）/ PLAN-004 🟡 / PLAN-009 🟡 / PLAN-015 🟢（暫緩）

**當前狀態凍結**：
- BUG-037 🚫 CLOSED（T0158 commit `fbcf2d2`，方案 A + Layer 2 PROXIED_CHANNELS bridge）
- PLAN-014 Phase 3 Tα1 (T0155) + Tα2 (T0156) ✅ DONE，Tα3+ 尚未規劃
- PLAN-015 💡 IDEA 🟢 Low（塔台推薦 Phase 3 完整收官後再動）
- 2 條新 learning（L035 / L036）寫入，candidate 標記待晉升評估
- 工作樹乾淨，4 commits unpushed

---

## 🗄️ 舊 Session 退出快照（2026-04-17 14:22，歷史追溯用）

**退出原因**：使用者手動 rebuild + 換版 BAT（塔台當前在 BAT 裡跑，重裝會斷 session）

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（快照 <24h）
2. 檢查 `git status` 確認 meta 變更狀態（可能已由使用者自行 commit，或仍 uncommitted）
3. 檢查 `git log -1` 確認最新 commit（應為 `412d52c` 或之後使用者的 meta commit）
4. 若 BAT 已換新版 → 新 session 在 BAT 內（`BAT_SESSION=1`）→ 派 T0145 驗收
5. 若尚未換版 → 提醒使用者 `npm run build` + 重裝

**當前狀態凍結**：
- T0144 ✅ DONE (commit 412d52c by Worker，14:18)
- PLAN-012 實作完成，等 T0145 驗收
- BUG-032 🚫 CLOSED（T0143 Task B 驗證通過）
- **9 檔塔台 meta uncommitted**（見下方清單）

**未 commit 清單**（塔台建立/修改，尚未進入 git history）：
```
modified:  _ct-workorders/_backlog.md              (PLAN-012 加入)
modified:  _ct-workorders/_bug-tracker.md          (BUG-032 移至 CLOSED)
modified:  _ct-workorders/_tower-state.md          (本檔，decisions/起手式)
modified:  _ct-workorders/BUG-032-...md            (CLOSED + D036)
modified:  _ct-workorders/PLAN-012-...md           (翻盤描述)
modified:  _ct-workorders/T0142-...md              (MERGED → DONE)
modified:  _ct-workorders/T0143-...md              (Worker 已 commit 為 215e8757，塔台這端可能還有微調)
new:       _ct-workorders/T0144-...md              (塔台建立 + Worker 補回報)
new:       _ct-workorders/T0145-...md              (塔台建立，驗收工單)
```

**建議 commit 訊息**（下次恢復後提供給使用者）：
```
chore(ct): PLAN-012 + BUG-032 meta (D033-D037)

- BUG-032 → CLOSED (T0143 Task B all-green)
- T0142 → DONE (merged into T0143)
- PLAN-012 strategy: native Electron dialog (D035)
- T0143 DONE (research, Worker commit 215e8757)
- T0144 DONE (impl, Worker commit 412d52c)
- New: T0145 acceptance workorder pending
```

---

## 🌅 起手式（Quick Recovery）
> 最後更新：2026-04-18 00:55 UTC+8

### 🎉 BUG-037 全鏈路閉環（2026-04-18 00:23~00:43）

**本 session 成果**（~1.5h，4 commits unpushed）：
- **T0157** 研究 DONE（commit `378a124`）— 靜態 + 1 輪使用者互動定位根因：`WorkspaceView::renderTabContent` 缺 `case 'git-graph'`（T0155 commit 只補了 App.tsx，漏 WorkspaceView 的 main zone render path）
- **T0158** 修復 DONE（commit `fbcf2d2`）— 方案 A（最小修改）+ **Layer 2 範圍擴展**（UAT 發現 `electron/remote/protocol.ts::PROXIED_CHANNELS` 漏 `git-scaffold:*` 3 channels，Worker 依 F-11 問 [A/B/C]，使用者選 [B] 合併修復）
- **BUG-037** OPEN → CLOSED（使用者 runtime UAT 通過，VERIFY 決策流選項 [1] 直接 CLOSED）
- **2 條 learning 寫入**：
  - L035: Dockable panel 雙 render 路徑同步 checklist（App.tsx + WorkspaceView.tsx）
  - L036: Electron IPC PROXIED_CHANNELS scaffold checklist
- **PLAN-015** 入 backlog（🟢 Low IDEA — 抽 shared helper 消除雙 render path，塔台推薦 Phase 3 Tα3+ 完整收官後再動）
- **塔台 meta** 2 commit 批次收尾（`ad6f9e8` + `2def77a`）

### 立即待辦（本輪結束，下一輪從這裡接）
- ✅ **T0159 完成**（commit `4e5af2f`，01:32）— 三合一研究結論
- ✅ **EXP-ELECTRON41-001 CONCLUDED**（commit `ef3624f` on `exp/electron41`，02:16，27 分鐘）
- ✅ **T0160 DONE**（commit `e7eab33`，02:30）— PLAN-016 Phase 2 完成：FF merge + postinstall rebuild + CLAUDE.md + worktree 清理
- ✅ **T0161 DONE**（commit `9d734a8`，02:33 FIXED → 03:01 DONE）— 方案 B：pty-manager.ts + terminal-server.ts 在 spawn 前刪除 `ELECTRON_RUN_AS_NODE`；runtime 驗收通過
- ✅ **BUG-038 CLOSED**（03:01）— runtime 驗收通過
- ✅ **Electron 41 升級 CLOSED**（03:01，D051）— runtime 閉環完成
- 💡 **Learning candidates**（下次 `*evolve` 寫入）：
  - **L037**：一次性大批 deps 升級失敗率高（證據 `b5b3d1a` → `d8ee82a` revert +7557/-813）
  - **L038**：大型升級假設常過度悲觀（EXP 預估 4-8h / 實際 27 分鐘），研究階段應採「先 EXP 驗證再定優先級」
  - **L039**：BAT 內跑 Electron dev 需清 `ELECTRON_RUN_AS_NODE`（跨專案通用）
- 🟡 **待 push**：本 session ~8 個 commit 累計
- 📋 **PLAN-016 Phase 3（PLAN-005 builder 26）暫緩**：等 T0160 merged + 主線穩定 1-2 輪
- 📋 **其他下一輪候選**：
  1. **PLAN-014 Phase 3 Tα3**（若已定義）— 繼續 Git GUI 實作主線
  2. **PLAN-004** 🟡 Medium — GPU Whisper 加速（Win/Linux）
  3. **PLAN-009** 🟡 Medium — Sprint 儀表板 UI
- 💡 **可選 learning 晉升**：L003/L004/L005 等 `candidate: global` 標記已累積多時，下次 `/ct-evolve --playbook` 可評估晉升

### 🟠 上一輪起手式（2026-04-17 17:12 存檔，歷史追溯用）

### 🎉 PLAN-012 全案結案（2026-04-17 17:12）— 5 BUG 批次 CLOSED
**收官**：使用者 rebuild + 重裝後實測 T0145 情境 1-5 + 8 + 9 全綠，D044 批次結案：
- **PLAN-012** ✅ DONE（Quit Dialog + CheckBox 主動關 server，四路徑一致）
- **BUG-031** 🚫 CLOSED（外部 PTY workspace 分配）
- **BUG-033** 🚫 CLOSED（托盤 Quit bypass Dialog）
- **BUG-034** 🚫 CLOSED（checkbox 勾選後 reconnect 路徑 server 未結束）
- **BUG-035** 🚫 CLOSED（watchdog shutdown race 誤 re-fork）
- **T0145/T0147/T0148/T0149/T0150** 全數 DONE

**PLAN-013** 💡 IDEA（🟢 Low）：Installer 檔案鎖定詢問 kill（依 D033 劃出 PLAN-012 範圍，入 backlog）

**🟢 BUG-036** 🚫 CLOSED 🟢 Low（17:30）：T0151 三連修復 `cb0d535`+`feb84df`+`4d9fba4`（status + priority + meta），使用者驗證通過。

**本輪最大收穫**：T0144 實作引爆連環 bug（BUG-033 → BUG-034 → BUG-035），每層靠 log 鐵證定位根因，堅守「塔台不改 code」邊界；研究工單（T0146/T0148）+ 修復工單（T0147/T0149/T0150）節奏穩定。

### 🟠 舊起手式（2026-04-17 14:38 存檔，歷史追溯用）

### 🔴 BUG-033 發現（2026-04-17 14:35）— PLAN-012 T0144 regression
**現象**：使用者 rebuild + 重裝新版 BAT 實測 → **從系統托盤 Quit 時完全沒出現 Dialog**，直接退出，Terminal Server 殘留背景（使用者 Q1.A / Q2.D 確認）。
**影響**：T0145 驗收無法進行（Dialog 是所有情境前提），PLAN-012 設計失效，且破壞原版 Quit 行為（regression）。
**行動**：BUG-033 OPEN + T0146 研究工單已派發（允許 Worker 加 trace log 請使用者重測）。

### 🟢 BUG-032 已 CLOSED（2026-04-17 13:58）
T0143 Task B 全綠：`BAT_HELPER_DIR` 正確、helper 可執行、notify exit 0、UUID 路由無 cwd first-match 誤判。Helper packaging + path resolution 修復鏈（T0139/T0140/T0141）驗收通過。

### 🔴 當前焦點：BUG-033 → T0146 研究 → 修復 → T0145 驗收 → PLAN-012 DONE
T0143 研究定調：採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel）。T0144 實作完成（commit 412d52c）但使用者實測托盤路徑 Dialog 未觸發。

### 🔴 BUG-035 發現（2026-04-17 16:49）— watchdog shutdown race
**現象**：打包版 T0149 實測勾 checkbox 退出，原 server 真的被殺（log `via TCP shutdown`），但 PtyManager heartbeat watchdog 把 TCP close 誤判為 crash，20ms 內 re-fork 出 PID 26412 孤兒 server → 孤兒持 refed TCP socket → main event loop 卡住 → `crashpad-handler` 殘留。
**性質**：pre-existing watchdog（T0108 期間的 crash recovery 邏輯）+ T0149 graceful TCP close 觸發的 race，**不是 T0149 引入**，是 T0149 才讓它顯現化。
**BUG-034 不退回 FIXING**（原始根因 early-return 已修好，log 為證）；開 BUG-035 另案追蹤。
**修復方向**（T0150）：`PtyManager.beginShutdown()` + `attemptRecovery` guard，shutdown 期間跳過 re-fork。根因明確不需研究工單。

### 🟢 BUG-034 已 FIXED（2026-04-17 16:20）— 等 T0145 情境 8 打包驗收
**現象**：打包版 T0147 修好 Dialog 出現（BUG-033 → VERIFY）後，使用者勾選「一併結束 Terminal Server」checkbox 實測 → `terminal-server.js` 子進程 + `crashpad-handler` 殘留；托盤 + File 兩路徑皆中（Q2.A+B）。
**根因**（T0148 確認）：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），BAT reconnect 路徑 `_terminalServerProcess=null` → 早退，SIGTERM 從未發出。
**修復**（T0149 commit `cd460d2`）：方案 C — Step A `child.kill('SIGTERM')` → Step B `sendShutdownToServer(port)` TCP shutdown → Step C `waitForPidFileRemoval` 1500ms → Step D Unix `SIGKILL` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])`；各路徑 log `via <method>`，失敗則 `logger.error`。+ `pty-manager.dispose()` 補 destroy tcpSocket（修 crashpad-handler leak 候選）+ 移除 main.ts:1491 誤報 log。
**驗收計畫**：T0145 擴增**情境 8**（4 子情境 8a/8b/8c/8d，涵蓋 fork/reconnect × dev/packaged × 成功路徑 + fallback）→ 使用者 rebuild + 打包驗收。

### 立即待辦（全部完成 ✅，下一輪新起點）
1. ~~T0144 實作~~ ✅ commit `412d52c`
2. ~~T0146 研究（BUG-033 根因）~~ ✅ commit `4bc8d26`
3. ~~T0147 修復（BUG-033 Tray handler）~~ ✅ commit `ef867a2`
4. ~~T0148 研究（BUG-034 根因）~~ ✅ commit `98be02d`
5. ~~T0149 修復（reconnect + tcpSocket + 誤報 log）~~ ✅ commit `cd460d2`
6. ~~T0150 修復（watchdog guard）~~ ✅ commit `31b4ec2`
7. ~~T0145 驗收（情境 1-5 + 8 + 9 全綠）~~ ✅ 使用者打包實測通過
8. ~~批次 CLOSED + PLAN-012 DONE + PLAN-013 IDEA~~ ✅（D044）

### 下一輪候選（優先級待定）
- **PLAN-004** 📋 PLANNED 🟡：GPU Whisper 加速（Win/Linux）
- **PLAN-009** 📋 PLANNED 🟡：Sprint 儀表板 UI
- **PLAN-013** 💡 IDEA 🟢：Installer 檔案鎖定詢問 kill（本 session 新開）
- **PLAN-001/002/003/005/007** 💡 IDEA 🟢：Vite 升級、Dynamic Import、npm audit、Electron Builder 升級、遠端容器
- **`*evolve`**：本 session 有 learning 候選（T0144 連環 bug 模式 + 工單引用檔案路徑前應驗證存在 + BUG 不退回假 FIXING 的追蹤紀律）
8. BUG-031 runtime 驗證（🟡 Medium，FIXED → CLOSED）— 低優先
9. T0135 PARTIAL（6.2 `--help` 未實作）— 獨立處理
10. Backlog 剩餘 PLAN 待排優先級（PLAN-001~007）

### 本 session 決策
- **D032**：BUG-032 拆單方案 [A]（一張統籌 BUG + 一張研究 + N 張修復）；`_local-rules.md` 暫不動 [A]（避免破壞 baseline，等 BUG-032 整體方案敲定一起改）
- **追加**：BUG-031 維持 FIXED 狀態（PTY allocation 邏輯本身已透過使用者實測驗證），副作用檢查併入 BUG-032 範圍
- **D033**（2026-04-17 13:15）：建立 PLAN-012 — Quit Dialog 加「一併結束 Terminal Server」CheckBox，預設**不勾選**（避免誤按關掉背景 server）；Installer 強制 kill 另開 PLAN；時程緊急，排 T0142 驗收後
- **D034**（2026-04-17 13:25）：PLAN-012 拆單策略 Q1.D + Q2.A — 先派研究工單 T0143 摸清 Quit Dialog + Terminal Server 現狀；T0142 驗收 checklist Phase 2-5 內嵌到 T0143「Task B」觀察表，T0142 狀態改 🔀 MERGED；dogfood 驗收（派 T0143 行為本身即為 BUG-032 鏈路驗證）；CT 上游回 PR 編號順延
- **D035**（2026-04-17 13:58）：PLAN-012 UI 路線定調 — 採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel），放棄 Custom React Modal；main.ts +~50 行 + i18n 6 行，零 React 改動，零 IPC 擴充
- **D036**（2026-04-17 13:58）：**BUG-032 → CLOSED** — T0143 Task B B1/B3/B4/B5 全綠（BAT_HELPER_DIR 正確、helper 可執行、notify exit 0、UUID 路由無 cwd 誤判），BUG-032 原範圍（helper packaging + path resolution）完全驗收通過；**版本更新檔案鎖定**問題屬 PLAN-012 範圍，獨立追蹤不混為一談
- **D037**（2026-04-17 14:00）：PLAN-012 拆單定案 — 採 T0143 Worker 推薦方案 B（2 張）：**T0144 實作**（`before-quit` 原生 Dialog + CheckBox + SIGTERM+timeout fallback + i18n，~60-80 行）+ **T0145 驗收**（6 情境 + 版本更新安裝場景）；T0142 合併完成後狀態改 ✅ DONE
- **D038**（2026-04-17 14:35）：**BUG-033 建立 + T0146 派發** — 使用者實測 rebuild + 重裝後托盤 Quit 無 Dialog 直接退出（Q1.A/Q2.D 確認），Terminal Server 殘留；屬 T0144 regression。策略：開研究工單（非直接修復）— 根因不明（可能 Tray handler bypass `before-quit` / Dialog async race / packaging 未涵蓋 / i18n init 失敗）；研究允許 Worker 加 trace log 請使用者重測（使用者已主動授權）。不直接派修復因為風險：盲修可能再 regression，也無從驗證其他 Quit 路徑（File/Ctrl+Q/視窗X）是否同病
- **D046**（2026-04-17 17:30）：**BUG-036 CLOSED + T0151 DONE（含 priority follow-up）** — Worker 實際根因比塔台假設精確：`src/types/backlog.ts:55` `sectionToStatus` 只認 `DONE`/`已完成`，不認 `COMPLETED`（而 skill 模板 `_backlog.md` 用的是 `## Completed`）→ fallback 'IDEA'；外加 Completed 表 schema 無「狀態」欄 → `rowStatusToStatus` 無法 override。雙因合力。修復三連：`cb0d535`（加 COMPLETED match 主修）+ `feb84df`（meta）+ `4d9fba4`（使用者追加反映 priority 也 Unknown，Worker 新增 `extractPriorityFromPlanContent` 從 PLAN metadata 補讀）。使用者驗證通過 → BUG-036 OPEN→CLOSED + T0151 DONE。**潛在上游 PR 候選**：本修復對所有使用 CT Panel 框架的專案都有用，類似 PLAN-011 模式可推回 CT 上游（留待後續評估）。
- **D045**（2026-04-17 17:22）：**BUG-036 建立 + T0151 派發（UI parser 缺 DONE 支援）** — D044 批次結案後使用者在 CT panel Backlog tab 發現 PLAN-012 顯示 Unknown 而非 Done，右側詳細頁正確顯示 ✅ DONE → UI 列表 parser 問題（列表 parser 可能只讀 `_backlog.md` Active 表找不到 Completed 區塊的 PLAN / 或 status enum mapping 缺 DONE case / 或 regex 未覆蓋）。非緊急純 UI 顯示缺陷，嚴重度 🟢 Low，不影響資料正確性。使用者選項 [B]：直接派修復工單（T0151），Worker 自行 grep 定位 parser，不另派研究工單。預期修完後類似 PLAN-008/010/011 歸檔前的 DONE 顯示邏輯將補齊。
- **D044**（2026-04-17 17:12）：**PLAN-012 全案結案 + 5 BUG 批次 CLOSED + PLAN-013 開立（IDEA）** — 使用者完成 rebuild + 重裝後實測：BUG-031 / BUG-033 / BUG-034 / BUG-035 **全部通過驗收**（T0145 情境 1-5/8/9 全綠）。一次結案：BUG-031 FIXED→CLOSED（T0137 runtime 驗證通過）、BUG-033 VERIFY→CLOSED（T0147 四路徑通過）、BUG-034 FIXED→CLOSED（T0149 方案 C 通過）、BUG-035 OPEN→CLOSED（T0150 watchdog guard 通過）、PLAN-012 PLANNED→DONE（四個實作 commits `412d52c`+`ef867a2`+`cd460d2`+`31b4ec2`）、T0145 READY→DONE、T0149/T0150 FIXED→DONE。**情境 7（installer 強制 kill 檔案鎖定場景）依 D033 劃出範圍**，使用者選項 [B] 另開 PLAN-013 IDEA 🟢 Low 入 backlog，不排入本輪結案。本輪最大收穫：T0144 實作引爆連環 bug（BUG-033 regression + BUG-034 reconnect early-return + BUG-035 watchdog race），每一層都靠 log 鐵證快速定位根因，堅守「塔台不直接改 code」邊界讓所有決策透明可追。
- **D043**（2026-04-17 16:49）：**BUG-035 建立 + T0150 派發（不退回 BUG-034）** — 使用者實測 T0149 打包版勾 checkbox 退出，觀察到 `terminal-server.js` + `crashpad-handler` 仍殘留。Log 鐵證（08:42:48 時間序）：`.814 TCP closed` → `.814 Terminal Server died — attempting recovery` → `.815 re-forking` → `.833 re-forked with pid 26412` → `.839 [quit] terminal server stopped (via TCP shutdown)`。性質明確：**BUG-034 根因已修好**（原 server graceful close，log `via TCP shutdown` 為證），但 PtyManager heartbeat watchdog（pre-existing T0108 期間的 crash recovery 邏輯）把 T0149 觸發的 graceful TCP close 誤判為 crash → 20ms 內 re-fork 孤兒 server PID 26412 → 孤兒持 refed TCP socket 卡住 main event loop → crashpad-handler 殘留。不是 T0149 引入，是 T0149 才讓它顯現化（之前 SIGTERM 根本沒送，watchdog 自然不觸發）。**BUG-034 保持 FIXED**（避免假退回汙染追蹤），開 BUG-035 另案追蹤。修復方向明確（`PtyManager.beginShutdown()` + `attemptRecovery` guard）→ 不需研究工單直接派 T0150。
- **D042**（2026-04-17 16:20）：**T0149 完成採 Worker 方案偏差合理化** — Worker 實作方案 C 時遭遇 2 處工單指示與現實衝突：(1) 工單要求用 `src/utils/execFileNoThrow.ts`，但此 util **不存在於本專案** → Worker 採專案既有 pattern（main.ts:1696、2353 已用動態 import + `execFile` 非 `exec` + Promise wrapper），安全性等價（`execFile` 天生無 shell 解析、`windowsHide: true`、`timeout: 3000`）；(2) `getPidFilePath` 為 pid-manager.ts module-local 未匯出 → Worker 硬編碼 `path.join(userDataPath, 'bat-pty-server.pid')` 並在註解標註「與 pid-manager.ts:4 `PID_FILENAME` 常數保持一致，若未來檔名變更需同步兩處」。兩處偏差塔台**批准合理化**：Worker 判斷正確（安全性等價 + 不新建 util 檔符合保守原則），但塔台寫工單時**未驗證 `execFileNoThrow.ts` 存在**是疏漏，learning 候選（工單引用具體檔案路徑前應先 grep 確認）。BUG-034 FIXING → FIXED（等 T0145 情境 8 打包驗收）
- **D041**（2026-04-17 16:04）：**T0148 結論採方案 C + 派發 T0149** — Worker Static 分析 + log 證據鏈完整確定根因：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），reconnect 路徑 `_terminalServerProcess=null` → `if (!child) return` 早退，SIGTERM 從未發出。log L123→L124 只差 1ms 鐵證。使用者在 T0148 互動 [15:54] 選定**方案 C**（TCP shutdown 優先 → PID SIGTERM fallback → Windows taskkill 兜底）+ 同意併修 tcpSocket leak（`pty-manager.dispose` 漏 destroy tcpSocket，疑似 crashpad-handler 殘留根因）+ 修誤報 log。T0149 範圍：3 檔案修改（main.ts 重寫 stop 函式 / pty-manager dispose 補 destroy / main.ts:1424 移除誤報 log）。**關鍵約束**：Windows taskkill 必須用專案 util `src/utils/execFileNoThrow.ts`（shell-safe，security hook 約束）。BUG-034 → FIXING
- **D040**（2026-04-17 15:38）：**BUG-034 建立 + T0148 研究工單派發** — 使用者重測打包版（含 T0147 `ef867a2`）確認 Dialog 會問 ✅ + checkbox 可勾 ✅，但勾選後仍殘留 `terminal-server.js` 子進程 + `crashpad-handler`（暗示 main 也沒完全退）。使用者確認托盤 + File 選單**兩條路徑都中**（Q2.A+B）→ 非路徑特定，是 checkbox → kill-server 邏輯本身失效。與 BUG-033（Dialog 不出現）性質不同，開新 BUG-034 另案追蹤避免 scope 爆炸。派研究工單而非直接修復 — 理由：可能根因多元（SIGTERM 對象 / Windows signal 行為 / child handle 遺失 / timeout race / main exit 未觸發），盲修風險高。Q3.C 授權 Worker 自行判斷 static vs trace log 策略。嚴重度 🟡 Medium（Dialog 主功能 OK，checkbox 為延伸功能，workaround 為工作管理員手動結束）
- **D039**（2026-04-17 14:58）：**T0146 結論採方案 A + 派發 T0147** — Worker 靜態分析 + log 交叉驗證 100% 確定根因（電子證據鏈：main.ts:540-546 Tray handler / main.ts:1334-1339 before-quit 守護條件 / log 完全無 `[quit]` prefix），未使用 trace log。**性質確認**：pre-existing bug，非 T0144 引入（Tray handler 的 `isAppQuitting = true` 在 commit `d09c45e` 就存在），但 T0144 才顯現化（T0144 前沒 Dialog 感知不到）。採方案 A（刪除 1 行）而非 B（改守護條件，跨路徑驗證面積大）或 C（重構 ~80 行 overkill）。雖僅 1 行改動仍派工單而非塔台自主 commit — 理由：屬邏輯變更 + regression 修復 + 需 4 路徑冒煙測試，超出 `auto_commit` 小變動範圍

### 本 session 新增工單
| ID | 標題 | 狀態 |
|----|------|------|
| BUG-032 | Helper scripts 打包與路徑解析設計缺漏 | 🚫 CLOSED |
| T0138 | 研究：BAT Helper Scripts 打包與路徑解析設計 | ✅ DONE |
| PLAN-012 | Quit Dialog 新增「一併結束 Terminal Server」CheckBox | 🔄 IN_PROGRESS |
| T0143 | 研究：Quit Dialog + Terminal Server 現狀（PLAN-012 起手 + T0142 驗收內嵌） | ✅ DONE (commit 215e8757) |
| T0144 | PLAN-012 實作：Quit Dialog + CheckBox（原生 dialog + SIGTERM fallback + i18n） | ⚠️ DONE but regression 顯現化（commit 412d52c） |
| T0145 | PLAN-012 驗收：6 情境 + 版本更新安裝場景 + BUG-033 四路徑打包覆蓋 | 📋 READY（等 build） |
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔍 VERIFY（dev serve 四路徑通過，等打包驗收） |
| T0146 | 研究：托盤 Quit 為何 bypass Dialog（BUG-033 根因調查） | ✅ DONE（推薦方案 A） |
| T0147 | 修復：刪除 Tray handler 的 `isAppQuitting = true`（方案 A，1 行） | ✅ DONE（commit `ef867a2`） |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🔧 FIXING |
| T0148 | 研究：checkbox → kill-server 邏輯失效根因（BUG-034 根因調查） | ✅ DONE（commit `98be02d`，推薦方案 C） |
| T0149 | 修復：stopTerminalServerGracefully 支援 reconnect 路徑 + tcpSocket leak + 誤報 log（方案 C） | ✅ FIXED（commit `cd460d2`，log `via TCP shutdown` 證實 early-return 已修；T0145 情境 9.1 發現 watchdog race → BUG-035） |
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，孤兒 server 卡住 main event loop | 🚫 CLOSED（D044） |
| T0150 | 修復：PtyManager.beginShutdown() + attemptRecovery guard 避免 graceful shutdown 被誤判 crash | ✅ DONE（commit `31b4ec2`，T0145 情境 9.1 驗收通過） |
| PLAN-013 | NSIS Installer 偵測檔案鎖定時詢問 kill Terminal Server | 💡 IDEA 🟢 Low（D044 依 D033 剝離，入 backlog） |
| BUG-036 | CT Panel Backlog 列表對 DONE 狀態的 PLAN 顯示 Unknown | 🚫 CLOSED（D046） |
| T0151 | 修復：CT Panel Backlog 列表讓 DONE PLAN 正確顯示 Done（BUG-036） | ✅ DONE（commits `cb0d535`+`4d9fba4`，使用者驗證通過） |

### 本 session 新增工單（2026-04-17 02:00-03:05）
| ID | 標題 | 狀態 | Commit |
|----|------|------|--------|
| T0135 | BAT v2.x + CT v4.1.0 全鏈路驗收（統籌） | ✅ DONE | c98a04c, 8ec97ad |
| T0136 | BUG-030 修復 — MSYS 路徑轉換 | ✅ FIXED | f77d2d0 |
| T0137 | BUG-031 修復 — PTY workspace 分配 | ✅ FIXED | f325d1d |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑污染 | 🚫 CLOSED | c23bae2 |
| BUG-031 | 外部 PTY 被分配到錯 workspace（cwd first-match） | ✅ FIXED（待驗） | 7fdd76a |

### 本 session 關鍵發現
1. **BUG-030**：Git Bash MSYS2 把 `/ct-exec` 誤轉成 `C:/Program Files/Git/ct-exec`，T0136 加 regex 還原
2. **BUG-031 真根因**：不是「default workspace」，是 `cwd.startsWith(folderPath)` first-match，當 parent + 子專案 workspace 都打開時 match 到較早建立的
3. **PARTIAL**：`bat-terminal.mjs --help` 未實作（會被當命令執行）
4. **Worker→Tower 通知鏈路** 不受 BUG-031 影響（PTY 預填用 targetId 全域唯一；Toast 廣播到所有 BrowserWindows）— 仍需 T0138 runtime 確認

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0 / Fixed: 1 / Closed: 1）
- Backlog → [_backlog.md](_backlog.md)
- 工單列表 → 熱區 14 + EXP/CP 雜項 — 全部 ✅ DONE 或 ✅ FIXED

### 近期完成摘要（本 session）
- **T0126** DONE：修復 CT 面板工單按鈕命令格式（`/ct-exec` → `claude "/ct-exec"`）
- **T0127** DONE：研究 BAT 內部終端建立機制 → 推薦方案 A
- **T0128** DONE：Agent 自訂參數 Settings UI + 7 處啟動路徑套用
- **T0129** DONE：RemoteServer 自動啟動 + BAT_REMOTE_PORT/TOKEN env vars 注入
- **T0130** DONE：外部建立終端 UI 同步（縮圖 + xterm + 自動聚焦）
- **T0131** DONE：CLI helper bat-terminal.mjs（零依賴 WebSocket invoke）
- **T0132** DONE：研究 Worker→Tower 自動通知 → 推薦方案 A（雙管道）
- **T0133** DONE：Worker→Tower 自動通知實作（雙管道 + 三層 badge 冒泡）
- **T0134** DONE：【統籌】CT 上游整合（COORDINATED → CT-T001 DONE）
- **CT-T001** DONE：CT v4.0.1 → v4.1.0（BAT 路由 + Worker 通知整合）
- **PLAN-011** DONE：CT 上游 PR 完成（v4.1.0 發布）
- `_local-rules.md` 更新：BAT auto-session 路由規則 + Bash 白名單

### 工單統計
- Done: 137 + CT-T001 | Active: 0 | 總計: 138
- 最高編號：T0137 / BUG-031 / PLAN-011 / D031
- FIXED BUG（待 rebuild 驗證）: BUG-031（Medium，T0137 commit f325d1d）
- Closed BUG（本輪）: BUG-030（High → CLOSED, 02:42）

## 🌅 明日起手式（Quick Recovery）<!-- ORIGINAL -->

**目前進度**：單據系統遷移 + 歸檔完成。20 張工單全部 DONE。目錄已清理。

**最後完成工單**：T0085（Commit all + v0.0.9-pre.1 pre-release）
**本輪完成**：T0065-T0085（21 張），涵蓋 BMad UI 整合、workspace 切換修復、VS Code 開啟功能、BUG-012 根因確認與修復

**下一步建議**：
1. 參考 `_backlog.md` 的 PLAN-001~007 決定下一批工作
2. BUG-001 待 runtime 驗收（最後一張 VERIFY bug）

**快速連結**：
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0，Closed: 24）
- Backlog → [_backlog.md](_backlog.md)（Active: 6）
- 工單索引 → [_workorder-index.md](_workorder-index.md)（Active only）
- 決策日誌 → [_decision-log.md](_decision-log.md)（最新：D028）
- 學習紀錄 → [_learnings.md](_learnings.md)
- 歷史 Checkpoint → [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（lastSyncCommit: 079810025，上游版號 2.1.3） |
| **Fork 版號** | 1.0.0（獨立版號，從 1.0.0 開始，D026） |
| **目前里程碑** | Phase 1 — Voice Input（實作完成，收官驗收中） |
| **工單最大編號** | T0251(session 25 完成:T0250→T0251 全綠,commit `426d6fc`,DISABLE_AUTOUPDATER env 注入 4 處) |
| **BUG 最大編號** | BUG-059(🔴 High 🚫 CLOSED 2026-04-25,T0251 runtime 驗收通過;BUG-055 連帶 CLOSED,D088) |
| **PLAN 最大編號** | PLAN-028 |
| **EXP 最大編號** | EXP-GPUWHIS-001(session 21 新增,📊 CONCLUDED) |
| **上游同步版本** | v2.1.42-pre.2(2026-04-16)— ⏸ 版號 bump 暫停待 BUG-056 CLOSED |
| **決策最大編號** | D088(session 25:BUG-059 + BUG-055 一同 CLOSED,T0250→T0251 修復鏈閉環,L067-070 候選待 *evolve) |
| **塔台版本** | Control Tower v4.3.0 |

---

## 📊 進度快照

**Phase 1 語音功能**：✅ 實作完成
- 工單 T0001~T0062 執行完畢
- BUG-001~015 全部處理（1 個上游追蹤，1 個關閉，13 個已修復）
- 語音辨識：Whisper CPU + macOS Metal GPU 已啟用
- npm 安全：漏洞從 27 個降至 17 個（減少 48%）

**近期完成**：
- T0060：Metal GPU 加速（macOS）+ npm 安全修復
- T0061：文件結構設計
- T0062：_tower-state.md 瘦身 + 文件系統遷移

**塔台語氣校準**：
- 使用繁體中文
- 偏好決策速度快（選項式回答）
- 務實路線（先求有再求好，接受分階段交付）
- 重視細節，會主動回報 bug

---

## 📝 管理筆記

**2026-04-13 16:20 T0094 批次結案**：
- 所有 FIXED 狀態 BUG 人工驗收通過，批次更新為 CLOSED
- 共 20 筆：BUG-003~006, 008~011, 013~022, 023, 024
- BUG-023（右鍵選單智慧定位，T0092）驗收通過
- BUG-024（CT 面板不監聽索引文件，T0095）驗收通過
- T0091（BUG Detail 工作流 UI）驗收通過
- T0092（右鍵選單智慧定位實作）驗收通過
- Bug Tracker 統計：Open 0 / Fixed 0 / Closed 24

**2026-04-13 13:43 T0086 結案**：
- BUG-002 CLOSED（人工驗收通過）
- BUG-012 CLOSED（人工驗收通過，v0.0.9-pre.1 確認修復）
- Worktree 檢查：無 bug012 worktree 存在（已自行清理或未建立）
- Bug Tracker 統計：Open 0 / Verify 1 / Fixed 18 / Closed 3

**2026-04-13 13:14 Session 結束筆記**：
- 本輪 21 張工單（T0065~T0085），生產力高
- **BUG-012 重大突破**：EXP-BUG012-001 實驗確認根因為 `convertEol: true`，5 輪排除法，2 行修復
- 新功能：VS Code 開啟工作區（T0078~T0082）、BMad Workflow/Epics 頁籤（T0072~T0073）
- 新規範：`_local-rules.md` 加入 EXP-/跨專案工單前綴規範
- v0.0.9-pre.1 pre-release 已推出，BUG-012 待 runtime 驗收後 CLOSED
- worktree `../better-agent-terminal-bug012` 待清理

**2026-04-12 21:43 Session 結束筆記**：
- 本輪 20 張工單，生產力極高
- 新單據系統（BUG/PLAN/Decision 獨立檔 + 歸檔原則）是本專案實驗，成功後推回 BMad-Control-Tower
- `_local-rules.md` 教塔台認識新單據，下輪 session 驗證是否有效
- 4 commits 待使用者 push

---

## 🗂️ 歸檔索引

歷史 Checkpoint（2026-04-11 至 2026-04-12）：
→ [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)（2016 行，完整保留）

---

## 🔍 環境快照
> 最後掃描:2026-04-25 14:51 (UTC+8) — *rescan(session 26 起手,session 25 BUG-059/055 收工後首掃,decision-log drift 偵測 D083→D088)

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ❌ | _bmad/ 不存在(專案自訂工作流程)|
| ECC 學習 | ✅ Level 1+ | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync healthy, updated 2026-04-25 14:49, queue_size:2 |
| 終端環境 | BAT | TERM_PROGRAM=better-agent-terminal, WT_SESSION 空, TERM=xterm-256color |
| BAT 終端 | ✅ | BAT_SESSION=1, port:9876, workspace:0228e89a-650f-4c98-aeaf-3c5b3ffcd053, terminal:e00c24cd-3c6c-4a10-b116-2c2077603907 |
| BAT_TOWER_TERMINAL_ID | ❌ 空 | 本 session 未設 tower terminal id,bat-notify Worker 回報需走降級 |
| 平台 | Windows | MINGW64 (Git Bash, Msys),Windows 11 Pro for Workstations (26200) |
| ct-exec / ct-done / ct-status | ✅ | |
| ct-evolve / ct-insights | ✅ | |
| ct-fieldguide / ct-help | ✅ | |
| worker-time-estimation | ✅ Skill | (前次 session 升 Skill,沿用) |
| _archive/ | ✅ | **304 張歸檔**(workorders:238 / bugs:51 / plans:15;v.s. 上次 205,session 21-25 期間自然累積) |
| _playbooks/ | ✅ 空 | 目錄存在,0 張(Playbook 候選仍在 Global Layer 2) |
| _decision-log | ⚠️ | 檔案至 D083(drift!metadata 報 D088,session 24/25 D084-D088 待補) |
| 跨專案參照 | 📋 | 無關聯(_cross-references.md 不存在)|
| Global 學習 | ✅ ⭐ | ~/.claude/control-tower-data/learnings/ — patterns.md + tech-gotchas.md(session 23 *evolve 後新增 GP083/084/TG014-016) |
| Global 設定 | ❌ 無 | ~/.claude/control-tower-data/config.yaml 不存在(僅 project 層設定) |
| BUG/PLAN 追蹤 | ✅ | BUG:8 熱區(全 CLOSED!)/ PLAN:12 熱區(4 IDEA / 2 PLANNED / 2 IP / 1 DONE / 3 DROPPED) |
| 實驗追蹤 | ✅ | EXP:1 熱區(EXP-GPUWHIS-001 CONCLUDED) |
| 熱區工單 | **T:25 / BUG:8 / PLAN:12 / EXP:1** = 46 張 | T0153 唯一 PARTIAL(spike 擱置),其餘已交付 |
| 最大編號 | **T0251 / BUG-059 / PLAN-028 / EXP-GPUWHIS-001 / D088** | session 25 收工後 |
| 設定來源 | project | _tower-config.yaml (auto-session: **yolo**, yolo_max_retries: **1**, auto_commit: on, archive_days: 2) |
| 塔台版本 | v4.4.0 | SKILL.md frontmatter(已自 v4.3.0 升級) |
| 能力等級 | Level 2 | ECC(Level 1+) + mem0 + Layer 2 學習資料 |

> **⚠️ Drift 警告**:
> 1. `_decision-log.md` 末記 D083(2026-04-23),metadata 報 D088 — D084-D088 需在補 session 24/25 退場快照時一併補入
> 2. `_tower-state.md` 頂部「最後更新」仍標 2026-04-23 16:02 (session 23) — 需於 Step 3(D)補史料時更新

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。
> **Footnote**：本 session [斷點 C] 標記僅取狹義（Worker 跨 PLAN 建議）；使用者手動「停」暫不歸 A/B/C，列為 `[使用者中斷]` 自訂事件（待 L064 上游修正）。

### 當前 Session（2026-04-18 ~16:10 啟動，第三 session，收尾）

- [啟動] 2026-04-18 ~16:10 — 塔台 Fast Path 恢復，YOLO MODE ACTIVE 警語自動顯示（配置 `auto-session: yolo`, `yolo_max_retries: 1`）
- [派發] 2026-04-18 ~16:12 — CT-T003 DELEGATE 派發指引已送出（跨專案，目標 `BMad-Control-Tower-v4.x.x/`），使用者選 [B] 手動切換；本端更新 CT-T003 狀態 TODO → DISPATCHED
- [部分完成] 2026-04-18 16:18 — CT-T003 PARTIAL（commits monorepo:`1d02727` + 本地:`c73a23b`）。Worker 規格三步 + CHANGELOG 完成；Worker 自主 inference 調整 Step 2（工單預設字串在 v4.2.0 不存在，改為新增「使用者中斷快捷」段落，符合互動規則第 1 條）。剩餘 Step A(push) / C(sync) / D(tag) 待使用者決策。L065 候選：跨專案 DELEGATE 工單 monorepo vs 獨立 repo 結構假設缺口
- [完成] 2026-04-18 16:25 — CT-T003 DONE（使用者收尾全綠）。A-1: better-agent-terminal push origin/main（27 commits，`6ccf369..c73a23b`）; A-2: BMad-Guide monorepo push origin/dev-main（`d65f451..1d02727`）; D: v4.2.1 tag 打於 1d02727 並 push; C: 生產塔台 sync 驗證通過（grep 三處命中）。L064 drift 修正閉環
- [evolve] 2026-04-18 ~16:35 — `*evolve` 批次萃取 L057-L065 + L066，寫入 GP038-GP043（6 Global）+ L062/L063/L066（3 Project）+ L065 補充。GP039/GP042 直接升 🟢
- [archive-test] 2026-04-18 ~16:45 — `*archive --dry-run` → 3 張候選（T0149/T0150/BUG-034）→ 執行 → 全數觸發活躍引用豁免還原（PLAN-013 🟢 IDEA 引用鎖）→ L066 記錄 → archive_days 1→7 恢復保守設定

### 上個 Session（2026-04-18 ~15:30 啟動，T0174 Phase 2-6）

- [啟動] 2026-04-18 ~15:30 — 塔台啟動偵測 `auto-session: yolo` (持久化於 `_tower-config.yaml`)，自動顯示 YOLO MODE ACTIVE 警語面板（驗證 Phase 1 session-to-session 延續）
- [派發] 2026-04-18 15:45 — T0173 (BUG-040 研究，Phase 2 dogfood 首張，BAT 內部終端 `--notify-id $BAT_TERMINAL_ID`)
- [完成] 2026-04-18 15:50 — T0173 DONE (commit `5a2030c`，Worker 自動回報「T0173 完成」經斷點 A regex 通過)
- [斷點 C] 2026-04-18 15:55 — T0173 回報「建議實作工單列表 T-NEXT-1/2/3」跨出 PLAN-020 → 塔台 PAUSE（當下未明確識別為斷點 C，事後對照規格才確認 — L064 候選）
- [使用者中斷] 2026-04-18 ~16:00 — Phase 5 dogfood 測試：使用者輸入「停」→ 塔台正確 abort 派發。事件類型規格未定義（沿用 SKILL.md 警語語意，L064 已記錄）
- [完成] 2026-04-18 15:59 — Phase 6 區段建立中（本條為 self-recursive 紀錄）

### 計數器

- 連續 FAILED: 0 / 1（`yolo_max_retries: 1` dogfood 設定）
- 本 session yolo 派發工單數: 1（T0173）
- 本 session 斷點觸發: A×0, B×0, C×1, 使用者中斷×1
- 本 session 學習候選新增: L064（規格 drift）

### 歷史 Session（摘要）

- 2026-04-18 上半場（PLAN-020 開發）：派發 7 張本專案工單 + 1 跨專案 DELEGATE，全 DONE，無斷點觸發（pre-yolo / 早期 yolo 混用）
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood 完成（無工單派發，純 setup + 警語驗證）
