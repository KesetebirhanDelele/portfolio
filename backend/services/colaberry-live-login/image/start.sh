#!/bin/bash
set -e

DISPLAY_NUM=99
export DISPLAY=:${DISPLAY_NUM}

echo "[start] starting Xvfb on display :${DISPLAY_NUM}"
Xvfb :${DISPLAY_NUM} -screen 0 1280x800x24 &

for i in $(seq 1 20); do
  if xdpyinfo -display :${DISPLAY_NUM} >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "[start] starting x11vnc"
x11vnc -display :${DISPLAY_NUM} -forever -shared -nopw -rfbport 5900 -bg -o /var/log/x11vnc.log

echo "[start] starting websockify + noVNC web UI on 6080"
websockify --web=/usr/share/novnc 6080 localhost:5900 &

sleep 1

echo "[start] starting Playwright driver (control API on 7000)"
cd /app
exec node driver.js
