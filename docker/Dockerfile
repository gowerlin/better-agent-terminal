FROM debian:bookworm-slim

WORKDIR /opt/bat-server

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/*

COPY dist-server/bat-server-linux-x64-*.tar.gz /tmp/bundle.tar.gz

RUN tar xzf /tmp/bundle.tar.gz -C /opt/bat-server --strip-components=1 \
  && rm /tmp/bundle.tar.gz

ENV BAT_PORT=9876
ENV NODE_ENV=production

EXPOSE 9876

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fk https://127.0.0.1:${BAT_PORT}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/opt/bat-server/bin/bat-server"]
