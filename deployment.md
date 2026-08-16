# Deploying Repo2Reputation to Hetzner Cloud

This is the real, tested runbook for this app specifically — not a generic template. Every command here was actually run against the production server on 2026-08-15 and worked. Follow it in order for a repeat deployment (a rebuild, a new environment, disaster recovery) and it should go smoothly with no re-derivation needed.

**Stack**: Postgres, Redis, a Node/Express backend (Puppeteer + Playwright for PDF/scraping), and an nginx-served React frontend — four containers total via `docker-compose.yml` in this repo.

---

## Architecture decisions (why the setup looks the way it does)

### URL topology: one origin, path-based routing

Only two things get a public URL — everything else stays internal:

| Service | Public? |
|---|---|
| Frontend (nginx serving the Vite build) | Yes — `/` |
| Backend (Express) | Yes — reverse-proxied at `/api/*`, **same origin** as the frontend |
| Postgres | No — loopback-only (`127.0.0.1:5432`), never bound to `0.0.0.0` |
| Redis | No — same, loopback-only |

Single origin, path-based routing (`server/` → frontend, `server/api/*` → backend) instead of subdomains: one DNS record if/when a domain gets added, one TLS cert, and same-origin requests mean **zero CORS configuration needed**. Revisit only if frontend and backend ever need independent scaling or deploy cadence — neither applies at this app's scale.

### The Colaberry live-login feature forces `network_mode: host` — this is the load-bearing decision in the whole compose file

`backend/services/colaberryLiveLoginSessionManager.js` shells out to the `docker` CLI directly (sibling-container pattern, not Docker-in-Docker) to spawn/tear down per-session browser containers over the mounted host socket. Those sibling containers publish their ports as `-p 127.0.0.1::PORT` — because the backend talks to the **host's** Docker daemon over the mounted socket, that bind is to the **host's** loopback, not the backend container's own network namespace.

Concretely: `waitForDriverReady()` and `colaberryLiveLoginWsProxy.js` connect to `http://127.0.0.1:<assignedPort>`. Under normal Docker bridge networking, that `127.0.0.1` resolves to the container itself — those connections would simply fail. The fix is that **the backend service runs with `network_mode: host`**, so its `127.0.0.1` really is the host's loopback, matching what the sibling containers publish to.

This one setting cascades into everything else in `docker-compose.yml`:
- Postgres and Redis publish to `127.0.0.1` on the **host** (not an isolated Compose network) — the host-networked backend reaches them via `localhost:<port>`, not Docker DNS service names.
- The frontend/nginx container is *also* `network_mode: host`, for the same reason: its `/api/*` reverse-proxy target (`127.0.0.1:5000`) only resolves correctly under host networking.
- The backend's own port (5000) ends up directly on the host network — the Hetzner Firewall (below) is what keeps it from being publicly reachable, not Compose.
- The `colaberry-live-login` image is *not* part of `docker-compose.yml` — the backend's `docker run` calls resolve it by name against the host daemon's local image cache, so it has to be built once, directly on the host, separately.

