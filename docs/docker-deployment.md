# Docker Deployment Guide

> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

This guide explains how to build the BAT server image, what the Docker setup
wizard does, how ports, tokens and rollback work, and the manual release checks.

> **You build the image yourself.** The Docker wizard does not install a server
> bundle into the container: it creates or starts a container from the local
> image `bat-server:latest`, which contains the server at `/opt/bat-server`.
> That image is not published anywhere (no registry, no release asset); build it
> from the BAT source as below. WSL and SSH do not need this step.

## Prerequisites

- Docker Desktop (Windows, macOS) or Docker Engine (Linux) with a running
  daemon (`docker info` succeeds).
- To build the image: a checkout of the BAT source, preferably at the tag of
  the BAT version you run (`v<version>`), with Node.js and dependencies
  installed (`npm ci`).
- One host folder to mount into the container.

## Build

```bash
npm ci
npm run build:docker-image
```

`scripts/build-docker-image.mjs`:

- reads the version from `package.json`;
- builds `dist-server/bat-server-linux-x64-v<version>.tar.gz` first when it is
  missing (`npm run build:server-bundle`);
- builds `--platform linux/amd64` and tags `bat-server:<version>` and
  `bat-server:latest`;
- prints the image id and size.

Rebuild after every BAT upgrade so the server matches the app.

## Verify

```bash
npm run verify:docker-image
node scripts/verify-docker-image.mjs bat-server:<version>
```

`scripts/verify-docker-image.mjs` checks that the image is below 300 MB, that
its `HEALTHCHECK` matches the contract below, and that `/opt/bat-server/bin`
contains `node` and `bat-server`.

## Container Behavior

`docker/Dockerfile`:

- base image `debian:bookworm-slim` (plus `ca-certificates`, `curl`, `tini`);
  platform `linux/amd64` comes from the build script;
- install root `/opt/bat-server`; the server runs as root;
- `ENV BAT_SERVER_PORT=9876`, `EXPOSE 9876`;
- entrypoint `/usr/bin/tini -- /opt/bat-server/bin/bat-server --bind-interface all`.

### Health check

The server is a TLS / WSS endpoint with no HTTP routes, so there is no
`/health` URL. The `HEALTHCHECK` opens a TLS handshake against the server port
with the bundled node:

```text
/opt/bat-server/bin/node -e 'const s=require("tls").connect({host:"127.0.0.1",port:Number(process.env.BAT_SERVER_PORT),rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1
```

- Interval `30s`, timeout `5s`, start period `10s`, retries `3`.
- `rejectUnauthorized:false` because the server presents a self-signed
  certificate; the probe only proves the listener is up.
- `scripts/verify-docker-image.mjs` asserts this exact command and these
  timings, so the Dockerfile and the verify script change together.

From the host:

```bash
docker inspect --format '{{.State.Health.Status}}' <container-name>
```

The wizard waits up to 45 s for `healthy` (a container without a health check
counts as ready).

### Port exposure and security

Inside the container the server always listens on 9876 on all container
interfaces (`--bind-interface all`); Docker's port forward reaches it through
the container's network interface, so a loopback-only bind inside the container
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

## Setup wizard

Open the sidebar **Profiles** panel, click **+ More ▾**, and pick
**Add Docker Profile** under **Container**.

