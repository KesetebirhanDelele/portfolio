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

### Normal Compose networking — no host networking, no Docker socket mount (as of the 2026-08-19/20 SQL-only Colaberry import work)

**Historical note, kept for context:** this stack used to run `backend` and `frontend` with `network_mode: host` and a mounted `/var/run/docker.sock`, because `colaberryLiveLoginSessionManager.js` spawned sibling browser containers (over the mounted socket) that published their ports to the **host's** `127.0.0.1` — reachable only if the backend shared the host's network namespace too. That was a deliberate call at the time: full live-login feature parity, accepting the larger blast radius (root-equivalent host access from inside the backend container if it were ever compromised).

**That tradeoff is gone.** As of PROGRESS.md M101/M102, Colaberry project import is SQL-only — it never drives live-login at all, and the feature is structurally unreachable through the UI (confirmed by tracing every code path that could open it; see that session's investigation). A fresh deployment has no reason to accept that blast radius for a feature nothing can trigger, so new servers use plain, isolated Compose networking:

- `backend` and `frontend` join Compose's normal default network — no `network_mode: host`, no socket mount.
- `backend` reaches Postgres/Redis by Docker DNS service name (`postgres:5432`, `redis:6379`), not `localhost`.
- `frontend`'s nginx reverse-proxies `/api/*` to `http://backend:5000` (Docker DNS), not `127.0.0.1:5000`.
- `frontend` publishes 80/443 to the host via an explicit Compose port mapping instead of inheriting them from host networking.
- The `colaberry-live-login` sibling-container image never needs building at all — that runbook step (previously "8. Build the colaberry-live-login image") is skipped entirely for new deployments.
- `colaberryLiveLoginSessionManager.js`'s startup-time orphan-container sweep detects the missing socket (`fs.existsSync('/var/run/docker.sock')`) and logs one clear "skipped" line instead of erroring — the app boots clean with no Docker CLI or socket access at all.

The live-login code itself (`colaberryLiveLoginSessionManager.js`, `colaberryLiveLoginWsProxy.js`, the routes, the frontend's "Connect Colaberry"/live-login modal) is **not deleted** — it's dead code pending a separate cleanup pass, per PROGRESS.md M101's plan. This section just documents that new deployments no longer need to accept its infrastructure cost to run the rest of the app.

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

Three rules needed: SSH from your own IP, HTTP and HTTPS open to everyone (80 for certbot's renewal challenge and the plain-HTTP→HTTPS redirect, 443 for the real TLS traffic — see the "Path to real production" TLS section below; this was originally documented as just 80, before TLS landed on 2026-08-16, and never updated — fixed here). **Never** open 5432/6379/5000 publicly — Postgres/Redis stay loopback-only regardless, and 5000 is meant to be reached only through nginx's proxy.

Fastest, repeatable way — via the Hetzner API (needs an API token: Console → Security → API Tokens → generate with Read & Write; keep it in a local `.env`, never in chat/logs):

```bash
MY_IP=$(curl -s https://api.ipify.org)

# If more than one server exists on the account at once (e.g. mid-migration,
# old + new side by side), .servers[0] is NOT guaranteed to be the new one —
# list them all and pick the right id explicitly rather than trusting index 0:
curl -s -H "Authorization: Bearer $HETZNER_API_KEY" "https://api.hetzner.cloud/v1/servers" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{JSON.parse(d).servers.forEach(s=>console.log(s.id, s.name, s.public_net.ipv4.ip))})"
# then:
SERVER_ID=<the id that matches the NEW server's name/IP from the listing above>

curl -s -X POST "https://api.hetzner.cloud/v1/firewalls" \
  -H "Authorization: Bearer $HETZNER_API_KEY" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"portfolio-firewall\",
    \"rules\": [
      {\"direction\": \"in\", \"protocol\": \"tcp\", \"port\": \"22\", \"source_ips\": [\"${MY_IP}/32\"]},
      {\"direction\": \"in\", \"protocol\": \"tcp\", \"port\": \"80\", \"source_ips\": [\"0.0.0.0/0\", \"::/0\"]},
      {\"direction\": \"in\", \"protocol\": \"tcp\", \"port\": \"443\", \"source_ips\": [\"0.0.0.0/0\", \"::/0\"]}
    ],
    \"apply_to\": [{\"type\": \"server\", \"server\": {\"id\": ${SERVER_ID}}}]
  }"
```

Verify: SSH still works, `curl http://$SERVER/` returns a redirect to the nip.io HTTPS origin (200 once TLS is up in step 9+ below), `curl http://$SERVER:5000/` times out (blocked, correct).

If your own IP changes (new location, VPN), update the rule's `source_ips` via the Hetzner API or you'll lock yourself out of SSH. **See "Troubleshooting: Recovering SSH Access" below the first time this happens** — check the firewall before touching keys, passwords, or the console.

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

### 8. ~~Build the `colaberry-live-login` image~~ — skipped

Not needed as of the "Normal Compose networking" architecture change above — the live-login sibling-container image is only ever used by a feature that's now structurally unreachable. Nothing in this step applies to a new deployment; kept here only so the step numbering below matches history.

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
- Test a Colaberry import (exercises item 10 for real) — SQL-only as of M101/M102, no live-login step involved.
- Live-login itself is not part of the golden path for a new deployment — it's dead code (structurally unreachable via the UI), and new servers don't even mount the Docker socket it would need. Nothing to test here.

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

## Troubleshooting: Recovering SSH Access

On 2026-08-16, SSH access broke and took roughly two hours to recover — almost entirely because the actual cause (a stale firewall rule) wasn't checked first, so time went into console keyboard workarounds and password resets that were never going to fix it. This section exists so that never happens again. **Read step 1 before doing anything else.**

### Step 1: Check the firewall FIRST, always

If `ssh root@$SERVER` (or `ssh deploy@$SERVER`) suddenly stops working — connection times out, or hangs — the firewall's IP allowlist has almost certainly gone stale. This is the #1 suspect, checked before anything else, every time:

```bash
curl -4 ifconfig.me    # your current IPv4 — the ONLY thing that changes on your end
```

Compare against what the firewall currently allows (needs `HETZNER_API_KEY` from `.env` — never print the key itself, only use it in the `Authorization` header). **Firewall ID `11470214` below is the current server's** — once the migration to a new server (see "Path to real production" section) is complete and the old server is decommissioned, this whole section needs re-pointing at the new firewall's own ID:

```bash
curl -s https://api.hetzner.cloud/v1/firewalls/11470214 \
  -H "Authorization: Bearer $HETZNER_API_KEY" | grep -A3 '"port": "22"'
```

If `source_ips` doesn't contain your current IP, that's the entire problem — nothing wrong with your key, your password, or the server. Fix it with one API call (replace `<YOUR_IP>` — and note this `set_rules` call REPLACES the entire ruleset, so 80/443 must be included every time, not just 22, or you'll silently lock out the live site while fixing SSH):

```bash
curl -s -X POST https://api.hetzner.cloud/v1/firewalls/11470214/actions/set_rules \
  -H "Authorization: Bearer $HETZNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rules": [
    {"direction": "in", "protocol": "tcp", "port": "22", "source_ips": ["<YOUR_IP>/32"]},
    {"direction": "in", "protocol": "tcp", "port": "80", "source_ips": ["0.0.0.0/0", "::/0"]},
    {"direction": "in", "protocol": "tcp", "port": "443", "source_ips": ["0.0.0.0/0", "::/0"]}
  ]}'
```

Wait ~15 seconds for `apply_firewall` to finish, then retry SSH with your normal key. This alone fixed the 2026-08-16 incident — no password, no console, no new key ever ended up being necessary.

**Important distinction if Claude Code (or any other automation) is trying to SSH in and gets "Permission denied" or "Connection timed out":** a *live* "Permission denied" response (not a timeout) means the target answered but rejected the key/password — that's a different problem (wrong IP entirely, or wrong key) from a *timeout*, which means the firewall silently dropped the connection before SSH even started. Don't assume which one you're looking at — the error message tells you which branch of this troubleshooting guide applies. And a remote AI agent's SSH attempts will always be blocked by this firewall by design (it only trusts Kes's IP) — that's correct behavior, not a bug to route around by adding the agent's IP to the allowlist without a deliberate decision to do so.

### Step 2: Also double-check you're targeting the right server

Before assuming it's a firewall or key problem at all, confirm the IP you're using matches what the Hetzner Console shows for `ubuntu-4gb-hel1-1` right now (Console → Servers → the server row shows its current Public IP). Server IPs don't normally change on their own, but documentation can go stale — this repo's own `CLAUDE.md` had the wrong IP for a while (fixed 2026-08-16). If in doubt, trust the Hetzner Console over any doc, including this one.

### Step 3 (only if the firewall is fine and the IP is right, and you still can't get in): password/console recovery

Only reach for this if steps 1-2 didn't fix it — e.g. you've genuinely lost every key that's in `authorized_keys`.

1. Hetzner Console → the server → **Rescue** tab → **"Reset Root Password"** button (the standalone one at the bottom of the tab, *not* "Enable rescue" / "Enable rescue & power cycle" above it — those boot into a separate recovery OS and require a reboot cycle; you don't need that just to log in with a password).
2. This shows a one-time password on screen. Use it either:
   - Over real SSH: `ssh root@$SERVER`, enter the password when prompted. **Password auth over SSH may be restricted for root** (`PermitRootLogin prohibit-password` is a common Ubuntu cloud-image default) — if this rejects a password you're sure is correct, that's why; go to the console instead.
   - Via the Hetzner Console's browser-based VNC terminal (Console button on the server's Overview page): log in as `root` with that password.
3. **The VNC console has a real keyboard bug**: any character that requires Shift on a US keyboard (`+ _ ~ > < & | " ! @ # $ % ^ * ( ) :`) gets silently typed as its *unshifted* equivalent instead — `+` becomes `=`, `_` becomes `-`, `"` becomes `'`, `>>` becomes `..`, `&&` becomes `77`, `~` becomes `` ` ``. Letters (including uppercase) and digits type fine; only shifted symbols break. This makes typing shell syntax or SSH key content directly into that console unreliable.
   - If the console has a clipboard/extra-keys sidebar (a small arrow tab on the console window's edge), paste through that — it's more likely to preserve exact characters than physical keystroke simulation.
   - Otherwise, do the least possible inside the console: just get a password set (`passwd`, alphanumeric-only, since digits/letters type correctly) and reserve anything symbol-heavy (adding SSH keys, editing config files) for a real SSH/terminal session once you're back in over the network — real terminals don't have this bug.
4. Once logged in one way or another, get back to key-based access and re-lock password auth down (or at minimum, rotate the password again) rather than leaving password auth as the ongoing access method.

### Reference: what's actually authorized right now

Despite `deployment.md`'s "One-time setup" section describing a dedicated `hetzner_portfolio` key as the intended setup, in practice `~/.ssh/id_ed25519` (Kes's regular default key) is what's authorized on the server as of 2026-08-16. No `hetzner_portfolio` key currently exists on Kes's machine. Worth actually doing the dedicated-key setup next time SSH access is touched, so a compromised personal key doesn't also expose this server — but don't assume it's already done.

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
- [ ] Hetzner Firewall: only 22 (your IP), 80 and 443 (any) open
- [ ] `docker compose ps` shows all services healthy
- [ ] `docker compose logs migrate` shows a clean exit
- [ ] Colaberry SQL Server reachability confirmed
- [ ] Golden-path login test passed, with a real DB row confirmed

---

## Path to real production (Colaberry School, not just Kes's testing)

What's live today (raw IP, personal accounts, single server) is a real, working deployment — but "real Colaberry School production, real student load" changes a few things beyond what's built so far. None of this is decided yet; it's written down here so the questions aren't lost, and so nothing below gets executed without an explicit decision first.

### Domain and TLS

**Update (2026-08-16): TLS is live, but via a stopgap, not a real domain.** Plain HTTP turned out to be more than cosmetic — it silently broke the Colaberry live-login feature outright (noVNC refuses to run outside a secure context; see `PROGRESS.md` M74–M77 for the full diagnosis). Rather than block that fix on the domain decision below, shipped TLS immediately using `46.62.228.67.nip.io` — `nip.io` resolves any `<ip>.nip.io` hostname straight back to that IP, which lets Let's Encrypt's HTTP-01 challenge complete with no domain purchase, no DNS setup, and no waiting on anyone's decision. The cert is genuinely trusted (no browser warning), auto-renews via certbot's systemd timer, and `FRONTEND_URL`/the GitHub OAuth App's callback URL were both updated to match. nginx now terminates TLS on 443 and redirects all plain-HTTP traffic (including bare-IP hits) to the HTTPS origin.

This does **not** resolve the question below — `nip.io` is a third-party dependency the app now soft-relies on for its hostname, and it's explicitly a stopgap: swap the cert path in `frontend/nginx.conf` for a real domain's cert whenever that decision lands, no re-architecting needed.

Real institutional use still needs:
- A real domain/subdomain (e.g. `portfolio.colaberry.com`) with a DNS **A record** pointed at the server.
- nginx's cert paths repointed from the nip.io cert to the real domain's cert (mechanical — same TLS termination logic already in place).

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
