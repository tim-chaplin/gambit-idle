import { ACTIONS } from './data/actions';
import { ZONES, zoneById } from './data/areas';
import { CLASSES } from './data/classes';
import { ENEMIES } from './data/enemies';
import { ITEMS } from './data/items';
import type { Activity, Battle, EquipSlot, Hero, StatBlock } from './types';

export const SAVE_VERSION = 1;

/** Everything that persists between sessions. */
export interface GameState {
  version: number;
  gold: number;
  heroes: Hero[];
  /** Owned items not currently equipped, including consumables. */
  inventory: Record<string, number>;
  /** Victories per zone. */
  zoneKills: Record<string, number>;
  /** Selected zone; the party fights here when `activity` is 'fighting'. */
  currentZone: string;
  activity: Activity;
}

/** Fraction of max HP/MP recovered per inn tick (one tick per turn length). */
export const INN_RECOVERY_PER_TICK = 0.1;

export function newHero(id: string, classId: string, name: string): Hero {
  const cls = CLASSES[classId];
  return {
    id,
    name,
    classId,
    level: 1,
    xp: 0,
    equipment: classId === 'fighter' ? { weapon: 'rusty-sword', armor: 'padded-vest' } : {},
    gambits: cls.defaultGambits.map((g) => ({ ...g })),
  };
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    gold: 0,
    heroes: [newHero('hero-1', 'fighter', 'Fighter')],
    inventory: { potion: 3 },
    zoneKills: {},
    currentZone: ZONES[0].id,
    activity: 'idle',
  };
}

export function heroStats(hero: Hero): StatBlock {
  const cls = CLASSES[hero.classId];
  const lv = hero.level - 1;
  const stats: StatBlock = {
    maxHp: cls.base.maxHp + cls.growth.maxHp * lv,
    maxMp: cls.base.maxMp + cls.growth.maxMp * lv,
    atk: cls.base.atk + cls.growth.atk * lv,
    def: cls.base.def + cls.growth.def * lv,
  };
  for (const itemId of Object.values(hero.equipment)) {
    const item = itemId ? ITEMS[itemId] : undefined;
    stats.atk += item?.atk ?? 0;
    stats.def += item?.def ?? 0;
  }
  return stats;
}

/** Current HP/MP, clamped to the hero's maximums. */
export function heroVitals(hero: Hero): { hp: number; mp: number } {
  const { maxHp, maxMp } = heroStats(hero);
  return { hp: Math.min(maxHp, hero.hp ?? maxHp), mp: Math.min(maxMp, hero.mp ?? maxMp) };
}

/** Copies HP/MP from a battle back onto the heroes so damage carries over. */
export function saveBattleVitals(state: GameState, battle: Battle) {
  for (const c of battle.combatants) {
    const hero = c.heroId ? state.heroes.find((h) => h.id === c.heroId) : undefined;
    if (hero) {
      hero.hp = c.hp;
      hero.mp = c.mp;
    }
  }
}

export const isPartyWiped = (state: GameState) => state.heroes.every((h) => heroVitals(h).hp <= 0);
export const isPartyRested = (state: GameState) =>
  state.heroes.every((h) => {
    const { maxHp, maxMp } = heroStats(h);
    const v = heroVitals(h);
    return v.hp >= maxHp && v.mp >= maxMp;
  });

/** One inn tick: every hero recovers a slice of max HP and MP. */
export function innTick(state: GameState) {
  for (const hero of state.heroes) {
    const { maxHp, maxMp } = heroStats(hero);
    const v = heroVitals(hero);
    hero.hp = Math.min(maxHp, v.hp + Math.ceil(maxHp * INN_RECOVERY_PER_TICK));
    hero.mp = Math.min(maxMp, v.mp + Math.ceil(maxMp * INN_RECOVERY_PER_TICK));
  }
}

export const xpToNext = (level: number) => Math.round(12 * level ** 1.8);

/** Skill ids the hero has learned, in learn order. */
export function learnedSkills(hero: Hero): string[] {
  return CLASSES[hero.classId].skills.filter((s) => s.level <= hero.level).map((s) => s.skillId);
}

