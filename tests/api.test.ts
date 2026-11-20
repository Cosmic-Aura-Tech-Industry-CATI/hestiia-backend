import 'dotenv/config';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/mongodb';
import { BookingModel } from '../src/models/Booking.model';
import { CustomerModel } from '../src/models/Customer.model';
import { DishModel } from '../src/models/Dish.model';
import { InvoiceModel } from '../src/models/Invoice.model';
import { LoginAttemptModel } from '../src/models/LoginAttempt.model';
import { OrderModel } from '../src/models/Order.model';
import { PartyInquiryModel } from '../src/models/PartyInquiry.model';
import { PaymentModel } from '../src/models/Payment.model';
import { ReviewModel } from '../src/models/Review.model';
import { UserModel } from '../src/models/User.model';

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api`;

async function waitForHealth(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Timed out waiting for Next.js API server to become healthy.');
}

async function runTests() {
  console.log('🧪 [TEST SUITE START] Running Hestiia Next.js + MongoDB Integration Tests...\n');

  const hasBuild = fs.existsSync(path.resolve(process.cwd(), '.next', 'BUILD_ID'));
  const nextSubcommand = hasBuild ? 'start' : 'dev';
  const nextBin = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

  const serverProc: ChildProcess = spawn(process.execPath, [nextBin, nextSubcommand, '-p', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: hasBuild ? 'production' : 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
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
  const testOrderPhone = '9839099881';
  const tempStaffUsername = `test_staff_${Date.now()}`;
  const bruteForceProbeUser = `bruteforce_probe_${Date.now()}`;

  try {
    await waitForHealth();
    await connectDB();

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

    // 9. Online Order Lifecycle & Price Integrity Check (using active available dishes)
    const activeDish = pubMenuRes.dishes[0];
    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Rohit Aggarwal',
        customerPhone: `+91 ${testOrderPhone}`,
        deliveryAddress: 'Shyam Nagar Block B, Kanpur',
        fulfillmentType: 'delivery',
        paymentMethod: 'cod',
        items: [{ dishId: activeDish.id, quantity: 2 }],
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

    // 19. Upload Endpoint Validation (rejects missing file)
    const emptyUploadForm = new FormData();
    const emptyUploadRes = await fetch(`${BASE_URL}/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: emptyUploadForm,
    });
    assert(emptyUploadRes.status === 400, 'Upload endpoint rejects empty form payload with 400');

    // 20. Auth Hardening: createUser validation (invalid role & weak password)
    const badRoleRes = await fetch(`${BASE_URL}/admin/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Invalid Role User',
        email: 'badrole@hestiia.com',
        username: 'bad_role_user',
        password: 'ValidPassword1',
        role: 'owner',
      }),
    });
    assert(badRoleRes.status === 400, 'createUser rejects disallowed role with status 400');

    const weakPwdRes = await fetch(`${BASE_URL}/admin/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Weak Password User',
        email: 'weakpwd@hestiia.com',
        username: 'weak_pwd_user',
        password: 'weak',
        role: 'staff',
      }),
    });
    assert(weakPwdRes.status === 400, 'createUser rejects weak password with status 400');

    // 21. Auth Hardening: Create valid staff user & verify token invalidation on password change + logout
    const createStaffRes = await fetch(`${BASE_URL}/admin/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test Staff Member',
        email: `${tempStaffUsername}@hestiia.com`,
        username: tempStaffUsername,
        password: 'StaffUser@2026',
        role: 'staff',
      }),
    });
    const createStaffBody = await createStaffRes.json();
    assert(createStaffRes.status === 201 && createStaffBody.user?.role === 'staff', 'Valid staff user created via superadmin');

    const staffLoginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: tempStaffUsername, password: 'StaffUser@2026' }),
    }).then((r) => r.json());
    const oldStaffToken = staffLoginRes.token;
    assert(Boolean(oldStaffToken), 'Newly created staff user can log in');

    const changePwdRes = await fetch(`${BASE_URL}/admin/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oldStaffToken}`,
      },
      body: JSON.stringify({ currentPassword: 'StaffUser@2026', newPassword: 'StaffUserNew@2026' }),
    });
    assert(changePwdRes.status === 200, 'Staff password updated successfully');

    const staleTokenAfterPwdRes = await fetch(`${BASE_URL}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${oldStaffToken}` },
    });
    assert(staleTokenAfterPwdRes.status === 401, 'Old JWT invalidated immediately after password change');

    const staffReloginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: tempStaffUsername, password: 'StaffUserNew@2026' }),
    }).then((r) => r.json());
    const freshStaffToken = staffReloginRes.token;
    assert(Boolean(freshStaffToken), 'Staff user can log in with new password');

    const logoutRes = await fetch(`${BASE_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshStaffToken}` },
    });
    assert(logoutRes.status === 200, 'Staff logout succeeded');

    const tokenAfterLogoutRes = await fetch(`${BASE_URL}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${freshStaffToken}` },
    });
    assert(tokenAfterLogoutRes.status === 401, 'JWT invalidated immediately after logout');

    // 22. Auth Hardening: Brute-force lockout after 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: bruteForceProbeUser, password: 'WrongPassword1' }),
      });
    }
    const lockedRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: bruteForceProbeUser, password: 'WrongPassword1' }),
    });
    assert(lockedRes.status === 429, 'Brute-force lockout returns 429 after 5 failed attempts');
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    try {
      await connectDB();
      await Promise.all([
        createdDishId ? DishModel.deleteOne({ id: createdDishId }) : Promise.resolve(),
        createdOrderId ? OrderModel.deleteOne({ id: createdOrderId }) : Promise.resolve(),
        createdOrderId ? PaymentModel.deleteOne({ orderId: createdOrderId }) : Promise.resolve(),
        createdInvoiceNumber
          ? InvoiceModel.deleteOne({ invoiceNumber: createdInvoiceNumber })
          : Promise.resolve(),
        createdBookingId ? BookingModel.deleteOne({ id: createdBookingId }) : Promise.resolve(),
        createdPartyId ? PartyInquiryModel.deleteOne({ id: createdPartyId }) : Promise.resolve(),
        createdReviewId ? ReviewModel.deleteOne({ id: createdReviewId }) : Promise.resolve(),
        CustomerModel.deleteOne({ normalizedPhone: `91${testOrderPhone}` }),
        UserModel.deleteOne({ username: tempStaffUsername }),
        LoginAttemptModel.deleteMany({
          key: { $regex: `${tempStaffUsername}|${bruteForceProbeUser}|ratelimit:` },
        }),
      ]);
      await mongoose.disconnect();
    } catch {
      // Ignore cleanup errors
    }

    serverProc.kill();
  }

  console.log(`\n=======================================================`);
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
