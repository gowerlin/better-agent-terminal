# T0278 — Impl PLAN-007 Docker base image + Dockerfile + multi-arch baseline (v1 local-only)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0278 |
| 類型 | impl |
| Phase | PLAN-007 Phase 3(Docker deployment)第二張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 12:15 (UTC+8) |
| Sizing | M(spec 估 4-8h;Phase 3 預期 wall 10-30 min) |
| 依賴 | T0271(server bundle pipeline + tarball `dist-server/bat-server-linux-x64-v<ver>.tar.gz`)、T0277(DockerPathTranslator,parallel use)|
| 後續 | T0279(Docker setup wizard)依本工單;registry push 標 v2 不在本工單 |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `43d6eea`) |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget) |
| `affects_files` | `docker/Dockerfile`(新建)、`docker/.dockerignore`(新建)、`scripts/build-docker-image.mjs`(新建)、`scripts/verify-docker-image.mjs`(新建)、`package.json`、`.gitignore` |

## 目標

建立 BAT server 的 Docker base image baseline:`docker/Dockerfile`(`debian:bookworm-slim` + 解壓 server bundle tarball + `HEALTHCHECK`)、`scripts/build-docker-image.mjs`(npm script wrapper)、`scripts/verify-docker-image.mjs`(image size + HEALTHCHECK 驗證)、整合 `package.json` script。**v1 純本機 build,不上 registry**(spec § C-1 待拍板項由塔台拍板為 [A] 本機 only,registry push 標 v2)。

## 範圍

### 新增

1. **`docker/Dockerfile`** — base image 定義
   - `FROM debian:bookworm-slim`(spec §4.2 凍結 + digest pin 推薦但不強制)
   - `WORKDIR /opt/bat-server`
   - `COPY dist-server/bat-server-linux-x64-*.tar.gz /tmp/bundle.tar.gz`(從 worktree 解壓)
   - `RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tini && rm -rf /var/lib/apt/lists/*`(curl for HEALTHCHECK + tini 為 PID 1)
   - `RUN tar xzf /tmp/bundle.tar.gz -C /opt/bat-server --strip-components=0 && rm /tmp/bundle.tar.gz`
   - `ENV BAT_PORT=9876` + `ENV NODE_ENV=production`
   - `EXPOSE 9876`
   - `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fk https://127.0.0.1:${BAT_PORT}/health || exit 1`(spec §4.2 凍結;`-k` 因為 self-signed cert)
   - `ENTRYPOINT ["/usr/bin/tini", "--", "/opt/bat-server/bin/bat-server"]`(launcher script 來自 T0271)

2. **`docker/.dockerignore`** — build context 收斂
   - 排除 `node_modules`、`dist`、`out`、`*.log`、`.git`、`tests`、`docs` 等(避免 build context 過大)
   - 唯一保留 `dist-server/bat-server-linux-x64-*.tar.gz`

3. **`scripts/build-docker-image.mjs`** — ESM script,wrapper around `docker build`
   - 讀 `package.json` 取 `version` → image tag `bat-server:<version>`
   - 確認 `dist-server/bat-server-linux-x64-v<version>.tar.gz` 存在,不存在則先 `npm run build:server-bundle` 再繼續(或印錯誤訊息要求使用者先跑)
   - `execFileSync('docker', ['build', '--platform', 'linux/amd64', '-t', `bat-server:${version}`, '-t', 'bat-server:latest', '-f', 'docker/Dockerfile', '.'])`(`linux/amd64` 凍結,arm64 標 v2)
   - 印 image ID + size(`docker image inspect bat-server:${version} --format='{{.Size}}'`)
   - 退出 0 為成功;build 失敗 abort

4. **`scripts/verify-docker-image.mjs`** — image 驗證 script
   - 讀 image tag(預設 `bat-server:latest`)
   - 三項驗證:
     - **size 驗證**:`docker image inspect bat-server:${tag} --format='{{.Size}}'` → bytes < 300 MB(spec §AC 凍結);超過 abort
     - **HEALTHCHECK 配置驗證**:`docker image inspect ... --format='{{json .Config.Healthcheck}}'` → 確認非 null + interval/timeout/retries 對齊 Dockerfile
     - **Bundle 解壓驗證**:`docker run --rm bat-server:${tag} ls /opt/bat-server/bin` → 必須含 `node` + `bat-server`(launcher script)
   - 全綠印 `✅ Docker image valid`,任一失敗 abort

5. **`package.json`** — 加 script
   ```json
   {
     "scripts": {
       "build:docker-image": "node scripts/build-docker-image.mjs",
       "verify:docker-image": "node scripts/verify-docker-image.mjs"
     }
   }
   ```

6. **`.gitignore`** — 確認 `dist-server/` 已在(T0271 加過)。本工單不額外加(docker build context 不會留檔)。

### Out of scope(不做)

