import { DiscountClass, ProductDiscountSelectionStrategy } from '../generated/api';

/**
 * Open bundles: charges exactly what the theme's bundle block shows.
 *
 * Config (shop metafield open_bundles.config, written by the editor; the theme's offer block reads the same one):
 * {
 *   "bundles":  { "<bundleId>": { "title": "Bundle", "tiers": [ { "buy": 2, "free": 1, "off": { "type": "percent" | "amount" | "price", "value": 40 } } ] } },
 *   "products": { "gid://shopify/Product/1": { "bundle": "<default bundleId>", "tests": { "<testId>": { "a": "<bundleId>", "b": "<bundleId>" } } } }
 * }
 * A tier is a box of the bundle: `buy` paid units + `free` units at 100% off, plus an optional saving on the
 * paid units (`percent` of their price, or a fixed `amount` off). The largest box the cart's quantity of that
 * product reaches is applied once. The visitor's A/B version comes from the cart attribute _obab
 * ("test:version,test2:version") that the theme's A/B engine writes.
 *
 * Gifts: a tier can carry gifts [{ type: "product", variant: <numeric variant id> } | { type: "shipping" }]. When the cart
 * reaches that tier, one unit of each gift variant in the cart is 100% off (the theme adds it with the bundle), and
 * a shipping gift makes delivery free (cart_delivery_options_discounts_generate_run). A gift is only free when its
 * tier is reached, so adding the gift product alone costs its normal price. A gift with choose: true and product: <id>
 * lets the shopper pick the variant: the theme adds it with the line attribute _ob_gift = 1, and one unit of any
 * variant of that product carrying the attribute is free.
 *
 * Safety: only carts filled by the theme's bundle block (cart attribute _ob = "1") get a bundle discount, so
 * stores whose live theme has no bundle block keep their own discounts untouched.
 *
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const parseAb = (value) => {
  const out = {};
  for (const part of (value || '').split(',')) {
    const [test, version] = part.split(':');
    if (test && version) out[test.trim()] = version.trim();
  }
  return out;
};

const cents = (x) => Math.round(Number(x) * 100);

/** The bundle a product's buyer gets: their A/B version's bundle, or the product's default one. */
export function pickBundle(productConfig, ab) {
  for (const [testId, versions] of Object.entries(productConfig.tests || {})) {
    const v = ab[testId];
    if (v && versions[v]) return versions[v];
  }
  return productConfig.bundle;
}

/** The largest box reached by `quantity` units (boxes with no saving are ignored). */
export function pickTier(tiers, quantity) {
  let best = null;
  for (const t of tiers || []) {
    const buy = Math.max(0, Math.floor(t.buy || 0));
    const free = Math.max(0, Math.floor(t.free || 0));
    const size = buy + free;
    const gifts = Array.isArray(t.gifts) ? t.gifts : [];
    const saves = free > 0 || (t.off && Number(t.off.value) > 0) || gifts.length > 0;
    if (!size || !saves || size > quantity) continue;
    if (!best || size > best.size) best = { buy, free, size, off: t.off || null, gifts };
  }
  return best;
}

/**
 * Discount in cents per cart line for one product. Units are taken most expensive first; inside the box the
 * cheapest `free` units are free, and the saving applies to the paid units.
 */
export function allocate(lines, tier) {
  const units = [];
  for (const line of lines) {
    const price = cents(line.cost.amountPerQuantity.amount);
    for (let i = 0; i < line.quantity; i++) units.push({ id: line.id, price });
  }
  units.sort((a, b) => b.price - a.price);
  const box = units.slice(0, tier.size);
  const paid = box.slice(0, tier.buy);
  const free = box.slice(tier.buy);
  const perLine = {};
  const add = (id, c) => { if (c > 0) perLine[id] = (perLine[id] || 0) + c; };
  free.forEach((u) => add(u.id, u.price));
  if (tier.off && paid.length) {
    const paidTotal = paid.reduce((s, u) => s + u.price, 0);
    const value = Number(tier.off.value) || 0;
    // percent of the bought units, a fixed amount off, or a fixed total price for the bought units
    const saving = tier.off.type === 'amount' ? Math.min(cents(value), paidTotal)
      : tier.off.type === 'price' ? Math.max(0, paidTotal - cents(value))
      : Math.round((paidTotal * Math.min(value, 100)) / 100);
    // Spread over the paid units in proportion to their price; the last unit takes the rounding.
    let left = saving;
    paid.forEach((u, i) => {
      const share = i === paid.length - 1 ? left : Math.round((saving * u.price) / paidTotal);
      add(u.id, share);
      left -= share;
    });
  }
  return perLine;
}