/** Actions a hero can put in a gambit: learned skills plus consumable items. */
export function gambitActions(hero: Hero): string[] {
  const items = Object.values(ACTIONS)
    .filter((a) => a.kind === 'item')
    .map((a) => a.id);
  return [...learnedSkills(hero), ...items];
}

export function isZoneUnlocked(state: GameState, zoneId: string): boolean {
  const zone = zoneById(zoneId);
  if (zone.index === 0) return true;
  const prev = ZONES.find((z) => z.areaId === zone.areaId && z.index === zone.index - 1)!;
  return isZoneCleared(state, prev.id);
}

export function isZoneCleared(state: GameState, zoneId: string): boolean {
  return (state.zoneKills[zoneId] ?? 0) >= zoneById(zoneId).killsToClear;
}

export interface VictoryResult {
  xp: number;
  gold: number;
  levelUps: { heroId: string; level: number; learned: string[] }[];
  zoneCleared: string | null;
}

/** Grants rewards for a won battle and returns what changed. */
export function applyVictory(state: GameState, battle: Battle): VictoryResult {
  const enemies = battle.combatants.filter((c) => c.side === 'enemy');
  const xp = enemies.reduce((sum, c) => sum + ENEMIES[c.enemyId!].xp, 0);
  const gold = enemies.reduce((sum, c) => sum + ENEMIES[c.enemyId!].gold, 0);
  state.gold += gold;

  const wasCleared = isZoneCleared(state, battle.zoneId);
  state.zoneKills[battle.zoneId] = (state.zoneKills[battle.zoneId] ?? 0) + 1;
  const zoneCleared = !wasCleared && isZoneCleared(state, battle.zoneId) ? battle.zoneId : null;

  const levelUps: VictoryResult['levelUps'] = [];
  for (const hero of state.heroes) {
    const before = learnedSkills(hero);
    const oldStats = heroStats(hero);
    const oldVitals = heroVitals(hero);
    hero.xp += xp;
    let leveled = false;
    while (hero.xp >= xpToNext(hero.level)) {
      hero.xp -= xpToNext(hero.level);
      hero.level += 1;
      leveled = true;
    }
    if (leveled && oldVitals.hp > 0) {
      const newStats = heroStats(hero);
      hero.hp = oldVitals.hp + newStats.maxHp - oldStats.maxHp;
      hero.mp = oldVitals.mp + newStats.maxMp - oldStats.maxMp;
    }
    if (leveled) {
      const learned = learnedSkills(hero).filter((s) => !before.includes(s));
      levelUps.push({ heroId: hero.id, level: hero.level, learned });
    }
  }
  return { xp, gold, levelUps, zoneCleared };
}

export function buyItem(state: GameState, itemId: string): boolean {
  const item = ITEMS[itemId];
  if (!item || state.gold < item.price) return false;
  state.gold -= item.price;
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
  return true;
}

/** Equips an owned item (or unequips with null), returning the old item to the inventory. */
export function equipItem(state: GameState, heroId: string, slot: EquipSlot, itemId: string | null): boolean {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) return false;
  if (itemId && ((state.inventory[itemId] ?? 0) < 1 || ITEMS[itemId]?.slot !== slot)) return false;
  const old = hero.equipment[slot];
  if (old) state.inventory[old] = (state.inventory[old] ?? 0) + 1;
  if (itemId) {
    state.inventory[itemId] -= 1;
    hero.equipment[slot] = itemId;
  } else {
    delete hero.equipment[slot];
  }
  return true;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parses a save, falling back to a new game if it is missing or unreadable. */
export function deserialize(json: string | null): GameState {
  if (!json) return newGame();
  try {
    const data = JSON.parse(json) as GameState;
    if (data.version !== SAVE_VERSION || !Array.isArray(data.heroes) || data.heroes.length === 0) return newGame();
    const state = { ...newGame(), ...data };
    if (!['idle', 'fighting', 'resting'].includes(state.activity)) state.activity = 'idle';
    return state;
  } catch {
    return newGame();
  }
}
