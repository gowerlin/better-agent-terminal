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
- Confirm `docker run --rm -p 9876:9876 bat-server:latest` starts without crashing.
- Confirm `curl -k https://127.0.0.1:9876/health` returns success while the container is running.
- Confirm the container reports a healthy state through Docker inspection.
- Confirm the image remains `linux/amd64` only for v1.
- Confirm no registry push flow is introduced in scripts or docs.

## Notes

- This v1 baseline is local-only and does not push to any registry.
- Multi-arch `linux/arm64` support is intentionally deferred.
- Docker setup wizard integration is tracked separately.
