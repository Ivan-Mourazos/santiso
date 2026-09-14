import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const SENIOR_TEAMS = [
  "U.D. SANTISO F.C.",
  "C.D. SAN MAMED",
  "C.D. BERRES",
  "ATLETICO ETER",
  "CLUB ARENAL",
  "C.S.D ARZUA \"B\"",
  "GUERREROS DEL SOL",
  "S.D. CRUCES",
  "S.D. BANDEIRA",
  "S.D. TOURO",
  "VILATUXE F.C.",
  "VISTA ALEGRE S.D.",
  "C.D. COMPAÑÍA DE MARIA",
  "A.C.U.D. CAMPORRAPADO",
];

const VETERANOS_TEAMS = [
  "U.D. SANTISO F.C. SOLAINA",
  "C.D. VETERANOS BERMÉS",
  "S.D. TORDOIA",
  "S.E. ABELLA S.D.E C.",
  "PREFABRICADOS FARO RODEIRO VETERANS",
  "S.D.C. RECESENDE",
  "CAF SILLEDA",
  "S.D. CRUCES",
  "VETERANOS BALOMPIE FOGAR DE BREOGAN",
  "CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS",
  "S.D. CACHEIRAS",
  "S.D. TOURO VETERANOS",
  "ULLA OIL VETERANOS",
  "MELIDE VETERANOS",
  "SR CALO - MILONGAS",
  "RESMON C.F.",
];

