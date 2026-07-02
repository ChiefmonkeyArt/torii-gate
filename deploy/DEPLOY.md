# Self-hosting Torii Quest on your own VPS + domain

This kit runs Torii Quest (a static site) plus a **strfry** nostr relay, both in
Docker, behind **Caddy** (automatic HTTPS via Let's Encrypt).

```
Internet ──https──▶ Caddy (web container)
                      ├─ /        → static game (dist/)
                      └─ /relay   → wss reverse-proxy → strfry:7777 (sidecar)
```

## What you get

| URL | Serves |
|-----|--------|
| `https://YOURDOMAIN/` | The game (static build) |
| `wss://YOURDOMAIN/relay` | Your own nostr relay (strfry) |

## Files

- `Dockerfile` — multi-stage: builds the game (`npm run build`) then bakes `dist/` into a Caddy image.
- `docker-compose.yml` — `web` (Caddy) + `strfry` (relay).
- `Caddyfile` — static files + SPA fallback + `/relay` proxy + auto-HTTPS.
- `strfry.conf` — relay config. Binds `0.0.0.0:7777` (internal only), LMDB DB on a named volume.
- `.env.example` — your `DOMAIN` + `ACME_EMAIL`.
- `deploy/server-harden.sh` — firewall + fail2ban + auto-updates + Docker, on a fresh VPS.
- `deploy/deploy.sh` — pull + rebuild + restart, for updates.

## Step-by-step (fresh Debian/Ubuntu VPS)

### 1. Point your domain at the server
Create an **A record** at your DNS provider:
```
YOURDOMAIN.   A   <server IP>
```
Wait for it to resolve before starting the stack (Caddy needs DNS to issue a cert).

### 2. Harden the server + install Docker
```bash
ssh root@<server IP>
apt-get update -y && apt-get install -y git
git clone https://github.com/ChiefmonkeyArt/torii-quest.git
cd torii-quest
sudo bash deploy/server-harden.sh
```
This opens ports 22/80/443 only and installs Docker. SSH password login stays enabled
until you run `sudo bash deploy/server-harden.sh --lockdown-ssh` (do that only **after**
confirming an SSH key works in a separate session).

### 3. Configure
```bash
cp .env.example .env
nano .env      # set DOMAIN and ACME_EMAIL
```

### 4. Launch
```bash
docker compose up -d
docker compose logs -f web strfry
```
Within seconds Caddy logs `certificate obtained successfully` for your domain.

### 5. Verify
```bash
# Game over HTTPS
curl -I https://YOURDOMAIN/

# Relay NIP-11 info (over the /relay path)
curl -s -H 'Accept: application/nostr+json' https://YOURDOMAIN/relay

# WebSocket test (install nak: https://github.com/fiatjaf/nak)
nak req -r wss://YOURDOMAIN/relay '{"kinds":[1],"limit":1}'
```

Point the game at your relay by using `wss://YOURDOMAIN/relay` in the relay list.

## Updating the live game

From the VPS, in the repo:
```bash
./deploy/deploy.sh
```
Pulls latest code, rebuilds the game image, and restarts the containers with no downtime
beyond the few-second restart.

## Backups

The relay's events live in the `strfry_data` Docker volume. Back it up before updates:
```bash
docker run --rm -v strfry-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/strfry-backup-$(date +%F).tgz -C /data .
```
(Caddy certs are in `caddy_data`; back up if you want to avoid re-issuance on restore.)

## Path-based relay note

The relay is served at `wss://YOURDOMAIN/relay` (Caddy strips the `/relay` prefix before
forwarding to strfry). This works for the vast majority of clients. If a particular client
rejects a path-based relay URL, switch to a subdomain instead:

1. Add an A record for `relay.YOURDOMAIN` → same IP.
2. In `Caddyfile`, replace the two `handle_path /relay*` blocks with:
   ```caddy
   relay.YOURDOMAIN {
       reverse_proxy strfry:7777
   }
   ```
   and move the static-game block into its own `YOURDOMAIN { … }` site.
3. `docker compose up -d --force-recreate web`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Caddy: "no certificate" | DNS A record not resolving yet. Wait, then `docker compose restart web`. |
| Relay not reachable | `docker compose logs strfry` — check `bind = "0.0.0.0"` in strfry.conf. |
| 502 on /relay | strfry not up. `docker compose ps`, then `docker compose logs strfry`. |
| Game 404 on /zone/* | SPA fallback missing — ensure `try_files {path} /index.html` is in Caddyfile. |
| Port 80/443 blocked | `ufw allow 80/tcp && ufw allow 443/tcp`. |
