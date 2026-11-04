# Docker Deployment Guide

> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).
> Contributor reference (invariants, single implementations, tests):
> [docs/agent-guide/docker-remote.md](./agent-guide/docker-remote.md).

This guide explains what the Docker setup wizard does, how the base image, the
server bundle volume, ports, tokens, upgrades and rollback work, and the manual
release checks.

> **No image to build.** Since PLAN-052 (D283) the wizard pulls a public base
> image (default `buildpack-deps:bookworm-scm`), installs the BAT server bundle
> into a Docker volume and creates the container on the base image. The server
> bundle comes from the same place as for WSL and SSH (download, cache, or
> **Import local tarball…**). The image built from `docker/Dockerfile`
> (`bat-server:latest`) still works as an advanced path, see
> [Advanced: an image with the server built in](#advanced-an-image-with-the-server-built-in).

## Prerequisites

- Docker Desktop (Windows, macOS) or Docker Engine (Linux) with a running
  daemon (`docker info` succeeds) that runs **Linux containers** on x86-64 or
  arm64.
- Network access to pull the base image (Docker Hub for the default), or the
  image already present locally.
- The server bundle for your BAT version: downloaded by the wizard, or
  imported from a local file (see [Offline](#offline)).
- One host folder to mount into the container.

## Base image

The container runs on a base image you choose in step 2 (**Create new** only).
The default `buildpack-deps:bookworm-scm` is an official Debian 12 image with
git, curl and ssh (glibc 2.36, amd64 and arm64, about 130 MiB compressed).
A custom image works, including one from an internal registry
(`registry.example.com/team/dev:1.2`), when it has:

- glibc 2.35 or newer (Debian 12, Ubuntu 22.04 or newer). Alpine and other
  musl images do not work;
- `/bin/sh`, `tar` and `gzip`.

Image names are checked before anything runs (lower-case path components,
optional registry, tag and digest). The wizard checks the image twice: tools
and libc before anything is created, and the bundled `node` after the bundle
is installed. A failing check stops the wizard before it creates a container
or volume, with **Change base image** to go back.

If `docker pull` fails but the image exists locally (an image you only built
locally, or the base image while offline), the wizard uses the local copy and
logs a warning.

## Setup wizard

Open the sidebar **Profiles** panel, click **+ More ▾**, and pick
**Add Docker Profile** under **Container**.

| # | Step id | Label | What it does |
|---|---------|-------|--------------|
| 1 | `detect-env` | Detect target environment | Finds the `docker` CLI and a running daemon. |
| 2 | `pick-container` | Choose Docker container mode | **Create new** (then the base image) or **Use existing** (then the container, see [Modes](#modes)). |
| 3 | `configure-mounts` | Choose workspace folder | Pick one host folder; it maps to `/workspace/<folder name>`. **Use existing** first offers the container's own bind mounts. |
| 4 | `install-server-bundle` | Install BAT server bundle | Create new: pull the base image, check it, get the server bundle, install it into the bundle volume. Use existing on a BAT container: upgrade (see [Re-running the wizard](#re-running-the-wizard)). |
| 5 | `start-server` | Start Docker container | Creates the container (or starts / restarts an existing one), waits up to 45 s for `healthy`, then reads the server token. |
| 6 | `fetch-fingerprint` | Fetch TLS fingerprint | Records the certificate fingerprint from a TLS handshake on `127.0.0.1:<host-port>`. |
| 7 | `connect-test` | Verify remote connection | Connects with the token and the recorded fingerprint. |
| 8 | `write-profile` | Save remote profile | Updates the Docker profile of the same container if there is one, otherwise creates one. |
| 9 | `done` | Finalize | Lists the warnings collected along the way. |

While step 4 pulls the image, the wizard shows the layer progress
("n / m layers").

### Modes

| | Create new (recommended) | Use existing |
|---|---|---|
| Container | Created on the base image, named `bat-server-<profile slug>` (usually `bat-server-profile`); a taken name gets `-2`, `-3`, … and the existing one is left untouched | Picked from a list of all containers (image · state · published port · created by BAT). Containers BAT cannot use are listed but disabled, with the reason |
| Server | Bundle in the volume `bat-server-<container>-bundle` at `/opt/bat` | Whatever the container runs: a container created by BAT is upgraded on request; any other container must already contain the server at `/opt/bat-server` |
| Host port | Picked by BAT (see [Ports](#ports)) | The host port the container already publishes for `9876/tcp` |
| Mount | Applied with `-v` | Not changed. The wizard offers the container's bind mounts as the path mapping; picking other folders only changes path translation, not the container |
| Restart policy | `unless-stopped` | Whatever the container has |
| Token | Generated by the server on its first start and stored in the data volume; BAT reads it after the container is healthy | Read the same way after the container is healthy (see [Token](#token)) |
| Data volume | `bat-server-<container>-data` at `/var/lib/bat-server` | Whatever the container has |

A container cannot be used when it does not publish `9876/tcp`, or publishes
it on the port BAT's own remote server listens on. When no container can be
used, the wizard explains why and offers **Create new instead**. A stopped
container can be picked; the wizard starts it, and stops it again on cancel
only if it started it.

### What "Create new" creates

```text
docker run -d --name <name> --init --user 0:0 --restart unless-stopped --label bat.server=1
  --entrypoint /opt/bat/server/bin/bat-server --health-cmd <TLS probe> …
  -e NODE_ENV=production -p 127.0.0.1:<host-port>:9876
  -v bat-server-<name>-bundle:/opt/bat -v bat-server-<name>-data:/var/lib/bat-server
  -v <host folder>:/workspace/<folder name>
  <base image> --bind-interface all --port 9876 --data-dir /var/lib/bat-server
```

- No `--token` and no token in the command or environment.
- Root inside the container, `--init` as PID 1, label `bat.server=1`.
- The data directory is `0700` root; `server-cert.json` and
  `server-token.json` are `0600`.
- The bundle is installed by a one-shot job (`docker run --rm -i --network none
  --entrypoint /bin/sh <base image>`) that receives the tarball on stdin; the
  host path is never passed to Docker. Both volumes carry the labels
  `bat.server=1` and `bat.server.volume=bundle|data`.

### Health check

The server is a TLS / WSS endpoint with no HTTP routes, so there is no
`/health` URL. The health check opens a TLS handshake against port 9876 with
the bundled node (the same probe as `docker/Dockerfile`'s `HEALTHCHECK`, with
the bundle's node path):

```text
/opt/bat/server/bin/node -e 'const s=require("tls").connect({host:"127.0.0.1",port:9876,rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1
```

- Interval `30s`, timeout `5s`, start period `10s`, retries `3`.
- `rejectUnauthorized:false` because the server presents a self-signed
  certificate; the probe only proves the listener is up.

```bash
docker inspect --format '{{.State.Health.Status}}' <container-name>
```

The wizard waits up to 45 s for `healthy` (a container without a health check
counts as ready).

### Port exposure and security

Inside the container the server listens on 9876 on all container interfaces
(`--bind-interface all`); Docker's port forward reaches it through the
container's network interface, so a loopback-only bind inside the container
would make the published port unreachable.

That is safe **only because** the host side is bound to `127.0.0.1`: the
server hands out a root shell inside the container (`pty:create`). Never
publish it on a host-wide address (`-p <port>:9876` or
`-p 0.0.0.0:<port>:9876`). Other containers on the same Docker network can
still reach the port (they still need the token and the fingerprint); the LAN
cannot.

```bash
docker port <container-name>
# 9876/tcp -> 127.0.0.1:<host-port>
```

### Ports

The Docker wizard does not use a fixed host port (BUG-156). BAT's own remote
server listens on `127.0.0.1:9876` by default, so a container published on the
same address could never start.

- **Create new**: `docker:pick-server-port` (`pickDockerServerPort`,
  `electron/docker-lifecycle.ts`) uses the same picker as WSL: the first free
  port in **9877–9976** on `127.0.0.1`, skipping BAT's own remote server port
  (configured and listening). A retry keeps the port of the previous attempt
  while it is still free.
- **Use existing**: the host port published for `9876/tcp`
  (`NetworkSettings.Ports`, then `HostConfig.PortBindings`, so a stopped
  container is judged too). Containers without it, or on BAT's own server
  port, are disabled in the list.
- If creating or starting fails because the port is taken, the wizard removes
  the container this run created and the retry picks another port.
- The profile stores the host port actually used.

### Token

The wizard reads the token only after the container is healthy (a first start
writes `server-token.json` while the server starts up), for both modes:

1. `docker exec <name> cat <data dir>/server-token.json`. The data directory
   is worked out from the container: its `--data-dir` flag, then the env
   `BAT_SERVER_DATA_DIR`, `XDG_DATA_HOME/bat-server`,
   `HOME/.local/share/bat-server`, and finally
   `/root/.local/share/bat-server` (the same order as `bat-server` itself).
2. A container created with `--token <t>` by an older BAT: that value.
3. Neither: "Remote server token was not available" (`docker-token-unavailable`).

The wizard never issues a new token and never changes the container. Only the
token itself reaches the renderer; the container's environment is not passed
on.

## Offline

If the server bundle cannot be downloaded, step 4 fails with
**Import local tarball…**: pick `bat-server-<linux-x64|linux-arm64>-v<version>.tar.gz`
with its `.sha256` from the `server-bundle-v<version>` release (copied over
from a machine with network access); BAT verifies and caches it, then retries
the step. Details: [Server Bundle Distribution](./server-bundle-distribution.md#匯入本機-tarball離線--內網t0547).
The base image must then be present locally (`docker pull` or `docker load`
it beforehand), or come from a registry the host can reach.

## Re-running the wizard

- **Same container, same profile.** Running the wizard again for a container
  that already has a Docker profile updates that profile (port, token,
  fingerprint, mounts) instead of adding a second one; the name is kept.
- **Upgrade.** Pick a container BAT created this way (label `bat.server=1` and
  the volume `bat-server-<name>-bundle` on `/opt/bat`) with **Use existing**:
  - the bundle in the volume already matches this BAT's version: nothing is
    installed and the container is not restarted;
  - otherwise the wizard asks first (the restart ends every terminal and
    agent running in the container). **Upgrade and restart** installs the new
    bundle (the previous one is kept until setup finishes), checks it, and
    restarts the container (a stopped one is started). **Not now** connects to
    the server the container runs now.
  - The container, mounts, token and certificate stay the same.

## Rollback chain

When a step fails without a retry, or you cancel (including closing the wizard
while it runs), the runner rolls back the completed steps in reverse order,
and only what this run did:

- **write-profile**: deletes the profile this run created, or writes back the
  values of the profile it updated.
- **start-server**: Create new: `docker rm -f` the container, only if this run
  created it. Use existing: `docker stop`, only if this run started it (a
  container that was already running is left running).
- **install-server-bundle**: first removes the container this run created
  (its volumes are in use while it exists), then puts back the previous bundle
  if this run replaced one (and restarts an upgraded container on it), and
  last removes only the volumes this run created.
- **configure-mounts**: nothing to undo.
- **pick-container**: removes a container only if this run created it.

Nothing the wizard did not create or start is touched. A volume is removed
only when it carries the label `bat.server=1`.

## Editing a Docker profile

The profile card shows the name, `host:port` and the connection status, with
Open, Test connection, Edit connection (⚙), Duplicate, rename and Delete
buttons. The expanded details (`src/components/profiles/details/DockerDetails.tsx`)
show Container, Host (`host:port`), Target and a Mounts table. To re-pin the
fingerprint, use the pin button in the **Edit connection** dialog (see
[Fingerprint mismatch](./remote-dev-overview.md#fingerprint-mismatch)).

BAT does not start a stopped container when you open the profile; run
`docker start <container-name>` first.

## Advanced: an image with the server built in

`docker/Dockerfile` still builds an image with the server at `/opt/bat-server`:

```bash
npm ci
npm run build:docker-image      # bat-server:<version> and bat-server:latest, linux/amd64
npm run verify:docker-image     # size < 300 MB, HEALTHCHECK, /opt/bat-server/bin
```

Type `bat-server:latest` into the base image field. The wizard sees from the
image's `ENTRYPOINT` / `CMD` that it starts its own server
(`/opt/bat-server/bin/bat-server`), skips the install and creates the
container as before (data volume `bat-server-<container>-data` at
`/root/.local/share/bat-server`, no `--token`). Such a container is not
upgraded by re-running the wizard; rebuild the image and create a new
container instead.

## Dev Container Integration

To attach BAT to a container you manage yourself (for example the one behind a
VS Code dev container), the container must contain the BAT server at
`/opt/bat-server` (for example built from `bat-server:latest`) and start it the
same way, and publish the server port on loopback:

```bash
docker run -d \
  --name bat-server-myproject \
  --restart unless-stopped \
  -p 127.0.0.1:9880:9876 \
  -v /path/to/project:/workspace/project \
  -v bat-server-myproject-data:/root/.local/share/bat-server \
  bat-server:latest
```

- Pick a host port other than BAT's own server port (9876 by default).
- In the wizard, choose **Use existing**, pick the container, and accept its
  mounts (`/path/to/project` → `/workspace/project`) for path translation.

## Containers created before the BUG-097 fix

**Use existing** only `docker start`s an existing container (reconnects do
not start containers at all); it never changes the port bindings or image. A
container created before the BUG-097 fix (T0418) may keep a host-wide publish
and an old image whose server binds `127.0.0.1` inside the container. The
wizard detects both and warns ("…publishes the BAT server port on all host
interfaces…" / "…runs a BAT server image built before the Docker networking
fix…"); it does not change or delete the container. Fix: run the wizard with
**Create new**, then remove the old container yourself once you no longer need
its data.

## Lifecycle Scenarios

Manual release checks (`scripts/docker-acceptance.mjs` covers create /
upgrade / rollback against a real engine, see
[Release Pre-Flight Checklist](#release-pre-flight-checklist)).

### Restart self-heal

- Create a container with **Create new** and confirm the connection test
  passes.
- `docker restart <container-name>`; wait for `healthy`.
- `docker port <container-name>` still shows `127.0.0.1:<host-port>`.
- BAT reconnects (or run Test connection).

### Host reboot recovery

- With a **Create new** container (`unless-stopped`), reboot the host.
- `docker ps` shows the container running again; Test connection passes.

### Manual stop and start

- `docker stop <container-name>`: BAT can no longer connect.
- `docker start <container-name>`: the same profile reconnects with the
  existing token.

## Uninstallation

Deleting the profile in BAT removes only the local profile; the container keeps
running. To remove everything:

```bash
docker rm -f bat-server-profile
docker volume rm bat-server-bat-server-profile-bundle bat-server-bat-server-profile-data
docker rmi buildpack-deps:bookworm-scm   # only if nothing else uses it
```

Replace `bat-server-profile` with your container name (`docker ps -a`); the
volumes are `bat-server-<container-name>-bundle` and `-data`.

## Troubleshooting

### Docker daemon unavailable

Start Docker Desktop (or the Docker service on Linux) and retry the first
step. If Docker Desktop runs Windows containers, switch it to Linux
containers.

### Base image cannot be pulled

- "Docker could not find or pull image …": check the name and tag; log in to
  a private registry first (`docker login`).
- "Docker Hub pull rate limit reached": `docker login`, wait, or use an image
  from another registry.
- No network: pull or load the image beforehand, see [Offline](#offline).

### Base image not usable

- musl (Alpine) or glibc older than 2.35: use a Debian 12 / Ubuntu 22.04 or
  newer image.
- Missing `/bin/sh`, `tar` or `gzip`: add them to your image or use another.
- "The BAT server cannot run on this image": the bundled node failed on it;
  the details show the error.

Nothing was created when any of these is reported.

### Server bundle unavailable

Download failed: use **Import local tarball…** ([Offline](#offline)), or point
`BAT_SERVER_BUNDLE_BASE_URL` at a mirror.

### Port in use

- "No free port between 9877 and 9976 …": every port in the range is taken.
- A port error while creating or starting: the wizard removed the container
  it created; retry to pick another port.

### Container does not become healthy

```bash
docker logs <container-name>
docker inspect --format '{{json .State.Health}}' <container-name>
```

### Token not available

"Remote server token was not available …" means `server-token.json` could not
be read from the container's data directory: check that the server started
(`docker logs <container-name>`) and that the data directory is writable.

## Release Pre-Flight Checklist

- `gh workflow run docker-acceptance.yml -R gowerlin/better-agent-terminal -f from_version=<previous> -f to_version=<this>`
  (manual only, ubuntu-24.04): create / upgrade / rollback / musl / cleanup
  all PASS.
- With BAT's own remote server on 9876, **Create new** completes, the profile's
  `remotePort` is the picked host port (9877–9976), and `docker port` shows
  `127.0.0.1:<that port>`.
- Re-running the wizard on the same container keeps one profile; on an older
  bundle it asks, upgrades, and keeps the data volume.
- **Use existing** on a container published on a port other than 9876
  attaches, keeps that port, and passes the connection test.
- Cancelling after **Start Docker container** removes a container and volumes
  the run created and stops (only) a container the run started.
- Optional, Windows with Docker inside WSL: `e2e/t0743-docker-wizard.spec.ts`
  (`BAT_E2E_T0743_DOCKER=1`).

## Notes

- Nothing is pushed to a registry; the server bundle comes from the
  `server-bundle-v<version>` release like for WSL and SSH.
- Docker on a macOS host and an arm64 daemon have not been tested.
