# T0520 — SSH target for the setup-wizard part of e2e/pre7-acceptance.spec.ts (V2 / V3; opt-in,
# never run by CI).
#
# Same shape as t0515-sshd.Dockerfile (T0515, left unchanged): systemd as PID 1, real logind /
# user managers / polkit, nothing BAT-specific preinstalled — the SSH wizard under test uploads the
# pre.7 bundle and starts the systemd user service. One account (`bat`, key login only). The spec
# turns forwarding off with a higher-priority drop-in (`00-t0520-noforward.conf`, first value wins)
# for V2 (BUG-124) and removes it again for V3.
# Built and run by e2e/real-remote/t0520-env.mjs inside WSL's Docker as `bat-t0520-sshd`,
# published on 127.0.0.1:<port> only. Build context: authorized_keys (the run's public key).
FROM debian:bookworm-slim

LABEL bat.t0520="1"
ENV container=docker

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    systemd systemd-sysv dbus dbus-user-session libpam-systemd polkitd \
    openssh-server ca-certificates procps iproute2 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/bash bat \
  && printf '%s\n' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'AllowTcpForwarding yes' \
    'X11Forwarding no' \
    'LogLevel VERBOSE' \
    > /etc/ssh/sshd_config.d/t0520.conf \
  && systemctl enable ssh \
  && systemctl mask getty@tty1.service console-getty.service \
  && echo "bat-t0520 ssh target" > /etc/bat-t0520-marker

COPY authorized_keys /home/bat/.ssh/authorized_keys
RUN chown -R bat:bat /home/bat/.ssh \
  && chmod 0700 /home/bat/.ssh \
  && chmod 0600 /home/bat/.ssh/authorized_keys

EXPOSE 22
STOPSIGNAL SIGRTMIN+3
CMD ["/lib/systemd/systemd"]
