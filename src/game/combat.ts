import { ACTIONS } from './data/actions';
import { zoneById } from './data/areas';
import { CLASSES } from './data/classes';
import { ENEMIES } from './data/enemies';
import { chooseAction } from './gambits';
import { pick, randInt, type Rng } from './rng';
import { heroStats, type GameState } from './state';
import type { Battle, BattleEvent, Combatant } from './types';

/** MP each party member regains at the start of every turn after the first. */
export const MP_REGEN_PER_TURN = 1;

export function createBattle(state: GameState, zoneId: string, rng: Rng): Battle {
  const zone = zoneById(zoneId);
  const party: Combatant[] = state.heroes.map((hero) => {
    const stats = heroStats(hero);
    return {
      id: hero.id,
      name: hero.name,
      side: 'party',
      sprite: CLASSES[hero.classId].sprite,
      stats,
      hp: stats.maxHp,
      mp: stats.maxMp,
      stunned: 0,
      heroId: hero.id,
    };
  });

  const count = randInt(rng, zone.groupSize[0], zone.groupSize[1]);
  const enemies: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const def = ENEMIES[pick(rng, zone.enemies)];
    enemies.push({
      id: `enemy-${i}`,
      name: def.name,
      side: 'enemy',
      sprite: def.sprite,
      stats: { ...def.stats },
      hp: def.stats.maxHp,
      mp: 0,
      stunned: 0,
      enemyId: def.id,
      boss: def.boss,
    });
  }
  // Disambiguate duplicate names: "Green Slime A", "Green Slime B".
  const baseNames = enemies.map((e) => e.name);
  enemies.forEach((e, i) => {
    const same = baseNames.filter((n) => n === baseNames[i]).length;
    const nth = baseNames.slice(0, i).filter((n) => n === baseNames[i]).length;
    if (same > 1) e.name = `${baseNames[i]} ${String.fromCharCode(65 + nth)}`;
  });

  return { zoneId, combatants: [...party, ...enemies], turn: 0, queue: [], outcome: null };
}

export function computeDamage(atk: number, def: number, power: number, rng: Rng): number {
  const raw = atk * power - def * 0.5;
  return Math.max(1, Math.round(raw * (0.85 + rng() * 0.3)));
}

const byId = (battle: Battle, id: string) => battle.combatants.find((c) => c.id === id)!;
const living = (battle: Battle, side: Combatant['side']) =>
  battle.combatants.filter((c) => c.side === side && c.hp > 0);

function startTurn(battle: Battle): BattleEvent {
  battle.turn += 1;
  if (battle.turn > 1) {
    for (const c of living(battle, 'party')) c.mp = Math.min(c.stats.maxMp, c.mp + MP_REGEN_PER_TURN);
  }
  battle.queue = [...living(battle, 'party'), ...living(battle, 'enemy')].map((c) => c.id);
  return { type: 'turn', turn: battle.turn };
}

/**
 * Resolves the next combatant's action, starting a new turn first if needed.
 * Mutates the battle (and consumes items from state.inventory) and returns what happened.
 */
export function stepAction(battle: Battle, state: GameState, rng: Rng): BattleEvent[] {
  if (battle.outcome) return [];
  const events: BattleEvent[] = [];
  if (battle.queue.length === 0) events.push(startTurn(battle));

  let actor: Combatant | undefined;
  while (battle.queue.length > 0 && !actor) {
    const next = byId(battle, battle.queue.shift()!);
    if (next.hp > 0) actor = next;
  }
  if (!actor) return events;

  if (actor.stunned > 0) {
    actor.stunned -= 1;
    events.push({ type: 'stunned', actorId: actor.id });
    return events;
  }

  let choice: ReturnType<typeof chooseAction>;
  if (actor.side === 'party') {
    const hero = state.heroes.find((h) => h.id === actor.heroId)!;
    choice = chooseAction(battle, actor, hero, state);
  } else {
    const targets = living(battle, 'party');
    choice = targets.length ? { action: ACTIONS.attack, target: pick(rng, targets), gambitIndex: -1 } : null;
  }
  if (!choice) {
    events.push({ type: 'idle', actorId: actor.id });
    return events;
  }

  const { action, target } = choice;
  actor.mp -= action.mpCost;
  if (action.kind === 'item') state.inventory[action.id] -= 1;

  const event: Extract<BattleEvent, { type: 'action' }> = {
    type: 'action',
    actorId: actor.id,
    actionId: action.id,
    actionName: action.name,
    targetId: target.id,
  };
  if (action.power) {
    const damage = computeDamage(actor.stats.atk, target.stats.def, action.power, rng);
    target.hp = Math.max(0, target.hp - damage);
    event.damage = damage;
    if (action.stun && target.hp > 0) {
      target.stunned = 1;
      event.stun = true;
    }
  }
  if (action.heal) {
    const heal = Math.min(action.heal, target.stats.maxHp - target.hp);
    target.hp += heal;
    event.heal = heal;
  }
  events.push(event);
  if (target.hp === 0) events.push({ type: 'defeated', targetId: target.id });

  if (living(battle, 'enemy').length === 0) battle.outcome = 'victory';
  else if (living(battle, 'party').length === 0) battle.outcome = 'defeat';
  return events;
}

/** Runs a battle to completion with no pacing (for tests and balance simulation). */
export function runBattle(battle: Battle, state: GameState, rng: Rng, maxSteps = 2000): Battle {
  for (let i = 0; i < maxSteps && !battle.outcome; i++) stepAction(battle, state, rng);
  return battle;
}
