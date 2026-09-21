import { Suspense, type ReactNode } from "react";
import { StudioProvider } from "@/components/studio/StudioContext";
import { StudioShell } from "@/components/studio/StudioShell";
import { LoadingState } from "@/components/ui/foundation/States";
import { outfit, nunito } from "@/styles/fonts";
import theme from "@/styles/tokens.module.css";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${theme.theme} ${outfit.variable} ${nunito.variable}`}>
      <Suspense fallback={<LoadingState title="Abriendo Studio…" />}>
        <StudioProvider>
          <StudioShell>{children}</StudioShell>
        </StudioProvider>
      </Suspense>
    </div>
  );
}
