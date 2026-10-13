# T0510 — SSH targets for e2e/pre5-ssh-alias.spec.ts (opt-in, never run by CI).
#
# Built and run by e2e/real-remote/t0510-ssh-alias-env.mjs inside WSL's Docker. Unlike the
# T0467 image, nothing BAT-specific is preinstalled: the SSH wizard under test uploads the
# server bundle and starts it as a systemd user service (`loginctl enable-linger` +
# `systemctl --user enable --now bat-server`), so systemd runs as PID 1 and logind / user
# managers / polkit are real. One image, two containers:
#   bat-t0510-jump    published on 127.0.0.1:22 and 127.0.0.1:<port>; also the ProxyJump hop
#   bat-t0510-target  on the private network only — reachable from Windows only via the jump
#
# Build context (assembled by the env script): authorized_keys (the run's public key).
FROM debian:bookworm-slim

LABEL bat.t0510="1"
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
    'AllowUsers bat' \
    'AllowTcpForwarding yes' \
    'X11Forwarding no' \
    'LogLevel VERBOSE' \
    > /etc/ssh/sshd_config.d/t0510.conf \
  && systemctl enable ssh \
  && systemctl mask getty@tty1.service console-getty.service \
  && echo "bat-t0510 ssh target" > /etc/bat-t0510-marker

COPY authorized_keys /home/bat/.ssh/authorized_keys
RUN chown -R bat:bat /home/bat/.ssh \
  && chmod 0700 /home/bat/.ssh \
  && chmod 0600 /home/bat/.ssh/authorized_keys

EXPOSE 22
STOPSIGNAL SIGRTMIN+3
CMD ["/lib/systemd/systemd"]
