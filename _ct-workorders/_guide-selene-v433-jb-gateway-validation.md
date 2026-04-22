# 給 Selene 的 v4.3.3 JB Gateway 驗證指南

> **目的**:驗證 v4.3.3 對 JetBrains Gateway Dev Container 環境的識別能力 + 三模式(off / on / yolo)實際表現。
> **範圍限定**:v4.3.3 **只做到「識別正確 + 訊息清楚」**,不承諾自動化可用。這點先對齊預期。
> **預估時間**:Part 0~3 約 25-35 分鐘;Part 4-5 回報可於下次上線時補。

---

## Part 0:環境確認(跑之前請先確認)

請在容器內執行並把輸出丟回來:

```bash
# IDE 版本(GoLand aarch64)
which goland 2>/dev/null || echo "goland CLI not in PATH (可忽略)"

# Gateway 相關 process
ps -ef | grep -E "remote-dev-serv|jetbrainsd" | grep -v grep

# 容器 base image(應為 mcr.microsoft.com/devcontainers/go:1.26-bookworm 或類似)
cat /.jbdevcontainer/devcontainer.json 2>/dev/null | head -20 || echo "no devcontainer.json visible"

# Claude CLI 版本
claude --version

# Control Tower skill 版本(應看到 4.3.3)
grep "^version:" ~/.claude/skills/control-tower/SKILL.md
```

**預期結果**:
- `/.jbdevcontainer/` 目錄存在
- `remote-dev-serv` 或 `jetbrainsd` process 至少一個
- Control Tower skill 版本是 `4.3.3`

**若任一不符**:先別跑 Part 1-3,把差異列給 Gower 再決定怎麼走。

---

## Part 1:A.1 第 21 條偵測驗證

目的:確認「v4.3.3 A.1 第 21 條」在你的環境真的抓得到信號。

### Step 1.1 — 檔案系統主信號

```bash
# 主信號:/.jbdevcontainer/ 目錄
test -d /.jbdevcontainer/ && echo "✅ 偵測到主信號:/.jbdevcontainer/ 存在" || echo "❌ 主信號不存在 — 請回報"

# 列目錄內容(看是否有 devcontainer.json / docker-compose.yaml)
ls -la /.jbdevcontainer/ 2>/dev/null | head -10
```

### Step 1.2 — process 輔助信號

```bash
# 輔助信號 1:Gateway daemon
ps -ef | grep -E "remote-dev-serv|jetbrainsd" | grep -v grep | head -5

# 輔助信號 2:parent process 鏈
cat /proc/$$/status | grep PPid
cat /proc/$(cat /proc/$$/status | grep PPid | awk '{print $2}')/cmdline | tr '\0' ' '; echo

# 輔助信號 3:PWD 起首
echo "PWD = $PWD"
echo "$PWD" | grep -q "^/IdeaProjects/" && echo "✅ PWD 起首符合 /IdeaProjects/(弱信號)" || echo "ℹ️ PWD 不在 /IdeaProjects/(弱信號不成立,但主信號足夠)"
```

### Step 1.3 — 排除 VS Code 路徑

```bash
# 確認 VS Code 專屬 env 都不存在(否則會被 Step 2 REMOTE_CONTAINERS 吃掉,走錯分支)
echo "REMOTE_CONTAINERS = ${REMOTE_CONTAINERS:-(未設)}"
echo "CODESPACES = ${CODESPACES:-(未設)}"
echo "TERM_PROGRAM = ${TERM_PROGRAM:-(未設)}"
echo "IDEA_INITIAL_DIRECTORY = ${IDEA_INITIAL_DIRECTORY:-(未設)}"
echo "JETBRAINS_IDE = ${JETBRAINS_IDE:-(未設)}"
```

**預期**:全部顯示「未設」。若有任一有值,代表你的 Gateway 版本與我們預判不同,請回報實際值。

### Step 1.4 — 回報 checklist

- [ ] Step 1.1 主信號 `/.jbdevcontainer/` 存在? Y / N
- [ ] Step 1.2 有 `remote-dev-serv` 或 `jetbrainsd` process? Y / N
- [ ] Step 1.2 parent process 含 `bash --rcfile /.jbdevcontainer/...`? Y / N
- [ ] Step 1.3 VS Code 專屬 env 都未設? Y / N
- [ ] 若有任一 NO,把實際狀況貼回來

