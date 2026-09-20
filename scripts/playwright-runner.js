#!/usr/bin/env node
import "dotenv/config";
import { collectMetadata, revealPrice } from "../server/scraper.js";
import { upsertProducts } from "../server/db.js";
const chaos = process.argv.includes("--chaos"),
  headed = process.argv.includes("--headed"),
  arg = process.argv.indexOf("--product"),
  requested = arg >= 0 ? process.argv[arg + 1] : null;
let id = requested;
if (!id || chaos) {
  const products = await collectMetadata();
  await upsertProducts(products);
  console.log(`Collected ${products.length} products`);
  id = id || products[Math.floor(Math.random() * products.length)]?.id;
}
if (id) {
  try {
    console.log(await revealPrice(id, { headless: !headed && !chaos }));
  } catch (e) {
    console.error(
      `Price reveal blocked: ${e.code || "SCRAPE_FAILED"}: ${e.message}`,
    );
    process.exitCode = 2;
  }
}
