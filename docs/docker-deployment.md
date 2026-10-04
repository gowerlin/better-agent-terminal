# Docker Deployment Guide

> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

This guide explains how to build the local BAT server Docker image, verify the result, and complete the manual release checks for the Phase 3 Docker baseline.

## Prerequisites

- Docker Desktop or another Docker Engine installation with a running daemon.
- The BAT repo checked out on the `feature/plan-007-remote-dev` branch.
- Dependencies installed in the worktree.
- A linux-x64 BAT server bundle available under `dist-server/`.

If the bundle does not exist yet, the build script will generate it automatically before building the image.

## Build

Build the local-only linux/amd64 image:

```powershell
npm run build:docker-image
```

The script:

- Reads the app version from `package.json`
- Ensures `dist-server/bat-server-linux-x64-v<version>.tar.gz` exists
- Builds `bat-server:<version>` and `bat-server:latest`
- Prints the image id and image size

The current acceptance target is:

- image size under `300 MB`

## Verify

Verify the built image:

```powershell
npm run verify:docker-image
```

The verification script checks three things:

- image size is below `300 MB`
- the image `HEALTHCHECK` matches the BAT contract
- `/opt/bat-server/bin` contains both `node` and `bat-server`

You can also verify a specific tag:

```powershell
node scripts/verify-docker-image.mjs bat-server:0.3.1
```

## Container Behavior

The Docker image currently uses:

- base image: `debian:bookworm-slim`
- platform: `linux/amd64`
- install root: `/opt/bat-server`
- port: `9876` (`ENV BAT_SERVER_PORT=9876`; `bat-server` reads `BAT_SERVER_PORT` when no `--port` is given)
- init: `tini`
- entrypoint: `/usr/bin/tini -- /opt/bat-server/bin/bat-server --bind-interface all`

The image exposes:

```text
9876/tcp
```

### Health check

The BAT server is a TLS / WSS endpoint (`RemoteServer`) with **no HTTP routes**,
so there is no `/health` URL to curl. The image `HEALTHCHECK` instead opens a
TLS handshake against the server port with the bundled node runtime:

```text
/opt/bat-server/bin/node -e 'const s=require("tls").connect({host:"127.0.0.1",port:Number(process.env.BAT_SERVER_PORT),rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1
```

- Interval `30s`, timeout `5s`, start period `10s`, retries `3`.
- `rejectUnauthorized:false` is used because the server presents a local
  self-signed certificate; the probe only proves the TLS listener is up.
- `scripts/verify-docker-image.mjs` asserts this exact command and these
  timings, so the Dockerfile and the verify script must change together.

> Earlier revisions documented a `curl … /health` probe and an `ENV BAT_PORT`
> variable. Both were wrong (BUG-097 / T0418): the route never existed and the
> server reads `BAT_SERVER_PORT`. They have been removed.

To read the health state from the host, use Docker rather than an HTTP probe:

```powershell
docker inspect --format '{{.State.Health.Status}}' <container-name>
```

The expected value is `healthy` (`starting` during the first 10 seconds).

### Port exposure and security

The server is published on the **host loopback only**. BAT-managed containers
(wizard mode B, `electron/docker-lifecycle.ts`) are created with:

```text
-p 127.0.0.1:<port>:9876
```

Inside the container, `bat-server` binds to **all container interfaces**
(`--bind-interface all`). That is required: Docker's port forward reaches the
server through the container's network interface, not through the container's
own `127.0.0.1`, so a loopback-only bind inside the container would make the
published port unreachable.

The container-side `all` bind is safe **only because** the host side is bound
to `127.0.0.1`. The server hands out a root shell inside the container
(`pty:create`), so never publish it on a host-wide address (`-p 9876:9876` or
`-p 0.0.0.0:9876:9876`). Residual exposure: other containers on the same Docker
network can reach the port (they still need the token and the TLS fingerprint);
the host LAN cannot.

Verify the binding from the host:

```powershell
docker port <container-name>
```

The output must show `127.0.0.1:<port>`, e.g. `9876/tcp -> 127.0.0.1:9876`.

## Usage Modes

BAT supports two Docker deployment modes:

- Docker Desktop on Windows or macOS, where the daemon is exposed by Docker Desktop and bind mounts usually start from host paths like `C:\projects\bat` or `/Users/alice/bat`.
- Docker Engine on Linux, where the daemon is local to the host and bind mounts normally stay in POSIX form such as `/home/alice/bat`.

Key differences to verify:

- Daemon access: Docker Desktop manages the daemon for you, while Linux Docker Engine normally relies on the local `docker` service and socket permissions.
- Mount path style: Windows hosts use drive-letter paths in BAT profiles; Linux hosts keep POSIX paths and do not translate them into backslashes.
- HEALTHCHECK behavior: both modes use the same container health contract, but Desktop adds another host layer, so restarts and mount changes should be rechecked on the target host after BAT reports success.

