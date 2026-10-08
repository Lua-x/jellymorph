#!/bin/sh
# Jellymorph container entrypoint (docs/architecture.md §15).
#
# Validates the environment, writes config.js, the web manifest and the nginx site into
# /tmp/jellymorph, then runs the command (nginx). An invalid value stops the container with a
# message naming the variable, so a typo never goes unnoticed. Nothing is written outside /tmp,
# so the image runs with a read-only root filesystem.
set -eu

html_dir=${JELLYMORPH_HTML_DIR:-/usr/share/nginx/html}
template_dir=${JELLYMORPH_TEMPLATE_DIR:-/etc/jellymorph}
out_dir=${JELLYMORPH_RUNTIME_DIR:-/tmp/jellymorph}

# Keep in sync with src/config/theme-ids.ts (checked by src/config/theme-ids.test.ts).
theme_ids="default neon-grid crimson glass horizon constellation"

# http(s), host name or [IPv6], optional port and base path. No query, user info or spaces, so the
# value can go into JSON, the CSP and the nginx configuration without escaping.
url_pattern='^https?://([A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(/[A-Za-z0-9._~%-]+)*$'

log() {
  printf 'jellymorph: %s\n' "$*" >&2
}

fail() {
  log "$*"
  exit 1
}

# true or false; empty means the default ($3).
read_bool() {
  case "$2" in
    "") printf '%s' "$3" ;;
    true | false) printf '%s' "$2" ;;
    *) fail "$1 must be true or false (got \"$2\")." ;;
  esac
}

# An http(s) URL without trailing slash; empty stays empty.
read_url() {
  value=$2
  while :; do
    case "$value" in
      */) value=${value%/} ;;
      *) break ;;
    esac
  done
  if [ -z "$value" ]; then
    return 0
  fi
  if ! printf '%s\n' "$value" | grep -Eq "$url_pattern"; then
    fail "$1 must be an http(s) address such as http://jellyfin:8096 (got \"$2\")."
  fi
  printf '%s' "$value"
}

# scheme://host[:port] of a URL.
origin_of() {
  printf '%s' "$1" | sed -E 's#^(https?://[^/]+).*$#\1#'
}

# A JSON string literal. Control characters are already removed, so only \ and " need escaping.
json_string() {
  printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

json_or_null() {
  if [ -z "$1" ]; then
    printf 'null'
  else
    json_string "$1"
  fi
}

# --- Read and check the environment -----------------------------------------------------------

jellyfin_url=$(read_url JELLYFIN_URL "${JELLYFIN_URL:-}")
proxy_target=$(read_url JELLYFIN_PROXY_TARGET "${JELLYFIN_PROXY_TARGET:-}")
lock_server=$(read_bool LOCK_SERVER "${LOCK_SERVER:-}" false)
demo_mode=$(read_bool DEMO_MODE "${DEMO_MODE:-}" false)

default_theme=${DEFAULT_THEME:-default}
case "$default_theme" in
  *[!a-z-]*) fail "DEFAULT_THEME must be one of: $theme_ids (got \"$default_theme\")." ;;
esac
case " $theme_ids " in
  *" $default_theme "*) ;;
  *) fail "DEFAULT_THEME must be one of: $theme_ids (got \"$default_theme\")." ;;
esac

