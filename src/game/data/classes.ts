import type { Gambit, StatBlock } from '../types';

export interface ClassDef {
  id: string;
  name: string;
  sprite: string;
  base: StatBlock;
  growth: StatBlock;
  /** Skills in the order they are learned. */
  skills: { skillId: string; level: number }[];
  defaultGambits: Gambit[];
  gambitSlots: number;
}

export const CLASSES: Record<string, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    sprite: 'fighter',
    base: { maxHp: 20, maxMp: 10, atk: 8, def: 4 },
    growth: { maxHp: 10, maxMp: 1, atk: 2, def: 1 },
    skills: [
      { skillId: 'attack', level: 1 },
      { skillId: 'shield-bash', level: 2 },
    ],
    defaultGambits: [],
    gambitSlots: 4,
  },
};
