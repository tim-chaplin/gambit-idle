import type { ComponentChildren } from 'preact';

/** Sprites are plain PNGs in public/sprites/, so art can be swapped without code changes. */
export const spriteUrl = (sprite: string) => `${import.meta.env.BASE_URL}sprites/${sprite}.png`;

export function Sprite({ sprite, size = 48, class: className = '' }: { sprite: string; size?: number; class?: string }) {
  return <img class={`sprite ${className}`} src={spriteUrl(sprite)} width={size} height={size} alt="" draggable={false} />;
}

export function Bar({ value, max, kind, label }: { value: number; max: number; kind: 'hp' | 'mp' | 'xp'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div class={`bar bar-${kind}`}>
      <div class="bar-fill" style={{ width: `${pct}%` }} />
      {label !== undefined && <span class="bar-label">{label}</span>}
    </div>
  );
}

export function Panel({ title, children, right }: { title?: string; children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <section class="panel">
      {title && (
        <h2 class="panel-title">
          <span>{title}</span>
          {right}
        </h2>
      )}
      {children}
    </section>
  );
}
