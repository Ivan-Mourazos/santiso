import type { ReactNode } from "react";
import { outfit, nunito } from "../../../../styles/fonts";
import theme from "../../../../styles/tokens.module.css";
import "./fixture.css";
export const metadata = { title: "Santiso Studio · Componentes" };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={`${outfit.variable} ${nunito.variable} ${theme.theme}`}>{children}</body>
    </html>
  );
}
