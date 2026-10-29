import type { ListColumn, ListView } from "./model";

export function templateColumns(
  template: string,
  locale: string,
): ListColumn[] {
  const es = locale !== "en";
  const col = (
    id: string,
    name: string,
    type: ListColumn["type"],
    options: ListColumn["options"] = [],
    width = 180,
  ): ListColumn => ({
    id,
    name,
    type,
    icon: "",
    options,
    width,
    archived: false,
  });
  const priority = [
    { id: "high", label: es ? "Alta" : "High", color: "red" },
    { id: "medium", label: es ? "Media" : "Medium", color: "yellow" },
    { id: "low", label: es ? "Baja" : "Low", color: "blue" },
  ];
  const status = [
    { id: "todo", label: es ? "Pendiente" : "To do", color: "gray" },
    { id: "progress", label: es ? "En curso" : "In progress", color: "blue" },
    { id: "done", label: es ? "Listo" : "Done", color: "green" },
  ];
  if (template === "shopping")
    return [
      col("done", es ? "Comprado" : "Bought", "checkbox", [], 100),
      col("name", es ? "Producto" : "Product", "title", [], 260),
      col("quantity", es ? "Cantidad" : "Quantity", "number", [], 110),
      col("location", es ? "Dónde comprar" : "Location", "select", [
        {
          id: "market",
          label: es ? "Supermercado" : "Supermarket",
          color: "orange",
        },
        {
          id: "local",
          label: es ? "Mercado local" : "Local market",
          color: "green",
        },
      ]),
      col("category", es ? "Categoría" : "Category", "select", [
        { id: "fresh", label: es ? "Frescos" : "Fresh", color: "green" },
        { id: "pantry", label: es ? "Despensa" : "Pantry", color: "yellow" },
        { id: "home", label: es ? "Hogar" : "Household", color: "blue" },
      ]),
      col("notes", es ? "Notas" : "Notes", "text", [], 260),
    ];
  if (template === "packing")
    return [
      col("packed", es ? "En la maleta" : "Packed", "checkbox", [], 120),
      col("name", es ? "Artículo" : "Item", "title", [], 260),
      col("quantity", es ? "Cantidad" : "Quantity", "number", [], 110),
      col("category", es ? "Categoría" : "Category", "multiSelect", [
        { id: "clothes", label: es ? "Ropa" : "Clothing", color: "gray" },
        {
          id: "tech",
          label: es ? "Tecnología" : "Electronics",
          color: "green",
        },
        {
          id: "documents",
          label: es ? "Documentos" : "Documents",
          color: "blue",
        },
      ]),
      col("priority", es ? "Prioridad" : "Priority", "select", priority),
      col("notes", es ? "Notas" : "Notes", "text", [], 240),
    ];
  if (template === "tasks")
    return [
      col("name", es ? "Nombre" : "Name", "title", [], 300),
      col("status", es ? "Estado" : "Status", "status", status),
      col("priority", es ? "Prioridad" : "Priority", "select", priority),
      col("due", es ? "Fecha" : "Date", "date", [], 160),
      col("notes", es ? "Notas" : "Notes", "text", [], 260),
    ];
  return [
    col("name", es ? "Nombre" : "Name", "title", [], 300),
    col("notes", es ? "Notas" : "Notes", "text", [], 260),
  ];
}
export function defaultView(locale: string): ListView {
  return {
    id: "all",
    name: locale === "en" ? "All items" : "Todos",
    hidden: [],
    filters: [],
    sorts: [],
    groupBy: "",
    wrap: false,
  };
}
