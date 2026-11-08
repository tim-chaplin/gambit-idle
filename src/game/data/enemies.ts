import type { StatBlock } from '../types';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  stats: StatBlock;
  xp: number;
  gold: number;
  boss?: boolean;
}

const s = (maxHp: number, atk: number, def: number): StatBlock => ({ maxHp, maxMp: 0, atk, def });

export const ENEMIES: Record<string, EnemyDef> = {
  'green-slime': { id: 'green-slime', name: 'Green Slime', sprite: 'slime-green', stats: s(12, 5, 1), xp: 3, gold: 2 },
  'blue-slime': { id: 'blue-slime', name: 'Blue Slime', sprite: 'slime-blue', stats: s(20, 8, 3), xp: 6, gold: 4 },
  'mud-slime': { id: 'mud-slime', name: 'Mud Slime', sprite: 'slime-mud', stats: s(40, 12, 7), xp: 10, gold: 7 },
  'red-slime': { id: 'red-slime', name: 'Red Slime', sprite: 'slime-red', stats: s(38, 17, 5), xp: 13, gold: 10 },
  'king-slime': {
    id: 'king-slime',
    name: 'King Slime',
    sprite: 'slime-king',
    stats: s(480, 30, 12),
    xp: 150,
    gold: 100,
    boss: true,
  },
};
