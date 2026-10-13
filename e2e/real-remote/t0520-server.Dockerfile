# T0520 — headless remote target for e2e/pre7-acceptance.spec.ts (opt-in, never run by CI).
#
# Built and run by e2e/real-remote/t0520-env.mjs inside WSL's Docker. Same shape as
# t0514-server.Dockerfile (T0514, left unchanged): the stock pre.7 headless bat-server from the
# linux-x64 baseline tarball shipped inside the installed BAT, no source overlay, listening on
# 0.0.0.0:9876 inside the container and published on the Windows side as 127.0.0.1:<port> only.
#
# Its `profile:list` is the headless stub ({ profiles: [], activeProfileIds: [] }) — the trigger
# of BUG-123 (V1). The skill / command fixtures of e2e/fixtures/t0520-skill-fixtures.json sit
# under /work (project) and /home/bat (global, incl. a ct-help without description) so that
# `claude:scan-skills` / `claude:scan-star-commands` from a remote window run the pre.7 bundle's
# own code (V6). Build context (assembled by the env script): bat-server.tar.gz, fixture-work/,
# fixture-home/.
FROM debian:bookworm-slim

LABEL bat.t0520="1"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini procps \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/bash bat

COPY bat-server.tar.gz /tmp/bundle.tar.gz
RUN mkdir -p /home/bat/.local/bat-server \
  && tar xzf /tmp/bundle.tar.gz -C /home/bat/.local/bat-server --strip-components=1 \
  && rm /tmp/bundle.tar.gz \
  && test -x /home/bat/.local/bat-server/bin/bat-server

COPY fixture-work/ /work/
COPY fixture-home/ /home/bat/
RUN mkdir -p /home/bat/.local/share/bat-server \
  && echo 'T0520 remote file (bat-t0520-srv)' > /work/t0520-remote-marker.txt \
  && chown -R bat:bat /work /home/bat

USER bat
WORKDIR /home/bat
EXPOSE 9876
ENTRYPOINT ["/usr/bin/tini", "--", "/home/bat/.local/bat-server/bin/bat-server", \
  "--port", "9876", "--bind-interface", "all", "--data-dir", "/home/bat/.local/share/bat-server"]
