import http from 'http';
import { app } from '../src/app.js';
import { db } from '../src/shared/config/db.js';

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
  console.log('🧪 TESTING POSTMAN AUTH & ALL 6 ANALYTICS ENDPOINTS');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Admin Login Endpoint (Generates Real JWT Token)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Admin Login Flow & JWT Generation ---');
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@hestiia.com',
        password: 'Admin@Hestiia2026',
      }),
    });
    const loginData = await loginRes.json();

    assert(loginRes.status === 200, 'POST /api/v1/auth/login returns 200 OK');
    assert(loginData.success === true, 'Login response confirms success: true');
    assert(typeof loginData.token === 'string' && loginData.token.length > 20, 'Login response returns JWT token string');
    assert(loginData.accessToken === loginData.token, 'Both token and accessToken fields provided');
    assert(loginData.user && loginData.user.role === 'SUPERADMIN', 'Authenticated user role is SUPERADMIN');

    const adminToken = loginData.token;

    // Also test Manager login
    const managerLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'manager@hestiia.com',
        password: 'Manager@Hestiia2026',
      }),
    });
    const managerLoginData = await managerLoginRes.json();
    assert(managerLoginRes.status === 200, 'Manager login returns 200 OK');
    const managerToken = managerLoginData.token;

    // -------------------------------------------------------------------------
    // TEST 2: Security & Rejection without Token or with Invalid Token
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Security Guards & 401 Unauthorized Verification ---');
    const noTokenRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`);
    assert(noTokenRes.status === 401, 'Request without Authorization header returns 401 Unauthorized');

    const badTokenRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: 'Bearer this-is-a-garbage-token-12345' },
    });
    assert(badTokenRes.status === 401, 'Request with forged token returns 401 Unauthorized');

    // -------------------------------------------------------------------------
    // TEST 3: All 6 Analytics Endpoints with Standard Bearer Token (Postman Format)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: All 6 Analytics Endpoints with Postman Bearer Token ---');

    // 1. Overview
    const overviewRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const overviewData = await overviewRes.json();
    assert(overviewRes.status === 200, '1. GET /api/v1/admin/analytics/overview returns 200 OK');
    assert(overviewData.metrics && typeof overviewData.metrics.totalSales === 'number', 'Overview payload valid');

    // 2. Revenue
    const revenueRes = await fetch(`${baseUrl}/api/v1/admin/analytics/revenue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const revenueData = await revenueRes.json();
    assert(revenueRes.status === 200, '2. GET /api/v1/admin/analytics/revenue returns 200 OK');
    assert(revenueData.revenue && typeof revenueData.revenue.collectedRevenue === 'number', 'Revenue payload valid');

    // 3. Orders
    const ordersRes = await fetch(`${baseUrl}/api/v1/admin/analytics/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ordersData = await ordersRes.json();
    assert(ordersRes.status === 200, '3. GET /api/v1/admin/analytics/orders returns 200 OK');
    assert(ordersData.orders && Array.isArray(ordersData.orders.peakOrderingHours), 'Orders payload valid');

    // 4. Products
    const productsRes = await fetch(`${baseUrl}/api/v1/admin/analytics/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const productsData = await productsRes.json();
    assert(productsRes.status === 200, '4. GET /api/v1/admin/analytics/products returns 200 OK');
    assert(productsData.products && Array.isArray(productsData.products.bestSellingProducts), 'Products payload valid');
    assert(Array.isArray(productsData.products.categoryWiseSales), 'Category sales array present');

    // 5. Customers
    const customersRes = await fetch(`${baseUrl}/api/v1/admin/analytics/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const customersData = await customersRes.json();
    assert(customersRes.status === 200, '5. GET /api/v1/admin/analytics/customers returns 200 OK');
    assert(customersData.customers && typeof customersData.customers.totalUniqueCustomers === 'number', 'Customers payload valid');
    assert(Array.isArray(customersData.customers.highestValueCustomers), 'Highest value customers array present');

    // 6. Payments
    const paymentsRes = await fetch(`${baseUrl}/api/v1/admin/analytics/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const paymentsData = await paymentsRes.json();
    assert(paymentsRes.status === 200, '6. GET /api/v1/admin/analytics/payments returns 200 OK');
    assert(paymentsData.payments && typeof paymentsData.payments.paymentSuccessRate === 'number', 'Payments payload valid');
    assert(paymentsData.payments.paymentMethodDistribution !== undefined, 'Payment methods distribution present');

    // -------------------------------------------------------------------------
    // TEST 4: Lowercase 'bearer' Header Case-Insensitivity Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Case-Insensitive Bearer Token Support ---');
    const lowercaseBearerRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: `bearer ${adminToken}` },
    });
    assert(lowercaseBearerRes.status === 200, 'Lowercase "bearer <token>" header is accepted (never 401)');

    // -------------------------------------------------------------------------
    // TEST 5: Manager Role Access Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Manager Role Permissions ---');
    const managerOverviewRes = await fetch(`${baseUrl}/api/v1/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(managerOverviewRes.status === 200, 'Manager token successfully accesses analytics (200 OK)');

    // -------------------------------------------------------------------------
    // TEST 6: Legacy Endpoint Compatibility (/api/admin/analytics/*)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Legacy URL Namespace Compatibility ---');
    const legacyOverviewRes = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(legacyOverviewRes.status === 200, 'Legacy GET /api/admin/analytics/overview returns 200 OK');

    const legacyProductsRes = await fetch(`${baseUrl}/api/admin/analytics/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(legacyProductsRes.status === 200, 'Legacy GET /api/admin/analytics/products returns 200 OK');

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
