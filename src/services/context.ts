import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import type { EntryConfig, Settings } from "../domain/validation.js";
import { entryConfigSchema, settingsSchema } from "../domain/validation.js";
export type ContentItem = NonNullable<
  Awaited<ReturnType<NonNullable<PluginContext["content"]>["get"]>>
>;
export type StorageCollection<T> = Omit<
  PluginContext["storage"][string],
  "get" | "getVersioned" | "query"
> & {
  get(id: string): Promise<T | null>;
  getVersioned(id: string): Promise<{ value: T; revision: string } | null>;
  query(
    options?: Parameters<PluginContext["storage"][string]["query"]>[0],
  ): Promise<{
    items: { id: string; data: T }[];
    cursor?: string;
    hasMore: boolean;
  }>;
};
export function storage<T>(
  ctx: PluginContext,
  name: string,
): StorageCollection<T> {
  const collection = ctx.storage[name];
  if (!collection) throw new Error(`Missing declared storage: ${name}`);
  return collection as StorageCollection<T>;
}
export function actor(route: SandboxedRouteContext, minimum: number): string {
  if (!route.user || route.user.role < minimum)
    throw new Error("Permission denied");
  return route.user.id;
}
export async function settings(ctx: PluginContext): Promise<Settings> {
  return settingsSchema.parse(
    (await storage<Settings>(ctx, "settings").get("site")) ?? {},
  );
}
export const entryKey = (collection: string, id: string): string =>
  `${collection}:${id}`;
export async function entryConfig(
  ctx: PluginContext,
  collection: string,
  id: string,
): Promise<EntryConfig> {
  return entryConfigSchema.parse(
    (await storage<EntryConfig>(ctx, "entries").get(
      entryKey(collection, id),
    )) ?? {},
  );
}
export async function getEntry(
  ctx: PluginContext,
  collection: string,
  id: string,
): Promise<ContentItem> {
  if (!ctx.content) throw new Error("Content capability is unavailable");
  const item = await ctx.content.get(collection, id);
  if (!item) throw new Error("Entry no longer exists");
  return item;
}
export function bodyOf(item: ContentItem, bodyField = "body"): unknown {
  return item.data[bodyField] ?? item.data.content ?? "";
}
export const titleOf = (item: ContentItem, titleField = "title"): string =>
  String(item.data[titleField] ?? item.slug ?? "Untitled");
