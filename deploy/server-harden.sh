#!/usr/bin/env bash
# deploy/server-harden.sh — harden a fresh Debian/Ubuntu VPS for Torii Quest.
#
# Run as root (or with sudo) on a FRESH server, BEFORE bringing the stack up.
#   sudo bash deploy/server-harden.sh
#
# What it does:
#   - installs UFW firewall (allow 22 SSH, 80 HTTP, 443 HTTPS only)
#   - installs fail2ban (brute-force protection)
#   - enables automatic security updates
#   - installs Docker + Compose v2 (if missing)
#
# What it does NOT do (on purpose):
#   - does NOT disable SSH password login.
#     You currently log in with a password — locking that down BEFORE an SSH key
#     is confirmed working would lock you out. Pass --lockdown-ssh AFTER you have
#     confirmed key-based login works in a separate terminal.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root:  sudo bash $0"; exit 1; }

LOCKDOWN_SSH=0
if [ "${1:-}" = "--lockdown-ssh" ]; then LOCKDOWN_SSH=1; fi

echo "==> apt update"
apt-get update -y

echo "==> UFW firewall (22/80/443 only)"
apt-get install -y ufw fail2ban unattended-upgrades
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Automatic security updates"
dpkg-reconfigure -plow unattended-upgrades || true

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "==> Added current user to docker group (re-login to take effect)"
  usermod -aG docker "${SUDO_USER:-$USER}" || true
else
  echo "    Docker already installed: $(docker --version)"
fi

if [ "$LOCKDOWN_SSH" -eq 1 ]; then
  echo "==> Locking SSH to key-only (PasswordAuthentication no)"
  mkdir -p /etc/ssh/sshd_config.d
  cat >/etc/ssh/sshd_config.d/99-torii-hardening.conf <<'EOF'
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
  systemctl restart ssh || systemctl restart sshd
  echo "    SSH password login disabled. Keep your SSH key safe."
else
  echo ""
  echo "⚠️  SSH password login is still ENABLED."
  echo "    After you confirm key-based login works in a SEPARATE terminal, run:"
  echo "      sudo bash $0 --lockdown-ssh"
fi

echo ""
echo "✅ Server hardened. Next: cp .env.example .env, edit DOMAIN/ACME_EMAIL, then:"
echo "   docker compose up -d"
