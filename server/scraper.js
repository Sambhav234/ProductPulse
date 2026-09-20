import { chromium } from "playwright";
import crypto from "node:crypto";
export const ORIGIN =
  process.env.TARGET_ORIGIN || "https://demo.inelabteamdev.com";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function isPlaceholder(value) {
  return (
    value == null ||
    /^(?:n\/?a|na|unknown|unavailable|pending|loading|--|-|tbd)$/i.test(
      String(value).trim(),
    )
  );
}
export function parsePrice(value) {
  if (isPlaceholder(value)) return null;
  const text = String(value).trim().replace(/\s/g, "");
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(".") &&
    cleaned.includes(",") &&
    cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 && n <= 1e9 ? Math.round(n * 100) : null;
}
export function validateStock(value) {
  if (isPlaceholder(value)) return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (
    ["in_stock", "available", "limited", "selling_fast"].includes(normalized) ||
    /\d+_left/.test(normalized)
  )
    return "in_stock";
  if (["out_of_stock", "unavailable", "sold_out"].includes(normalized))
    return "out_of_stock";
  return null;
}
export function validateObservation(input, previous = null) {
  const price = parsePrice(input.price ?? input.salePrice ?? input.raw);
  const stock = validateStock(input.stock);
  if (price === null)
    return {
      valid: false,
      reason: "invalid_or_placeholder_price",
      price: null,
      stock,
    };
  const anomaly =
    previous?.price > 0 &&
    (price > previous.price * 5 || price < previous.price / 5);
  return {
    valid: true,
    price,
    stock,
    status: anomaly ? "anomaly" : "ok",
    anomaly,
  };
}
export function backoff(attempt, retryAfter) {
  if (retryAfter) {
    const n = Number(retryAfter);
    if (Number.isFinite(n)) return n * 1000;
    const t = Date.parse(retryAfter) - Date.now();
    if (t > 0) return t;
  }
  return Math.min(10000, 250 * 2 ** attempt + Math.floor(Math.random() * 100));
}
export async function withRetry(
  fn,
  { attempts = 4, timeoutMs = 10000, sleepFn = sleep } = {},
) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn({ attempt, signal: controller.signal });
    } catch (e) {
      last = e;
      const status = e.status || e.statusCode;
      if (status >= 400 && status < 500 && status !== 429) throw e;
      if (attempt === attempts - 1) break;
      await sleepFn(
        backoff(attempt, e.retryAfter || e.headers?.get?.("retry-after")),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}
async function json(path, fetchImpl) {
  fetchImpl = fetchImpl || globalThis.fetch;
  return withRetry(async ({ signal }) => {
    const r = await fetchImpl(`${ORIGIN}${path}`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      const e = new Error(`Target ${path} returned ${r.status}`);
      e.status = r.status;
      e.retryAfter = r.headers?.get?.("retry-after");
      throw e;
    }
    return r.json();
  });
}
export async function fetchCatalog({
  page = 1,
  pageSize = 60,
  fetchImpl,
} = {}) {
  return json(`/api/catalog?page=${page}&pageSize=${pageSize}`, fetchImpl);
}
export async function fetchProduct(id, { fetchImpl } = {}) {
  return json(`/api/product/${encodeURIComponent(id)}`, fetchImpl);
}
export async function fetchLayout({ fetchImpl } = {}) {
  return json("/api/layout", fetchImpl);
}
export async function collectMetadata({ concurrency = 5, fetchImpl } = {}) {
  const first = await fetchCatalog({ fetchImpl }),
    pages = Array.from({ length: first.pages }, (_, i) => i + 1),
    result = [];
  for (let i = 0; i < pages.length; i += concurrency) {
    result.push(
      ...(
        await Promise.all(
          pages
            .slice(i, i + concurrency)
            .map((page) => fetchCatalog({ page, pageSize: 60, fetchImpl })),
        )
      ).flatMap((x) => x.items || []),
    );
  }
  return result;
}
export function structureFingerprint(product) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(Object.keys(product || {}).sort()))
    .digest("hex");
}
export function detectStructureChange(previous, current) {
  return Boolean(
    previous &&
    current &&
    structureFingerprint(previous) !== structureFingerprint(current),
  );
}
export async function revealPrice(
  id,
  { browserType = chromium, headless = true, timeoutMs = 30000 } = {},
) {
  const browser = await browserType.launch({ headless });
  try {
    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/product/${id}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const consent = page
      .getByRole("button", { name: /^(accept|decline|reject)/i })
      .first();
    if (await consent.isVisible().catch(() => false))
      await consent.click().catch(() => {});
    const cookieButton = page.locator(".cookie-overlay button").first();
    if (await cookieButton.isVisible().catch(() => false))
      await cookieButton.click().catch(() => {});
    const priceBlock = page.locator(".price-block");
    await priceBlock.waitFor({ state: "visible", timeout: 10000 });
    const box = await priceBlock.boundingBox();
    if (!box)
      throw Object.assign(new Error("Price widget was not measurable"), {
        code: "PRICE_WIDGET_UNAVAILABLE",
      });
    await priceBlock.hover();
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(
        box.x + 10 + ((box.width - 20) * i) / 9,
        box.y + box.height / 2,
      );
      await page.waitForTimeout(80);
    }
    const button = page.getByRole("button", { name: /reveal price/i });
    await button.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () =>
        !document.querySelector('button[aria-label="Reveal price"]')?.disabled,
      null,
      { timeout: 10000 },
    );
    await button.click({ timeout: 10000 });
    let widgetText = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.waitForTimeout(1000);
      widgetText = await priceBlock.innerText().catch(() => "");
      if (
        /(?:\u20b9|INR|Rs\.?)\s*[\d,]+/i.test(widgetText) ||
        /couldn.t load|challenge_failed|upstream/i.test(widgetText)
      )
        break;
    }
    const text = await page.locator("body").innerText();
    const matches = [
      ...widgetText.matchAll(/(?:\u20b9|INR|Rs\.?)\s*[\d,]+(?:\.\d+)?/gi),
    ];
    if (!matches.length)
      throw Object.assign(
        new Error(
          widgetText.match(/Couldn.t load[^\n]*/i)?.[0] ||
            widgetText.match(/challenge_failed|upstream[^\n]*/i)?.[0] ||
            "Price was not revealed by target",
        ),
        { code: "PRICE_NOT_REVEALED" },
      );
    const raw = matches[matches.length - 1][0];
    const stockMatch = `${widgetText}\n${text}`.match(
      /out of stock|unavailable|sold out|in stock|available|selling fast|\d+\s+left/gi,
    );
    if (!stockMatch)
      throw Object.assign(
        new Error("Stock status was not revealed by target"),
        { code: "STOCK_NOT_REVEALED" },
      );
    return {
      id,
      price: parsePrice(raw),
      raw,
      stock: stockMatch[stockMatch.length - 1],
      capturedAt: new Date().toISOString(),
      pageText: text.slice(0, 2000),
    };
  } finally {
    await browser.close();
  }
}
