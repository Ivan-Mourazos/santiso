import { redirect } from "next/navigation";

// App interna: la raíz lleva al panel. Sin sesión, proxy.ts redirige a /login.
export default function RootPage() {
  redirect("/admin");
}
