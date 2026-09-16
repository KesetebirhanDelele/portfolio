# Deploying Repo2Reputation to Hetzner Cloud

This is the real, tested runbook for this app specifically — not a generic template. Every command here was actually run against the production server on 2026-08-15 and worked. Follow it in order for a repeat deployment (a rebuild, a new environment, disaster recovery) and it should go smoothly with no re-derivation needed.

**Stack**: Postgres, Redis, a Node/Express backend (Puppeteer + Playwright for PDF/scraping), and an nginx-served React frontend — four containers total via `docker-compose.yml` in this repo.

---

## Current access inventory (READ THIS FIRST — updated 2026-09-16)

Two completely separate credential systems are involved in operating this app, and they have different scopes. Confusing them wasted real time in the 2026-09-15/16 sessions — this section exists so that stops happening. Verify current state (`ufw status`, `GET /v1/servers`, etc.) rather than trusting this table blindly if it's been a while since the date above — but as of that date, here's exactly what's usable and what isn't:

| Credential | What it is | Scope / what it CAN do | What it CANNOT do | Status as of 2026-09-16 |
|---|---|---|---|---|
| SSH key (`~/.ssh/id_ed25519` on Kes's machine) | Standard OpenSSH keypair, trusted because its public half is in the server's `authorized_keys` | Full root access to whatever's **inside** the server's OS: files, Docker, `.env`, `ufw`/`iptables`, running containers | Cannot touch anything in Hetzner's own infrastructure layer — no creating/deleting servers, no Hetzner Cloud Firewalls, no DNS, no billing/account info. The server has no awareness of the Hetzner Cloud Firewall product; there's nothing "inside" for SSH to reach for that. | **Working.** Confirmed live against `157.180.43.42` (server itself, not Hetzner's control plane). |
| `HETZNER_API_KEY` (this repo's local `.env`) | A Hetzner Cloud API token, scoped to one specific Hetzner **Project** (not the whole account — a Hetzner login can hold multiple Projects, each with independent servers/firewalls/tokens) | Manage cloud-level resources — create/attach Cloud Firewalls, list/delete servers, check Primary IPs — but only within whichever Project issued it | Cannot see or manage resources in a different Project, even under the same Hetzner login. Cannot log into the server's OS (that's SSH's job, not this). | **Working**, as of 2026-09-16 — Kes generated a fresh Read & Write token from the `Repo2Reputation` Project (Security → API tokens) and it correctly sees `157.180.43.42` (server ID `165218595`) and its Cloud Firewall (`11633598`, named `firewall-1`). The earlier `11470214`-scoped key was for the old server's Project, confirmed a dead end. |
| Hetzner Console (browser login) | N/A | N/A | Claude has no browser session, no username/password, no OAuth token for Hetzner's web Console at all — never has, this isn't a regression | Not available to Claude, ever. Anything needing the Console (e.g. eyeballing which Project a server lives in) needs Kes directly. |

**Practical consequence of the table above**: the Hetzner Cloud Firewall for `157.180.43.42` could not be created via API (wrong-scoped token) or via SSH (wrong system entirely, see the CANNOT column). The mitigation actually applied instead — `ufw` configured directly on the server via SSH (deny-by-default incoming, port 22 restricted to Kes's IP, 80/443 open) — closes the real exposure today, but is not a substitute for the Cloud Firewall long-term (no network-edge layer, no redundancy). See PROGRESS.md M111 for the full record. **Once Kes's new Project-scoped token lands, update this table's `HETZNER_API_KEY` row to "Working" and finish attaching the real Cloud Firewall** (rules below, in "Troubleshooting: Recovering SSH Access").

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

**Update (2026-09-16, M113): the model this whole section describes is retired.** Steps 1 and much of "Reference" below describe an IP-allowlist for port 22 that no longer exists — kept as historical context (the pattern, and the VNC keyboard bug in Step 3, are still real and still useful), but don't expect a "stale firewall IP" diagnosis to be the answer for SSH specifically anymore. What changed and why:

- Kes was on a rotating/CGNAT-style network — the specific public IP allowlisted for SSH changed **5 times in one session** (2026-09-16), each change requiring a manual fix in two places (Cloud Firewall AND `ufw`, see below) before access worked again. IP-allowlisting was actively causing outages, not preventing them.
- The actual security boundary was never the IP restriction — it was always the SSH keypair (`~/.ssh/id_ed25519`, trusted via `authorized_keys`). Root login was already locked to key-only (`PermitRootLogin prohibit-password`), so IP-restriction was a redundant second layer, not the real lock.
- **New model**: port 22 is open to any source (`0.0.0.0/0`/`::/0`) on both the Hetzner Cloud Firewall (`11633598`, `firewall-1`) and `ufw`. Security now rests entirely on: (1) key-only auth — `PasswordAuthentication no` set daemon-wide as of 2026-09-16 (not just `PermitRootLogin prohibit-password` for root; the `deploy` account's password is also locked, `passwd -S deploy` shows `L`), and (2) `fail2ban` (installed 2026-09-16, `sshd` jail active) to blunt brute-force/scan noise now that the port is reachable from anywhere.
- **This directly reverses the "a remote AI agent's SSH attempts will always be blocked by this firewall by design" note further down this section (Step 1) — that's no longer true, and was never the actual intent; it described a side effect of IP-restriction, not a deliberate access-control decision.**
- If a fellow engineer needs access later, this model also just works — add their public key to `authorized_keys`, no firewall/IP coordination needed at all. (A VPN mesh like Tailscale was considered for a stable network-location layer on top of this, but wasn't needed — key-only auth was judged sufficient for this app's risk level.)

If SSH access ever breaks again, the questions to ask now are: is the key actually in `authorized_keys`, is `sshd` running, is the server itself up — not "did the firewall's allowlist go stale," since there isn't one for port 22 anymore. `80`/`443` on the Cloud Firewall remain open-to-all and unrelated to this.

---

**Historical section below (pre-2026-09-16 model, kept for the reusable parts — VNC keyboard bug, password-reset flow, the general "check firewall before assuming key/password is broken" instinct):**

On 2026-08-16, SSH access broke and took roughly two hours to recover — almost entirely because the actual cause (a stale firewall rule) wasn't checked first, so time went into console keyboard workarounds and password resets that were never going to fix it. This section exists so that never happens again. **Read step 1 before doing anything else.**

### Step 1: Check the firewall FIRST, always

If `ssh root@$SERVER` (or `ssh deploy@$SERVER`) suddenly stops working — connection times out, or hangs — the firewall's IP allowlist has almost certainly gone stale. This is the #1 suspect, checked before anything else, every time:

```bash
curl -4 ifconfig.me    # your current IPv4 — the ONLY thing that changes on your end
```

**Update (2026-09-15): the migration this note warned about has happened, and `11470214` is now stale.** Production moved to a new server, `157.180.43.42` (M107, 2026-09-08). The old server (`46.62.228.67`, firewall `11470214`) is **no longer this project's server at all** — live-verified 2026-09-15 that it now serves a different app entirely (TLS cert `CN=eventgenius.m-dev.me`). Do not use firewall `11470214` or IP `46.62.228.67` for anything below.

**Update (2026-09-16, M111): the missing-firewall gap above is now mitigated, not fully closed.** No Hetzner Cloud Firewall is attached to `157.180.43.42` yet (still true — see "Current access inventory" near the top of this file for exactly why: the local `HETZNER_API_KEY` is valid but scoped to a different Hetzner Project than the one `157.180.43.42` lives in, so it can't create one; a new Project-scoped token is pending). In the meantime, `ufw` was configured directly on the server via SSH — default-deny incoming, port 22 restricted to Kes's IP, 80/443 open — which closes the actual exposure today. **Correction to earlier phrasing**: this was described mid-investigation as "a separate Hetzner account" — Kes's recollection (and the more likely explanation) is it's the *same* account/login, just a different Hetzner **Project** within it, which is where API tokens are actually scoped. Don't re-litigate "which account" again; check the access-inventory table at the top of this file instead, and update it once the new token confirms which is true.

Once a real Cloud Firewall exists on the new server (via the new Project-scoped token, or Kes creating it directly in the Console), the same recovery pattern applies — replace `11470214` and `$HETZNER_API_KEY` usage below with the new server's real firewall ID:

```bash
curl -4 ifconfig.me    # your current IPv4

curl -s https://api.hetzner.cloud/v1/firewalls/<NEW_FIREWALL_ID> \
  -H "Authorization: Bearer $HETZNER_API_KEY" | grep -A3 '"port": "22"'
```

If `source_ips` doesn't contain your current IP, that's the entire problem — nothing wrong with your key, your password, or the server. Fix it with one API call (replace `<YOUR_IP>` and `<NEW_FIREWALL_ID>` — and note this `set_rules` call REPLACES the entire ruleset, so 80/443 must be included every time, not just 22, or you'll silently lock out the live site while fixing SSH):

```bash
curl -s -X POST https://api.hetzner.cloud/v1/firewalls/<NEW_FIREWALL_ID>/actions/set_rules \
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

Before assuming it's a firewall or key problem at all, confirm the IP you're using matches what the Hetzner Console shows for the current production server right now (Console → Servers → the server row shows its current Public IP). Server IPs don't normally change on their own, but documentation can go stale — this repo's own `CLAUDE.md` had the wrong IP for a while (fixed 2026-08-16, then again 2026-09-15 after the 2026-09-08 server migration). If in doubt, trust the Hetzner Console over any doc, including this one. **Also verify you're on the right account/project**: the 2026-09-08 migration (M107) created a brand-new Hetzner account, so the old server's console/API key won't even show the new one — don't assume "I don't see it" means it was deleted.

**A second, sharper version of this same check, learned 2026-09-15**: a matching IP and a live TLS handshake are not proof it's still *this* app's server — an IP can be reassigned to an entirely different customer/project after a server is deleted. Before trusting any cached IP from a doc or memory, confirm the live content: `curl https://<ip-or-nip.io-host>/api/health` should return this app's `{"status":"healthy","checks":{"postgres":...,"colaberryMssql":...}}` shape, and the TLS cert's `CN` (`openssl s_client -connect <ip>:443 -servername <host> | openssl x509 -noout -subject`) should match the hostname you expect. This is exactly how `46.62.228.67` was caught having silently become `eventgenius.m-dev.me`'s server, not this app's.

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

Despite `deployment.md`'s "One-time setup" section describing a dedicated `hetzner_portfolio` key as the intended setup, in practice `~/.ssh/id_ed25519` (Kes's regular default key) is what was authorized on the **old** server (`46.62.228.67`) as of 2026-08-16. That server is no longer this project's (see the 2026-09-15 update above) — this note has **not been re-verified against the new server (`157.180.43.42`)** and shouldn't be trusted for it without checking `authorized_keys` there directly. Worth actually doing the dedicated-key setup next time SSH access is touched, so a compromised personal key doesn't also expose this server — but don't assume it's already done.

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
- [x] Hetzner Firewall: `22`/`80`/`443` all open (any source) on both the Cloud Firewall and `ufw` — **updated 2026-09-16 (M113)**: 22 is deliberately open to any source now, not IP-restricted (see "Troubleshooting: Recovering SSH Access" for why). Security instead relies on key-only auth (`PasswordAuthentication no`, confirmed) and `fail2ban` (installed, `sshd` jail active) — check both are still true, not that an IP allowlist exists.
- [ ] `docker compose ps` shows all services healthy
- [ ] `docker compose logs migrate` shows a clean exit
- [ ] Colaberry SQL Server reachability confirmed
- [ ] Golden-path login test passed, with a real DB row confirmed

---

## Path to real production (Colaberry School, not just Kes's testing)

What's live today (raw IP, personal accounts, single server) is a real, working deployment — but "real Colaberry School production, real student load" changes a few things beyond what's built so far. None of this is decided yet; it's written down here so the questions aren't lost, and so nothing below gets executed without an explicit decision first.

### Domain and TLS

**Update (2026-08-16): TLS is live, but via a stopgap, not a real domain.** Plain HTTP turned out to be more than cosmetic — it silently broke the Colaberry live-login feature outright (noVNC refuses to run outside a secure context; see `PROGRESS.md` M74–M77 for the full diagnosis). Rather than block that fix on the domain decision below, shipped TLS immediately using `46.62.228.67.nip.io` — `nip.io` resolves any `<ip>.nip.io` hostname straight back to that IP, which lets Let's Encrypt's HTTP-01 challenge complete with no domain purchase, no DNS setup, and no waiting on anyone's decision. The cert is genuinely trusted (no browser warning), auto-renews via certbot's systemd timer, and `FRONTEND_URL`/the GitHub OAuth App's callback URL were both updated to match. nginx now terminates TLS on 443 and redirects all plain-HTTP traffic (including bare-IP hits) to the HTTPS origin.

**Update (2026-09-08, M107): server migrated, same nip.io stopgap, new IP.** Production moved to `157.180.43.42`; the live HTTPS origin is now `157.180.43.42.nip.io` (same nip.io mechanism as above — that hostname is nothing but the IP itself, wrapped so Let's Encrypt will issue it a real cert). `frontend/nginx.conf`'s cert paths and `FRONTEND_URL` were repointed accordingly. `46.62.228.67`/`46.62.228.67.nip.io` are retired for this project — confirmed 2026-09-15 that IP now serves a different, unrelated app.

This does **not** resolve the question below — `nip.io` is a third-party dependency the app now soft-relies on for its hostname, and it's explicitly a stopgap: swap the cert path in `frontend/nginx.conf` for a real domain's cert whenever that decision lands, no re-architecting needed. It also means any future server migration repeats this same nip.io re-bootstrap step, which a real domain would avoid entirely (the A record would just get repointed instead).

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
