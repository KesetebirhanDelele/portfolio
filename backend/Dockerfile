# mcr.microsoft.com/playwright pins an exact Chromium build to an exact
# Playwright npm version and preinstalls every OS-level shared library
# headless Chromium needs — matches backend/package.json's ^1.62.1. Puppeteer
# (services/pdfGenerator.js) downloads its own Chromium during npm install;
# it runs fine on top of the same base image since the OS deps are shared.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

# colaberryLiveLoginSessionManager.js shells out to the `docker` binary
# directly (sibling-container pattern over the mounted host socket) — the
# CLI has to exist in this image, no daemon needed here.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg unzip \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    # Ensure the Chromium build npm actually resolved (package.json uses a
    # caret range, so the installed patch version can drift from the tag
    # above) has matching browser binaries, not just the base image's build.
    && npx playwright install --with-deps chromium

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
