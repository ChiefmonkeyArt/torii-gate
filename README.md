# Torii Quest

An open-world arena shooter built on [Nostr](https://nostr.com) and Bitcoin.

**Sats. Shots. Sovereignty.**

🎮 **Play now:** [torii-quest.pplx.app](https://torii-quest.pplx.app)

---

## About

Torii Quest is a browser-based multiplayer arena shooter where players battle for sats in a Japanese-inspired open world. Built entirely with open-source tools — no big tech, no cloud lock-in.

The game is a gateway to a decentralised open world powered by the Nostr protocol. Free market economics (Gamma Markets, Plebeian) as rational infrastructure for prosperous communities. Optimistic cypherpunk — hi-tech in balance with nature.

## Features

- **Nostr login** — sign in with your Nostr key via browser extension (e.g. Plebeian Signer)
- **Bitcoin/ecash rewards** — earn sats for kills
- **3D arena** — Three.js / WebGL renderer with physics via Rapier
- **Atmospheric world** — sunrise skybox, mountain ranges, instanced trees, drifting ground mist, birds
- **Torii gate** — 313KB optimised GLB centrepiece, Draco + WebP compressed
- **Playable characters** — Chiefmonkey and Nostrich (rigged GLB, 18–19 animation clips each)
- **Enemy bots** — Banker bots with full animation set including `Shot_and_Blown_Back` death physics
- **Mirror** — live Reflector on the west wall, throttled to 20Hz for performance
- **Service worker** — offline-capable, cache-first for assets, network-first for JS

## Tech Stack

| Layer | Technology |
|---|---|
| Renderer | Three.js r184 (WebGL) |
| Physics | Rapier3D (WASM) |
| Protocol | Nostr (NIP-01, NIP-07) |
| Payments | Bitcoin / ecash (fake sats in alpha) |
| Build | Vite 8 |
| 3D Models | Blender → glTF/GLB (Draco compressed) |
| Deployment | pplx.app |

## Controls

| Key | Action |
|---|---|
| W A S D | Move / strafe |
| ← → ↑ ↓ | Move / strafe (identical) |
| Mouse | Look |
| Click | Shoot |
| Space | Jump |
| R | Reload |
| ESC | Pause / resume |

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

Requires Node 18+.

## Project Structure

```
src/
  atmosphere.js   # Mountains, trees, mist, birds
  arena.js        # Arena geometry + torii gate GLB
  bots.js         # Bot AI, spawning, kill/revive
  botModel.js     # Banker GLB loader + AnimationMixer
  bullets.js      # Bullet pool
  config.js       # All game constants
  events.js       # Event bus
  hud.js          # HUD overlay
  input.js        # Keyboard + mouse + pointer lock
  lod.js          # Level of detail
  loop.js         # rAF game loop
  main.js         # Wiring only — no game logic
  mirror.js       # Live Reflector mirror
  minimap.js      # Canvas minimap
  nostr.js        # Nostr protocol integration
  physics.js      # Rapier world + colliders
  player.js       # Player movement, shoot, respawn
  playerModel.js  # Player GLB loader + animations
  scene.js        # Three.js scene, sunrise sky, fog
  state.js        # Game state machine
  weapons.js      # Bullet pool, gun viewmodel, hit detection
public/
  banker-rigged.glb
  chiefmonkey6.glb
  nostrich3.glb
  torii-gate.glb
  gun-steampunk.glb
  bitcoin-b.png
  sw.js           # Service worker
```

## Philosophy

> *The torii gate marks the threshold between the ordinary world and the sacred. In Torii Quest, it marks the threshold between the old financial system and a free, open, decentralised one.*

Nostr is the social layer. Bitcoin is the economic layer. The game is the fun layer.

## License

MIT — open source, free to fork, free to build on.

## Credits

- Built by [Chiefmonkey](https://github.com/chiefmonkey) and AI agents
- Character models: Tripo3D / Mixamo
- Torii gate model: Tripo3D (optimised with `gltf-transform`)
- Physics: [Rapier](https://rapier.rs)
- Protocol: [Nostr](https://nostr.com)
