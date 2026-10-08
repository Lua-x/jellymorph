# syntax=docker/dockerfile:1
# Jellymorph – static web client served by unprivileged nginx (docs/architecture.md §15).

# Build on the machine's own platform: the output is static files, identical for every target
# architecture, so arm64 images need no emulated Node build.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && rm -rf dist/.vite

FROM nginxinc/nginx-unprivileged:1.31-alpine

USER root
# The directory is created here: COPY --chmod would give a new directory the file mode (0644).
RUN rm -f /etc/nginx/conf.d/*.conf && mkdir -p /etc/jellymorph
COPY --chmod=0644 docker/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=0644 docker/nginx.conf.template docker/proxy.conf.template /etc/jellymorph/
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/jellymorph-entrypoint
COPY --from=build /app/dist /usr/share/nginx/html
USER 101

ENV JELLYFIN_URL="" \
    LOCK_SERVER="false" \
    JELLYFIN_PROXY_TARGET="" \
    DEFAULT_THEME="default" \
    APP_TITLE="Jellymorph" \
    DEMO_MODE="false"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/jellymorph-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