/** Tiers reached by the cart, one per configured product (shared with the delivery target). */
export function reachedTiers(input, config) {
  const ab = parseAb(input.cart.ab?.value);
  const byProduct = {};
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;
    const pid = line.merchandise.product.id;
    if (!config.products?.[pid]) continue;
    (byProduct[pid] ||= []).push(line);
  }
  const out = [];
  for (const [pid, lines] of Object.entries(byProduct)) {
    const bundle = config.bundles?.[pickBundle(config.products[pid], ab)];
    if (!bundle) continue;
    const gifted = new Set(giftVariants(bundle)), chosen = new Set(giftProducts(bundle));
    // gift units are not part of the box
    const boxLines = lines.filter((l) => !gifted.has(l.merchandise.id) && !(isGiftLine(l) && chosen.has(l.merchandise.product.id)));
    const quantity = boxLines.reduce((s, l) => s + l.quantity, 0);
    const tier = pickTier(bundle.tiers, quantity);
    if (tier) out.push({ pid, bundle, tier, lines: boxLines });
  }
  return out;
}

const variantGid = (v) => (String(v).startsWith('gid://') ? String(v) : `gid://shopify/ProductVariant/${v}`);
const productGid = (p) => (String(p).startsWith('gid://') ? String(p) : `gid://shopify/Product/${p}`);
const isChoose = (g) => g.type === 'product' && g.choose && g.product;
const giftVariants = (bundle) => (bundle.tiers || []).flatMap((t) => (t.gifts || []).filter((g) => g.type === 'product' && g.variant && !isChoose(g)).map((g) => variantGid(g.variant)));
const giftProducts = (bundle) => (bundle.tiers || []).flatMap((t) => (t.gifts || []).filter(isChoose).map((g) => productGid(g.product)));
const isGiftLine = (l) => l.gift?.value === '1';
// key of a gift: its fixed variant, or "p:<product gid>" when the shopper picks the variant
const giftKey = (g) => (isChoose(g) ? `p:${productGid(g.product)}` : variantGid(g.variant));

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const config = input.shop?.metafield?.jsonValue;
  if (input.cart.bundleCart?.value !== '1') return { operations: [] };
  if (!input.cart.lines.length || !config || !input.discount.discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }
  const candidates = [];
  const giftLeft = {}; // gift variant -> free units still to give
  for (const { bundle, tier, lines } of reachedTiers(input, config)) {
    for (const g of tier.gifts) if (g.type === 'product' && (g.variant || isChoose(g))) giftLeft[giftKey(g)] = (giftLeft[giftKey(g)] || 0) + 1;
    for (const [lineId, c] of Object.entries(allocate(lines, tier))) {
      candidates.push({
        message: bundle.title || 'Bundle discount',
        targets: [{ cartLine: { id: lineId } }],
        value: { fixedAmount: { amount: (c / 100).toFixed(2), appliesToEachItem: false } },
      });
    }
  }
  for (const line of input.cart.lines) {
    const key = giftLeft[line.merchandise.id] ? line.merchandise.id : isGiftLine(line) ? `p:${line.merchandise.product.id}` : null;
    const left = key && giftLeft[key];
    if (!left) continue;
    const units = Math.min(left, line.quantity);
    giftLeft[key] -= units;
    candidates.push({
      message: 'Free gift',
      targets: [{ cartLine: { id: line.id } }],
      value: { fixedAmount: { amount: ((cents(line.cost.amountPerQuantity.amount) * units) / 100).toFixed(2), appliesToEachItem: false } },
    });
  }
  if (!candidates.length) return { operations: [] };
  return {
    operations: [{ productDiscountsAdd: { candidates, selectionStrategy: ProductDiscountSelectionStrategy.All } }],
  };
}
