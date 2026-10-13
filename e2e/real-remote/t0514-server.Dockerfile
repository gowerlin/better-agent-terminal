# T0514 — remote target for e2e/pre6-ui-remote-acceptance.spec.ts (opt-in, never run by CI).
#
# Built and run by e2e/real-remote/t0514-env.mjs inside WSL's Docker. One container =
# the stock pre.6 headless bat-server (the linux-x64 baseline tarball shipped inside the
# installed BAT, no overlay), listening on 0.0.0.0:9876 inside the container and published
# on the Windows side as 127.0.0.1:<port> only. The isolated BAT instance under test reaches
# it as a docker-linux remote profile (host path C:\bat-t0514-virt\work <-> /work).
#
# /work is a git repo with markers only this container has, so a call that runs on the
# Windows machine instead (fail-open) or with an untranslated path cannot produce them:
#   - commit "T0514-REMOTE-MARKER"            (git:log / git-scaffold:listCommits)
#   - t0514-remote-marker.txt                  (fs:readdir / fs:readFile)
#   - .claude/commands/t0514-remote-skill.md   (claude:scan-skills)
#   - ~/.claude/projects/-work/<uuid>.jsonl    (claude:list-sessions)
#   - /usr/local/bin/gh (fake)                 (github:*: answers with its own $PWD)
FROM debian:bookworm-slim

LABEL bat.t0514="1"

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tini procps \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/bash bat

COPY bat-server.tar.gz /tmp/bundle.tar.gz
RUN mkdir -p /home/bat/.local/bat-server \
  && tar xzf /tmp/bundle.tar.gz -C /home/bat/.local/bat-server --strip-components=1 \
  && rm /tmp/bundle.tar.gz \
  && test -x /home/bat/.local/bat-server/bin/bat-server

COPY gh /usr/local/bin/gh
COPY seed-session.jsonl /tmp/seed-session.jsonl
RUN chmod 0755 /usr/local/bin/gh \
  && mkdir -p /work/.claude/commands /home/bat/.claude/projects/-work /home/bat/.local/share/bat-server \
  && printf '%s\n' '---' 'description: T0514 remote-only skill' '---' 'T0514 remote skill body' > /work/.claude/commands/t0514-remote-skill.md \
  && echo 'T0514 remote file (bat-t0514-srv)' > /work/t0514-remote-marker.txt \
  && mv /tmp/seed-session.jsonl /home/bat/.claude/projects/-work/5140d514-0514-4514-8514-000000005140.jsonl \
  && chown -R bat:bat /work /home/bat \
  && su -s /bin/sh bat -c 'git config --global user.email t0514@example.invalid \
    && git config --global user.name T0514 \
    && git config --global init.defaultBranch main \
    && cd /work && git init -q \
    && git remote add origin https://github.com/bat-t0514/fake-repo.git \
    && git add -A && git commit -q -m "T0514-REMOTE-MARKER commit"'

USER bat
WORKDIR /home/bat
EXPOSE 9876
ENTRYPOINT ["/usr/bin/tini", "--", "/home/bat/.local/bat-server/bin/bat-server", \
  "--port", "9876", "--bind-interface", "all", "--data-dir", "/home/bat/.local/share/bat-server"]
