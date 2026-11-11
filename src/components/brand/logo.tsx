import Link from "next/link";

/** LaptopVerse mark: a laptop silhouette orbited by a ring ("verse"). */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="lv-g" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="11" y="12" width="26" height="17" rx="2.5" stroke="url(#lv-g)" strokeWidth="3" />
      <path d="M7 33h34l-2.5 4h-29L7 33Z" fill="url(#lv-g)" />
      <ellipse
        cx="24"
        cy="24"
        rx="21"
        ry="8.5"
        transform="rotate(-18 24 24)"
        stroke="url(#lv-g)"
        strokeWidth="1.8"
        strokeDasharray="38 6"
        opacity="0.85"
      />
      <circle cx="42.5" cy="16" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2" aria-label="LaptopVerse — inicio">
      <LogoMark className="h-8 w-8 transition-transform duration-500 group-hover:rotate-[8deg]" />
      {withText && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Laptop<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Verse</span>
        </span>
      )}
    </Link>
  );
}
