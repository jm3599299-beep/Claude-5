import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell, authLink } from "@/components/auth/auth-page";
import { signUpAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Comparte experiencias reales con tu laptop. Las reseñas de cuentas nuevas se revisan antes de publicarse."
      footer={<>¿Ya tienes cuenta? {authLink("/entrar", "Entra")}</>}
    >
      <AuthForm mode="register" action={signUpAction} next="/cuenta" />
    </AuthShell>
  );
}
