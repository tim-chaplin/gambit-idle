export type Side = 'party' | 'enemy';
export type StatBlock = { maxHp: number; maxMp: number; atk: number; def: number };
export type EquipSlot = 'weapon' | 'armor';

/** A single gambit rule: when `condition` finds a target, perform `action` on it. */
export interface Gambit {
  enabled: boolean;
  condition: string;
  action: string;
}

/** Persistent hero data (saved). */
export interface Hero {
  id: string;
  name: string;
  classId: string;
  level: number;
  xp: number;
  equipment: Partial<Record<EquipSlot, string>>;
  gambits: Gambit[];
}

/** A participant in a battle (transient). */
export interface Combatant {
  id: string;
  name: string;
  side: Side;
  sprite: string;
  stats: StatBlock;
  hp: number;
  mp: number;
  /** Number of upcoming actions this combatant will skip. */
  stunned: number;
  heroId?: string;
  enemyId?: string;
  boss?: boolean;
}

export type BattleEvent =
  | { type: 'turn'; turn: number }
  | {
      type: 'action';
      actorId: string;
      actionId: string;
      actionName: string;
      targetId: string;
      damage?: number;
      heal?: number;
      stun?: boolean;
    }
  | { type: 'stunned'; actorId: string }
  | { type: 'idle'; actorId: string }
  | { type: 'defeated'; targetId: string };

export interface Battle {
  zoneId: string;
  combatants: Combatant[];
  turn: number;
  /** Ids of combatants still to act this turn. */
  queue: string[];
  outcome: 'victory' | 'defeat' | null;
}
