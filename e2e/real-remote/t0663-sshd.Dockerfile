# T0663 — SSH target for e2e/v071-pre2-acceptance.spec.ts (opt-in, never run by CI).
#
# A plain sshd that accepts no key at all: account `bat` has an empty authorized_keys and password /
# keyboard-interactive login is off, so every login ends in `Permission denied (publickey)`. Only used
# to make the SSH wizard's verify-auth step fail the way BUG-158's message is about. No systemd, nothing
# BAT-specific. Built and run by e2e/real-remote/t0663-env.mjs inside WSL's Docker
# (`bat-t0663-sshd`, label bat.t0663=1, published on 127.0.0.1 only).
FROM debian:bookworm-slim

LABEL bat.t0663="1"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/bash bat \
  && install -d -m 0700 -o bat -g bat /home/bat/.ssh \
  && install -m 0600 -o bat -g bat /dev/null /home/bat/.ssh/authorized_keys \
  && mkdir -p /run/sshd \
  && printf '%s\n' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'LogLevel VERBOSE' \
    > /etc/ssh/sshd_config.d/t0663.conf \
  && echo "bat-t0663 ssh target (no keys accepted)" > /etc/bat-t0663-marker

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D", "-e"]
