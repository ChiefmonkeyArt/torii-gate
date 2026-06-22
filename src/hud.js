// hud.js — ALL DOM updates live here. Nothing else touches the DOM.
import { state, PHASE } from './state.js';
import { on, EV } from './events.js';

// DOM refs — cached once
const $ = id => document.getElementById(id);
const elSats    = $('sb-sats'), elKills = $('sb-kills'), elHp = $('sb-hp');
const elAmmo    = $('ammo-cur'), elHpFill = $('healthbar-fill');
const elHitFlash= $('hit-flash'), elDeathMsg = $('death-msg'), elCross = $('crosshair');
const elKillFeed= $('killfeed');

// Prev-value guards — skip DOM write if unchanged
let _ph=-1,_pk=-1,_pp=-1,_pa='',_ps=-1;
let _hitTimer=0, _crossTimer=0;

export function initHUD() {
  on(EV.HUD_UPDATE,    updateHUD);
  on(EV.BOT_KILLED,    d => { addKill(`<span style="color:#f7931a">☠ NOSTRICH DOWN +5⚡</span>`); updateHUD(); });
  on(EV.PLAYER_HIT,    d => flashHit(d?.dmg || 25));
  on(EV.PLAYER_KILLED, () => { elDeathMsg.classList.add('show'); });
  on(EV.PLAYER_RESPAWN,() => { elDeathMsg.classList.remove('show'); });
}

export function updateHUD() {
  if (state.sats  !== _ps) { elSats.textContent  = state.sats;  _ps = state.sats;  }
  if (state.kills !== _pk) { elKills.textContent = state.kills; _pk = state.kills; }
  const hp = Math.max(0, Math.round(state.hp));
  if (hp !== _ph) {
    elHp.textContent = hp;
    const c = hp>60?'#44ff88':hp>30?'#ffcc00':'#ff4444';
    elHp.style.color = c; elHpFill.style.width=hp+'%'; elHpFill.style.background=c;
    _ph = hp;
  }
  const at = state.reloading ? 'R' : String(state.ammo);
  if (at !== _pa) { elAmmo.textContent = at; _pa = at; }
}

export function flashHit(dmg=25) {
  const i = Math.min(1, dmg/50);
  elHitFlash.style.opacity = String(0.3+i*0.5);
  _hitTimer = 0.2+i*0.3;
}

export function flashCross() { elCross.classList.add('hit'); _crossTimer = 0.12; }

export function addKill(html) {
  const d = document.createElement('div');
  d.className='kill-entry'; d.innerHTML=html;
  elKillFeed.appendChild(d);
  while(elKillFeed.children.length>6) elKillFeed.removeChild(elKillFeed.firstChild);
  setTimeout(()=>d.remove(), 5000);
}

export function tickHUD(dt) {
  if (_hitTimer>0)   { _hitTimer=Math.max(0,_hitTimer-dt);   if(_hitTimer<=0) elHitFlash.style.opacity='0'; }
  if (_crossTimer>0) { _crossTimer=Math.max(0,_crossTimer-dt); if(_crossTimer<=0) elCross.classList.remove('hit'); }
}

// Minimap
const _mm = $('minimap')?.getContext('2d');
const MM  = 110;
export function drawMinimap(playerPos, bots) {
  if (!_mm) return;
  const wx = x => ((x+20)/40)*MM, wz = z => ((20-z)/40)*MM;
  _mm.fillStyle='rgba(10,10,20,0.85)'; _mm.fillRect(0,0,MM,MM);
  _mm.strokeStyle='rgba(139,92,246,0.5)'; _mm.lineWidth=1; _mm.strokeRect(3,3,MM-6,MM-6);
  _mm.fillStyle='#ff9933';
  bots.forEach(b => {
    if (!b.alive) return;
    _mm.beginPath(); _mm.arc(wx(b.mesh.position.x), wz(b.mesh.position.z), 2.5, 0, Math.PI*2); _mm.fill();
  });
  const px=wx(playerPos.x), pz=wz(playerPos.z);
  const g=_mm.createRadialGradient(px,pz,0,px,pz,8);
  g.addColorStop(0,'rgba(139,92,246,0.8)'); g.addColorStop(1,'rgba(139,92,246,0)');
  _mm.fillStyle=g; _mm.beginPath(); _mm.arc(px,pz,8,0,Math.PI*2); _mm.fill();
  _mm.fillStyle='#8b5cf6'; _mm.beginPath(); _mm.arc(px,pz,4,0,Math.PI*2); _mm.fill();
}
