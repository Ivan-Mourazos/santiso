import { redirect } from "next/navigation";

// Herramienta interna, sin login: la raíz lleva al panel.
export default function RootPage() {
  redirect("/admin");
}
