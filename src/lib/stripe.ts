import type { Stripe } from '@stripe/stripe-js';

// Stripe publishable key - safe to include in client-side code
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SF3PtAQgLXUZe0i2JzlhcoV97rcOvInGLmkCGvvIvc5ZwZlTSV9KeK0Mu3b03Zo1ZyM8OWeAnJdPAViYiVAX9RL00ayKHDyRv';

// Lazy-load Stripe only when needed to reduce initial bundle size
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) => 
      loadStripe(STRIPE_PUBLISHABLE_KEY)
    );
  }
  return stripePromise;
};
