"use client";
import { createBrowserClient } from "@supabase/ssr";

// Singleton para que React no recree el cliente en cada render
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

/**
 * Alias para componentes admin: misma instancia que getSupabaseBrowserClient().
 * Incluye la sesión del usuario → opera con el rol `authenticated` en Supabase RLS.
 */
export const supabase = getSupabaseBrowserClient();