| # | Step id | Label | What it does |
|---|---------|-------|--------------|
| 1 | `detect-env` | Detect target environment | Finds the `docker` CLI and a running daemon. |
| 2 | `pick-container` | Choose Docker container mode | **Create new** or **Use existing** (see [Modes](#modes)). |
| 3 | `configure-mounts` | Configure bind mounts | Pick one host folder; it maps to `/workspace/<folder name>`. One folder only, container path fixed. |
| 4 | `install-server-bundle` | Verify BAT server bundle | Copies nothing: the server comes from the image (`/opt/bat-server`). |
| 5 | `start-server` | Start Docker container | Picks the host port, creates or starts the container, waits up to 45 s for `healthy`. |
| 6 | `fetch-fingerprint` | Fetch TLS fingerprint | Records the certificate fingerprint from a TLS handshake on `127.0.0.1:<host-port>`. |
| 7 | `connect-test` | Verify remote connection | Connects with the token and the recorded fingerprint. |
| 8 | `write-profile` | Save remote profile | Creates a Docker profile (`targetOS: docker-linux`, container, mounts, host port). |
| 9 | `done` | Finalize | Lists the warnings collected along the way. |

### Modes

| | Create new (recommended) | Use existing |
|---|---|---|
| Container | `docker run` from `bat-server:latest`, named `bat-server-<profile slug>` (usually `bat-server-profile`); a taken name gets `-2`, `-3`, … and the existing one is left untouched | The **first** container of `docker ps -a` (the newest one); there is no picker. Default when any container exists |
| Host port | Picked by BAT (see [Ports](#ports)) | The host port the container already publishes for `9876/tcp` |
| Mount | Applied with `-v` | **Not applied** to the container; only stored on the profile for path translation, so it must match the container's own mount |
| Restart policy | `unless-stopped` | Whatever the container has |
| Token | Generated by BAT and passed as `--token` | Read with `docker exec <name> cat /root/.local/share/bat-server/server-token.json` after `docker start` |
| Data volume | `bat-server-<container>-data` at `/root/.local/share/bat-server` | Whatever the container has |

The server writes `server-token.json` (plaintext, no keychain in the
container) into its data directory on every start, including a container the
wizard created with `--token`, so **Use existing** can attach to such a
container. This is traced from the code (`electron/docker-lifecycle.ts`,
`RemoteServer.start`), not tested on a real Docker host.

### Ports

The Docker wizard no longer uses a fixed host port (BUG-156). BAT's own
remote server listens on `127.0.0.1:9876` by default, so a container published
on the same address could never start.

- **Create new**: `docker:pick-server-port` (`pickDockerServerPort`,
  `electron/docker-lifecycle.ts`) uses the same picker as WSL: the first free
  port in **9877–9976** on `127.0.0.1`, skipping BAT's own remote server port
  (configured and listening). A retry keeps the port of the previous attempt
  while it is still free. The container is created with
  `-p 127.0.0.1:<host-port>:9876`.
- **Use existing**: the host port published for `9876/tcp`
  (`NetworkSettings.Ports`, then `HostConfig.PortBindings`). It is refused only
  when BAT's own remote server is listening on that port (the connection would
  reach BAT instead of the container): change BAT's server port in Settings,
  or use **Create new**. A container that does not publish 9876 is refused;
  recreate it with `-p 127.0.0.1:<port>:9876`.
- If `docker run` / `docker start` fails because the port is taken, the wizard
  removes the container this run created and the retry picks another port.
- The profile stores the host port actually used; the fingerprint step, the
  connection test and later connections use it.

You no longer need to change BAT's own server port before running the wizard.

## Rollback chain

When a step fails without a retry, or you cancel (including closing the wizard
while it runs), the runner rolls back the completed steps in reverse order:

- **write-profile**: deletes the profile this run created.
- **start-server**: Create new: `docker rm -f` the container, only if this run
  created it. Use existing: `docker stop`, only if this run started it (a
  container that was already running is left running). The named data volume is
  kept.
- **install-server-bundle**, **configure-mounts**: nothing to undo.
- **pick-container**: removes a container only if this run created it.

Nothing the wizard did not create or start is touched.

## Editing a Docker profile

The profile card shows the name, `host:port` and the connection status, with
Open, Test connection, Edit connection (⚙), Duplicate, rename and Delete
buttons. The expanded details (`src/components/profiles/details/DockerDetails.tsx`)
show Container, Host (`host:port`), Target and a Mounts table.

There is no "re-run wizard" button. The Docker wizard always creates a new
profile; it never updates an existing one, so delete the old profile after
setting up a replacement. To re-pin the fingerprint, use the pin button in the
**Edit connection** dialog (see
[Fingerprint mismatch](./remote-dev-overview.md#fingerprint-mismatch)).

BAT does not start a stopped container when you open the profile; run
`docker start <container-name>` first.

## Dev Container Integration

To attach BAT to a container you manage yourself (for example the one behind a
VS Code dev container), the container must run the BAT server image (or have
`/opt/bat-server` and start it the same way), publish the server port on
loopback, and be the newest container on the host when you run the wizard,
because **Use existing** takes the first entry of `docker ps -a`:

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
- In the wizard, choose **Use existing** and select the same host folder
  (`/path/to/project`) so path translation matches `/workspace/project`.
- If you recreate the container with different mounts, delete the profile and
  run the wizard again so the stored mounts match.

## Containers created before the BUG-097 fix

**Use existing** only `docker start`s an existing container (reconnects do
not start containers at all); it never changes the port bindings or image. A container created before the
BUG-097 fix (T0418) may keep a host-wide publish and an old image whose server
binds `127.0.0.1` inside the container. The wizard detects both and warns
("…publishes the BAT server port on all host interfaces…" /
"…runs a BAT server image built before the Docker networking fix…"); it does
not change or delete the container.

Fix: rebuild the image, run the wizard with **Create new**, then remove the old
container yourself once you no longer need its data:

```bash
npm run build:docker-image
docker rm -f <old-container-name>
```

A data volume mounted at `/root/.local/share/bat-server` survives `docker rm`,
so a container recreated on the same volume keeps its token and certificate.
A container on a new volume gets a new certificate and token; the wizard
creates a new profile for it, so delete the old profile.

## Lifecycle Scenarios

Manual release checks (the wizard itself is covered by mock-based tests).

### Restart self-heal

- Create a container with **Create new** and confirm the connection test
  passes.
- `docker restart <container-name>`; wait for `healthy`.
- `docker port <container-name>` still shows `127.0.0.1:<host-port>`.
- BAT reconnects (or run Test connection).

### Host reboot recovery

- With a **Create new** container (`unless-stopped`), reboot the host.
- `docker ps` shows the container running again; Test connection passes.

### Crash recovery

- Kill the server process or the container on a test machine.
- `docker logs <container-name>` shows the last server output.
- Docker restarts the container while the restart policy applies; health
  returns to `healthy`.

### Manual stop and start

- `docker stop <container-name>`: BAT can no longer connect.
- `docker start <container-name>`: the same profile reconnects with the
  existing token.

## Manual Smoke Test

```bash
docker run --rm --name bat-server-smoke -p 127.0.0.1:9880:9876 bat-server:latest
docker port bat-server-smoke          # 9876/tcp -> 127.0.0.1:9880
docker inspect --format '{{json .State.Health}}' bat-server-smoke
```

The status moves from `starting` to `healthy`. Use a host port other than
BAT's own server port.

## Uninstallation

Deleting the profile in BAT removes only the local profile; the container keeps
running. To remove everything:

```bash
docker rm -f bat-server-profile
docker volume rm bat-server-bat-server-profile-data
docker rmi bat-server:latest bat-server:<version>
```

Replace `bat-server-profile` with your container name (`docker ps -a`); the
volume is `bat-server-<container-name>-data`.

## Troubleshooting

### Docker daemon unavailable

Start Docker Desktop (or the Docker service on Linux) and retry the first
step. `build:docker-image` and `verify:docker-image` also fail without a
daemon.

### Image not found

**Start Docker container** fails with Docker's own error (without a local
image `docker run` tries to pull `bat-server:latest` from a registry, where it
does not exist; the exact text was not checked on a Docker host): build the
image (see [Build](#build)) and retry.

### Port in use

- "No free port between 9877 and 9976 …": every port in the range is taken.
- A `docker run` / `docker start` port error: the wizard removed the container
  it created; retry to pick another port.
- **Use existing** on a container published on the port BAT's own server
  listens on: change BAT's server port in Settings, or use **Create new**.

The real Docker error texts were not reproduced on a Docker host for this
guide.

### Container does not become healthy

```bash
docker logs <container-name>
docker inspect --format '{{json .State.Health}}' <container-name>
docker exec <container-name> printenv BAT_SERVER_PORT   # 9876
```

An image from before the BUG-097 fix probes a `/health` route that does not
exist; rebuild it (see [Containers created before the BUG-097 fix](#containers-created-before-the-bug-097-fix)).

### Token not available

"Remote server token was not available after starting the BAT service." means
`server-token.json` could not be read from
`/root/.local/share/bat-server` in the container: check that the server
started (`docker logs`) and that the data directory is writable.

### Image too large

```bash
docker image inspect bat-server:latest --format='{{.Size}}'
```

Confirm the build context contains only the generated tarball.

## Release Pre-Flight Checklist

Manual for now: there is no registry push or CI image publishing.

- `npm run build:server-bundle`, `npm run build:docker-image` and
  `npm run verify:docker-image` succeed; the image stays below 300 MB and
  `linux/amd64`.
- With BAT's own remote server on 9876, **Create new** completes, the profile's
  `remotePort` is the picked host port (9877–9976), and `docker port` shows
  `127.0.0.1:<that port>`.
- **Use existing** on a container published on a port other than 9876
  attaches, keeps that port, and passes the connection test (token read from
  `server-token.json`).
- `healthy` while running; restart, host reboot, crash and stop / start
  scenarios above.
- Cancelling after **Start Docker container** removes a container the run
  created and stops (only) a container the run started.

## Notes

- Local-only; nothing is pushed to a registry.
- `linux/arm64` images are not built.
- Docker on a macOS host is not restricted by the code but has not been tested.