app_title=$(printf '%s' "${APP_TITLE:-}" | tr -d '\000-\037\177' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
if [ -z "$app_title" ]; then
  app_title=Jellymorph
fi

if [ "$lock_server" = true ] && [ -z "$jellyfin_url" ] && [ -z "$proxy_target" ]; then
  fail "LOCK_SERVER=true needs JELLYFIN_URL (or JELLYFIN_PROXY_TARGET)."
fi

proxy_path=""
if [ -n "$proxy_target" ]; then
  proxy_path=/jellyfin
fi

# Which servers the browser may talk to (docs/architecture.md §14). Demo mode and the proxy stay on
# the own origin; a locked server is exactly one origin; otherwise users may add any server.
if [ "$demo_mode" = true ]; then
  mode="demo"
  jellyfin_sources=""
  socket_sources=""
elif [ -n "$proxy_target" ]; then
  mode="proxy to $proxy_target"
  jellyfin_sources=""
  socket_sources=""
elif [ "$lock_server" = true ]; then
  mode="fixed server $jellyfin_url"
  jellyfin_sources=" $(origin_of "$jellyfin_url")"
  socket_sources=$(printf '%s' "$jellyfin_sources" | sed 's#http#ws#')
else
  mode="any server"
  jellyfin_sources=" https: http:"
  socket_sources=" wss: ws:"
fi

csp="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'"
csp="$csp; img-src 'self' data: blob:$jellyfin_sources; media-src 'self' blob:$jellyfin_sources"
csp="$csp; connect-src 'self'$jellyfin_sources$socket_sources; worker-src 'self' blob:"
csp="$csp; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
csp="$csp; frame-ancestors 'none'"

permissions="fullscreen=(self), picture-in-picture=(self), autoplay=(self), screen-wake-lock=(self)"
permissions="$permissions, camera=(), microphone=(), geolocation=(), payment=(), usb=()"

# --- Write the runtime files -------------------------------------------------------------------

mkdir -p "$out_dir"

cat > "$out_dir/config.js" << EOF
window.__APP_CONFIG__ = {
  "jellyfinUrl": $(json_or_null "$jellyfin_url"),
  "lockServer": $lock_server,
  "proxyPath": $(json_or_null "$proxy_path"),
  "defaultTheme": $(json_string "$default_theme"),
  "appTitle": $(json_string "$app_title"),
  "demoMode": $demo_mode
};
EOF

# The app name in the web manifest follows APP_TITLE.
JM_TITLE_JSON=$(json_string "$app_title") awk '
  /^  "name": / { print "  \"name\": " ENVIRON["JM_TITLE_JSON"] ","; next }
  /^  "short_name": / { print "  \"short_name\": " ENVIRON["JM_TITLE_JSON"] ","; next }
  { print }
' "$html_dir/manifest.webmanifest" > "$out_dir/manifest.webmanifest"

cat > "$out_dir/headers.conf" << EOF
add_header Content-Security-Policy "$csp" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "$permissions" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
EOF

listen_ipv6=""
if [ -f /proc/net/if_inet6 ]; then
  listen_ipv6="listen [::]:8080 default_server;"
fi
JM_LISTEN_IPV6=$listen_ipv6 envsubst '${JM_LISTEN_IPV6}' \
  < "$template_dir/nginx.conf.template" > "$out_dir/site.conf"

if [ -n "$proxy_target" ]; then
  proxy_host=$(printf '%s' "$proxy_target" | sed -E 's#^https?://(\[[^]]*\]|[^:/]+).*$#\1#')
  resolver_directive=""
  # IP addresses need no resolver; host names are looked up per request. nginx does not read
  # /etc/resolv.conf itself, and zone-scoped IPv6 servers (fe80::1%eth0) are not supported.
  case "$proxy_host" in
    \[*\]) ;;
    *[!0-9.]*)
      servers=$(awk '$1 == "nameserver" && $2 !~ /%/ {
        server = $2
        if (server ~ /:/) server = "[" server "]"
        printf "%s%s", separator, server
        separator = " "
      }' /etc/resolv.conf 2> /dev/null || true)
      if [ -z "$servers" ]; then
        fail "JELLYFIN_PROXY_TARGET needs a DNS server in /etc/resolv.conf to resolve $proxy_host."
      fi
      resolver_directive="resolver $servers valid=10s; resolver_timeout 5s;"
      ;;
    *) ;;
  esac
  JM_PROXY_TARGET=$proxy_target JM_RESOLVER_DIRECTIVE=$resolver_directive \
    envsubst '${JM_PROXY_TARGET} ${JM_RESOLVER_DIRECTIVE}' \
    < "$template_dir/proxy.conf.template" > "$out_dir/proxy.conf"
else
  : > "$out_dir/proxy.conf"
fi

log "server: $mode; default theme: $default_theme; title: $app_title"

exec "$@"
