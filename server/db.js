import { createClient } from "@supabase/supabase-js";
let client;
export function db() {
  if (
    !client &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  return client;
}
export async function upsertProducts(products) {
  const s = db();
  if (!s) return { count: uniqueProducts.length, persisted: false };
  const uniqueProducts = [
    ...new Map(
      products.map((product) => [String(product.id), product]),
    ).values(),
  ];
  const rows = uniqueProducts.map((p) => ({
    store_product_id: String(p.id),
    name: p.name,
    product_url: `${process.env.STORE_BASE_URL || process.env.TARGET_ORIGIN || "https://demo.inelabteamdev.com"}/product/${encodeURIComponent(p.id)}`,
    category: p.category,
    description: p.description,
  }));
  const { error } = await s
    .from("tracked_products")
    .upsert(rows, { onConflict: "store_product_id" });
  if (error) throw error;
  return { count: rows.length, persisted: true };
}
export async function query(table, opts = {}) {
  const s = db();
  if (!s) return [];
  let q = s.from(table).select(opts.select || "*");
  if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) q = q.eq(k, v);
  if (opts.order) q = q.order(opts.order, { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function mutateTracked(method, row, id) {
  const s = db();
  if (!s) return row;
  if (method === "insert") {
    const input = {
      store_product_id: String(row.store_product_id || row.id),
      name: row.name,
      product_url:
        row.product_url ||
        `${process.env.STORE_BASE_URL || process.env.TARGET_ORIGIN || "https://demo.inelabteamdev.com"}/product/${encodeURIComponent(row.store_product_id || row.id)}`,
      image_url: row.image_url || null,
      category: row.category || null,
      description: row.description || null,
    };
    const { data, error } = await s
      .from("tracked_products")
      .upsert(input, { onConflict: "store_product_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { error } = await s.from("tracked_products").delete().eq("id", id);
  if (error) throw error;
  return row;
}
export async function acquireScrapeLock(runId) {
  const s = db();
  if (!s) return true;
  const { error } = await s
    .from("scrape_locks")
    .insert({ name: "global", run_id: runId });
  return !error;
}
export async function releaseScrapeLock() {
  const s = db();
  if (s) await s.from("scrape_locks").delete().eq("name", "global");
}

export async function insertScrapeLog(row) {
  const s = db();
  if (!s) return { id: null, ...row };
  const { data, error } = await s
    .from("scrape_logs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertPriceHistory(row) {
  const s = db();
  if (!s) return row;
  const { data, error } = await s
    .from("price_history")
    .upsert(row, { onConflict: "product_id,scraped_at" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrackedProduct(id, values) {
  const s = db();
  if (!s) return values;
  const { error } = await s
    .from("tracked_products")
    .update(values)
    .eq("id", id);
  if (error) throw error;
}