---

## Part 2:A.2 Step 2.5 決策樹驗證

目的:實際派發工單,看 Worker 是否走 Step 2.5 分支 + 訊息是否清楚。

### Step 2.1 — 準備測試工單

回塔台 session(macOS host 端),請 Gower 幫你開一張最小測試工單,或直接手動建一個:

```
_ct-workorders/T9999-jb-gateway-detection-test.md
```

內容只要能讓 Worker 起 session 執行並收尾即可(例如「建立 test.txt 寫入『hello jb gateway』」這種雞毛蒜皮的)。

### Step 2.2 — 在 GoLand 容器 terminal 執行派發

```bash
# 在容器內(JB Gateway terminal)直接執行
claude "/ct-exec T9999"
```

### Step 2.3 — 觀察 Worker 啟動訊息

**預期看到**(兩者擇一,依 CT_MODE):

情境 A:塔台未派發(直接手動跑,CT_MODE 未設)
```
⚠️ 塔台未傳 --mode flag,降級為 ask 模式
你正在使用舊版塔台 skill(v4.2.x 或更早)。...
```
這是 v4.3.0 既有行為,不是 bug。

情境 B:Worker Step 2.5 識別(執行中途某個時點)
```
🔧 工單 T9999 已啟動
   (正常工單執行訊息)
```

重點觀察:**Worker 有無把環境識別為 `devcontainer` + `jetbrains-gateway` wrapping**(log 或訊息中應可看到)。

### Step 2.4 — 觀察收尾訊息

Worker 完成後,預期看到以下三則訊息之一(依三模式):

| CT_MODE | 預期訊息 |
|---------|---------|
| `off` / `ask` / 未設 | `📋 回塔台回報時輸入:T9999 完成`(文字提示,因為 Step 8.5 跳過) |
| `on` | Step 8.5 執行 bat-notify,但**非 BAT 環境**會跳過 → 降級文字提示 |
| `yolo` | 硬鉤子:若 bat-notify 失敗會阻斷工單 |

**GoLand terminal 非 BAT 環境**,所以 Step 8.5 的 `BAT_SESSION=1` 檢查會直接跳過,永遠走剪貼簿 fallback。

### Step 2.5 — 剪貼簿 fallback 實測

Worker 收尾後會嘗試寫剪貼簿:

```bash
# 預期 Worker 跑了這條(或類似):
printf '\033]52;c;%s\007' "$(printf %s 'T9999 完成' | base64 -w0)"
```

**切回 macOS host(例如 Notes.app)按 Cmd+V**,看貼出什麼:

| 貼出內容 | 含義 |
|---------|------|
| `T9999 完成` | ✅ OSC 52 意外成功(你的 Gateway 版本可能已支援穿透,請回報!) |
| `T9999 done` | ✅ 降級 ASCII 成功(但環境應該不會走這條,因為不是 Windows clip.exe 路徑) |
| 其他文字 / 空白 / 貼出你之前複製的東西 | ❌ OSC 52 不穿透(預期,符合 v4.3.3 判定) |

### Step 2.6 — 回報 checklist

- [ ] Step 2.3 Worker 有啟動? Y / N
- [ ] Step 2.4 看到的收尾訊息類型(文字提示 / Step 8.5 跳過訊息 / 其他)
- [ ] Step 2.5 OSC 52 實測結果(貼出內容)

---

## Part 3:三模式觀察(off / on / yolo 在 JB Gateway 下表現)

目的:確認三模式在 JB Gateway 環境下的**實際差異**(或差異不大的確認)。

### Step 3.1 — CT_MODE=off 測試

```bash
CT_MODE=off claude "/ct-exec T9999"
```

**預期**:
- Worker 正常執行
- Step 0 無 YOLO banner
- Step 8.5 跳過(CT_MODE=off 分流)
- Step 11 剪貼簿 fallback(但 JB 環境 OSC 52 失敗)
- 最終只剩文字提示

### Step 3.2 — CT_MODE=on 測試

```bash
CT_MODE=on claude "/ct-exec T9999"
```

