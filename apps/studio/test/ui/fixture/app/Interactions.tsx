"use client";
import { useRef, useState } from "react";
import { Button } from "../../../../components/ui/foundation/Button";
import { Field } from "../../../../components/ui/foundation/Fields";
import { Dialog } from "../../../../components/ui/foundation/Dialog";
import { ConfirmDialog } from "../../../../components/ui/foundation/ConfirmDialog";
import { Tabs } from "../../../../components/ui/foundation/Tabs";
import { Toast } from "../../../../components/ui/foundation/Toast";
export function Interactions() {
  const fieldRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(0);
  const [category, setCategory] = useState("senior");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="stack">
      <h2 className="section-label">Interacciones</h2>
      <div className="actions">
        <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Abrir confirmación
        </Button>
        <Button variant="secondary" onClick={() => setMessage("Cambios guardados")}>
          Mostrar aviso
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        initialFocusRef={fieldRef}
        title="Editar partido"
        description="Revisa el campo antes de guardar."
        footer={<Button onClick={() => setOpen(false)}>Guardar partido</Button>}
      >
        <Field ref={fieldRef} label="Campo" defaultValue="Campo municipal" />
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setPending(true);
          setCount((n) => n + 1);
        }}
        title="Eliminar equipo"
        description="Este ejemplo no elimina ningún registro. La operación permanece pendiente para probar su bloqueo."
        confirmLabel="Eliminar"
        pending={pending}
      />
      <span aria-label="Confirmaciones">{count}</span>
      <Tabs
        label="Categoría"
        value={category}
        onValueChange={setCategory}
        items={[
          { value: "senior", label: "Senior", content: <p>Partidos del equipo Senior.</p> },
          {
            value: "veteranos",
            label: "Veteranos",
            content: <p>Partidos del equipo Veteranos.</p>,
          },
          { value: "directiva", label: "Directiva", content: <p>Directiva</p>, disabled: true },
        ]}
      />
      <section aria-label="Avisos">
        <Toast message={message} onDismiss={() => setMessage(null)} />
      </section>
    </section>
  );
}
