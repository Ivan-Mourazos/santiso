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
import { cambiarParametros, type AccesoPanel } from "@/lib/navigation/contexto";
import { ConfirmDialog } from "@/components/ui/foundation/ConfirmDialog";
import { Toast } from "@/components/ui/foundation/Toast";
import styles from "./StudioShell.module.css";

export type TipoNavegacion = "nav-forward" | "nav-back" | "nav-tab";

type StudioValue = {
  /** Quién usa el panel; `null` con el acceso por contraseña apagado. */
  acceso: AccesoPanel;
  params: URLSearchParams;
  /** `tipo`: cómo se anima el cambio de pantalla (entrar, volver o cambiar de pestaña). */
  navigate: (href: string, tipo?: TipoNavegacion) => boolean;
  setParams: (patch: Record<string, string | null>, replace?: boolean) => boolean;
  /** Los avisos buenos se van solos a los 4 s (6 s si traen acción); los errores se quedan. */
  showToast: (
    message: string,
    type?: "success" | "error",
    action?: { label: string; onClick: () => void },
  ) => void;
  /**
   * Pide confirmación con el diálogo de la app. Con `trasCerrar`, la acción corre cuando el
   * diálogo ya se cerró: para descartar un editor, así el foco vuelve a donde se abrió.
   */
  showConfirm: (
    message: string,
    onConfirm: () => void | Promise<void>,
    opciones?: { trasCerrar?: boolean },
  ) => void;
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
export function StudioProvider({
  children,
  acceso = null,
}: {
  children: ReactNode;
  acceso?: AccesoPanel;
}) {
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
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action: () => void | Promise<void>;
    trasCerrar?: boolean;
  } | null>(null);
  // Acción confirmada que espera a que el diálogo se cierre (y devuelva el foco) para correr.
  const trasCerrar = useRef<(() => void | Promise<void>) | null>(null);
  useEffect(() => {
    if (confirmation || !trasCerrar.current) return;
    const accion = trasCerrar.current;
    trasCerrar.current = null;
    void accion();
  }, [confirmation]);
  const [pending, setPending] = useState(false);
  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" = "success",
      action?: { label: string; onClick: () => void },
    ) => setToast({ message, type, action }),
    [],
  );
  useEffect(() => {
    if (!toast || toast.type === "error") return;
    const reloj = setTimeout(() => setToast(null), toast.action ? 6000 : 4000);
    return () => clearTimeout(reloj);
  }, [toast]);
  const showConfirm = useCallback(
    (message: string, action: () => void | Promise<void>, opciones?: { trasCerrar?: boolean }) =>
      setConfirmation({ message, action, trasCerrar: opciones?.trasCerrar }),
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
    (href: string, tipo: TipoNavegacion = "nav-forward") => {
      if (new URL(href, window.location.href).href === window.location.href) return true;
      if (!authorize()) return false;
      drafts.current.clear();
      router.push(href, { transitionTypes: [tipo] });
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
  // Fin de la transición de un recorrido del historial: se llama al pintarse la pantalla nueva.
  const finRecorrido = useRef<(() => void) | null>(null);
  // Transición de vista del recorrido en curso, para no encadenar una sobre otra.
  const transicionRecorrido = useRef<ViewTransition | null>(null);
  useLayoutEffect(() => {
    finRecorrido.current?.();
    finRecorrido.current = null;
  }, [pathname, query]);
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
      // El aviso que reemite este mismo oyente (ver abajo) ya está revisado: pasa al router tal cual.
      if (!event.isTrusted) return;
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
      // Atrás (botón, gesto o tecla del sistema) también anima. React pinta los recorridos del
      // historial de golpe, sin transición de vista; así que se hace aquí a mano: el router recibe
      // el aviso, reemitido, dentro de una transición propia que desliza la página entera (cabecera
      // y pestañas quedan quietas, tienen nombre propio). Si el navegador ya animó (gesto de
      // Safari), o se pidió menos movimiento, pasa tal cual.
      const tipo =
        typeof target === "number" && target > historyPosition.current
          ? "recorrido-adelante"
          : "recorrido-atras";
      if (typeof target === "number") historyPosition.current = target;
      if (
        typeof ViewTransition === "undefined" ||
        !("types" in ViewTransition.prototype) ||
        event.hasUAVisualTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      // Un recorrido sobre otro aún animado (Atrás y Adelante seguidos) no anima: se corta el
      // anterior y el aviso pasa tal cual. Tampoco con la pestaña oculta.
      if (transicionRecorrido.current || document.visibilityState !== "visible") {
        transicionRecorrido.current?.skipTransition();
        return;
      }
      event.stopImmediatePropagation();
      const estado: unknown = event.state;
      let despachado = false;
      const despachar = () => {
        if (despachado) return false;
        despachado = true;
        window.dispatchEvent(new PopStateEvent("popstate", { state: estado }));
        return true;
      };
      const transicion = document.startViewTransition({
        update: () =>
          new Promise<void>((resolve) => {
            if (!despachar()) return resolve();
            finRecorrido.current = resolve;
            // Por si la pantalla no cambia (misma dirección): la transición no se queda colgada.
            setTimeout(resolve, 800);
          }),
        types: [tipo],
      });
      transicionRecorrido.current = transicion;
      // Cortarla rechaza estas promesas: es lo esperado, no un error.
      transicion.ready.catch(() => undefined);
      transicion.updateCallbackDone.catch(() => undefined);
      void transicion.finished
        .catch(() => undefined)
        .finally(() => {
          if (transicionRecorrido.current === transicion) transicionRecorrido.current = null;
        });
      // Vigilante fuera del update: si el navegador no pinta (WebKit puede quedarse segundos sin
      // fotogramas), el update no llega a correr. Se corta la animación y el router recibe el aviso.
      setTimeout(() => {
        if (despachado) return;
        transicion.skipTransition();
        despachar();
      }, 800);
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
    () => ({ acceso, params, navigate, setParams, showToast, showConfirm, register }),
    [acceso, params, navigate, setParams, showToast, showConfirm, register],
  );
  return (
    <StudioContext.Provider value={value}>
      {children}
      <div className={styles.toast}>
        <Toast
          message={toast?.message ?? null}
          kind={toast?.type}
          action={toast?.action}
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
          if (confirmation.trasCerrar) {
            trasCerrar.current = confirmation.action;
            setConfirmation(null);
            return;
          }
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
