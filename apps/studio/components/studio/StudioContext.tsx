"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cambiarParametros } from "@/lib/navigation/contexto";
import { ConfirmDialog } from "@/components/ui/foundation/ConfirmDialog";
import { Toast } from "@/components/ui/foundation/Toast";
import styles from "./StudioShell.module.css";

type StudioValue = {
  params: URLSearchParams;
  navigate: (href: string) => boolean;
  setParams: (patch: Record<string, string | null>, replace?: boolean) => boolean;
  showToast: (message: string, type?: "success" | "error") => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>) => void;
  register: (id: string, dirty: boolean) => void;
};
const StudioContext = createContext<StudioValue | null>(null);
export function useOptionalStudio() {
  return useContext(StudioContext);
}
export function useStudio() {
  const value = useOptionalStudio();
  if (!value) throw new Error("StudioProvider no está montado");
  return value;
}
export function useUnsavedChanges(dirty: boolean) {
  const value = useOptionalStudio();
  const id = useId();
  const register = value?.register;
  useLayoutEffect(() => {
    register?.(id, dirty);
    return () => register?.(id, false);
  }, [register, id, dirty]);
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const drafts = useRef(new Set<string>());
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirty) drafts.current.add(id);
    else drafts.current.delete(id);
  }, []);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action: () => void | Promise<void>;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => setToast({ message, type }),
    [],
  );
  const showConfirm = useCallback(
    (message: string, action: () => void | Promise<void>) => setConfirmation({ message, action }),
    [],
  );
  const authorize = useCallback(() => {
    return (
      !drafts.current.size || window.confirm("Hay cambios sin guardar. ¿Descartarlos y continuar?")
    );
  }, []);
  const locationRef = useRef({ pathname, query });
  useEffect(() => {
    locationRef.current = { pathname, query };
  }, [pathname, query]);
  const navigate = useCallback(
    (href: string) => {
      if (new URL(href, window.location.href).href === window.location.href) return true;
      if (!authorize()) return false;
      drafts.current.clear();
      router.push(href);
      return true;
    },
    [authorize, router],
  );
  const setParams = useCallback(
    (patch: Record<string, string | null>, replace = false) => {
      const current = locationRef.current;
      const next = cambiarParametros(new URLSearchParams(current.query), patch).toString();
      if (next === current.query) return true;
      const href = current.pathname + (next ? `?${next}` : "");
      if (replace) {
        router.replace(href, { scroll: false });
        return true;
      }
      if (!authorize()) return false;
      drafts.current.clear();
      router.push(href, { scroll: false });
      return true;
    },
    [router, authorize],
  );
  // Historial del shell: cada entrada conserva un índice junto al estado interno de Next.
  const historyPosition = useRef(0);
  const restoring = useRef(false);
  useEffect(() => {
    const history = window.history;
    historyPosition.current =
      typeof history.state?.studioPosition === "number" ? history.state.studioPosition : 0;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    replace(
      { ...history.state, studioPosition: historyPosition.current },
      "",
      window.location.href,
    );
    // Next puede copiar el estado previo: asignar el índice al crear la entrada,
    // no al renderizar la ruta, permite deshacer Atrás sin desmontar el borrador.
    history.pushState = function (data, unused, url) {
      const position = historyPosition.current + 1;
      push({ ...data, studioPosition: position }, unused, url);
      historyPosition.current = position;
    };
    history.replaceState = function (data, unused, url) {
      replace({ ...data, studioPosition: historyPosition.current }, unused, url);
    };
    return () => {
      history.pushState = push;
      history.replaceState = replace;
    };
  }, []);
  useEffect(() => {
    // Navigation API permite cancelar el recorrido antes de que el router
    // restaure la pantalla y desmonte los formularios. popstate queda como respaldo.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    function beforeTraverse(event: Event) {
      if (!("navigationType" in event) || event.navigationType !== "traverse" || !event.cancelable)
        return;
      if (!authorize()) event.preventDefault();
      else drafts.current.clear();
    }
    navigation?.addEventListener("navigate", beforeTraverse);
    function unload(event: BeforeUnloadEvent) {
      if (drafts.current.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function traverse(event: PopStateEvent) {
      if (restoring.current) {
        restoring.current = false;
        event.stopImmediatePropagation();
        return;
      }
      const target = event.state?.studioPosition;
      if (drafts.current.size && !authorize()) {
        event.stopImmediatePropagation();
        restoring.current = true;
        window.history.go(typeof target === "number" ? historyPosition.current - target : 1);
        return;
      }
      drafts.current.clear();
      if (typeof target === "number") historyPosition.current = target;
    }
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", traverse, true);
    return () => {
      navigation?.removeEventListener("navigate", beforeTraverse);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", traverse, true);
    };
  }, [authorize]);
  const value = useMemo(
    () => ({ params, navigate, setParams, showToast, showConfirm, register }),
    [params, navigate, setParams, showToast, showConfirm, register],
  );
  return (
    <StudioContext.Provider value={value}>
      {children}
      <div className={styles.toast}>
        <Toast
          message={toast?.message ?? null}
          kind={toast?.type}
          onDismiss={() => setToast(null)}
        />
      </div>
      <ConfirmDialog
        open={confirmation !== null}
        title="Confirmar acción"
        description={confirmation?.message ?? ""}
        confirmLabel="Confirmar"
        pending={pending}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          if (!confirmation || pending) return;
          setPending(true);
          try {
            await confirmation.action();
            setConfirmation(null);
          } catch {
            showToast("No se pudo completar la acción. Tus cambios siguen aquí.", "error");
          } finally {
            setPending(false);
          }
        }}
      />
    </StudioContext.Provider>
  );
}
