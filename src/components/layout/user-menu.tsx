import Link from "next/link";
import { UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

/** Request-time: rendered inside <Suspense> in the header. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user)
    return (
      <Link href="/entrar" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-fg hover:opacity-90">
        Entrar
      </Link>
    );
  const name = user.displayName ?? user.username ?? user.email?.split("@")[0] ?? "Mi cuenta";
  return (
    <Link href="/cuenta" className="inline-flex h-9 max-w-40 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:border-primary" title="Mi cuenta">
      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </Link>
  );
}

export function UserMenuFallback() {
  return <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-surface-2" aria-hidden="true" />;
}