**Chose full socket mount over skipping live-login** — accepted the larger blast radius (root-equivalent host access from inside the backend container if it's ever compromised) for full feature parity from day one. This was a deliberate call, not a default.

### Secrets: real credentials carried over, everything else generated fresh on the server

`SQL_SERVER`/`SQL_DATABASE`/`SQL_USER`/`SQL_PASSWORD`, `COLABERRY_LOGIN_URL`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, and `OPENAI_API_KEY` are real external credentials tied to real accounts — these get carried over from `backend/.env`, never regenerated. Everything else (`POSTGRES_*`, `REDIS_PASSWORD`, `JWT_SECRET`, `COLABERRY_SESSION_ENCRYPTION_KEY`, `RESUME_DATA_ENCRYPTION_KEY`, `GITHUB_TOKEN_ENCRYPTION_KEY`) gets generated **fresh, directly on the server** with `openssl rand` — never reused from local dev. A leaked dev `.env` should not also compromise production.

### Access control: Colaberry account required to log in at all

GitHub OAuth alone is not sufficient to use the app — `backend/routes/auth.js`'s `/github/callback` checks every *verified* email on the authenticating GitHub account against `getColaberryUserByEmail()` (`colaberrySqlClient.js`, querying `dbo.ADF_ColaberryActiveUsers`). No match, no account. **Fails closed**: if that SQL Server lookup itself errors (an outage, not a "no match" result), the login is rejected the same as a real non-match — an unverifiable check must never be treated as a passed one. This can only be enforced *after* GitHub OAuth completes (GitHub doesn't reveal a user's email before they authorize), so the frontend's pre-click banner on the login page is guidance, not the actual security boundary — the backend check is.

---

## One-time setup: SSH keys

### Your own login key (if you don't already have one for this server)

```powershell
ssh-keygen -t ed25519 -C "kes-hetzner-portfolio" -f "$env:USERPROFILE\.ssh\hetzner_portfolio"
ssh-add "$env:USERPROFILE\.ssh\hetzner_portfolio"
```
Add the `.pub` file's contents to the server's SSH keys when creating the VM in the Hetzner Console (or `ssh-copy-id` after the fact). Leave the passphrase set for this one — it's your personal daily-driver key for this server.

### Repo-scoped deploy key (run on the server, as the `deploy` user — see below)

A dedicated keypair per repo means a compromised server only ever exposes read access to *this* repo, not everything your GitHub account can reach.

```bash
ssh-keygen -t ed25519 -C "deploy-portfolio" -f ~/.ssh/deploy_portfolio -N ""
cat ~/.ssh/deploy_portfolio.pub
```

Add the printed public key to the repo as a **read-only** deploy key. The fast way (from your own machine, `gh` CLI authenticated):

```bash
gh api repos/KesetebirhanDelele/portfolio/keys -f title="hetzner-deploy-portfolio" -f key="<pasted pubkey>" -F read_only=true
```

Then wire SSH to use it for this repo specifically:

```bash
cat > ~/.ssh/config <<'EOF'
Host github.com-portfolio
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_portfolio
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config ~/.ssh/deploy_portfolio
chmod 644 ~/.ssh/deploy_portfolio.pub

ssh -o StrictHostKeyChecking=accept-new -T git@github.com-portfolio
# Expect: "Hi KesetebirhanDelele/portfolio! You've successfully authenticated..."
```

Clone (or repoint an existing clone's remote) using the alias host, not `github.com` directly:
```bash
git clone git@github.com-portfolio:KesetebirhanDelele/portfolio.git /opt/portfolio
```

---

## Full deployment runbook

Run everything below as `root@<server>` unless a step says otherwise. `$SERVER` = the server's IP or hostname throughout.

### 1. Provision the VM

Hetzner Cloud Console → New Server → Ubuntu 22.04 or newer → add your SSH key → Create. (The current server is `ubuntu-4gb-hel1-1`, running Ubuntu 26.04 LTS.)

### 2. Install Docker CE

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version && docker compose version
```

### 3. Create the non-root `deploy` user

```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 4. Set up the deploy key and clone (as `deploy`)

Follow "One-time setup: SSH keys" above, then:
```bash
mkdir -p /opt/portfolio && chown deploy:deploy /opt/portfolio
su - deploy -c 'git clone git@github.com-portfolio:KesetebirhanDelele/portfolio.git /opt/portfolio'
```

### 5. Configure the Hetzner Firewall

Only two rules needed: SSH from your own IP, HTTP open to everyone. **Never** open 5432/6379/5000 publicly — Postgres/Redis stay loopback-only regardless, and 5000 is meant to be reached only through nginx's proxy on 80.

Fastest, repeatable way — via the Hetzner API (needs an API token: Console → Security → API Tokens → generate with Read & Write; keep it in a local `.env`, never in chat/logs):

```bash
MY_IP=$(curl -s https://api.ipify.org)
SERVER_ID=$(curl -s -H "Authorization: Bearer $HETZNER_API_KEY" "https://api.hetzner.cloud/v1/servers" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).servers[0].id))")

curl -s -X POST "https://api.hetzner.cloud/v1/firewalls" \
  -H "Authorization: Bearer $HETZNER_API_KEY" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"portfolio-firewall\",
    \"rules\": [
      {\"direction\": \"in\", \"protocol\": \"tcp\", \"port\": \"22\", \"source_ips\": [\"${MY_IP}/32\"]},
      {\"direction\": \"in\", \"protocol\": \"tcp\", \"port\": \"80\", \"source_ips\": [\"0.0.0.0/0\", \"::/0\"]}
    ],
    \"apply_to\": [{\"type\": \"server\", \"server\": {\"id\": ${SERVER_ID}}}]
  }"
```

Verify: SSH still works, `curl http://$SERVER/` returns 200, `curl http://$SERVER:5000/` times out (blocked, correct).

If your own IP changes (new location, VPN), update the rule's `source_ips` via `PUT /v1/firewalls/{id}/rules` or you'll lock yourself out of SSH.

**If SSH suddenly starts rejecting a key/password that used to work, check this first** — before troubleshooting keys, passwords, or console access. On 2026-08-16 a stale `source_ips` entry (an old IP no longer in use) cost about two hours of unnecessary console/password debugging that a firewall check would have caught in under a minute. Get the server's current firewall rules with `GET https://api.hetzner.cloud/v1/firewalls/{firewall_id}` (Bearer `HETZNER_API_KEY`) and compare `source_ips` against your actual current IP (`curl -4 ifconfig.me`) before assuming the problem is on the server.

Also, in practice the key actually authorized on this server has been Kes's regular default key (`~/.ssh/id_ed25519`), not a dedicated `hetzner_portfolio` key — the "One-time setup" section above describes the intended, more isolated setup, but no `hetzner_portfolio` key currently exists on Kes's machine. Worth doing properly (a server-specific key, so a compromised personal key doesn't also expose this server) next time SSH access is touched.

### 6. Build the production `.env`

```bash
su - deploy -c '
cd /opt/portfolio
cp .env.production.example .env

# Fresh secrets — never reused from local dev
sed -i "s#^POSTGRES_USER=.*#POSTGRES_USER=r2r_prod#" .env
sed -i "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=$(openssl rand -hex 20)#" .env
sed -i "s#^POSTGRES_DB=.*#POSTGRES_DB=repo2reputation#" .env
sed -i "s#^REDIS_PASSWORD=.*#REDIS_PASSWORD=$(openssl rand -hex 20)#" .env
sed -i "s#^JWT_SECRET=.*#JWT_SECRET=$(openssl rand -hex 32)#" .env
sed -i "s#^COLABERRY_SESSION_ENCRYPTION_KEY=.*#COLABERRY_SESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)#" .env
sed -i "s#^RESUME_DATA_ENCRYPTION_KEY=.*#RESUME_DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)#" .env
sed -i "s#^GITHUB_TOKEN_ENCRYPTION_KEY=.*#GITHUB_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)#" .env
chmod 600 .env
'
```

For the real-credential values (`SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `COLABERRY_LOGIN_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`) — transfer `backend/.env` from your dev machine directly via `scp` (never through a terminal that prints its contents), extract just those keys into the server's `.env`, then shred the transferred copy:

```bash
# from your local machine:
scp backend/.env root@$SERVER:/tmp/.env_transfer

# on the server:
for key in SQL_SERVER SQL_DATABASE SQL_USER SQL_PASSWORD COLABERRY_LOGIN_URL GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET OPENAI_API_KEY; do
  val=$(grep "^${key}=" /tmp/.env_transfer | head -1)
  [ -n "$val" ] && sed -i "s#^${key}=.*#${val}#" /opt/portfolio/.env
done
rm -f /tmp/.env_transfer
```

Finally, set `FRONTEND_URL` — **this is not optional and fails silently if wrong**. It's the exact value the backend uses to build the post-login redirect (`${FRONTEND_URL}/auth/callback?token=...`); getting it wrong doesn't error, it just silently sends every successful login to the wrong place.

```bash
su - deploy -c "sed -i 's#^FRONTEND_URL=.*#FRONTEND_URL=http://${SERVER}#' /opt/portfolio/.env"
```

### 7. Update the GitHub OAuth App's Redirect URI

`github.com/settings/developers` → the app matching `GITHUB_CLIENT_ID` → add a Redirect URI: `${FRONTEND_URL}/api/auth/github/callback` (e.g. `http://<server-ip>/api/auth/github/callback`) → **Update application**. Keep the `localhost:5000` entry too if you still test locally.

This is simpler here than in local dev: because nginx reverse-proxies `/api/*` on the *same* origin as the frontend, `FRONTEND_URL` and the OAuth redirect are identical up to the `/api/` prefix. This is a one-time change you make as the app owner — individual users never see GitHub developer settings, just the normal "Authorize" consent screen.

### 8. Build the `colaberry-live-login` image (once, directly on the host — not part of Compose)

```bash
su - deploy -c 'docker build -t colaberry-live-login /opt/portfolio/backend/services/colaberry-live-login/image/'
```

### 9. Bring the stack up

```bash
su - deploy -c '
cd /opt/portfolio
docker compose up -d --build
docker compose logs migrate    # confirm clean exit, "Migrations complete!"
docker compose ps              # postgres/redis healthy, backend/frontend up
'
```

### 10. Verify Colaberry SQL Server reachability

External dependency, outside our control — worth confirming before a user hits the failure first. If it fails, it needs Ali or Colaberry's infra team to allowlist the server's IP.

```bash
docker exec portfolio-backend-1 node -e "
const { getNetworkProjects } = require('/app/services/colaberrySqlClient');
getNetworkProjects().then(p => console.log('OK -', p.length, 'projects')).catch(e => console.log('FAILED -', e.message));
"
```

### 11. Golden-path test

- Visit `http://$SERVER/` — login page loads.
- "Sign in with GitHub" → authorize → land back on `http://$SERVER/`, logged in.
- Confirm a real row: `docker compose exec postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "SELECT github_username, created_at FROM users;"`.
- Test a Colaberry import (exercises item 10 for real).
- If testing live-login: confirm a session actually starts — this is the one piece that specifically validates the `network_mode: host` + Docker-socket design end-to-end.

---

## Updating the app after this initial deploy

```bash
su - deploy -c '
cd /opt/portfolio
git pull origin main    # or whichever branch is live
docker compose up -d --build
docker compose logs migrate
docker compose ps
'
```
Code is baked into images at build time — `docker compose restart <service>` alone will **not** pick up new code. Always `--build`.

---

## Operational commands

```bash
docker compose ps                                    # status
docker compose logs -f backend                        # follow backend logs
docker compose exec backend sh                         # shell into a container
docker compose exec postgres psql -U <user> -d <db>    # query the database
docker compose down                                    # stop everything, keep volumes
docker compose down -v                                 # stop AND wipe data — IRREVERSIBLE
```

## Backups

```bash
# Dump
docker compose exec postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260101.sql | docker compose exec -T postgres psql -U <POSTGRES_USER> <POSTGRES_DB>
```
Always back up before a schema-changing migration.

---

## Deployment checklist (quick reference before any deploy)

- [ ] `.env` present on the server, not committed to git, `chmod 600`
- [ ] Database/Redis/JWT/encryption secrets are fresh, not copied from dev
- [ ] `FRONTEND_URL` matches the real server address
- [ ] GitHub OAuth Redirect URI matches `FRONTEND_URL`
- [ ] Hetzner Firewall: only 22 (your IP) and 80 (any) open
- [ ] `docker compose ps` shows all services healthy
- [ ] `docker compose logs migrate` shows a clean exit
- [ ] Colaberry SQL Server reachability confirmed
- [ ] Golden-path login test passed, with a real DB row confirmed

---

## Path to real production (Colaberry School, not just Kes's testing)

What's live today (raw IP, personal accounts, single server) is a real, working deployment — but "real Colaberry School production, real student load" changes a few things beyond what's built so far. None of this is decided yet; it's written down here so the questions aren't lost, and so nothing below gets executed without an explicit decision first.

### Domain and TLS

Raw IP + plain HTTP was the deliberate choice for getting to a working deployment fast (see "Architecture decisions" above). Real institutional use needs:
- A real domain/subdomain (e.g. `portfolio.colaberry.com`) with a DNS **A record** pointed at the server.
- Certbot or Caddy for a free, auto-renewing Let's Encrypt certificate — mechanical once the domain exists.
- nginx updated to terminate TLS on 443 and redirect 80 → 443.

**Blocking question, not mine to decide**: whose domain? If Colaberry doesn't already have one to use a subdomain of, registering one is a new paid external dependency — an "escalate" item under this repo's own `CLAUDE.md` Autonomy Model, not an implementation detail.

### Infrastructure and credential ownership

Right now, everything runs on Kes's personal accounts:
- The Hetzner server itself.
- The GitHub OAuth App (`Repo2Reputation`, registered under `KesetebirhanDelele`).
- The OpenAI API key (billed personally).

For a tool Colaberry School depends on operationally, this is a real bus-factor and governance risk — access and continuity currently depend on one person's personal accounts staying active and reachable. Moving infrastructure ownership and billing to a Colaberry-controlled account is itself a **production infrastructure change** under this repo's Autonomy Model — requires Ali's sign-off, not something to execute unilaterally.

### Reliability, for real (not test) student load

- **Automated backups.** The `pg_dump` command under "Backups" above is manual — for real use it needs a cron job with retention, not a command someone remembers to run.
- **Real error tracking.** `@sentry/node` is already wired in (M66) but inert — no `SENTRY_DSN` set, no Sentry project exists yet. Turning this on is cheap once someone creates the project.
- **A staging environment**, separate from production, so testing new features doesn't risk real student data or a live outage during class hours.
- **CI/CD** instead of manual SSH deploys, once change frequency picks up past what one person reasonably tracks by hand.

### Compliance / data privacy

If this ends up handling real student data at institutional scale (names, emails, GitHub activity, resume content), that may cross into territory needing an actual privacy/compliance review (e.g., FERPA-adjacent considerations for an educational tool) — flagged here as a real open question, not evaluated or resolved. Per this repo's own `CLAUDE.md`, compliance/security posture changes are an escalation trigger, not an implementation decision.

**Bottom line**: domain + infrastructure ownership is the practical blocker — once decided, TLS/backups/monitoring/staging are mechanical follow-up work. Everything in this section needs Kes and Ali's decision before execution, not a unilateral build.
