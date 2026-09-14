import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase-browser";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** 
 * Cliente unificado.
 * En navegador: usa el singleton de @supabase/ssr (evita aviso "Multiple GoTrueClient").
 * En servidor: usa el cliente estándar (útil para Server Components estáticos).
 */
export const supabase = typeof window !== "undefined" 
  ? getSupabaseBrowserClient() 
  : createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: async (url, options) => {
          try {
            return await fetch(url, options);
          } catch {
            return new Response(
              JSON.stringify({ message: "Network unavailable", error: "Offline" }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        },
      },
    });

