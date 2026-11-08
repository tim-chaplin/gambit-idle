import { itemBonus } from '../../game/engine';
import { ITEMS, SHOP_STOCK } from '../../game/data/items';
import { Panel } from '../components';
import { useEngine } from '../useEngine';

export function TownScreen() {
  const engine = useEngine();
  const { state } = engine;
  const soloHero = state.heroes.length === 1 ? state.heroes[0] : null;

  return (
    <div class="screen">
      <h1 class="screen-title">Town</h1>
      <Panel title="Shop">
        <div class="shop">
          {SHOP_STOCK.map((id) => {
            const item = ITEMS[id];
            const owned = state.inventory[id] ?? 0;
            const equipped = state.heroes.filter((h) => Object.values(h.equipment).includes(id)).length;
            const canEquip = soloHero && item.slot && owned > 0;
            return (
              <div class="shop-row" key={id}>
                <div class="shop-info">
                  <div class="shop-name">{item.name}</div>
                  <div class="shop-desc">{itemBonus(id)}</div>
                  <div class="shop-owned">
                    {equipped > 0 ? 'Equipped' : owned > 0 ? `Owned: ${owned}` : ' '}
                  </div>
                </div>
                <div class="shop-actions">
                  <button class="btn" disabled={state.gold < item.price} onClick={() => engine.buy(id)}>
                    {item.price} G
                  </button>
                  {canEquip && (
                    <button class="btn btn-alt" onClick={() => engine.equip(soloHero.id, item.slot!, id)}>
                      Equip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
