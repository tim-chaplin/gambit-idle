import { itemBonus, TURN_MS } from '../../game/engine';
import { CLASSES } from '../../game/data/classes';
import { ITEMS, SHOP_STOCK } from '../../game/data/items';
import { heroStats, heroVitals, isPartyRested, INN_RECOVERY_PER_TICK } from '../../game/state';
import { Bar, Panel, Sprite } from '../components';
import { useEngine } from '../useEngine';

export function TownScreen() {
  const engine = useEngine();
  const { state } = engine;
  const soloHero = state.heroes.length === 1 ? state.heroes[0] : null;

  return (
    <div class="screen">
      <h1 class="screen-title">Town</h1>
      <Panel title="Inn">
        <div class="inn-party">
          {state.heroes.map((hero) => {
            const stats = heroStats(hero);
            const { hp, mp } = heroVitals(hero);
            return (
              <div class="inn-hero" key={hero.id}>
                <Sprite sprite={CLASSES[hero.classId].sprite} size={40} />
                <div class="inn-bars">
                  <div>{hero.name}</div>
                  <Bar kind="hp" value={hp} max={stats.maxHp} label={`HP ${hp}/${stats.maxHp}`} />
                  <Bar kind="mp" value={mp} max={stats.maxMp} label={`MP ${mp}/${stats.maxMp}`} />
                </div>
              </div>
            );
          })}
        </div>
        {state.activity === 'resting' ? (
          <>
            <p class="hint">
              {isPartyRested(state) ? 'Fully rested. Head back out when ready!' : 'Resting... recovering HP and MP.'}
            </p>
            <button class="btn btn-wide" onClick={() => engine.leaveInn()}>
              Leave the Inn
            </button>
          </>
        ) : (
          <>
            <p class="hint">
              Rest to recover {Math.round(INN_RECOVERY_PER_TICK * 100)}% of max HP and MP every {TURN_MS / 1000}s. Resting
              ends any fight in progress.
            </p>
            <button class="btn btn-wide btn-alt" onClick={() => engine.rest()}>
              Rest at the Inn
            </button>
          </>
        )}
      </Panel>
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
