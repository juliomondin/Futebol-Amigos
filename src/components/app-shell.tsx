"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { PasswordDialog } from "@/components/password-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Hoje" },
  { href: "/elenco", label: "Elenco" },
  { href: "/devedores", label: "Devem" },
  { href: "/historico", label: "Histórico" },
];

export function AppShell({
  username,
  debtCount,
  children,
}: {
  username: string;
  debtCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-pitch/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="min-w-0">
            <p className="font-heading text-2xl leading-none tracking-wide text-pitch-ink uppercase">
              Futebol <span className="text-bib">&</span> Amigos
            </p>
            <p className="mt-1 truncate text-xs text-pitch-ink/70">Lista de {username}</p>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <PasswordDialog />
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                className="h-9 text-pitch-ink hover:bg-white/10 hover:text-pitch-ink"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
        <nav className="mx-auto hidden w-full max-w-xl gap-2 px-4 pb-3 md:flex">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} debtCount={debtCount} />
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-28 md:pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-pitch/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} debtCount={debtCount} stacked />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  href,
  debtCount,
  stacked = false,
}: {
  href: string;
  debtCount: number;
  stacked?: boolean;
}) {
  const pathname = usePathname();
  const link = links.find((item) => item.href === href)!;
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-pitch-ink/80",
        stacked && "flex-col gap-0 rounded-xl px-1 py-2 text-xs",
        active && "bg-bib text-pitch",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span>{link.label}</span>
      {href === "/devedores" && debtCount > 0 ? (
        <span
          className={cn(
            "rounded-full bg-destructive px-1.5 text-[11px] leading-4 text-white",
            active && "bg-pitch text-bib",
          )}
        >
          {debtCount}
        </span>
      ) : null}
    </Link>
  );
}