- ❌ 不做 registry push(spec § C-1 拍板:v1 本機 only,registry path 標 v2)
- ❌ 不做 `linux/arm64` multi-arch(spec §6.1 凍結:v1 僅 `linux/amd64`)
- ❌ 不寫 docker-compose.yml(超出 spec 範圍)
- ❌ 不寫 GitHub Actions workflow(同上,registry 相關)
- ❌ 不寫 Docker setup wizard(留 T0279)
- ❌ 不動 `electron/remote/server-entry.ts`(T0271 已備 stub)
- ❌ 不做 `--user $UID:$GID` permission 處理(spec §4.2 v2 標記;v1 預設 root)
- ❌ 不做 runtime container 完整啟動測試(unit test 路徑 + verify script + docs 已足;wizard runtime 留 T0279)
- ❌ 不引入 dockerode SDK(spec §4.2 凍結:CLI spawn,不嵌 SDK)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.2(L345-368) | Docker deployment 凍結規格(base image debian:bookworm-slim、HEALTHCHECK 命令、CLI spawn 哲學)|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §6.1 + §C-1(L400-405, L452-457) | Multi-arch v1 僅 linux/amd64;CI matrix 切割(本工單 v1 不啟用 server-bundle workflow,只做本機 build)|
| `_ct-workorders/T0265-research-plan007-docker-deployment.md` §1-§3 | Docker deployment 研究來源,base image 選型理由 + 容器 lifecycle 三模式對比 |
| `_ct-workorders/T0271-impl-plan007-server-bundle-pipeline-linux-x64.md` | server bundle tarball 結構(`bin/{node,bat-server,bat-server.js}` / `node_modules/` / `electron/remote/` / `handlers/` / `README.md`),Dockerfile 解壓後對應 `/opt/bat-server/` |
| `scripts/build-server-bundle.mjs`(T0271) | 產出 `dist-server/bat-server-linux-x64-v<version>.tar.gz`,本工單 Dockerfile COPY 來源 |
| `scripts/verify-server-bundle.js`(T0271 風格) | verify-docker-image.mjs 仿此 ESM script 格式 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `docker/Dockerfile` 落地,以 `debian:bookworm-slim` 為 base,含 HEALTHCHECK + ENTRYPOINT(tini)+ EXPOSE 9876 | grep Dockerfile 內容 |
| AC2 | `docker/.dockerignore` 落地,build context 收斂(排除 node_modules / .git / tests 等) | grep .dockerignore |
| AC3 | `scripts/build-docker-image.mjs` 落地,可執行 `npm run build:docker-image`(Worker 環境若無 docker daemon → 豁免實際 build,改用 lint 驗 script 結構 + 預期參數) | 跑指令看輸出 / 結構檢查 |
| AC4 | `scripts/verify-docker-image.mjs` 落地,可執行 `npm run verify:docker-image`(Worker 環境若無 docker daemon → 豁免實際 verify,改 lint script 結構) | 跑指令看輸出 / 結構檢查 |
| AC5 | 本機 build 成功(若 Worker 環境有 docker)→ image size <300 MB(spec § AC 凍結);若無 docker daemon → AC5 標記為「待人類驗收」並寫進 README docs/docker-deployment.md | docker image inspect 或 README 標註 |
| AC6 | HEALTHCHECK 配置正確(interval=30s / timeout=5s / start-period=10s / retries=3 / curl `-fk`)| grep Dockerfile + verify script 檢查 |
| AC7 | `package.json` 加 `build:docker-image` + `verify:docker-image` script | grep package.json |
| AC8 | `dist-server/` 已在 `.gitignore`(T0271 加過,本工單僅確認不重複)| grep .gitignore |
| AC9 | docs/docker-deployment.md 落地,含 build 指令、verify 指令、image size baseline、HEALTHCHECK 行為、release pre-flight checklist(對齊 docs/wsl-deployment.md 結構);registry push 標「v2 future」 | 檔案存在 + 章節完整 |
| AC10 | TypeScript / build 不破:`npm run build`(既有 desktop build)仍通過;baseline error 不增加(≤36) | 跑 build 看輸出 |

## 守則(嚴格)

1. **工作分支**:在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**:`feat(docker): T0278 base image + Dockerfile + build/verify scripts (v1 local-only)\n\n工單:T0278\n依賴:T0271 / T0277\nspec § C-1 拍板:v1 本機 only,registry push 標 v2`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0278-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **Docker daemon 豁免**:Worker 環境(Windows MINGW64)若無 docker daemon → AC3/AC4/AC5 走「結構驗證 + 文件標註」路徑,不強制實機 build。Build 實機驗收由 release pre-flight checklist 由人類執行(對齊 docs/wsl-deployment.md 模式)。
7. **registry push 嚴格 out-of-scope**:任何 ghcr.io / GitHub Release / npm registry 相關設計都**不寫**(即使覺得方便),保持 v1 純本機。
8. **multi-arch 嚴格 v1**:`--platform linux/amd64` 寫死,不留 arm64 hook(避免 v1 階段引入 QEMU 依賴)。
9. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用。
10. **shell-out 安全**:`scripts/build-docker-image.mjs` 用 `execFileSync` 不用 `execSync`(避免 shell injection);參數陣列傳遞。
11. **完成判定**:10 個 AC 全部通過(AC5 daemon 豁免時走文件路徑視為通過)後,worktree commit,完成訊息 `T0278 完成`。失敗或 blocker 訊息 `T0278 失敗:<原因>`。

## 預期 wall

**10-30 min**(GP099 + Phase 3 校準下界;Dockerfile 結構直譯 spec §4.2 / build script 仿 build-server-bundle.mjs / verify script 仿 verify-server-bundle.js,無新模式)。若超過 45 min 視為 over-budget。

## 工單回報區

(尚無)

---

## 塔台補充(Renew #N)

(尚無)

---
