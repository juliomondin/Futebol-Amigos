"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="sheet px-6 py-10 text-center">
      <h1 className="font-heading text-3xl tracking-wide uppercase">A lista não abriu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Alguma coisa falhou ao carregar. Tenta de novo sem fechar o dia.
      </p>
      <Button type="button" className="mt-5" onClick={() => reset()}>
        Tentar de novo
      </Button>
    </div>
  );
}
