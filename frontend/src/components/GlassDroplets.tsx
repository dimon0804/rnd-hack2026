import { GLASS_DROPLETS_BG, GLASS_DROPLETS_FG } from "../data/glassDropletsData";

export function GlassDropletsLayer() {
  return (
    <div className="glass-droplets" aria-hidden>
      {GLASS_DROPLETS_BG.map((drop, i) => (
        <span
          key={i}
          className={`glass-droplet${drop.lg ? " glass-droplet--large" : ""}`}
          style={{
            top: `${drop.t}%`,
            left: `${drop.l}%`,
            width: drop.w,
            height: drop.h,
            borderRadius: drop.br,
            animationDelay: `${drop.d}s`,
          }}
        />
      ))}
    </div>
  );
}

export function GlassDropletsForeground() {
  return (
    <div className="glass-droplets-front" aria-hidden>
      {GLASS_DROPLETS_FG.map((drop, i) => (
        <span
          key={`fg-${i}`}
          className={`glass-droplet-fg glass-droplet-fg--${drop.tier}`}
          style={{
            top: `${drop.t}%`,
            left: `${drop.l}%`,
            width: drop.w,
            height: drop.h,
            borderRadius: drop.br,
            animationDelay: `${drop.d}s`,
          }}
        />
      ))}
    </div>
  );
}
