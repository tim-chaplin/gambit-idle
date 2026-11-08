import type { EquipSlot } from '../types';

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  slot?: EquipSlot;
  atk?: number;
  def?: number;
  /** Consumables share their id with an action in ACTIONS. */
  consumable?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {
  'rusty-sword': { id: 'rusty-sword', name: 'Rusty Sword', price: 0, slot: 'weapon', atk: 1 },
  'bronze-sword': { id: 'bronze-sword', name: 'Bronze Sword', price: 30, slot: 'weapon', atk: 3 },
  'iron-sword': { id: 'iron-sword', name: 'Iron Sword', price: 100, slot: 'weapon', atk: 6 },
  'steel-sword': { id: 'steel-sword', name: 'Steel Sword', price: 420, slot: 'weapon', atk: 10 },
  'padded-vest': { id: 'padded-vest', name: 'Padded Vest', price: 0, slot: 'armor', def: 1 },
  'leather-armor': { id: 'leather-armor', name: 'Leather Armor', price: 35, slot: 'armor', def: 3 },
  'chain-mail': { id: 'chain-mail', name: 'Chain Mail', price: 120, slot: 'armor', def: 6 },
  'iron-plate': { id: 'iron-plate', name: 'Iron Plate', price: 480, slot: 'armor', def: 9 },
  potion: { id: 'potion', name: 'Potion', price: 8, consumable: true },
};

/** What the Town shop sells, in display order. */
export const SHOP_STOCK = [
  'bronze-sword',
  'iron-sword',
  'steel-sword',
  'leather-armor',
  'chain-mail',
  'iron-plate',
  'potion',
];
