import { DiscountClass, DeliveryDiscountSelectionStrategy } from '../generated/api';
import { reachedTiers } from './cart_lines_discounts_generate_run';

/**
 * Free shipping gift: when a bundle cart (_ob = "1") reaches a tier whose gifts include { type: "shipping" },
 * every delivery group is 100% off.
 * @param {import("../generated/api").DeliveryInput} input
 */
export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  const config = input.shop?.metafield?.jsonValue;
  if (input.cart.bundleCart?.value !== '1' || !config || !input.discount.discountClasses.includes(DiscountClass.Shipping)) {
    return { operations: [] };
  }
  const free = reachedTiers(input, config).some(({ tier }) => tier.gifts.some((g) => g.type === 'shipping'));
  if (!free || !input.cart.deliveryGroups.length) return { operations: [] };
  return {
    operations: [{
      deliveryDiscountsAdd: {
        candidates: [{
          message: 'Free shipping',
          targets: input.cart.deliveryGroups.map((g) => ({ deliveryGroup: { id: g.id } })),
          value: { percentage: { value: 100 } },
        }],
        selectionStrategy: DeliveryDiscountSelectionStrategy.All,
      },
    }],
  };
}
