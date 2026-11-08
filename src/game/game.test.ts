import { describe, expect, it } from 'vitest';
import { createBattle, runBattle, stepAction } from './combat';
import { zoneById } from './data/areas';
import { chooseAction } from './gambits';
import { seeded } from './rng';
import {
  applyVictory,
  buyItem,
  deserialize,
  equipItem,
  heroStats,
  isZoneUnlocked,
  newGame,
  serialize,
  xpToNext,
} from './state';

describe('gambits', () => {
  it('uses the first rule whose condition and action apply', () => {
    const state = newGame();
    const battle = createBattle(state, 'sf-1', seeded(1));
    const fighter = battle.combatants[0];
    const hero = state.heroes[0];

    // Full HP: the potion rule is skipped, attack rule fires.
    expect(chooseAction(battle, fighter, hero, state)?.action.id).toBe('attack');

    // Low HP: potion rule fires and targets self.
    fighter.hp = 5;
    const choice = chooseAction(battle, fighter, hero, state);
    expect(choice?.action.id).toBe('potion');
    expect(choice?.target.id).toBe(fighter.id);

    // No potions left: falls through to attack.
    state.inventory.potion = 0;
    expect(chooseAction(battle, fighter, hero, state)?.action.id).toBe('attack');
  });

  it('skips skills the hero has not learned yet', () => {
    const state = newGame();
    const hero = state.heroes[0];
    hero.gambits = [
      { enabled: true, condition: 'foe-not-stunned', action: 'shield-bash' },
      { enabled: true, condition: 'foe-any', action: 'attack' },
    ];
    const battle = createBattle(state, 'sf-1', seeded(1));
    expect(chooseAction(battle, battle.combatants[0], hero, state)?.action.id).toBe('attack');
    hero.level = 2;
    expect(chooseAction(battle, battle.combatants[0], hero, state)?.action.id).toBe('shield-bash');
  });

  it('ignores disabled rules and mismatched condition/action pairs', () => {
    const state = newGame();
    const hero = state.heroes[0];
    hero.gambits = [
      { enabled: false, condition: 'foe-any', action: 'potion' },
      { enabled: true, condition: 'self-hp-70', action: 'attack' },
    ];
    const battle = createBattle(state, 'sf-1', seeded(1));
    const fighter = battle.combatants[0];
    fighter.hp = 1;
    // Neither rule is valid, so the fallback attack is used.
    expect(chooseAction(battle, fighter, hero, state)?.gambitIndex).toBe(-1);
  });
});

describe('combat', () => {
  it('stuns make the target skip its next action', () => {
    const state = newGame();
    state.heroes[0].level = 2;
    state.heroes[0].gambits = [{ enabled: true, condition: 'foe-any', action: 'shield-bash' }];
    const battle = createBattle(state, 'sf-5', seeded(3));
    const turn1 = stepAction(battle, state, seeded(3));
    expect(turn1.find((e) => e.type === 'action')).toMatchObject({ actionId: 'shield-bash', stun: true });
    const kingTurn = stepAction(battle, state, seeded(3));
    expect(kingTurn).toEqual([{ type: 'stunned', actorId: 'enemy-0' }]);
  });

  it('a fresh fighter beats the first zone', () => {
    const state = newGame();
    const battle = runBattle(createBattle(state, 'sf-1', seeded(7)), state, seeded(7));
    expect(battle.outcome).toBe('victory');
  });
});

describe('battle setup', () => {
  it('labels duplicate enemies A, B, C', () => {
    const state = newGame();
    for (let seed = 0; seed < 50; seed++) {
      const names = createBattle(state, 'sf-2', seeded(seed))
        .combatants.filter((c) => c.side === 'enemy')
        .map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('progression', () => {
  it('victories grant rewards, levels and unlock the next zone', () => {
    const state = newGame();
    expect(isZoneUnlocked(state, 'sf-2')).toBe(false);
    for (let i = 0; i < zoneById('sf-1').killsToClear; i++) {
      const battle = runBattle(createBattle(state, 'sf-1', seeded(i)), state, seeded(i));
      applyVictory(state, battle);
    }
    expect(state.gold).toBeGreaterThan(0);
    expect(state.heroes[0].level).toBeGreaterThan(1);
    expect(isZoneUnlocked(state, 'sf-2')).toBe(true);
    expect(isZoneUnlocked(state, 'sf-3')).toBe(false);
  });

  it('buying and equipping changes stats', () => {
    const state = newGame();
    state.gold = 30;
    const before = heroStats(state.heroes[0]).atk;
    expect(buyItem(state, 'bronze-sword')).toBe(true);
    expect(state.gold).toBe(0);
    expect(equipItem(state, 'hero-1', 'weapon', 'bronze-sword')).toBe(true);
    expect(heroStats(state.heroes[0]).atk).toBe(before + 2);
    expect(state.inventory['rusty-sword']).toBe(1);
    expect(buyItem(state, 'iron-sword')).toBe(false);
  });

  it('xp curve increases', () => {
    expect(xpToNext(1)).toBe(12);
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
  });

  it('saves round-trip and bad saves start fresh', () => {
    const state = newGame();
    state.gold = 42;
    expect(deserialize(serialize(state)).gold).toBe(42);
    expect(deserialize('not json').gold).toBe(0);
    expect(deserialize(null).heroes).toHaveLength(1);
  });
});
