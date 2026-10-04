FROM debian:bookworm-slim

WORKDIR /opt/bat-server

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/*

COPY dist-server/bat-server-linux-x64-*.tar.gz /tmp/bundle.tar.gz

RUN tar xzf /tmp/bundle.tar.gz -C /opt/bat-server --strip-components=1 \
  && rm /tmp/bundle.tar.gz

# bat-server reads BAT_SERVER_PORT when no --port is given (scripts/bat-server.mjs);
# the HEALTHCHECK below probes the same variable.
ENV BAT_SERVER_PORT=9876
ENV NODE_ENV=production

EXPOSE 9876

# BUG-097: RemoteServer is a TLS/WSS endpoint with no HTTP routes, so probe
# liveness with a TLS handshake using the bundled node runtime (no /health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD /opt/bat-server/bin/node -e 'const s=require("tls").connect({host:"127.0.0.1",port:Number(process.env.BAT_SERVER_PORT),rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1

# BUG-097: bind to all container interfaces so the docker port forward can
# reach the server. Safe only because the host side publishes on 127.0.0.1
# (electron/docker-lifecycle.ts `-p 127.0.0.1:<port>:9876`).
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/bat-server/bin/bat-server", "--bind-interface", "all"]
