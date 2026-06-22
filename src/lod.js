// lod.js — Distance-based LOD for bot models.
// < LOD_NEAR  : full GLB with AnimationMixer (already running in botModel)
// >= LOD_NEAR : disable mixer tick to save CPU; model still visible but frozen
// >= LOD_FAR  : hide model entirely (beyond render distance)
// No new allocations in tick — compare squared distances only.

const LOD_NEAR_SQ = 15 * 15; // 15 units — freeze animation
const LOD_FAR_SQ  = 35 * 35; // 35 units — hide mesh

// Scratch
const _d = { x: 0, z: 0 };

// Called from bots.js tickBots for each bot after movement is resolved.
// Returns: 'full' | 'frozen' | 'hidden'
export function getLodLevel(botPosX, botPosZ, playerPosX, playerPosZ) {
  const dx = botPosX - playerPosX;
  const dz = botPosZ - playerPosZ;
  const dsq = dx * dx + dz * dz;
  if (dsq >= LOD_FAR_SQ)  return 'hidden';
  if (dsq >= LOD_NEAR_SQ) return 'frozen';
  return 'full';
}

// Apply LOD to a BotModel instance — call once per frame per bot
export function applyLod(botModel, level) {
  if (!botModel?.root) return;
  if (level === 'hidden') {
    botModel.root.visible = false;
    return;
  }
  botModel.root.visible = true;
  // 'frozen': skip mixer.update (save CPU) but keep mesh visible
  // Actual skip is handled by passing skipMixer flag to BotModel.tick()
  // 'full': normal — mixer runs in BotModel.tick()
}
