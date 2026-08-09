FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    imagemagick \
    net-tools \
    fonts-liberation \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm -f /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

# noVNC web page
EXPOSE 6080
# raw VNC (debug only, not exposed in the real app)
EXPOSE 5900

ENTRYPOINT ["/start.sh"]
