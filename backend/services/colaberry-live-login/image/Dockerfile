FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates curl \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    fonts-liberation \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm -f /tmp/chrome.deb \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev

COPY driver.js .
COPY start.sh /start.sh
RUN chmod +x /start.sh

# noVNC web UI + websocket bridge (only reachable inside the Docker network —
# the backend proxies it, never published to the public internet directly)
EXPOSE 6080
# internal control API (driver.js) — session-manager only, never public
EXPOSE 7000

ENTRYPOINT ["/start.sh"]
