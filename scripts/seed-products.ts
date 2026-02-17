import { getUncachableStripeClient } from '../server/stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const products = await stripe.products.search({ query: "name:'UTM Spec Pro'" });
  if (products.data.length > 0) {
    console.log('UTM Spec Pro product already exists:', products.data[0].id);
    const prices = await stripe.prices.list({ product: products.data[0].id, active: true });
    console.log('Existing prices:', prices.data.map(p => `${p.id} - $${(p.unit_amount ?? 0) / 100}/${p.recurring?.interval}`));
    return;
  }

  const product = await stripe.products.create({
    name: 'UTM Spec Pro',
    description: 'Professional UTM parameter management with unlimited rows, CSV export, and up to 50 saved rulesets.',
    metadata: {
      plan: 'pro',
    },
  });

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 1900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'pro' },
  });

  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 19000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'pro' },
  });

  console.log('Created product:', product.id);
  console.log('Monthly price:', monthlyPrice.id, '- $19/month');
  console.log('Yearly price:', yearlyPrice.id, '- $190/year');
  console.log('\nUpdate STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_PRO_YEARLY_PRICE_ID env vars with these IDs.');
}

createProducts().catch(console.error);
