# Selene v4.3.2 診斷指南 — IntelliJ IDEA Dev Containers 預判驗證

> **前情**:你已經跑過 `_guide-selene-t0228-devcontainer-validation.md` 的 Part 1 Step 1(`env | grep ...`),輸出**完全空白**,且 `/control-tower` 面板顯示「終端環境 ❌ 未知」。
>
> **這份指南**:基於我們對你環境的新預判,請你多跑幾個診斷確認 / 推翻假設,結果會決定是否派 v4.3.3 patch。
>
> **不急**——Gower 已經說了不急,等你方便再跑。時間預估 5-10 min。

---

## 1. 我們的預判(看你回報前的推論)

**關鍵線索**:你截圖的 shell prompt 是 `vscode ➜ /IdeaProjects/lt_lc (developer) $`。

- `/IdeaProjects/` 是 **JetBrains IntelliJ IDEA** 的預設 workspace 資料夾(VS Code 不會用這路徑)
- `vscode ➜` 這個 user prompt 是**容器內的 username**(Microsoft `mcr.microsoft.com/devcontainers/*` 基底 image 預設 user 叫 `vscode`),**不代表** IDE 是 VS Code
- 你的 `env | grep` 完全沒東西,連 `TERM=xterm-256color` 都沒抓到,代表這個 shell 的環境變數**極為稀薄**——不符合 VS Code Remote-Containers 應該注入的完整環境(`REMOTE_CONTAINERS=true` / `TERM_PROGRAM=vscode` / `VSCODE_INJECTION=1` 等)

**我們的假設**:
> 你的 IDE 可能是 **IntelliJ IDEA**(使用 Dev Containers 外掛或 Remote Development + JetBrains Gateway),而不是 VS Code。Container 的基底 image 是 Microsoft dev containers 那系列(所以預設 user 是 `vscode`),但**實際操作 IDE 是 JetBrains**。

**v4.3.2 現行 gap**:A.2 決策樹(Step 1-2)只靠 VS Code 特有的 `REMOTE_CONTAINERS` / `CODESPACES` env 偵測容器,**沒有「不是 VS Code 但確實在 container 裡」的 fallback**——所以你的環境直接落到 `unknown` 了。

---

## 2. 請幫忙跑的診斷(5-10 min)

### 2.1 基本環境驗證(2 min)

```bash
echo "---- 基本 env ----"
echo "TERM=$TERM"
echo "SHELL=$SHELL"
echo "USER=$USER"
echo "HOME=$HOME"
echo "PWD=$PWD"

echo "---- container 偵測 ----"
test -f /.dockerenv && echo "✅ /.dockerenv 存在" || echo "❌ /.dockerenv 不存在"
cat /proc/1/cgroup 2>/dev/null | head -5

echo "---- 父行程 ----"
ps -o pid,ppid,comm= -p $$
ps -o pid,ppid,comm= -p $PPID
ps -o pid,ppid,comm= -p $(ps -o ppid= -p $PPID | tr -d ' ')

echo "---- 完整 env (前 40 條,sort 過) ----"
env | sort | head -40
```

**我們想看什麼**:
- `TERM` 是否真的空白?還是當初 grep 只是 regex 漏了?
- `/.dockerenv` 存在嗎?(確認在 container 內)
- 父行程是什麼?(會不會是 `remote-dev-serv` / `jetbrains-agent` / `ssh` 之類的 JetBrains 專有字串)
- 完整 env 裡有沒有 `JAVA_` / `IDEA_` / `JETBRAINS_` / `RIDER_` / `PYCHARM_` / `INTELLIJ_` 開頭的變數

### 2.2 IDE 指紋偵測(1 min)

```bash
echo "---- JetBrains 相關 env ----"
env | grep -iE "java|idea|jetbrains|intellij|pycharm|rider|rubymine|clion|gateway" || echo "(無)"

echo "---- VS Code 相關 env ----"
env | grep -iE "vscode|VSCODE_|CODESPACES|REMOTE_CONTAINERS|VSCODE_INJECTION" || echo "(無)"

echo "---- 其他可能的 IDE 指紋 ----"
env | grep -iE "cursor|windsurf|zed|fleet" || echo "(無)"
```

**我們想確認**:IDE 到底是哪個。如果是 JetBrains,env 會有 `JAVA_*` 或 `JETBRAINS_*` 或 `IDEA_*`。

### 2.3 Claude Code 啟動路徑驗證(2 min)

你是怎麼在 container 裡啟動 Claude Code 的?

- [A] IDE 內建 terminal(按 IDE 的 terminal 按鈕開的)
- [B] SSH 從 host 進 container 後跑 `claude`
- [C] `docker exec -it <name> bash` 然後跑 `claude`
- [D] 其他:___________

