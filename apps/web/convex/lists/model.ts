import { v, type Infer } from "convex/values";

export const cellValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.array(v.string()),
  v.null(),
);
export const columnType = v.union(
  v.literal("title"),
  v.literal("text"),
  v.literal("number"),
  v.literal("checkbox"),
  v.literal("select"),
  v.literal("multiSelect"),
  v.literal("status"),
  v.literal("date"),
  v.literal("url"),
  v.literal("email"),
  v.literal("phone"),
  v.literal("currency"),
  v.literal("percent"),
  v.literal("rating"),
);
export const option = v.object({
  id: v.string(),
  label: v.string(),
  color: v.string(),
  archived: v.optional(v.boolean()),
});
export const column = v.object({
  id: v.string(),
  name: v.string(),
  icon: v.string(),
  type: columnType,
  width: v.number(),
  options: v.array(option),
  archived: v.boolean(),
  currency: v.optional(v.string()),
});
export const filter = v.object({
  columnId: v.string(),
  operator: v.union(
    v.literal("contains"),
    v.literal("equals"),
    v.literal("notEquals"),
    v.literal("empty"),
    v.literal("notEmpty"),
    v.literal("gt"),
    v.literal("lt"),
  ),
  value: cellValue,
});
export const view = v.object({
  id: v.string(),
  name: v.string(),
  hidden: v.array(v.string()),
  filters: v.array(filter),
  sorts: v.array(
    v.object({
      columnId: v.string(),
      direction: v.union(v.literal("asc"), v.literal("desc")),
    }),
  ),
  groupBy: v.string(),
  wrap: v.boolean(),
  filterMode: v.optional(v.union(v.literal("all"), v.literal("any"))),
  calculations: v.optional(
    v.record(
      v.string(),
      v.union(
        v.literal("none"),
        v.literal("count"),
        v.literal("sum"),
        v.literal("average"),
        v.literal("min"),
        v.literal("max"),
        v.literal("checked"),
      ),
    ),
  ),
});
const rowInput = v.object({
  key: v.string(),
  cells: v.record(v.string(), cellValue),
  icon: v.optional(v.string()),
  notes: v.optional(v.string()),
});
const change = v.object({
  rowKey: v.string(),
  columnId: v.string(),
  value: cellValue,
  baseVersion: v.number(),
});
export const command = v.union(
  v.object({
    kind: v.literal("deleteList"),
    listKey: v.string(),
    baseRevision: v.number(),
  }),
  v.object({
    kind: v.literal("deleteRows"),
    listKey: v.string(),
    rowKeys: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("createList"),
    key: v.string(),
    name: v.string(),
    icon: v.string(),
    template: v.union(
      v.literal("blank"),
      v.literal("tasks"),
      v.literal("shopping"),
      v.literal("packing"),
    ),
    locale: v.string(),
    imported: v.optional(
      v.object({
        headers: v.array(v.string()),
        rows: v.array(v.array(v.string())),
      }),
    ),
  }),
  v.object({
    kind: v.literal("updateList"),
    listKey: v.string(),
    baseRevision: v.number(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    favorite: v.optional(v.boolean()),
  }),
  v.object({
    kind: v.literal("duplicateList"),
    listKey: v.string(),
    key: v.string(),
    name: v.string(),
    baseRevision: v.number(),
  }),
  v.object({
    kind: v.literal("archiveList"),
    listKey: v.string(),
    baseRevision: v.number(),
    archived: v.boolean(),
  }),
  v.object({
    kind: v.literal("setColumns"),
    listKey: v.string(),
    baseRevision: v.number(),
    columns: v.array(column),
  }),
  v.object({
    kind: v.literal("setViews"),
    listKey: v.string(),
    baseRevision: v.number(),
    views: v.array(view),
  }),
  v.object({
    kind: v.literal("addRows"),
    listKey: v.string(),
    rows: v.array(rowInput),
    afterKey: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("setCells"),
    listKey: v.string(),
    changes: v.array(change),
  }),
  v.object({
    kind: v.literal("setRow"),
    listKey: v.string(),
    rowKey: v.string(),
    baseVersion: v.number(),
    icon: v.optional(v.string()),
    notes: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("archiveRows"),
    listKey: v.string(),
    rowKeys: v.array(v.string()),
    archived: v.boolean(),
  }),
  v.object({
    kind: v.literal("moveRow"),
    listKey: v.string(),
    rowKey: v.string(),
    beforeKey: v.optional(v.string()),
    afterKey: v.optional(v.string()),
  }),
);
export type CellValue = Infer<typeof cellValue>;
export type ListColumn = Infer<typeof column>;
export type ListView = Infer<typeof view>;
export type ListCommand = Infer<typeof command>;

export const COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
];
export const LIMITS = {
  lists: 100,
  rows: 1000,
  columns: 40,
  views: 12,
  text: 2000,
};
