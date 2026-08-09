#!/bin/bash
set -e

DISPLAY_NUM=99
export DISPLAY=:${DISPLAY_NUM}

echo "[poc] starting Xvfb on display :${DISPLAY_NUM}"
Xvfb :${DISPLAY_NUM} -screen 0 1280x800x24 &
XVFB_PID=$!

# wait for the display to actually accept connections
for i in $(seq 1 20); do
  if xdpyinfo -display :${DISPLAY_NUM} >/dev/null 2>&1; then
    echo "[poc] Xvfb ready after ${i} attempt(s)"
    break
  fi
  sleep 0.5
done

echo "[poc] starting x11vnc on :${DISPLAY_NUM}, port 5900"
x11vnc -display :${DISPLAY_NUM} -forever -shared -nopw -rfbport 5900 -bg -o /var/log/x11vnc.log

echo "[poc] starting websockify + noVNC web UI on port 6080"
websockify --web=/usr/share/novnc 6080 localhost:5900 &
WS_PID=$!

sleep 2

echo "[poc] launching chromium under Xvfb"
google-chrome --no-sandbox --disable-gpu --window-size=1280,800 --window-position=0,0 \
  "https://example.com" &
CHROME_PID=$!

sleep 4
echo "[poc] capturing screenshot for verification -> /tmp/poc-screenshot.png"
DISPLAY=:${DISPLAY_NUM} import -window root /tmp/poc-screenshot.png || echo "[poc] screenshot capture failed"

echo "[poc] processes: xvfb=${XVFB_PID} websockify=${WS_PID} chromium=${CHROME_PID}"
echo "[poc] noVNC web UI:  http://localhost:6080/vnc.html"
echo "[poc] raw VNC port:  5900"

# keep the container alive so the ports stay reachable for verification
tail -f /dev/null