**預期**:
- 同 off,因為 Step 8.5 在**非 BAT 環境**(`BAT_SESSION` 未設)會整段跳過
- 不會看到「已預填塔台終端」訊息
- 效果等同 off

### Step 3.3 — CT_MODE=yolo 測試

```bash
CT_MODE=yolo claude "/ct-exec T9999"
```

**預期**:
- Step 0 顯示 YOLO MODE ACTIVE banner
- Step 8.5 同樣跳過(非 BAT 環境)
- 效果等同 on / off,但 banner 會出現

### Step 3.4 — 回報 checklist

- [ ] off 模式:文字提示是否清楚? Y / N
- [ ] on 模式:是否如預期「等同 off」? Y / N
- [ ] yolo 模式:YOLO banner 是否顯示? Y / N
- [ ] 三模式實際體驗差異描述(自由填寫,一兩句即可)

---

## Part 4:已知限制明示(不是 bug,是設計限制)

v4.3.3 **不解決以下問題**,請對齊預期:

1. **auto-session 對 JB Gateway 無自動化能力**
   - 原因:Gateway 協議不提供遠端 PTY tab spawn API
   - 結果:不論 CT_MODE 為何,實際效果等同 `auto-session = off`
   - v4.3.3 改善:訊息明示原因,不會誤以為塔台壞了

2. **OSC 52 剪貼簿在 JB Gateway Dev Container 不穿透**
   - 原因:escape sequence 被容器或 Gateway 吞掉
   - 2026-04 實測確認(見 CHANGELOG v4.3.3)
   - v4.3.3 改善:OSC 52 支援清單明列「❌ 不穿透」,避免嘗試失敗

3. **剪貼簿 proxy 等替代方案不在 v4.3.3 範圍**
   - 候選方向:容器內 clipboard bridge、Gateway 檔案系統交換、外掛
   - 優先級:等 Part 5 回報蒐集完,再決定是否升級為獨立工單

---

## Part 5:回報模板(收集下輪 feedback)

請把 Part 0-4 的 checklist 結果整理成一份 markdown 丟回 Gower / LINE,格式:

```markdown
## Selene v4.3.3 JB Gateway 驗證回報

### 環境
- GoLand 版本:___
- Gateway 版本:___
- 容器 base image:___
- Control Tower skill 版本:___

### Part 1:A.1 第 21 條偵測
- 主信號 /.jbdevcontainer/ 存在:Y/N
- process 輔助信號:Y/N(附 ps 輸出片段)
- PWD 起首 /IdeaProjects/:Y/N
- VS Code env 排除:Y/N

### Part 2:A.2 Step 2.5 決策樹
- Worker 啟動:Y/N
- 收尾訊息類型:___
- OSC 52 實測貼出內容:___

### Part 3:三模式觀察
- off 文字提示清楚:Y/N
- on 等同 off:Y/N
- yolo banner 顯示:Y/N
- 三模式實際差異:___

### 主觀體驗
(自由填寫:從「全部 fallthrough 到 Fallback」升級為「識別正確 + 訊息清楚」有感嗎?多 1% / 5% / 10%?)

### 後續優先級建議
(v4.3.3 範圍外的改善方向,例如剪貼簿 proxy、Gateway 協議擴充等,你覺得哪條最痛?)
```

---

## 附錄:為什麼 v4.3.3 範圍這麼小?

v4.3.2 下游首次實測揭露:我們把「devcontainer 主場景」假設成「VS Code Remote-Containers」,
但你(Selene)的主力環境是 JetBrains Gateway + GoLand Dev Container,
關鍵 env(`REMOTE_CONTAINERS` / `CODESPACES` / `TERM_PROGRAM`)**都不存在**,
v4.3.2 對此情境幾乎無識別能力。

v4.3.3 作為 **patch-level hotfix**,範圍嚴格限定在:
1. 正確識別 JB Gateway Dev Container 環境(A.1 #21 + A.2 Step 2.5)
2. 明示 OSC 52 不可用(C.2.3 #13)
3. 訊息清楚,不讓使用者誤以為塔台壞了

**不做**:剪貼簿 proxy、Gateway 協議擴充、自動開分頁替代方案 → 這些留待 Part 5 feedback 蒐集完再判斷優先級。

有問題隨時回報。

— Gower(via control-tower v4.3.3)
