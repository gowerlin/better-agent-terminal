# T0515 — SSH targets for e2e/pre6-wizard-acceptance.spec.ts (opt-in, never run by CI).
#
# Same shape as t0510-sshd.Dockerfile (systemd as PID 1, real logind / user managers / polkit,
# nothing BAT-specific preinstalled: the SSH wizard under test uploads the bundle and starts the
# systemd user service), with T0515's own label and two differences:
#   - no `AllowUsers` line: the env script adds a second account named like the Windows login
#     on bat-t0515-target (W10, an alias without `User`); key login is still the only way in
#   - netcat-openbsd: W7 / W8 start a listener owned by the "user" on the server port to make
#     start-server fail, and check that rollback leaves it alone
# Built and run by e2e/real-remote/t0515-wizard-env.mjs inside WSL's Docker. One image, two
# containers:
#   bat-t0515-jump    published on 127.0.0.1:<port>; also the ProxyJump hop
#   bat-t0515-target  on the private network only — reachable from Windows only via the jump
#
# Build context (assembled by the env script): authorized_keys (the run's public key).
FROM debian:bookworm-slim

LABEL bat.t0515="1"
ENV container=docker

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    systemd systemd-sysv dbus dbus-user-session libpam-systemd polkitd \
    openssh-server ca-certificates procps iproute2 netcat-openbsd \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/bash bat \
  && printf '%s\n' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'AllowTcpForwarding yes' \
    'X11Forwarding no' \
    'LogLevel VERBOSE' \
    > /etc/ssh/sshd_config.d/t0515.conf \
  && systemctl enable ssh \
  && systemctl mask getty@tty1.service console-getty.service \
  && echo "bat-t0515 ssh target" > /etc/bat-t0515-marker

COPY authorized_keys /home/bat/.ssh/authorized_keys
COPY authorized_keys /etc/bat-t0515-authorized_keys
RUN chown -R bat:bat /home/bat/.ssh \
  && chmod 0700 /home/bat/.ssh \
  && chmod 0600 /home/bat/.ssh/authorized_keys

EXPOSE 22
STOPSIGNAL SIGRTMIN+3
CMD ["/lib/systemd/systemd"]
