import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { db } from '../src/shared/config/db.js';
import { JWT_ACCESS_SECRET, JWT_SECRET } from '../src/shared/config/utils.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, title: string, detail?: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${title} - ${detail || ''}`);
    throw new Error(`Test Failed: ${title}`);
  }
  passed++;
  console.log(`✅ PASS: ${title}`);
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING ANALYTICS STAGE 1 TEST SUITE (OVERVIEW, REVENUE, ORDERS)');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const state = db.getState();
  const adminUser = state.users.find((u) => u.role === 'superadmin' || u.role === ('SUPERADMIN' as any)) || state.users[0];
  const managerUser = state.users.find((u) => u.role === 'manager' || u.role === ('MANAGER' as any)) || {
    id: 'usr_manager_1',
    role: 'manager',
    email: 'manager@hestiia.com',
    tokenVersion: 0,
  };

  const secret = JWT_ACCESS_SECRET || JWT_SECRET;
  const superadminToken = jwt.sign(
    {
      id: adminUser.id,
      role: 'SUPERADMIN',
      email: adminUser.email,
      tokenVersion: adminUser.tokenVersion || 0,
    },
    secret,
    { expiresIn: '1h' }
  );

  const managerToken = jwt.sign(
    {
      id: managerUser.id,
      role: 'MANAGER',
      email: managerUser.email,
      tokenVersion: managerUser.tokenVersion || 0,
    },
    secret,
    { expiresIn: '1h' }
  );

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Authorization Guards
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Auth & Role Security ---');
    const unauthRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`);
    assert(unauthRes.status === 401, 'GET /overview without token returns 401 Unauthorized');

    const invalidTokenRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: 'Bearer invalid.token.string' },
    });
    assert(invalidTokenRes.status === 401, 'GET /overview with forged JWT returns 401 Unauthorized');

    // -------------------------------------------------------------------------
    // TEST 2: Overview Analytics Service
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Analytics Overview Service ---');
    const overviewRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const overviewData = await overviewRes.json();

    assert(overviewRes.status === 200, 'GET /api/v1/admin/analytics/overview returns 200 OK');
    assert(overviewData.success === true, 'Response payload contains success: true');
    assert(overviewData.metrics !== undefined, 'Response contains metrics object');

    const m = overviewData.metrics;
    assert(typeof m.totalOrders === 'number', 'totalOrders is numeric');
    assert(typeof m.completedOrders === 'number', 'completedOrders is numeric');
    assert(typeof m.cancelledOrders === 'number', 'cancelledOrders is numeric');
    assert(typeof m.pendingOrders === 'number', 'pendingOrders is numeric');
    assert(typeof m.totalSales === 'number', 'totalSales is numeric float');
    assert(typeof m.totalSalesInPaise === 'number', 'totalSalesInPaise is integer paise');
    assert(m.totalSalesInPaise === Math.round(m.totalSales * 100), 'Paise matches rupee calculation for total sales');
    assert(typeof m.collectedRevenue === 'number', 'collectedRevenue is numeric float');
    assert(typeof m.collectedRevenueInPaise === 'number', 'collectedRevenueInPaise is integer paise');
    assert(typeof m.totalRefunds === 'number', 'totalRefunds is numeric float');
    assert(typeof m.averageOrderValue === 'number', 'averageOrderValue is numeric float');
    assert(typeof m.uniqueCustomers === 'number', 'uniqueCustomers is numeric');
    assert(typeof m.returningCustomers === 'number', 'returningCustomers is numeric');
    assert(m.returningCustomers <= m.uniqueCustomers, 'Returning customers is subset of unique customers');

    // -------------------------------------------------------------------------
    // TEST 3: Revenue Analytics Service
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Sales & Revenue Analytics Service ---');
    const revenueRes = await fetch(`${baseUrl}/api/v1/admin/analytics/revenue?preset=last30days`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const revenueData = await revenueRes.json();

    assert(revenueRes.status === 200, 'GET /api/v1/admin/analytics/revenue returns 200 OK');
    const r = revenueData.revenue;
    assert(typeof r.grossSales === 'number', 'grossSales is numeric float');
    assert(typeof r.discounts === 'number', 'discounts is numeric float');
    assert(typeof r.netSales === 'number', 'netSales is numeric float');
    assert(typeof r.collectedRevenue === 'number', 'collectedRevenue is numeric float');
    assert(typeof r.refundAmounts === 'number', 'refundAmounts is numeric float');
    assert(typeof r.averageOrderValue === 'number', 'averageOrderValue is numeric float');
    assert(r.comparison !== undefined, 'comparison object is present');
    assert(typeof r.comparison.revenueChangePercent === 'number', 'revenueChangePercent is numeric');
    assert(Array.isArray(r.trends), 'trends array is present');

    // -------------------------------------------------------------------------
    // TEST 4: Order Analytics Service
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Order Analytics Service ---');
    const ordersRes = await fetch(`${baseUrl}/api/v1/admin/analytics/orders`, {
      headers: { Authorization: `Bearer ${managerToken}` }, // Manager role authorized
    });
    const ordersData = await ordersRes.json();

    assert(ordersRes.status === 200, 'GET /api/v1/admin/analytics/orders with MANAGER role returns 200 OK');
    const o = ordersData.orders;
    assert(typeof o.totalOrders === 'number', 'totalOrders is numeric');
    assert(o.ordersByStatus !== undefined, 'ordersByStatus object is present');
    assert(o.ordersByType !== undefined, 'ordersByType object is present');
    assert(typeof o.ordersByType.delivery === 'number', 'ordersByType.delivery is numeric');
    assert(typeof o.ordersByType.pickup === 'number', 'ordersByType.pickup is numeric');
    assert(typeof o.ordersByType.dineIn === 'number', 'ordersByType.dineIn is numeric');
    assert(Array.isArray(o.peakOrderingHours), 'peakOrderingHours is an array');
    assert(o.peakOrderingHours.length === 24, 'peakOrderingHours contains 24 hourly buckets (0-23)');
    assert(Array.isArray(o.trends), 'order trends array is present');

    // -------------------------------------------------------------------------
    // TEST 5: Date Filtering & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Date Filtering & Validation ---');
    const presets = ['today', 'yesterday', 'last7days', 'last30days', 'thismonth'];
    for (const p of presets) {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics/overview?preset=${p}`, {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      assert(res.status === 200, `Date filter preset '${p}' executes successfully`);
    }

    const customValidRes = await fetch(
      `${baseUrl}/api/v1/admin/analytics/revenue?preset=custom&startDate=2026-10-01&endDate=2026-11-30`,
      { headers: { Authorization: `Bearer ${superadminToken}` } }
    );
    assert(customValidRes.status === 200, 'Valid custom date range returns 200 OK');

    const customInvalidRes = await fetch(
      `${baseUrl}/api/v1/admin/analytics/revenue?preset=custom&startDate=2026-11-30&endDate=2026-10-01`,
      { headers: { Authorization: `Bearer ${superadminToken}` } }
    );
    assert(customInvalidRes.status === 400, 'startDate > endDate rejected with 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 6: Legacy Endpoint Compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Backward Compatible Endpoints ---');
    const legacyRes = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    assert(legacyRes.status === 200, 'Legacy GET /api/admin/analytics/overview returns 200 OK');

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${passed} / ${total} TESTS PASSED SUCCESSFULLY!`);
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST RUNNER ABORTED WITH ERROR:', err);
  process.exit(1);
});
