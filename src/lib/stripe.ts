import { loadStripe } from '@stripe/stripe-js';

// IMPORTANT: Add your Stripe publishable key as a secret
// 1. Go to your Stripe dashboard: https://dashboard.stripe.com/test/apikeys
// 2. Copy your "Publishable key" (starts with pk_test_ or pk_live_)
// 3. Add it as VITE_STRIPE_PUBLISHABLE_KEY in your project secrets
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
