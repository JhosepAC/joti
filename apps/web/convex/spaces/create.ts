import { internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { toSlugBase, validateSpaceName } from "./validators";
export const create = internalMutation({
  args: {
    hash: v.string(),
    name: v.string(),
    template: v.string(),
    key: v.string(),
    locale: v.string(),
  },
  handler: async (ctx, a) => {
    function fail(code: string): never {
      throw new ConvexError({ code });
    }
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", a.hash))
      .first();
    if (!session || session.expires_at <= Date.now()) fail("UNAUTHORIZED");
    const user = await ctx.db.get(session.user_id);
    if (!user || user.deleted_at || !user.email_verified_at)
      fail("UNAUTHORIZED");
    const name = validateSpaceName(a.name);
    if (
      !["university", "work", "couple", "project", "blank"].includes(
        a.template,
      ) ||
      !/^[-\w]{8,100}$/.test(a.key)
    )
      fail("VALIDATION_ERROR");
    const owned = await ctx.db
      .query("spaces")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();
    const old = owned.find((s) => s.creation_key === a.key && !s.deleted_at);
    if (old) return { slug: old.slug };
    if (owned.filter((s) => !s.deleted_at).length >= 30) fail("LIMIT_REACHED");
    const base = toSlugBase(name);
    let slug = base;
    for (
      let n = 1;
      await ctx.db
        .query("spaces")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      n++
    ) {
      if (n > 100) fail("LIMIT_REACHED");
      slug = `${base}-${n + 1}`;
    }
    const type = a.template,
      es = a.locale !== "en";
    const icon =
      type === "university"
        ? "🎓"
        : type === "work"
          ? "💼"
          : type === "couple"
            ? "🩷"
            : type === "project"
              ? "🚀"
              : "📌";
    const space = await ctx.db.insert("spaces", {
      owner_id: user._id,
      name,
      slug,
      icon,
      purpose:
        type === "university"
          ? "study"
          : type === "work" || type === "project"
            ? "work"
            : type === "blank"
              ? "blank"
              : "personal",
      is_private: true,
      created_at: Date.now(),
      starter_initialized_at: Date.now(),
      creation_key: a.key,
    });
    const titles: Record<string, string[]> = es
      ? {
          university: ["Mi semestre", "Asignaturas", "Entregas y exámenes"],
          work: ["Prioridades", "Reuniones", "Recursos del equipo"],
          couple: ["Nuestros planes", "Recuerdos", "Acuerdos y pendientes"],
          project: [
            "Resumen del proyecto",
            "Plan de trabajo",
            "Ideas y referencias",
          ],
          blank: ["Sin título"],
        }
      : {
          university: ["My semester", "Courses", "Assignments and exams"],
          work: ["Priorities", "Meetings", "Team resources"],
          couple: ["Our plans", "Memories", "Agreements and tasks"],
          project: ["Project brief", "Work plan", "Ideas and references"],
          blank: ["Untitled"],
        };
    const sections: Record<string, string[]> = es
      ? {
          university: [
            "Objetivos del semestre",
            "Asignaturas y horarios",
            "Fechas importantes",
          ],
          work: ["Objetivos", "Próximas acciones", "Notas"],
          couple: ["Ideas para compartir", "Próximos planes", "Por recordar"],
          project: ["Objetivo", "Alcance", "Próximos pasos"],
        }
      : {
          university: [
            "Semester goals",
            "Courses and schedule",
            "Important dates",
          ],
          work: ["Goals", "Next actions", "Notes"],
          couple: ["Ideas to share", "Upcoming plans", "Things to remember"],
          project: ["Goal", "Scope", "Next steps"],
        };
    const details: Record<string, string[][]> = es
      ? {
          university: [
            ["Asignatura", "Docente y horario", "Recursos"],
            ["Entrega o examen", "Fecha", "Preparación"],
          ],
          work: [
            ["Fecha y participantes", "Decisiones", "Próximas acciones"],
            ["Documentación", "Enlaces útiles", "Contactos"],
          ],
          couple: [
            ["Momentos", "Lugares", "Por recordar"],
            ["Acuerdos", "Pendientes", "Próxima revisión"],
          ],
          project: [
            ["Hitos", "En curso", "Pendiente"],
            ["Referencias", "Preguntas", "Ideas"],
          ],
        }
      : {
          university: [
            ["Course", "Teacher and schedule", "Resources"],
            ["Assignment or exam", "Date", "Preparation"],
          ],
          work: [
            ["Date and participants", "Decisions", "Next actions"],
            ["Documentation", "Useful links", "Contacts"],
          ],
          couple: [
            ["Moments", "Places", "Things to remember"],
            ["Agreements", "Tasks", "Next review"],
          ],
          project: [
            ["Milestones", "In progress", "Pending"],
            ["References", "Questions", "Ideas"],
          ],
        };
    for (const [n, title] of titles[type]!.entries())
      await ctx.db.insert("space_pages", {
        space_id: space,
        title,
        body:
          type === "blank"
            ? ""
            : (n === 0
                ? (sections[type] ?? [])
                : (details[type]?.[n - 1] ?? [])
              )
                .map((s) => `## ${s}\n\n`)
                .join("\n"),
        revision: 1,
        is_starter: n === 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    return { slug };
  },
});
