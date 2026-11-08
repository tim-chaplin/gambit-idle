import { createBattle, runBattle } from './combat';
import { ZONES } from './data/areas';
import { ITEMS } from './data/items';
import { seeded } from './rng';
import {
  applyVictory,
  buyItem,
  equipItem,
  heroStats,
  heroVitals,
  innTick,
  isPartyRested,
  isZoneUnlocked,
  newGame,
  saveBattleVitals,
  type GameState,
} from './state';

/** Seconds per turn and pause between fights, matching the live game loop. */
export const TURN_SECONDS = 2;
export const BETWEEN_FIGHTS_SECONDS = 2;

export interface SimResult {
  fights: number;
  wipes: number;
  minutes: number;
  level: number;
  bossBeaten: boolean;
  /** Share of total time spent resting at the inn. */
  restShare: number;
  log: string[];
}

function shopSensibly(state: GameState) {
  const hero = state.heroes[0];
  for (const slot of ['weapon', 'armor'] as const) {
    const current = ITEMS[hero.equipment[slot]!];
    const upgrade = Object.values(ITEMS)
      .filter((i) => i.slot === slot && i.price > current.price && i.price <= state.gold)
      .sort((a, b) => b.price - a.price)[0];
    if (upgrade && buyItem(state, upgrade.id)) equipItem(state, hero.id, slot, upgrade.id);
  }
  while ((state.inventory.potion ?? 0) < 3 && buyItem(state, 'potion'));
}

/** Inn ticks until the party is fully rested. */
function restFully(state: GameState): number {
  let ticks = 0;
  while (!isPartyRested(state)) {
    innTick(state);
    ticks++;
  }
  return ticks;
}

/**
 * Plays the first area like a reasonable player: push forward, rest at the inn when HP runs low,
 * drop back a zone after repeated wipes, and shop often.
 */
export function simulateFirstArea(seed: number, maxFights = 2000): SimResult {
  const rng = seeded(seed);
  const state = newGame();
  const log: string[] = [];
  let fights = 0;
  let wipes = 0;
  let turns = 0;
  let restTicks = 0;
  let lossStreak = 0;
  let retreatFor = 0;

  while (fights < maxFights) {
    const hero = state.heroes[0];
    hero.gambits =
      hero.level >= 2
        ? [
            { enabled: true, condition: 'self-hp-30', action: 'potion' },
            { enabled: true, condition: 'foe-not-stunned', action: 'shield-bash' },
            { enabled: true, condition: 'foe-lowest-hp', action: 'attack' },
          ]
        : [
            { enabled: true, condition: 'self-hp-30', action: 'potion' },
            { enabled: true, condition: 'foe-lowest-hp', action: 'attack' },
          ];

    const unlocked = ZONES.filter((z) => isZoneUnlocked(state, z.id));
    const frontier = unlocked[unlocked.length - 1];
    const zone = retreatFor > 0 && unlocked.length > 1 ? unlocked[unlocked.length - 2] : frontier;
    if (retreatFor > 0) retreatFor--;

    // Head to the inn before a fight when HP is low, or always before the boss.
    const hpPct = heroVitals(hero).hp / heroStats(hero).maxHp;
    if (hpPct < 0.5 || zone.boss) restTicks += restFully(state);

    const battle = runBattle(createBattle(state, zone.id, rng), state, rng);
    saveBattleVitals(state, battle);
    fights++;
    turns += battle.turn;
    if (battle.outcome === 'victory') {
      lossStreak = 0;
      const result = applyVictory(state, battle);
      for (const lv of result.levelUps) log.push(`fight ${fights}: level ${lv.level}`);
      if (result.zoneCleared) log.push(`fight ${fights}: cleared ${zone.name} at Lv ${hero.level} with ${hero.equipment.weapon}/${hero.equipment.armor}, ${wipes} wipes`);
      if (zone.boss && result.zoneCleared) break;
    } else {
      wipes++;
      restTicks += restFully(state);
      if (++lossStreak >= 2) {
        retreatFor = 10;
        lossStreak = 0;
      }
    }
    shopSensibly(state);
  }

  const fightSeconds = turns * TURN_SECONDS + fights * BETWEEN_FIGHTS_SECONDS;
  const restSeconds = restTicks * TURN_SECONDS;
  return {
    fights,
    wipes,
    minutes: (fightSeconds + restSeconds) / 60,
    restShare: restSeconds / (fightSeconds + restSeconds),
    level: state.heroes[0].level,
    bossBeaten: ZONES.filter((z) => z.boss).every((z) => (state.zoneKills[z.id] ?? 0) > 0),
    log,
  };
}
