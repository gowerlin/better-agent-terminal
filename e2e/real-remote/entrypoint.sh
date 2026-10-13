#!/bin/sh
# T0467 container entrypoint: authorized key from the env, host keys, the
# headless bat-server as user `bat` (localhost only), then sshd in the foreground.
set -eu

: "${T0467_AUTHORIZED_KEY:?T0467_AUTHORIZED_KEY is required}"
SERVER_PORT="${T0467_SERVER_PORT:-9876}"

install -d -m 0700 -o bat -g bat /home/bat/.ssh
printf '%s\n' "$T0467_AUTHORIZED_KEY" > /home/bat/.ssh/authorized_keys
chown bat:bat /home/bat/.ssh/authorized_keys
chmod 0600 /home/bat/.ssh/authorized_keys

ssh-keygen -A >/dev/null

install -d -o bat -g bat /home/bat/.local/share/bat-server
su -s /bin/sh bat -c "cd /home/bat && nohup /home/bat/.local/bat-server/bin/bat-server \
  --port $SERVER_PORT --bind-interface localhost --data-dir /home/bat/.local/share/bat-server \
  > /home/bat/bat-server.out 2>&1 &"

exec /usr/sbin/sshd -D -e
