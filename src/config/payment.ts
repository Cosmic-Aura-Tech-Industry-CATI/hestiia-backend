import { ENV } from './env.js';

export const paymentConfig = {
  provider: 'razorpay',
  currency: 'INR',
  keyId: ENV.RAZORPAY_KEY_ID || 'rzp_test_hestiia_mock',
  keySecret: ENV.RAZORPAY_KEY_SECRET || 'rzp_sec_hestiia_mock',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_hestiia_mock',
};

export default paymentConfig;
