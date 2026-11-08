import { ACTIONS, type ActionDef } from './data/actions';
import { learnedSkills } from './state';
import type { Battle, Combatant, Hero } from './types';

export interface ConditionDef {
  id: string;
  label: string;
  /** Which side the chosen target is on; only actions with a matching target can pair with it. */
  side: 'foe' | 'ally';
  pick: (battle: Battle, actor: Combatant) => Combatant | undefined;
}

const alive = (c: Combatant) => c.hp > 0;
const foesOf = (battle: Battle, actor: Combatant) =>
  battle.combatants.filter((c) => c.side !== actor.side && alive(c));
const alliesOf = (battle: Battle, actor: Combatant) =>
  battle.combatants.filter((c) => c.side === actor.side && alive(c));
const hpPct = (c: Combatant) => c.hp / c.stats.maxHp;

function selfHpBelow(pct: number): ConditionDef {
  return {
    id: `self-hp-${pct}`,
    label: `Self: HP < ${pct}%`,
    side: 'ally',
    pick: (_b, actor) => (hpPct(actor) < pct / 100 ? actor : undefined),
  };
}

function allyHpBelow(pct: number): ConditionDef {
  return {
    id: `ally-hp-${pct}`,
    label: `Ally: HP < ${pct}%`,
    side: 'ally',
    pick: (b, actor) =>
      alliesOf(b, actor)
        .filter((c) => hpPct(c) < pct / 100)
        .sort((x, y) => hpPct(x) - hpPct(y))[0],
  };
}

const CONDITION_LIST: ConditionDef[] = [
  { id: 'foe-any', label: 'Foe: any', side: 'foe', pick: (b, a) => foesOf(b, a)[0] },
  {
    id: 'foe-lowest-hp',
    label: 'Foe: lowest HP',
    side: 'foe',
    pick: (b, a) => foesOf(b, a).sort((x, y) => x.hp - y.hp)[0],
  },
  {
    id: 'foe-highest-hp',
    label: 'Foe: highest HP',
    side: 'foe',
    pick: (b, a) => foesOf(b, a).sort((x, y) => y.hp - x.hp)[0],
  },
  {
    id: 'foe-not-stunned',
    label: 'Foe: not stunned',
    side: 'foe',
    pick: (b, a) => foesOf(b, a).find((c) => c.stunned === 0),
  },
  selfHpBelow(30),
  selfHpBelow(50),
  selfHpBelow(70),
  allyHpBelow(30),
  allyHpBelow(50),
  allyHpBelow(70),
];

export const CONDITIONS: Record<string, ConditionDef> = Object.fromEntries(CONDITION_LIST.map((c) => [c.id, c]));
export const CONDITION_IDS = CONDITION_LIST.map((c) => c.id);

export interface GambitContext {
  inventory: Record<string, number>;
}

export function canUse(action: ActionDef, actor: Combatant, hero: Hero, ctx: GambitContext): boolean {
  if (actor.mp < action.mpCost) return false;
  if (action.kind === 'item') return (ctx.inventory[action.id] ?? 0) > 0;
  return learnedSkills(hero).includes(action.id);
}

/**
 * Walks the hero's gambits top to bottom and returns the first one whose condition finds a target
 * and whose action is usable. Falls back to attacking the first foe if none apply.
 */
export function chooseAction(
  battle: Battle,
  actor: Combatant,
  hero: Hero,
  ctx: GambitContext,
): { action: ActionDef; target: Combatant; gambitIndex: number } | null {
  for (const [i, gambit] of hero.gambits.entries()) {
    if (!gambit.enabled) continue;
    const action = ACTIONS[gambit.action];
    const condition = CONDITIONS[gambit.condition];
    if (!action || !condition || action.target !== condition.side) continue;
    if (!canUse(action, actor, hero, ctx)) continue;
    const target = condition.pick(battle, actor);
    if (target) return { action, target, gambitIndex: i };
  }
  const fallbackTarget = foesOf(battle, actor)[0];
  return fallbackTarget ? { action: ACTIONS.attack, target: fallbackTarget, gambitIndex: -1 } : null;
}
