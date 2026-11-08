import { useEffect, useState } from 'preact/hooks';
import { AREAS, zoneById } from '../../game/data/areas';
import { isZoneCleared, isZoneUnlocked } from '../../game/state';
import type { BattleEvent, Combatant } from '../../game/types';
import { Bar, Panel, Sprite } from '../components';
import { useEngine } from '../useEngine';

interface Float {
  id: number;
  targetId: string;
  text: string;
  kind: 'dmg' | 'heal' | 'info';
}

let floatId = 0;

function BattleView() {
  const engine = useEngine();
  const battle = engine.battle;
  const [floats, setFloats] = useState<Float[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);

  useEffect(
    () =>
      engine.onBattleEvents((events: BattleEvent[]) => {
        const added: Float[] = [];
        for (const e of events) {
          if (e.type === 'action') {
            setActing(e.actorId);
            if (e.damage !== undefined) {
              setHit(e.targetId);
              added.push({ id: ++floatId, targetId: e.targetId, text: `${e.damage}`, kind: 'dmg' });
            }
            if (e.heal !== undefined) added.push({ id: ++floatId, targetId: e.targetId, text: `+${e.heal}`, kind: 'heal' });
            if (e.stun) added.push({ id: ++floatId, targetId: e.targetId, text: 'STUN', kind: 'info' });
          } else if (e.type === 'stunned') {
            added.push({ id: ++floatId, targetId: e.actorId, text: 'zzz', kind: 'info' });
          }
        }
        if (added.length) {
          setFloats((f) => [...f, ...added]);
          setTimeout(() => setFloats((f) => f.filter((x) => !added.includes(x))), 1000);
        }
        setTimeout(() => {
          setActing(null);
          setHit(null);
        }, 350);
      }),
    [engine],
  );

  const unit = (c: Combatant) => {
    const classes = ['unit', c.hp <= 0 ? 'dead' : '', acting === c.id ? 'acting' : '', hit === c.id ? 'hit' : '', c.side];
    return (
      <div class={classes.join(' ')} key={c.id}>
        <div class="unit-sprite">
          <Sprite sprite={c.sprite} size={c.boss ? 96 : 56} class={c.side === 'party' ? 'flip' : ''} />
          {c.stunned > 0 && c.hp > 0 && <span class="status-tag">STUN</span>}
          {floats
            .filter((f) => f.targetId === c.id)
            .map((f) => (
              <span class={`float float-${f.kind}`} key={f.id}>
                {f.text}
              </span>
            ))}
        </div>
        <div class="unit-name">{c.name}</div>
        <Bar kind="hp" value={c.hp} max={c.stats.maxHp} label={c.side === 'party' ? `${c.hp}/${c.stats.maxHp}` : undefined} />
        {c.side === 'party' && <Bar kind="mp" value={c.mp} max={c.stats.maxMp} label={`${c.mp}/${c.stats.maxMp}`} />}
      </div>
    );
  };

  return (
    <div class="stage">
      <div class="stage-top">
        <span>{zoneById(battle.zoneId).name}</span>
        <span>Turn {Math.max(1, battle.turn)}</span>
      </div>
      <div class="row enemies">{battle.combatants.filter((c) => c.side === 'enemy').map(unit)}</div>
      <div class="row party">{battle.combatants.filter((c) => c.side === 'party').map(unit)}</div>
      {engine.banner && <div class={`banner banner-${engine.banner.tone}`}>{engine.banner.text}</div>}
    </div>
  );
}

export function AreaScreen({ areaId }: { areaId: string }) {
  const engine = useEngine();
  const area = AREAS.find((a) => a.id === areaId)!;
  const { state } = engine;

  return (
    <div class="screen">
      <h1 class="screen-title">{area.name}</h1>
      <BattleView />
      <Panel title="Battle log">
        <ul class="log">
          {engine.log.slice(0, 6).map((line) => (
            <li key={line.id} class={line.tone ? `log-${line.tone}` : ''}>
              {line.text}
            </li>
          ))}
          {engine.log.length === 0 && <li class="muted">The battle begins...</li>}
        </ul>
      </Panel>
      <Panel title="Zones">
        <div class="zones">
          {area.zones.map((zone, i) => {
            const unlocked = isZoneUnlocked(state, zone.id);
            const cleared = isZoneCleared(state, zone.id);
            const kills = Math.min(state.zoneKills[zone.id] ?? 0, zone.killsToClear);
            const current = state.currentZone === zone.id;
            return (
              <button
                class={`zone ${current ? 'current' : ''} ${zone.boss ? 'boss' : ''}`}
                disabled={!unlocked}
                onClick={() => engine.setZone(zone.id)}
              >
                <span class="zone-name">
                  {i + 1}. {unlocked ? zone.name : '???'}
                </span>
                <span class="zone-progress">
                  {!unlocked ? 'Locked' : zone.boss ? (cleared ? 'Defeated' : 'BOSS') : cleared ? 'Cleared' : `${kills}/${zone.killsToClear}`}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
