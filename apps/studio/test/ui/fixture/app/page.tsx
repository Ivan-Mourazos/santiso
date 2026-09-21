import { Interactions } from "./Interactions";
import { Button } from "../../../../components/ui/foundation/Button";
import { Field, Select, Textarea } from "../../../../components/ui/foundation/Fields";
import { PageHeader } from "../../../../components/ui/foundation/PageHeader";
import { DataTable } from "../../../../components/ui/foundation/DataTable";
import { EmptyState, LoadingState, ErrorState } from "../../../../components/ui/foundation/States";
export default function Page() {
  return (
    <main>
      <PageHeader
        eyebrow="UD Santiso · Studio"
        title="Una base para cada jornada"
        description="Galería de componentes. Datos ficticios, sin conexión a la base de datos."
      />
      <section className="grid">
        <div className="card stack">
          <h2 className="section-label">Datos del equipo</h2>
          <Field
            label="Nombre del equipo"
            hint="Escribe el nombre que aparece en el calendario."
            error="Falta el nombre."
          />
          <Select label="Temporada" defaultValue="2026/27">
            <option>2026/27</option>
            <option>2025/26</option>
          </Select>
          <Textarea label="Notas" placeholder="Fecha pendiente, cambio de campo…" />
          <div className="actions">
            <Button>Guardar equipo</Button>
            <Button variant="secondary">Cancelar</Button>
            <Button pending>Guardar</Button>
          </div>
        </div>
        <div className="stack">
          <h2 className="section-label">Estados de trabajo</h2>
          <EmptyState
            title="Todavía no hay partidos"
            detail="Añade el primer partido para preparar un cartel."
            action={<Button>Añadir partido</Button>}
          />
          <LoadingState title="Cargando plantilla" />
          <ErrorState
            title="No se pudo guardar"
            detail="Tus cambios siguen aquí. Vuelve a intentarlo."
            action={<Button variant="secondary">Reintentar</Button>}
          />
        </div>
      </section>
      <DataTable
        caption="Clasificación de ejemplo"
        rows={[
          { id: "santiso", equipo: "U.D. Santiso", puntos: 12, jugados: 5 },
          { id: "visitante", equipo: "Equipo visitante", puntos: 9, jugados: 5 },
        ]}
        rowKey={(row) => row.id}
        columns={[
          { id: "equipo", heading: "Equipo", render: (row) => row.equipo, rowHeader: true },
          { id: "puntos", heading: "Puntos", render: (row) => row.puntos, numeric: true },
          { id: "jugados", heading: "Partidos", render: (row) => row.jugados, numeric: true },
        ]}
      />
      <Interactions />
    </main>
  );
}
