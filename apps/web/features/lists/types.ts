import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
export type {
  CellValue,
  ListColumn,
  ListView,
  ListCommand,
} from "@/convex/lists/model";
export type ListsSnapshot = FunctionReturnType<typeof api.lists.data.watch>;
export type ListData = NonNullable<ListsSnapshot["list"]>;
export type ListRow = ListsSnapshot["rows"][number];
export type ListSummary = ListsSnapshot["lists"][number];
