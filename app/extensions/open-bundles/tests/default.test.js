import { describe, it, expect } from 'vitest';
import { cartLinesDiscountsGenerateRun } from '../src';

const P = 'gid://shopify/Product/1';
const config = {
  bundles: {
    duo: { title: 'Duo Savings', tiers: [{ buy: 1 }, { buy: 2, off: { type: 'amount', value: 20 } }] },
    spring: { title: 'Spring sale', tiers: [{ buy: 1 }, { buy: 2, off: { type: 'amount', value: 50 } }, { buy: 2, free: 1 }] },
    b3g4: { title: 'Buy 3 get 4', tiers: [{ buy: 3, free: 4 }] },
  },
  products: { [P]: { bundle: 'duo', tests: { 'spring-test': { a: 'duo', b: 'spring' } } } },
};
const line = (id, qty, price = '124.95') => ({ id, quantity: qty, cost: { amountPerQuantity: { amount: price } },
  merchandise: { __typename: 'ProductVariant', id: 'v' + id, product: { id: P } } });
const run = (lines, ab, cfg = config, bundleCart = '1') => cartLinesDiscountsGenerateRun({
  cart: { ab: ab ? { value: ab } : null, bundleCart: bundleCart ? { value: bundleCart } : null, lines },
  shop: { metafield: { jsonValue: cfg } },
  discount: { discountClasses: ['PRODUCT'] },
});
const total = (r) => (r.operations[0]?.productDiscountsAdd.candidates || [])
  .reduce((s, c) => s + Number(c.value.fixedAmount.amount), 0);

describe('open bundles', () => {
  it('no test: default bundle, 2 items = -20', () => expect(total(run([line('1', 2)]))).toBeCloseTo(20));
  it('version A gets A bundle', () => expect(total(run([line('1', 2)], 'spring-test:a'))).toBeCloseTo(20));
  it('version B, 2 items = -50 (199.90)', () => expect(total(run([line('1', 1), line('2', 1)], 'spring-test:b'))).toBeCloseTo(50));
  it('version B, 3 items = buy 2 get 1 free (249.90)', () => expect(total(run([line('1', 3)], 'spring-test:b'))).toBeCloseTo(124.95));
  it('1 item: nothing', () => expect(run([line('1', 1)], 'spring-test:b').operations).toEqual([]));
  it('free units are the cheapest', () => {
    const cfg = { ...config, products: { [P]: { bundle: 'spring' } } };
    expect(total(run([line('1', 2, '100.00'), line('2', 1, '80.00')], '', cfg))).toBeCloseTo(80);
  });
  it('buy 3 get 4 free needs 7 units', () => {
    const cfg = { ...config, products: { [P]: { bundle: 'b3g4' } } };
    expect(run([line('1', 6)], '', cfg).operations).toEqual([]);
    expect(total(run([line('1', 7, '10.00')], '', cfg))).toBeCloseTo(40);
  });
  it('percent on the paid units', () => {
    const cfg = { bundles: { p: { tiers: [{ buy: 2, off: { type: 'percent', value: 20 } }] } }, products: { [P]: { bundle: 'p' } } };
    expect(total(run([line('1', 2, '100.00')], '', cfg))).toBeCloseTo(40);
  });
  it('carts not filled by the bundle block are untouched (live theme)', () => {
    expect(run([line('1', 2)], 'spring-test:b', config, null).operations).toEqual([]);
  });
  it('fixed total price: 2 for 199.90', () => {
    const cfg = { bundles: { p: { tiers: [{ buy: 2, off: { type: 'price', value: 199.9 } }] } }, products: { [P]: { bundle: 'p' } } };
    expect(total(run([line('1', 2)], '', cfg))).toBeCloseTo(50);
  });
  it('other products untouched', () => {
    const other = { ...line('9', 3), merchandise: { __typename: 'ProductVariant', id: 'x', product: { id: 'gid://shopify/Product/2' } } };
    expect(run([other], 'spring-test:b').operations).toEqual([]);
  });
});

describe('gifts', () => {
  const G = 'gid://shopify/ProductVariant/900';
  const cfg = { bundles: { g: { title: 'Gift', tiers: [{ buy: 1 }, { buy: 2, gifts: [{ type: 'product', variant: 900 }] }, { buy: 3, gifts: [{ type: 'shipping' }] }] } },
    products: { [P]: { bundle: 'g' } } };
  const gift = (qty = 1) => ({ id: 'g1', quantity: qty, cost: { amountPerQuantity: { amount: '30.00' } }, merchandise: { __typename: 'ProductVariant', id: G, product: { id: 'gid://shopify/Product/9' } } });
  it('tier reached: one gift unit is free', () => expect(total(run([line('1', 2), gift(1)], null, cfg))).toBeCloseTo(30));
  it('only one unit free even with 2 in the cart', () => expect(total(run([line('1', 2), gift(2)], null, cfg))).toBeCloseTo(30));
  it('tier not reached: gift is paid', () => expect(total(run([line('1', 1), gift(1)], null, cfg))).toBeCloseTo(0));
  it('gift alone is paid', () => expect(run([gift(1)], null, cfg).operations).toEqual([]));
  it('no bundle cart attribute: nothing', () => expect(run([line('1', 2), gift(1)], null, cfg, null).operations).toEqual([]));
});

describe('gift: shopper picks the variant', () => {
  const cfg = { bundles: { g: { title: 'Gift', tiers: [{ buy: 1 }, { buy: 2, gifts: [{ type: 'product', variant: 900, choose: true, product: 9 }] }] } },
    products: { [P]: { bundle: 'g' } } };
  const pick = (vid, flag = '1', qty = 1) => ({ id: 'p' + vid, quantity: qty, gift: flag ? { value: flag } : null, cost: { amountPerQuantity: { amount: '30.00' } },
    merchandise: { __typename: 'ProductVariant', id: 'gid://shopify/ProductVariant/' + vid, product: { id: 'gid://shopify/Product/9' } } });
  it('any variant of the gift product is free once', () => expect(total(run([line('1', 2), pick(905)], null, cfg))).toBeCloseTo(30));
  it('only one unit free', () => expect(total(run([line('1', 2), pick(905, '1', 2)], null, cfg))).toBeCloseTo(30));
  it('without the gift flag it is paid', () => expect(total(run([line('1', 2), pick(905, null)], null, cfg))).toBeCloseTo(0));
  it('tier not reached: paid', () => expect(total(run([line('1', 1), pick(905)], null, cfg))).toBeCloseTo(0));
  it('gift is the bundle product itself: box keeps its units', () => {
    const c = { bundles: { g: { title: 'Gift', tiers: [{ buy: 1 }, { buy: 2, gifts: [{ type: 'product', variant: 1, choose: true, product: 1 }] }] } }, products: { [P]: { bundle: 'g' } } };
    const g = { ...line('9', 1), gift: { value: '1' } };
    expect(total(run([line('1', 2), g], null, c))).toBeCloseTo(124.95);
  });
});