const SENIOR_MATCHES = [
  { j: 1, fecha: "2026-09-27T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "C.D. SAN MAMED", campo: "Municipal de Santiso" },
  { j: 2, fecha: "2026-10-04T17:00:00Z", local: "C.D. BERRES", rival: "U.D. SANTISO F.C.", campo: "Pardiñeiro" },
  { j: 3, fecha: "2026-10-18T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "ATLETICO ETER", campo: "Municipal de Santiso" },
  { j: 4, fecha: "2026-10-25T17:00:00Z", local: "CLUB ARENAL", rival: "U.D. SANTISO F.C.", campo: "Campo Municipal Del Sergas" },
  { j: 5, fecha: "2026-11-08T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "C.S.D ARZUA \"B\"", campo: "Municipal de Santiso" },
  { j: 6, fecha: "2026-11-15T17:00:00Z", local: "GUERREROS DEL SOL", rival: "U.D. SANTISO F.C.", campo: "Municipal de Santiso" },
  { j: 7, fecha: "2026-11-22T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "S.D. CRUCES", campo: "Municipal de Santiso" },
  { j: 8, fecha: "2026-11-29T17:00:00Z", local: "S.D. BANDEIRA", rival: "U.D. SANTISO F.C.", campo: "A Gandareira" },
  { j: 9, fecha: "2026-12-13T17:00:00Z", local: "S.D. TOURO", rival: "U.D. SANTISO F.C.", campo: "Municipal De Loxo (Touro)" },
  { j: 10, fecha: "2026-12-20T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "VILATUXE F.C.", campo: "Municipal de Santiso" },
  { j: 11, fecha: "2027-01-10T17:00:00Z", local: "VISTA ALEGRE S.D.", rival: "U.D. SANTISO F.C.", campo: "Santa Isabel" },
  { j: 12, fecha: "2027-01-17T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "C.D. COMPAÑÍA DE MARIA", campo: "Municipal de Santiso" },
  { j: 13, fecha: "2027-01-24T17:00:00Z", local: "A.C.U.D. CAMPORRAPADO", rival: "U.D. SANTISO F.C.", campo: "Da Silveira - Camporrapado" },
  { j: 14, fecha: "2027-01-31T17:00:00Z", local: "C.D. SAN MAMED", rival: "U.D. SANTISO F.C.", campo: "San Mamed" },
  { j: 15, fecha: "2027-02-14T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "C.D. BERRES", campo: "Municipal de Santiso" },
  { j: 16, fecha: "2027-02-21T17:00:00Z", local: "ATLETICO ETER", rival: "U.D. SANTISO F.C.", campo: "Municipal de Santiso" },
  { j: 17, fecha: "2027-02-28T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "CLUB ARENAL", campo: "Municipal de Santiso" },
  { j: 18, fecha: "2027-03-07T17:00:00Z", local: "C.S.D ARZUA \"B\"", rival: "U.D. SANTISO F.C.", campo: "O Viso" },
  { j: 19, fecha: "2027-03-14T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "GUERREROS DEL SOL", campo: "Municipal de Santiso" },
  { j: 20, fecha: "2027-03-21T17:00:00Z", local: "S.D. CRUCES", rival: "U.D. SANTISO F.C.", campo: "Mpal Do Camballón" },
  { j: 21, fecha: "2027-04-04T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "S.D. BANDEIRA", campo: "Municipal de Santiso" },
  { j: 22, fecha: "2027-04-11T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "S.D. TOURO", campo: "Municipal de Santiso" },
  { j: 23, fecha: "2027-04-18T17:00:00Z", local: "VILATUXE F.C.", rival: "U.D. SANTISO F.C.", campo: "San Lorenzo - Vilatuxe" },
  { j: 24, fecha: "2027-04-25T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "VISTA ALEGRE S.D.", campo: "Municipal de Santiso" },
  { j: 25, fecha: "2027-05-02T17:00:00Z", local: "C.D. COMPAÑÍA DE MARIA", rival: "U.D. SANTISO F.C.", campo: "Campo Municipal As Cancelas" },
  { j: 26, fecha: "2027-05-09T17:00:00Z", local: "U.D. SANTISO F.C.", rival: "A.C.U.D. CAMPORRAPADO", campo: "Municipal de Santiso" },
];

const VETERANOS_MATCHES = [
  { j: 1, fecha: "2026-09-12T18:00:00Z", local: "S.D. CRUCES", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Mpal Do Camballón" },
  { j: 2, fecha: "2026-09-19T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "RESMON C.F.", campo: "Municipal de Santiso" },
  { j: 3, fecha: "2026-09-26T18:00:00Z", local: "PREFABRICADOS FARO RODEIRO VETERANS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "A Raña - Rodeiro" },
  { j: 4, fecha: "2026-10-03T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.D. TOURO VETERANOS", campo: "Municipal de Santiso" },
  { j: 5, fecha: "2026-10-10T18:00:00Z", local: "CAF SILLEDA", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Outeiriño" },
  { j: 6, fecha: "2026-10-17T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.D.C. RECESENDE", campo: "Municipal de Santiso" },
  { j: 7, fecha: "2026-10-24T18:00:00Z", local: "MELIDE VETERANOS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Campo Municipal Jesús Carlos Pampin Rua" },
  { j: 8, fecha: "2026-11-07T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "VETERANOS BALOMPIE FOGAR DE BREOGAN", campo: "Municipal de Santiso" },
  { j: 9, fecha: "2026-11-14T18:00:00Z", local: "S.D. CACHEIRAS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "A Cañoteira - Cacheiras" },
  { j: 10, fecha: "2026-11-21T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.D. TORDOIA", campo: "Municipal de Santiso" },
  { j: 11, fecha: "2026-11-28T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS", campo: "Municipal de Santiso" },
  { j: 12, fecha: "2026-12-05T18:00:00Z", local: "S.E. ABELLA S.D.E C.", rival: "U.D. SANTISO F.C. SOLAINA", campo: "O Vedral ,Abella" },
  { j: 13, fecha: "2026-12-12T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "ULLA OIL VETERANOS", campo: "Municipal de Santiso" },
  { j: 14, fecha: "2026-12-19T18:00:00Z", local: "SR CALO - MILONGAS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Munic. Rebordelo" },
  { j: 15, fecha: "2027-01-09T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "C.D. VETERANOS BERMÉS", campo: "Municipal de Santiso" },
  { j: 16, fecha: "2027-01-16T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.D. CRUCES", campo: "Municipal de Santiso" },
  { j: 17, fecha: "2027-01-23T18:00:00Z", local: "RESMON C.F.", rival: "U.D. SANTISO F.C. SOLAINA", campo: "A Sagrada-Trazo" },
  { j: 18, fecha: "2027-01-30T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "PREFABRICADOS FARO RODEIRO VETERANS", campo: "Municipal de Santiso" },
  { j: 19, fecha: "2027-02-13T18:00:00Z", local: "S.D. TOURO VETERANOS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Municipal De Loxo (Touro)" },
  { j: 20, fecha: "2027-02-20T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "CAF SILLEDA", campo: "Municipal de Santiso" },
  { j: 21, fecha: "2027-02-27T18:00:00Z", local: "S.D.C. RECESENDE", rival: "U.D. SANTISO F.C. SOLAINA", campo: "A Devesiña - Recesende" },
  { j: 22, fecha: "2027-03-06T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "MELIDE VETERANOS", campo: "Municipal de Santiso" },
  { j: 23, fecha: "2027-03-13T18:00:00Z", local: "VETERANOS BALOMPIE FOGAR DE BREOGAN", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Anexo Manuel Anxo Cortizo" },
  { j: 24, fecha: "2027-04-03T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.D. CACHEIRAS", campo: "Municipal de Santiso" },
  { j: 25, fecha: "2027-04-10T18:00:00Z", local: "S.D. TORDOIA", rival: "U.D. SANTISO F.C. SOLAINA", campo: "A Rega- Pontepedra" },
  { j: 26, fecha: "2027-04-17T18:00:00Z", local: "CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "O Forte-Boqueixón" },
  { j: 27, fecha: "2027-04-24T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "S.E. ABELLA S.D.E C.", campo: "Municipal de Santiso" },
  { j: 28, fecha: "2027-05-01T18:00:00Z", local: "ULLA OIL VETERANOS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "San Mamed" },
  { j: 29, fecha: "2027-05-08T18:00:00Z", local: "U.D. SANTISO F.C. SOLAINA", rival: "SR CALO - MILONGAS", campo: "Municipal de Santiso" },
  { j: 30, fecha: "2027-05-15T18:00:00Z", local: "C.D. VETERANOS BERMÉS", rival: "U.D. SANTISO F.C. SOLAINA", campo: "Manuel Ángel Cortizo" },
];

async function seed() {
  console.log("=== INICIANDO INSERCIÓN EN SUPABASE ===");

  // 1. Tempada activa
  const { data: tempActiva } = await supabase
    .from("temporadas")
    .select("id")
    .eq("activa", true)
    .single();

  const temporadaId = tempActiva?.id;
  console.log("Temporada activa ID:", temporadaId);
  if (!temporadaId) throw new Error("Non hai temporada activa");

  // 2. Desactivar competicións vellas
  await supabase.from("competiciones").update({ activa: false }).neq("id", "00000000-0000-0000-0000-000000000000");

  // 3. Crear / Upsert competición Senior
  let { data: compSenior } = await supabase
    .from("competiciones")
    .select("id")
    .eq("categoria", "Senior")
    .eq("nombre", "Tercera Futgal - Gr. 3")
    .maybeSingle();

  if (!compSenior) {
    const { data: created, error } = await supabase
      .from("competiciones")
      .insert([
        {
          categoria: "Senior",
          nombre: "Tercera Futgal - Gr. 3",
          orden: 1,
          activa: true,
          formato: "liga",
        },
      ])
      .select("id")
      .single();
    if (error) console.error("Error creando comp senior:", error);
    compSenior = created;
  } else {
    await supabase.from("competiciones").update({ activa: true, orden: 1 }).eq("id", compSenior.id);
  }
  console.log("Competición Senior ID:", compSenior?.id);

  // 4. Crear / Upsert competición Veteranos
  let { data: compVet } = await supabase
    .from("competiciones")
    .select("id")
    .eq("categoria", "Veteranos")
    .eq("nombre", "Veteranos 1ª Galicia - Gr. 2")
    .maybeSingle();

  if (!compVet) {
    const { data: created, error } = await supabase
      .from("competiciones")
      .insert([
        {
          categoria: "Veteranos",
          nombre: "Veteranos 1ª Galicia - Gr. 2",
          orden: 2,
          activa: true,
          formato: "liga",
        },
      ])
      .select("id")
      .single();
    if (error) console.error("Error creando comp veteranos:", error);
    compVet = created;
  } else {
    await supabase.from("competiciones").update({ activa: true, orden: 2 }).eq("id", compVet.id);
  }
  console.log("Competición Veteranos ID:", compVet?.id);

  // 5. Inserir / Obter equipos
  const teamMap = new Map(); // name.toLowerCase() -> id

  const allTeamNames = [
    ...SENIOR_TEAMS.map(name => ({ name, cat: "Senior" })),
    ...VETERANOS_TEAMS.map(name => ({ name, cat: "Veteranos" })),
  ];

  for (const { name, cat } of allTeamNames) {
    const { data: existing } = await supabase
      .from("equipos")
      .select("id")
      .ilike("nombre", name)
      .maybeSingle();

    if (existing) {
      teamMap.set(name.toLowerCase(), existing.id);
    } else {
      const { data: inserted, error } = await supabase
        .from("equipos")
        .insert([{ nombre: name, categoria: cat }])
        .select("id")
        .single();
      if (inserted) {
        teamMap.set(name.toLowerCase(), inserted.id);
      } else {
        console.error("Error insertando equipo:", name, error);
      }
    }
  }

  console.log(`Equipos listos en BD: ${teamMap.size}`);

  // 6. Relacionar en equipo_competiciones
  for (const name of SENIOR_TEAMS) {
    const eqId = teamMap.get(name.toLowerCase());
    if (eqId && compSenior?.id) {
      const { data: rel } = await supabase
        .from("equipo_competiciones")
        .select("id")
        .eq("equipo_id", eqId)
        .eq("competicion_id", compSenior.id)
        .maybeSingle();

      if (!rel) {
        await supabase.from("equipo_competiciones").insert([
          {
            equipo_id: eqId,
            categoria: "Senior",
            competicion_id: compSenior.id,
            competicion: "Tercera Futgal - Gr. 3",
          },
        ]);
      }
    }
  }

  for (const name of VETERANOS_TEAMS) {
    const eqId = teamMap.get(name.toLowerCase());
    if (eqId && compVet?.id) {
      const { data: rel } = await supabase
        .from("equipo_competiciones")
        .select("id")
        .eq("equipo_id", eqId)
        .eq("competicion_id", compVet.id)
        .maybeSingle();

      if (!rel) {
        await supabase.from("equipo_competiciones").insert([
          {
            equipo_id: eqId,
            categoria: "Veteranos",
            competicion_id: compVet.id,
            competicion: "Veteranos 1ª Galicia - Gr. 2",
          },
        ]);
      }
    }
  }

  // 7. Campos de fútbol
  const campoMap = new Map();
  const allCampos = [
    "Municipal de Santiso",
    "Pardiñeiro",
    "Campo Municipal Del Sergas",
    "A Gandareira",
    "Municipal De Loxo (Touro)",
    "Santa Isabel",
    "Da Silveira - Camporrapado",
    "San Mamed",
    "O Viso",
    "Mpal Do Camballón",
    "San Lorenzo - Vilatuxe",
    "Campo Municipal As Cancelas",
    "A Raña - Rodeiro",
    "Outeiriño",
    "Campo Municipal Jesús Carlos Pampin Rua",
    "A Cañoteira - Cacheiras",
    "O Vedral ,Abella",
    "Munic. Rebordelo",
    "A Sagrada-Trazo",
    "A Devesiña - Recesende",
    "Anexo Manuel Anxo Cortizo",
    "A Rega- Pontepedra",
    "O Forte-Boqueixón",
    "Manuel Ángel Cortizo",
  ];

  for (const cName of allCampos) {
    const { data: existing } = await supabase
      .from("campos_futbol")
      .select("id")
      .ilike("nombre", cName)
      .maybeSingle();

    if (existing) {
      campoMap.set(cName.toLowerCase(), existing.id);
    } else {
      const { data: created } = await supabase
        .from("campos_futbol")
        .insert([{ nombre: cName }])
        .select("id")
        .single();
      if (created) campoMap.set(cName.toLowerCase(), created.id);
    }
  }

  // 8. Crear Jornadas Senior (1-26)
  const jornadaSeniorMap = new Map();
  for (let num = 1; num <= 26; num++) {
    const match = SENIOR_MATCHES.find((m) => m.j === num);
    const fecha = match ? match.fecha : null;

    let { data: jRow } = await supabase
      .from("jornadas")
      .select("id")
      .eq("temporada_id", temporadaId)
      .eq("competicion_id", compSenior.id)
      .eq("numero", num)
      .maybeSingle();

    if (!jRow) {
      const { data: created, error } = await supabase
        .from("jornadas")
        .insert([
          {
            temporada_id: temporadaId,
            categoria: "Senior",
            competicion_id: compSenior.id,
            competicion: "Tercera Futgal - Gr. 3",
            numero: num,
            fecha_inicio: fecha,
          },
        ])
        .select("id")
        .single();
      if (error) console.error("Error creando jornada senior", num, error);
      jRow = created;
    }
    if (jRow) jornadaSeniorMap.set(num, jRow.id);
  }

  // 9. Crear Jornadas Veteranos (1-30)
  const jornadaVetMap = new Map();
  for (let num = 1; num <= 30; num++) {
    const match = VETERANOS_MATCHES.find((m) => m.j === num);
    const fecha = match ? match.fecha : null;

    let { data: jRow } = await supabase
      .from("jornadas")
      .select("id")
      .eq("temporada_id", temporadaId)
      .eq("competicion_id", compVet.id)
      .eq("numero", num)
      .maybeSingle();

    if (!jRow) {
      const { data: created, error } = await supabase
        .from("jornadas")
        .insert([
          {
            temporada_id: temporadaId,
            categoria: "Veteranos",
            competicion_id: compVet.id,
            competicion: "Veteranos 1ª Galicia - Gr. 2",
            numero: num,
            fecha_inicio: fecha,
          },
        ])
        .select("id")
        .single();
      if (error) console.error("Error creando jornada veteranos", num, error);
      jRow = created;
    }
    if (jRow) jornadaVetMap.set(num, jRow.id);
  }

  console.log(`Jornadas creadas: ${jornadaSeniorMap.size} Senior, ${jornadaVetMap.size} Veteranos`);

  // 10. Inserir Partidos Senior
  let insertedSeniorMatches = 0;
  for (const m of SENIOR_MATCHES) {
    const jId = jornadaSeniorMap.get(m.j);
    const localId = teamMap.get(m.local.toLowerCase());
    const rivalId = teamMap.get(m.rival.toLowerCase());
    const campoId = campoMap.get(m.campo.toLowerCase());

    if (jId && localId && rivalId) {
      const { data: existing } = await supabase
        .from("partidos_liga")
        .select("id")
        .eq("jornada_id", jId)
        .eq("equipo_local_id", localId)
        .eq("equipo_visitante_id", rivalId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("partidos_liga").insert([
          {
            jornada_id: jId,
            categoria: "Senior",
            competicion_id: compSenior.id,
            competicion: "Tercera Futgal - Gr. 3",
            equipo_local_id: localId,
            equipo_visitante_id: rivalId,
            fecha: m.fecha,
            campo_id: campoId,
            estado: "programado",
          },
        ]);
        if (error) console.error("Error partido senior J" + m.j, error);
        else insertedSeniorMatches++;
      }
    }
  }

  // 11. Inserir Partidos Veteranos
  let insertedVetMatches = 0;
  for (const m of VETERANOS_MATCHES) {
    const jId = jornadaVetMap.get(m.j);
    const localId = teamMap.get(m.local.toLowerCase());
    const rivalId = teamMap.get(m.rival.toLowerCase());
    const campoId = campoMap.get(m.campo.toLowerCase());

    if (jId && localId && rivalId) {
      const { data: existing } = await supabase
        .from("partidos_liga")
        .select("id")
        .eq("jornada_id", jId)
        .eq("equipo_local_id", localId)
        .eq("equipo_visitante_id", rivalId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("partidos_liga").insert([
          {
            jornada_id: jId,
            categoria: "Veteranos",
            competicion_id: compVet.id,
            competicion: "Veteranos 1ª Galicia - Gr. 2",
            equipo_local_id: localId,
            equipo_visitante_id: rivalId,
            fecha: m.fecha,
            campo_id: campoId,
            estado: "programado",
          },
        ]);
        if (error) console.error("Error partido vet J" + m.j, error);
        else insertedVetMatches++;
      }
    }
  }

  console.log(`Partidos insertados: ${insertedSeniorMatches} Senior, ${insertedVetMatches} Veteranos`);
  console.log("=== INSERCIÓN COMPLETADA CON ÉXITO ===");
}

seed().catch(err => {
  console.error("Fallo na inserción:", err);
  process.exit(1);
});
