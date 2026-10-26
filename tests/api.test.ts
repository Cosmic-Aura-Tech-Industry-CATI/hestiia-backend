import app from '../src/server.js';
import { db } from '../src/shared/config/db.js';

let server: any;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('🧪 [TEST SUITE START] Running Hestiia Restaurant Admin & Backend Integration Tests...\n');

  // Start temporary test server
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  let adminToken = '';
  let createdDishId = '';
  let createdOrderId = '';
  let createdInvoiceNumber = '';
  let createdBookingId = '';
  let createdPartyId = '';
  let createdReviewId = '';

  try {
    // 1. Healthcheck
    const healthRes = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    assert(healthRes.status === 'healthy', 'API Healthcheck returns healthy status');

    // 2. Authentication Failure on invalid credentials
    const badLoginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword!' }),
    });
    assert(badLoginRes.status === 401, 'Unauthorized request rejected with status 401');

    // 3. Authentication Success
    const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@Hestiia2026' }),
    }).then((r) => r.json());

    assert(loginRes.success === true && Boolean(loginRes.token), 'Admin login successful and JWT returned');
    adminToken = loginRes.token;

    // 4. GET /api/admin/auth/me
    const meRes = await fetch(`${BASE_URL}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(meRes.user?.username === 'admin' && meRes.user?.role === 'superadmin', 'Current user session verified');

    // 5. Dashboard Overview Metrics
    const dashRes = await fetch(`${BASE_URL}/admin/dashboard/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(dashRes.success === true && dashRes.metrics?.totalDishesCount > 0, 'Dashboard overview calculated live metrics');

    // 6. Public Menu
    const pubMenuRes = await fetch(`${BASE_URL}/menu`).then((r) => r.json());
    assert(pubMenuRes.success === true && pubMenuRes.dishes.length >= 10, 'Public menu retrieves active dishes');

    // 7. Food Menu CRUD (Create Dish)
    const createDishRes = await fetch(`${BASE_URL}/admin/menu/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Awadhi Korma Platter',
        category: 'Main Course',
        price: 380,
        description: 'Tender simmered Awadhi gravy with saffron essence',
        isVeg: true,
        available: true,
      }),
    }).then((r) => r.json());

    assert(createDishRes.success === true && createDishRes.dish?.name === 'Awadhi Korma Platter', 'Food menu dish created');
    createdDishId = createDishRes.dish.id;

    // 8. Toggle Availability
    const toggleRes = await fetch(`${BASE_URL}/admin/menu/admin/${createdDishId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ available: false }),
    }).then((r) => r.json());
    assert(toggleRes.dish?.available === false, 'Availability successfully toggled to Sold Out (86’d)');

    // 9. Online Order Lifecycle & Price Integrity Check
    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Rohit Aggarwal',
        customerPhone: '+91 98390 99881',
        deliveryAddress: 'Shyam Nagar Block B, Kanpur',
        fulfillmentType: 'delivery',
        paymentMethod: 'cod',
        items: [
          { dishId: 'handi-paneer', quantity: 2 },
          { dishId: 'veg-biryani', quantity: 1 },
        ],
      }),
    }).then((r) => r.json());

    assert(orderRes.success === true && Boolean(orderRes.order?.orderNumber), 'Online order created with valid order number');
    createdOrderId = orderRes.order.id;
    createdInvoiceNumber = orderRes.invoice.invoiceNumber;
    assert(orderRes.order.taxAmount > 0, 'GST tax accurately calculated on order');
    assert(orderRes.order.deliveryCharge === 40, 'Delivery fee applied correctly');

    // 10. Order Status Transitions
    const statusRes = await fetch(`${BASE_URL}/admin/orders/admin/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'confirmed', note: 'Kitchen order accepted by Head Chef' }),
    }).then((r) => r.json());
    assert(statusRes.order?.orderStatus === 'confirmed', 'Order status moved to Confirmed');

    // 11. Payment Collection Workflow
    const payRes = await fetch(`${BASE_URL}/admin/orders/admin/${createdOrderId}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ paymentStatus: 'paid', collectedBy: 'Delivery Rider Aman' }),
    }).then((r) => r.json());
    assert(payRes.order?.paymentStatus === 'paid', 'Order payment reconciled as Paid');

    // 12. Printable Invoice Verification
    const invRes = await fetch(`${BASE_URL}/admin/invoices/${createdInvoiceNumber}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(invRes.success === true && invRes.invoice.orderNumber === orderRes.order.orderNumber, 'Printable tax invoice retrieved');

    // 13. Table Booking Inquiry
    const bookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tarun Saxena',
        phone: '+91 99180 77665',
        date: '2026-10-30',
        time: '08:00 PM',
        guests: '4 Guests',
        occasion: 'Birthday Dinner',
      }),
    }).then((r) => r.json());
    assert(bookRes.success === true && Boolean(bookRes.bookingId), 'Table reservation inquiry submitted successfully');
    createdBookingId = bookRes.bookingId;

    // 14. Update Booking Status
    const bookUpdateRes = await fetch(`${BASE_URL}/admin/bookings/admin/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'confirmed', staffNotes: 'Reserved Booth B2' }),
    }).then((r) => r.json());
    assert(bookUpdateRes.booking?.status === 'confirmed', 'Table booking confirmed with staff notes');

    // 15. Party and Event Inquiries
    const partyRes = await fetch(`${BASE_URL}/party-inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Shree Radhey Exports Ltd',
        phone: '+91 98391 00112',
        eventType: 'corporate',
        preferredDate: '2026-11-20',
        guestCount: 40,
        budgetRange: '₹40,000 – ₹60,000',
        specialRequirements: 'Vegetarian live counter with Handi Paneer & Chaap Tikka Biryani',
      }),
    }).then((r) => r.json());
    assert(partyRes.success === true && Boolean(partyRes.inquiryId), 'Banquet & party inquiry logged');
    createdPartyId = partyRes.inquiryId;

    // 16. Customer Feedback & Review Moderation
    const revRes = await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Kunal Singhal',
        rating: 5,
        dishName: 'Handi Paneer',
        comment: 'Exceptional slow-cooked flavours and rustic clay aroma!',
      }),
    }).then((r) => r.json());
    assert(revRes.success === true, 'Customer review submitted (pending moderation)');
    createdReviewId = revRes.review.id;

    // Approve Review
    const approveRes = await fetch(`${BASE_URL}/admin/reviews/admin/${createdReviewId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isApproved: true }),
    }).then((r) => r.json());
    assert(approveRes.review?.isApproved === true, 'Review successfully approved for public website');

    // 17. Reports Analytics & CSV Export
    const reportRes = await fetch(`${BASE_URL}/admin/reports/analytics?period=30days`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(reportRes.success === true && reportRes.totalRevenue > 0, 'Analytics report calculated verified revenue');

    const csvRes = await fetch(`${BASE_URL}/admin/reports/export/orders.csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csvText = await csvRes.text();
    assert(csvRes.status === 200 && csvText.includes('Order Number'), 'Orders CSV report generated with headers');

    // 18. Restaurant Settings
    const settingsRes = await fetch(`${BASE_URL}/admin/settings/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(settingsRes.settings?.currency === 'INR' && settingsRes.settings?.taxRatePercent === 5, 'Settings reflect INR currency and 5% GST');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log(`\n=======================================================`);
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
