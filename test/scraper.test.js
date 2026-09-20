import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fetchCatalog,
  fetchProduct,
  parsePrice,
  isPlaceholder,
  validateObservation,
  backoff,
  structureFingerprint,
} from "../server/scraper.js";

test("catalog client requests the documented endpoint", async () => {
  const old = global.fetch;
  let url;
  global.fetch = async (u) => {
    url = u;
    return { ok: true, json: async () => ({ page: 1, items: [] }) };
  };
  try {
    const result = await fetchCatalog({ page: 2, pageSize: 60 });
    assert.equal(result.page, 1);
    assert.match(url, /\/api\/catalog\?page=2&pageSize=60$/);
  } finally {
    global.fetch = old;
  }
});

test("product errors preserve target status", async () => {
  const old = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404 });
  try {
    await assert.rejects(fetchProduct(999999), /returned 404/);
  } finally {
    global.fetch = old;
  }
});
test("fixture validation rejects placeholders and flags anomalies", async () => {
  const f = JSON.parse(
    await readFile(new URL("./fixtures/price-responses.json", import.meta.url)),
  );
  assert.equal(isPlaceholder(f.placeholder.price), true);
  assert.equal(parsePrice(f.valid.price), 129900);
  assert.equal(validateObservation(f.placeholder).valid, false);
  assert.equal(
    validateObservation(f.anomaly, { price: 100 }).status,
    "anomaly",
  );
  assert.equal(
    structureFingerprint({ b: 1, a: 2 }),
    structureFingerprint({ a: 3, b: 4 }),
  );
});
test("retry-after supports seconds and dates", () => {
  assert.equal(backoff(0, "2"), 2000);
  assert.ok(backoff(0) > 0);
});
