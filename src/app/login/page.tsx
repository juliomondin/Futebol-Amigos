import type { Metadata } from "next";
import { getLoginHint } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  const hint = await getLoginHint();

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="sheet p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-pitch text-bib" aria-hidden>
              <BallMark />
            </span>
            <div>
              <p className="font-heading text-2xl leading-none tracking-wide uppercase">
                Futebol <span className="text-bib">&</span> Amigos
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Acesso do administrador</p>
            </div>
          </div>
          <h1 className="font-heading text-3xl tracking-wide uppercase">Entrar na lista</h1>
          <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">
            Só quem organiza o futebol mexe aqui. A ordem é a ordem de chegada.
          </p>
          <LoginForm />
          {hint ? (
            <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              Primeiro acesso: usuário <strong className="text-foreground">{hint.username}</strong> e senha{" "}
              <strong className="text-foreground">{hint.password}</strong>. Troque a senha depois de entrar.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function BallMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 8c2.3 2.5 3.6 5 3.6 8s-1.3 5.5-3.6 8c-2.3-2.5-3.6-5-3.6-8s1.3-5.5 3.6-8Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 16h15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
