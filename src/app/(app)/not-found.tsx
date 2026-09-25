import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="sheet px-6 py-10 text-center">
      <h1 className="font-heading text-3xl tracking-wide uppercase">Essa lista não existe</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ela pode ter sido de outro dia, ou o link está errado.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button render={<Link href="/" />}>Voltar para hoje</Button>
        <Button variant="outline" render={<Link href="/historico" />}>
          Ver histórico
        </Button>
      </div>
    </div>
  );
}
