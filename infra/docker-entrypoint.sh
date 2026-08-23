#!/bin/sh
# The container's first ten lines, and all three of them earn their place.
set -eu

# 1. Cloud Run injects PORT. The daemon reads ISOCAN_PORT. Rather than teach
#    the daemon a variable name that exactly one host in the world uses, the
#    translation happens here, where it is visible. 8080 is Cloud Run's default
#    and a fine default for `docker run` too.
export ISOCAN_PORT="${ISOCAN_PORT:-${PORT:-8080}}"

# 2. ISOCAN_HOME must EXIST before the daemon starts: `startDaemon` writes
#    daemon.json into it unconditionally, and on the cloud backing nothing else
#    ever creates the directory (FileStore.init would have; CloudStore has no
#    reason to). Without this line the container dies at boot with an ENOENT
#    that names a path nobody configured.
mkdir -p "${ISOCAN_HOME:-/tmp/isocan}"

# 3. Bind. Empty by default so a plain `docker run` of this image still refuses
#    the world unless asked; the Dockerfile sets it to 0.0.0.0 because a
#    container that binds loopback is a container nothing can reach.
: "${ISOCAN_BIND:=127.0.0.1}"
export ISOCAN_BIND

# `exec` so the daemon is the process tini signals, and so SIGTERM reaches the
# handler `runDaemon` installed rather than this shell.
exec node --import tsx packages/server/src/main.ts
