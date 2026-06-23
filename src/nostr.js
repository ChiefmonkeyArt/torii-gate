// nostr.js — NIP-07 login, kind:0 profile fetch
import { state } from './state.js';
import { emit, EV } from './events.js';

const RELAYS = ['wss://relay.damus.io','wss://nos.lol','wss://relay.nostr.band'];

// A nostrich profile's `picture` is attacker-controlled (anyone can sign a
// kind:0 with any string). Only accept a well-formed https URL before it ever
// reaches an <img src>, so a hostile value can't smuggle in javascript:/data:
// or other surprising schemes. Returns the URL string, or null if unsafe.
function _safeImageUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let u;
  try { u = new URL(raw); } catch { return null; } // absolute URLs only — no relative resolution
  return u.protocol === 'https:' ? u.href : null;
}

export async function nostrLogin() {
  if (!window.nostr) return 'NIP-07 extension not found';
  try {
    const pk = await window.nostr.getPublicKey();
    state.nostrPubkey = pk;
    state.nostrName   = pk.slice(0,8).toUpperCase();
    emit(EV.NOSTR_LOGIN, { pubkey: pk });
    _fetchProfile(pk);
    return `⚡ ${state.nostrName}`;
  } catch(e) {
    return 'Login failed';
  }
}

function _fetchProfile(pubkey) {
  for (const url of RELAYS) {
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ','prof',{ kinds:[0], authors:[pubkey], limit:1 }]));
      };
      ws.onmessage = ev => {
        try {
          const [type,,event] = JSON.parse(ev.data);
          if (type !== 'EVENT') return;
          const meta = JSON.parse(event.content);
          if (meta.name)    { state.nostrName = meta.name; }
          const safePic = _safeImageUrl(meta.picture);
          if (safePic) { state.nostrAvatar = safePic; }
          emit(EV.NOSTR_LOGIN, { pubkey, name: meta.name, avatar: safePic });
          ws.close();
          _updateTitleUI();
        } catch(_){}
      };
      ws.onerror = () => ws.close();
      setTimeout(() => ws.readyState === 1 && ws.close(), 5000);
      break;
    } catch(_){}
  }
}

function _updateTitleUI() {
  const nameEl   = document.getElementById('nostr-display-name');
  const avatarEl = document.getElementById('nostr-avatar-img');
  const phEl     = document.getElementById('nostr-avatar-ph');
  const statusEl = document.getElementById('stats-status');
  if (nameEl)   nameEl.textContent  = state.nostrName || 'ANON';
  if (statusEl) statusEl.textContent = '● CONNECTED';
  if (avatarEl && state.nostrAvatar) {
    avatarEl.src = state.nostrAvatar;
    avatarEl.style.display = 'block';
    if (phEl) phEl.style.display = 'none';
  }
}
