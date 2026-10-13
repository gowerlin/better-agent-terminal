# T0467 — SSH target for e2e/plan039-real-remote.spec.ts (opt-in, never run by CI).
#
# Built and run by e2e/real-remote/plan039-real-remote-env.mjs inside WSL's Docker.
# One container = sshd (key login only, user `bat`) + its own headless bat-server
# bound to the container's localhost — BAT reaches it the way it reaches any
# ssh-linux profile: `ssh -N -L <local>:localhost:<serverPort>`.
#
# Build context (assembled by the env script):
#   bat-server.tar.gz   a linux-x64 server bundle (dist-baseline/)
#   overlay/remote/     the current source's headless JS (scripts/dev-deploy-headless.mjs staging)
#   overlay/scripts/    the bundle helper scripts (bat-terminal.mjs / bat-notify.mjs / …)
#   entrypoint.sh
FROM debian:bookworm-slim

LABEL bat.t0467="1"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server ca-certificates tini procps \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/sshd \
  && useradd -m -s /bin/bash bat \
  && printf '%s\n' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'AllowUsers bat' \
    'AllowTcpForwarding local' \
    'X11Forwarding no' \
    > /etc/ssh/sshd_config.d/t0467.conf

COPY bat-server.tar.gz /tmp/bundle.tar.gz
RUN mkdir -p /home/bat/.local/bat-server \
  && tar xzf /tmp/bundle.tar.gz -C /home/bat/.local/bat-server --strip-components=1 \
  && rm /tmp/bundle.tar.gz
COPY overlay/remote/ /home/bat/.local/bat-server/electron/remote/
COPY overlay/scripts/ /home/bat/.local/bat-server/scripts/
COPY entrypoint.sh /usr/local/bin/t0467-entrypoint
RUN chmod 0755 /usr/local/bin/t0467-entrypoint \
  && echo "bat-t0467 ssh server (S)" > /etc/bat-t0467-marker \
  && chown -R bat:bat /home/bat

EXPOSE 22
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/t0467-entrypoint"]