## Dev Container Integration

You can point BAT at the same long-lived container that powers a VS Code dev container, as long as `/opt/bat-server` already exists inside that container.

Recommended pattern:

1. Build `bat-server:latest`.
2. Start the container with your project mounts plus `--restart unless-stopped`.
3. Reuse that container from BAT with Docker wizard mode A.
4. Keep BAT and the dev container sharing the same workspace mounts so file paths stay aligned.

Example:

```powershell
docker run -d `
  --name bat-server-myprofile `
  --restart unless-stopped `
  -p 127.0.0.1:9876:9876 `
  -v C:\projects\bat:/workspace/bat `
  -v bat-server-myprofile-data:/root/.local/share/bat-server `
  bat-server:latest
```

Always publish on `127.0.0.1` as shown; see [Port exposure and security](#port-exposure-and-security).

If you rebuild the dev container with different mounts, remove and recreate the BAT container so the stored profile metadata matches the live mount table.

## Containers created before the BUG-097 fix

Wizard mode A and the reconnect path only run `docker start` on an existing
container; they never rewrite its port bindings or swap its image. A container
created before the BUG-097 fix (T0418) therefore keeps:

- a **host-wide** publish (`-p <port>:9876`, i.e. reachable from the LAN), and
- the **old image**, whose server binds `127.0.0.1` inside the container (the
  published port is unreachable) and whose `HEALTHCHECK` probes a `/health`
  route that does not exist (the container stays `unhealthy`).

Check an existing container:

```powershell
docker port <container-name>
```

If the output shows `0.0.0.0:<port>`, `[::]:<port>`, or anything other than
`127.0.0.1:<port>`, delete it and recreate it from a rebuilt image:

```powershell
npm run build:docker-image
docker rm -f <container-name>
```

Then re-run **Add Docker Profile** with wizard mode B (or the **Re-run wizard**
button on the ProfileCard), which recreates the container with
`-p 127.0.0.1:<port>:9876`. If you manage the container yourself, recreate it
with the `docker run` command in [Dev Container Integration](#dev-container-integration).
A named data volume mounted at `/root/.local/share/bat-server` survives
`docker rm`, so the persisted `server-token.json` and `server-cert.json` are
kept. If the old container had no data volume, both are regenerated: use
**Pin expected fingerprint** on the ProfileCard after reconnecting.

## Lifecycle Scenarios

BAT treats Docker lifecycle validation as a manual release check for v1, even though the wizard flow is covered by mock-based tests.

### Restart self-heal

- Start a mode B container and confirm BAT passes connect-test.
- Run `docker restart <container-name>`.
- Recheck `docker inspect --format '{{.State.Health.Status}}' <container-name>` until it returns to `healthy`.
- Confirm `docker port <container-name>` still shows `127.0.0.1:<port>`.
- Confirm BAT reconnects (or re-run the BAT connection test).

### Host reboot recovery

- Start a mode B container created with `--restart unless-stopped`.
- Reboot the host.
- Confirm `docker ps` shows the BAT container running again.
- Re-run the BAT connection test and confirm `docker inspect --format '{{.State.Health.Status}}' <container-name>` reports `healthy`.

### OOM or crash recovery

- Force a container stop or simulate a crash on a test machine.
- Inspect `docker logs <container-name>` for the last BAT server output.
- Confirm Docker restarts the container when the restart policy still applies.
- Re-run the BAT connection test and confirm the Docker health status is back to `healthy`.

### Manual stop and restart

- Run `docker stop <container-name>` and confirm BAT can no longer connect.
- Run `docker start <container-name>` or re-run the wizard mode A flow.
- Confirm the existing token and profile still reconnect successfully.

## Manual Smoke Test

Run the container locally:

```powershell
docker run --rm --name bat-server-smoke -p 127.0.0.1:9876:9876 bat-server:latest
```

In another terminal, confirm the port is published on loopback only:

```powershell
docker port bat-server-smoke
```

The output must be `9876/tcp -> 127.0.0.1:9876`.

Wait for the `HEALTHCHECK` (TLS handshake probe; there is no `/health` URL) to
pass, then inspect the details if needed:

```powershell
docker inspect --format '{{.State.Health.Status}}' bat-server-smoke
docker inspect --format '{{json .State.Health}}' bat-server-smoke
```

The status should move from `starting` to `healthy`. For an end-to-end check,
point a BAT remote profile at `127.0.0.1:9876` and run its connection test.

## Troubleshooting

### Docker daemon unavailable

If Docker is not installed or the daemon is not running, `build:docker-image` and `verify:docker-image` will fail immediately. In that environment, limit validation to script structure and complete the runtime checks on a machine with Docker access.

### Bundle tarball missing

`build:docker-image` will try to generate the tarball automatically. If that fails, run:

```powershell
npm run build:server-bundle
```

Then rerun the Docker build.

### HEALTHCHECK failing

The probe is a TLS handshake to `127.0.0.1:$BAT_SERVER_PORT` **inside** the
container (there is no `/health` route). Check, in order:

- `docker inspect --format '{{json .State.Health}}' <container-name>` — the
  `Log` entries show the exit code of each probe run.
- `docker logs <container-name>` — confirm `bat-server` started and is
  listening on `9876` with `--bind-interface all`.
- `docker exec <container-name> printenv BAT_SERVER_PORT` — must be `9876`
  unless you intentionally overrode it together with `--port`.
- If the container was created before the BUG-097 fix, it runs the old image
  whose probe targets the non-existent `/health` route; recreate it as
  described in [Containers created before the BUG-097 fix](#containers-created-before-the-bug-097-fix).

### Image too large

Inspect the final image size:

```powershell
docker image inspect bat-server:latest --format='{{.Size}}'
```

If the image exceeds the threshold, confirm the build used the generated tarball only and did not copy extra files into the build context.

## Rollback chain

If a wizard step fails (e.g. image build fails, daemon becomes unreachable
mid-flow, container start fails) the wizard runner walks the completed steps
in reverse and invokes their rollback handler (best-effort, not transactional).
For the Docker flow:

- **build-image** rollback removes the partially-built image tag if the
  build aborted between layers.
- **start-container** rollback runs `docker stop` + `docker rm` on the
  managed container created by wizard mode B.
- **fetch-fingerprint** / **connect-test** failures are read-only; the
  rollback chain still logs their outcome and stops the container started in
  the previous step.
- The Docker profile is **not** persisted unless the wizard reaches `done`
  cleanly. Mode A (attach to existing container) deliberately leaves
  pre-existing containers untouched on rollback — only state created **by
  the wizard run** is rolled back.

Re-running **Add Docker Profile** after a rollback is safe; the chain
ensures the previous failed install does not leak state into the next
attempt. Contract source of truth:
`src/components/setup-wizard/wizard-runner.ts` plus
`tests/wizard-rollback.test.ts` / `tests/wizard-rollback-cross.test.ts`.

## Editing a Docker profile from the ProfilePanel

After the wizard completes, the Docker profile appears in the ProfilePanel
as a **ProfileCard**. The card shows:

- Profile name and `targetOS: docker-linux` badge.
- Container name + image tag (`bat-server:<version>`) + bind mount summary.
- Pinned TLS fingerprint (read-only) with a **Pin expected fingerprint**
  button to refresh after a container rebuild.
- A **Re-run wizard** button that reopens the Docker wizard pre-filled with
  the current profile — useful when bind mounts change or you switch from
  mode A (attach) to mode B (managed container).
- A **Delete** button that removes the local profile entry. The container
  itself is **not** stopped automatically; use `docker stop / rm` manually.

Per-environment metadata (mounts, container id, restart policy) is exposed
under the ProfileCard's **Details** slot so the ProfilePanel UI stays
consistent across local / WSL / Docker / SSH cards.

## Release Pre-Flight Checklist

This checklist stays manual for v1 because registry push and CI image publishing are out of scope.

- Confirm `npm run build:server-bundle` succeeds in the release worktree.
- Confirm `npm run build:docker-image` succeeds with Docker daemon access.
- Confirm `npm run verify:docker-image` succeeds.
- Confirm the built image stays below `300 MB`.
- Confirm wizard mode A can attach to an existing BAT-ready container without rewriting unrelated mounts.
- Confirm wizard mode B can create a fresh managed container with the expected bind mounts and `--restart unless-stopped`.
- Confirm `docker run --rm --name bat-server-smoke -p 127.0.0.1:9876:9876 bat-server:latest` starts without crashing.
- Confirm `docker port <container-name>` shows `127.0.0.1:<port>` (never `0.0.0.0` / `[::]`) for both the smoke container and a wizard mode B container.
- Confirm `docker inspect --format '{{.State.Health.Status}}' <container-name>` reports `healthy` while the container is running.
- Confirm a BAT remote profile pointed at the container passes its connection test.
- Confirm restart self-heal works after `docker restart <container-name>`.
- Confirm host reboot recovery works with `--restart unless-stopped`.
- Confirm the container recovery procedure is documented for OOM or unexpected exits.
- Confirm manual stop followed by start or wizard mode A reconnect works.
- Confirm the image remains `linux/amd64` only for v1.
- Confirm no registry push flow is introduced in scripts or docs.

## Notes

- This v1 baseline is local-only and does not push to any registry.
- Multi-arch `linux/arm64` support is intentionally deferred.
- Docker setup wizard integration is tracked separately.
