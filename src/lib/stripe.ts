import { loadStripe } from '@stripe/stripe-js';

// Stripe publishable key - safe to include in client-side code
export const stripePromise = loadStripe('pk_live_51SF3PtAQgLXUZe0i2JzlhcoV97rcOvInGLmkCGvvIvc5ZwZlTSV9KeK0Mu3b03Zo1ZyM8OWeAnJdPAViYiVAX9RL00ayKHDyRv');
