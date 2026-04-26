# Docker Deployment Guide

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
- port: `9876`
- init: `tini`
- entrypoint: `/opt/bat-server/bin/bat-server`

The image exposes:

```text
9876/tcp
```

The health check runs:

```text
curl -fk "https://127.0.0.1:${BAT_PORT}/health" || exit 1
```

This uses `-k` because the BAT server uses a local self-signed certificate.

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
  -p 9876:9876 `
  -v C:\projects\bat:/workspace/bat `
  -v bat-server-myprofile-data:/root/.local/share/bat-server `
  bat-server:latest
```

If you rebuild the dev container with different mounts, remove and recreate the BAT container so the stored profile metadata matches the live mount table.

## Lifecycle Scenarios

BAT treats Docker lifecycle validation as a manual release check for v1, even though the wizard flow is covered by mock-based tests.

### Restart self-heal

- Start a mode B container and confirm BAT passes connect-test.
- Run `docker restart <container-name>`.
- Recheck `curl -k https://127.0.0.1:9876/health`.
- Confirm the container returns to `healthy`.

### Host reboot recovery

- Start a mode B container created with `--restart unless-stopped`.
- Reboot the host.
- Confirm `docker ps` shows the BAT container running again.
- Re-run the BAT connection test or the `/health` probe.

### OOM or crash recovery

- Force a container stop or simulate a crash on a test machine.
- Inspect `docker logs <container-name>` for the last BAT server output.
- Confirm Docker restarts the container when the restart policy still applies.
- Re-run the BAT `/health` check.

### Manual stop and restart

- Run `docker stop <container-name>` and confirm BAT can no longer connect.
- Run `docker start <container-name>` or re-run the wizard mode A flow.
- Confirm the existing token and profile still reconnect successfully.

## Manual Smoke Test

Run the container locally:

```powershell
docker run --rm -p 9876:9876 bat-server:latest
```

In another terminal, confirm the health endpoint responds:

```powershell
curl.exe -k https://127.0.0.1:9876/health
```

Inspect the container health state:

```powershell
docker ps
docker inspect --format='{{json .State.Health}}' <container-id>
```

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

Confirm that the BAT server inside the container started correctly and that `/health` is reachable over HTTPS on `127.0.0.1:${BAT_PORT}`.

### Image too large

Inspect the final image size:

```powershell
docker image inspect bat-server:latest --format='{{.Size}}'
```

If the image exceeds the threshold, confirm the build used the generated tarball only and did not copy extra files into the build context.

## Release Pre-Flight Checklist

This checklist stays manual for v1 because registry push and CI image publishing are out of scope.

- Confirm `npm run build:server-bundle` succeeds in the release worktree.
- Confirm `npm run build:docker-image` succeeds with Docker daemon access.
- Confirm `npm run verify:docker-image` succeeds.
- Confirm the built image stays below `300 MB`.
- Confirm wizard mode A can attach to an existing BAT-ready container without rewriting unrelated mounts.
- Confirm wizard mode B can create a fresh managed container with the expected bind mounts and `--restart unless-stopped`.
- Confirm `docker run --rm -p 9876:9876 bat-server:latest` starts without crashing.
- Confirm `curl -k https://127.0.0.1:9876/health` returns success while the container is running.
- Confirm the container reports a healthy state through Docker inspection.
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
