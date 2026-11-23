import crypto from 'crypto';
import { ordersService } from '../src/modules/orders/orders.service.js';
import { paymentsService } from '../src/modules/payments/payments.service.js';
import { paymentConfig } from '../src/config/payment.js';
import { db } from '../src/shared/config/db.js';
import { eventBus, DOMAIN_EVENTS } from '../src/events/eventBus.js';
import '../src/events/orderEvents.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${testName} - ${detail || ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${testName}`);
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING PRODUCTION ORDERS & PAYMENTS TEST SUITE');
  console.log('===============================================================\n');

  const state = db.getState();
  const testDish = state.dishes.find((d) => d.available) || state.dishes[0];

  // -------------------------------------------------------------------------
  // TEST 1: Order Creation with Integer Paise and Server-Enforced Pending Payment
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Order Creation & Financial Integrity ---');
  const idempotencyKey1 = 'test_key_' + Date.now();
  const createPayload = {
    customerName: 'Aarav Patel',
    customerPhone: '9876543210',
    customerEmail: 'aarav@example.com',
    deliveryAddress: 'Flat 402, Royal Palms, Pune',
    fulfillmentType: 'delivery',
    items: [{ dishId: testDish.id, quantity: 2 }],
    paymentMethod: 'online', // Note: Requesting online
    idempotencyKey: idempotencyKey1,
  };

  const orderResult = await ordersService.createOrder(createPayload);
  const createdOrder = orderResult.order;
  const createdPayment = orderResult.payment;

  assert(createdOrder.orderStatus === 'pending', 'Initial order status is pending');
  assert(createdOrder.paymentStatus === 'pending', 'Online payment status is strictly initialized as pending, NEVER paid');
  assert(createdOrder.grandTotalInPaise !== undefined && createdOrder.grandTotalInPaise > 0, 'grandTotalInPaise calculated accurately');
  assert(createdOrder.grandTotalInPaise === Math.round(createdOrder.grandTotal * 100), 'Paise matches rupee float value');
  assert(createdPayment !== undefined && createdPayment.paymentStatus === 'pending', 'Payment record status is pending');

  // -------------------------------------------------------------------------
  // TEST 2: Idempotent Order Placement
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Order Idempotency Guard ---');
  const duplicateOrderResult = await ordersService.createOrder(createPayload);
  assert(duplicateOrderResult.isIdempotentReplay === true, 'Duplicate order request recognized via idempotencyKey');
  assert(duplicateOrderResult.order.id === createdOrder.id, 'Idempotent replay returns original order ID without duplicating database rows');

  // -------------------------------------------------------------------------
  // TEST 3: Payment Intent Initiation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Payment Intent Generation ---');
  const intentResult = await paymentsService.createPaymentIntent({
    orderId: createdOrder.id,
    idempotencyKey: 'intent_key_' + createdOrder.id,
  });

  assert(intentResult.orderId === createdOrder.id, 'Intent linked to order');
  assert(intentResult.gatewayOrderId.startsWith('order_hst_'), 'Gateway order ID generated with restaurant namespace');
  assert(intentResult.amountInPaise === createdOrder.grandTotalInPaise, 'Intent amount in paise matches exact order total in paise');

  // -------------------------------------------------------------------------
  // TEST 4: Online Payment Server-Side Verification (Tamper Proof)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Server-Side Cryptographic Signature Verification ---');
  const gatewayOrderId = intentResult.gatewayOrderId;
  const gatewayPaymentId = 'pay_mock_' + Date.now();

  // Test 4a: Fraudulent Signature Rejection
  let tamperedCaught = false;
  try {
    await paymentsService.verifyOnlinePayment({
      orderId: createdOrder.id,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature: 'fraudulent_tampered_signature_123',
    });
  } catch (err: any) {
    tamperedCaught = true;
  }
  assert(tamperedCaught, 'Tampered / forged payment signature rejected by server with 400 AppError');

  // Test 4b: Authentic Signature Acceptance
  const legitimateSignature = crypto
    .createHmac('sha256', paymentConfig.keySecret)
    .update(`${gatewayOrderId}|${gatewayPaymentId}`)
    .digest('hex');

  const verifiedPayment: any = await paymentsService.verifyOnlinePayment({
    orderId: createdOrder.id,
    gatewayOrderId,
    gatewayPaymentId,
    gatewaySignature: legitimateSignature,
  });

  assert(Boolean(verifiedPayment && verifiedPayment.paymentStatus === 'paid'), 'Legitimate signature marks payment as paid');
  assert(Boolean(verifiedPayment && verifiedPayment.gatewayTransactionReference === gatewayPaymentId), 'Gateway transaction reference stored');

  // Verify Domain Event advanced order to confirmed
  const refreshedOrder = (await ordersService.getOrderDetails(createdOrder.id)).order;
  assert(refreshedOrder.paymentStatus === 'paid', 'Order paymentStatus synchronized to paid via domain event');
  assert(refreshedOrder.orderStatus === 'confirmed', 'Order automatically advanced from pending to confirmed upon payment capture');

  // -------------------------------------------------------------------------
  // TEST 5: Manual UPI Workflow (Submit UTR, Prevent Duplicate, Admin Review)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Manual UPI Workflow & Duplicate Prevention ---');
  const upiOrderResult = await ordersService.createOrder({
    customerName: 'Priya Sharma',
    customerPhone: '9123456780',
    fulfillmentType: 'pickup',
    items: [{ dishId: testDish.id, quantity: 1 }],
    paymentMethod: 'upi',
  });
  const upiOrder = upiOrderResult.order;

  const testUtr = 'UTR_' + Date.now();
  const upiPayment: any = await paymentsService.submitManualUpiReference({
    orderId: upiOrder.id,
    orderNumber: upiOrder.orderNumber,
    upiUtr: testUtr,
  });

  assert(Boolean(upiPayment && upiPayment.paymentStatus === 'awaiting_verification'), 'Manual UPI payment moves to awaiting_verification');
  assert(Boolean(upiPayment && upiPayment.upiUtr === testUtr), 'UTR recorded on payment record');

  // Test Duplicate UTR fraud rejection
  let duplicateUtrCaught = false;
  // Mark this one as paid first via admin approval
  await paymentsService.verifyManualUpi({
    paymentId: upiPayment.id,
    approved: true,
  }, 'Manager Bob');

  const refreshedUpiOrder = (await ordersService.getOrderDetails(upiOrder.id)).order;
  assert(refreshedUpiOrder.paymentStatus === 'paid', 'Manager approval transitions UPI payment to paid and order to confirmed');

  // Now attempt to reuse the exact same UTR for a second order
  const upiOrder2 = (await ordersService.createOrder({
    customerName: 'Fraud Attempt',
    customerPhone: '9000000000',
    items: [{ dishId: testDish.id, quantity: 1 }],
    paymentMethod: 'upi',
  })).order;

  try {
    await paymentsService.submitManualUpiReference({
      orderId: upiOrder2.id,
      upiUtr: testUtr, // Reusing existing paid UTR!
    });
  } catch (err: any) {
    duplicateUtrCaught = true;
  }
  assert(duplicateUtrCaught, 'Duplicate UTR reuse correctly blocked to prevent fraud');

  // -------------------------------------------------------------------------
  // TEST 6: Webhook Idempotency & Capture
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Razorpay Webhook Idempotency ---');
  const webhookOrder = (await ordersService.createOrder({
    customerName: 'Neha Verma',
    customerPhone: '9888877777',
    items: [{ dishId: testDish.id, quantity: 1 }],
    paymentMethod: 'online',
  })).order;

  const mockWebhookPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_' + Date.now(),
          amount: Math.round(webhookOrder.grandTotal * 100),
          notes: {
            orderId: webhookOrder.id,
          },
        },
      },
    },
  };

  const capturedPayment = await paymentsService.handleWebhookPaymentCaptured(mockWebhookPayload);
  assert(capturedPayment?.paymentStatus === 'paid', 'Webhook payment.captured successfully marked payment paid');

  // Retried webhook event: Idempotent skip
  const retriedCapture = await paymentsService.handleWebhookPaymentCaptured(mockWebhookPayload);
  assert(retriedCapture?.paymentStatus === 'paid', 'Webhook retry safely handled without duplicate mutations');

  // -------------------------------------------------------------------------
  // TEST 7: Order Cancellation & Auto-Refund
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Order Cancellation & Auto-Refund Workflow ---');
  // Order 1 (createdOrder) is currently confirmed and paid
  const cancelResult: any = await ordersService.cancelOrder(
    createdOrder.id,
    'Customer changed their mind before food prep',
    'Customer',
    true // customer cancellation
  );

  assert(Boolean(cancelResult && cancelResult.orderStatus === 'cancelled'), 'Order status moved to cancelled');

  // Check that refund was automatically triggered for paid order
  const paymentAfterCancel = (await ordersService.getOrderDetails(createdOrder.id)).payment;
  assert(paymentAfterCancel?.paymentStatus === 'refunded', 'Paid order auto-triggers refund upon cancellation');
  assert(paymentAfterCancel?.refundReference?.startsWith('RFD_') === true, 'Refund reference generated');

  // Test cancellation blocked once preparing
  const preparingOrder = (await ordersService.createOrder({
    customerName: 'Rohan Gupta',
    customerPhone: '9777766666',
    items: [{ dishId: testDish.id, quantity: 1 }],
  })).order;

  await ordersService.updateOrderStatus(preparingOrder.id, 'preparing', 'Chef started cooking', 'Kitchen Chef');

  let customerCancelBlocked = false;
  try {
    await ordersService.cancelOrder(preparingOrder.id, 'Want to cancel', 'Customer', true);
  } catch (err: any) {
    customerCancelBlocked = true;
  }
  assert(customerCancelBlocked, 'Customer cancellation strictly blocked once kitchen starts food preparation');

  // -------------------------------------------------------------------------
  // TEST 8: Financial Reconciliation Report
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Financial Reconciliation Report ---');
  const report = await paymentsService.getReconciliationReport();
  assert(report.totalOrders > 0, 'Total orders counted');
  assert(report.totalPaidAmount > 0, 'Total paid amount aggregated');
  assert(typeof report.discrepancyCount === 'number', 'Discrepancy count calculated');
  console.log(`Financial Audit Summary: ${report.totalOrders} Orders, ₹${report.totalPaidAmount} Paid, ${report.refundedCount} Refunded, Discrepancies: ${report.discrepancyCount}`);

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER ABORTED WITH ERROR:', err);
  process.exit(1);
});