```bash
echo "---- Claude Code 父行程鏈 ----"
# 從當前 shell 往上爬三層父行程,看 IDE / 啟動源頭
pid=$$
for i in 1 2 3 4; do
  ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' ')
  comm=$(ps -o comm= -p $pid 2>/dev/null | tr -d ' ')
  [ -z "$ppid" ] || [ "$ppid" = "0" ] && break
  echo "層 $i: PID=$pid COMM=$comm PPID=$ppid"
  pid=$ppid
done
```

**我們想看**:最上游的 process 是什麼(`sshd` / `java` / `code` / `dockerd` 等)。

### 2.4 VS Code / JetBrains 版本確認(1 min)

```bash
# 如果 host 跑得到這些,可以在 host 上跑:
# (在 container 內可能不適用)
which code 2>/dev/null && code --version
which idea 2>/dev/null && idea --version
which remote-dev-server 2>/dev/null && remote-dev-server --version

# 在 container 內可能有 JetBrains backend:
ls /root/.cache/JetBrains/ 2>/dev/null || ls ~/.cache/JetBrains/ 2>/dev/null || echo "(無 JetBrains cache)"
ls ~/.vscode-server/ 2>/dev/null || echo "(無 .vscode-server)"
ls ~/.cursor-server/ 2>/dev/null || echo "(無 .cursor-server)"
```

**我們想看**:container 內有沒有 IDE backend 的 cache 目錄(直接證據)。

---

## 3. 回報格式(給 Gower 轉貼回塔台)

複製以下 template,把輸出貼進去:

```markdown
# Selene v4.3.2 IntelliJ 預判診斷 — 2026-04-XX

## 0. 環境確認
- IDE 實際是:_____________(你自己知道的答案)
- IDE 連到 container 的方式:[A 內建 terminal / B SSH / C docker exec / D 其他:___]
- Container 基底 image:_____________(如果知道)

## 2.1 基本環境
(貼入完整輸出)

## 2.2 IDE 指紋
(貼入三段 grep 結果)

## 2.3 Claude Code 父行程鏈
(貼入層 1-4 輸出)

## 2.4 IDE backend cache
(貼入 ls 結果)

## 我的補充觀察
- ______________________
```

---

## 4. 預判確認後的下一步(供你理解我們會怎麼處理)

**如果確認是 JetBrains / IntelliJ Dev Containers**:
- 我們會派 **v4.3.3 patch** 補 A.2 決策樹:
  - 新增 Step 2.5:`test -f /.dockerenv` + `ls ~/.cache/JetBrains/` → `type: "devcontainer", platform: "container", wrapping_layers: ["intellij"]`(或類似)
  - 新增 IntelliJ 特有 env 偵測(如確認的 `JETBRAINS_*` / `IDEA_*` 變數)
- 更新 OSC 52 support 清單(JetBrains terminal 的 OSC 52 支援度需實測)
- **不會**要求你切換到 VS Code——目標是讓 v4.3.x 在你現有工具鏈下能用

**如果其實你真的在用 VS Code,只是 env 被某個機制剝掉了**:
- 我們要找的是「env 剝離源頭」——可能是 Dev Container spec 的 `remoteEnv` 設定 / shell 啟動 profile / Claude Code 本身 spawn 模式
- 這就不是 v4.3.3 偵測規則的問題,而是**部署層問題**,可能需要你在 `devcontainer.json` 加回 VS Code 應該注入的 env

**如果你不介意切換**,也可以:
- 在同一 container 開 VS Code session(並行)對照跑相同診斷,比對兩者 env 差異——這對我們釐清非常有幫助,但**不強制**

---

## 5. 常見問題

### Q:如果我根本不在 container 裡,只是 IDE 的 remote workspace 恰好用了 `/IdeaProjects/` 命名?

→ `/.dockerenv` 會不存在。若是這種情況(你其實在 macOS host 的 IntelliJ 開了一個 local project,裝了某個讓 prompt 變 `vscode ➜` 的 zsh theme),回報這點我們就知道要改預判方向。

### Q:我懶得跑 2.1-2.4 全部,只跑一小段可以嗎?

→ 最關鍵的是 **2.1**(基本 env + `/.dockerenv`) 和 **2.2**(IDE 指紋)。這兩段就能大致分類。2.3 / 2.4 是補強。

### Q:跑的指令噴了一堆錯誤?

→ 把錯誤也貼回來就好,`ps` / `cat /proc/1/cgroup` 在某些 restricted 容器可能不讓跑,這本身也是資訊。

---

## 6. 最後

Selene,抱歉 v4.3.2 hotfix release 前沒有考慮到 JetBrains Dev Containers 的情境——我們的研究只涵蓋了 VS Code Remote-Containers 和 Codespaces,忽略了還有 JetBrains Gateway / Dev Containers 外掛這條路線。你的實測讓我們發現這個 gap,真的很有價值。

如果你回報後確認是 IntelliJ,我們會把這當作 v4.3.3 的**主要驅動**,會把你列為 driver。

任何時候跑卡住、不確定,直接問 Gower。
