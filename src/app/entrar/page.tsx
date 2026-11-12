import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell, authLink } from "@/components/auth/auth-page";
import { signInAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

async function Form({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && /^\/(?!\/)/.test(sp.next) ? sp.next : "/cuenta";
  return (
    <>
      {sp.error === "enlace" && <p className="mb-4 rounded-lg bg-warning/12 px-3 py-2 text-sm text-warning">El enlace no es válido o caducó. Inicia sesión o regístrate de nuevo.</p>}
      <AuthForm mode="login" action={signInAction} next={next} />
    </>
  );
}

export default function LoginPage(props: PageProps<"/entrar">) {
  return (
    <AuthShell title="Entrar en LaptopVerse" subtitle="Publica reseñas, guarda laptops y participa en la comunidad." footer={<>¿No tienes cuenta? {authLink("/registro", "Regístrate")}</>}>
      <Suspense fallback={<div className="h-64" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
