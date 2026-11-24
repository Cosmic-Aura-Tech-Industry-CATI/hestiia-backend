import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { db } from '../src/shared/config/db.js';
import { JWT_ACCESS_SECRET } from '../src/shared/config/utils.js';
import { DEFAULT_CONTACT_SETTINGS } from '../src/modules/contact/contact.service.js';

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
  console.log('🧪 TESTING CONTACT INFORMATION MANAGEMENT MODULE (PRODUCTION SUITE)');
  console.log('===============================================================\n');

  // Reset contactSettings in store for clean deterministic test run
  db.updateState((s: any) => {
    s.contactSettings = {
      ...DEFAULT_CONTACT_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Admin Authentication & RBAC Guards
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Admin Authentication & RBAC Guards ---');
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@hestiia.com',
        password: 'Admin@Hestiia2026',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Admin login returns 200 OK');
    assert(typeof loginData.token === 'string', 'Admin JWT token received');
    const adminToken = loginData.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Customer JWT token (to test 403 authorization guard)
    const customerToken = jwt.sign(
      { id: 'cust_contact_test', role: 'customer', email: 'cust@hestiia.com' },
      JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
    const customerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    };

    // Unauthenticated GET /api/admin/contact -> 401
    const unauthGet = await fetch(`${baseUrl}/api/admin/contact`);
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/admin/contact returns 401');

    // Unauthenticated PUT /api/admin/contact -> 401
    const unauthPut = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: { number: '+919999999999', enabled: true } }),
    });
    assert(unauthPut.status === 401, 'Unauthenticated PUT /api/admin/contact returns 401');

    // Malformed Bearer header -> 401
    const malformedAuth = await fetch(`${baseUrl}/api/admin/contact`, {
      headers: { Authorization: 'InvalidFormatBearerToken' },
    });
    assert(malformedAuth.status === 401, 'Malformed Authorization header returns 401');

    // Customer token on Admin GET /api/admin/contact -> 403 Forbidden
    const custGet = await fetch(`${baseUrl}/api/admin/contact`, { headers: customerHeaders });
    assert(custGet.status === 403, 'Customer token on GET /api/admin/contact returns 403 Forbidden');

    // Customer token on Admin PUT /api/admin/contact -> 403 Forbidden
    const custPut = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: customerHeaders,
      body: JSON.stringify({ phone: { number: '+919999999999', enabled: true } }),
    });
    assert(custPut.status === 403, 'Customer token on PUT /api/admin/contact returns 403 Forbidden');

    // -------------------------------------------------------------------------
    // SECTION 2: Customer Public Contact API (GET /api/customer/contact)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Customer Public Contact API ---');
    // Public GET without any token
    const publicGetRes = await fetch(`${baseUrl}/api/customer/contact`);
    const publicGetData = await publicGetRes.json();
    assert(publicGetRes.status === 200, 'GET /api/customer/contact is public (200 OK)');
    assert(publicGetData.success === true, 'Response confirms success: true');
    assert(publicGetData.data !== null && typeof publicGetData.data === 'object', 'Data is an object');

    // Verify initial enabled defaults: Call, Email, WhatsApp
    assert(publicGetData.data.phone !== null, 'Phone option is present when enabled');
    assert(publicGetData.data.phone.number === '+919876543210', 'Phone number matches default');
    assert(publicGetData.data.phone.action.startsWith('tel:'), 'Phone action is actionable tel: URI');

    assert(publicGetData.data.email !== null, 'Email option is present when enabled');
    assert(publicGetData.data.email.address === 'restaurant@hestiia.com', 'Email address matches default');
    assert(publicGetData.data.email.action.startsWith('mailto:'), 'Email action is actionable mailto: URI');

    assert(publicGetData.data.whatsapp !== null, 'WhatsApp option is present when enabled');
    assert(publicGetData.data.whatsapp.number === '919876543210', 'WhatsApp number matches default digits');
    assert(publicGetData.data.whatsapp.action.startsWith('https://wa.me/'), 'WhatsApp action is actionable https://wa.me/ URI');

    // Verify response does NOT expose internal database fields
    assert(publicGetData.data._id === undefined, 'Customer payload does not leak database _id');
    assert(publicGetData.data.__v === undefined, 'Customer payload does not leak database __v');
    assert(publicGetData.data.createdAt === undefined, 'Customer payload does not leak createdAt');
    assert(publicGetData.data.updatedAt === undefined, 'Customer payload does not leak updatedAt');
    assert(publicGetData.data.phone.enabled === undefined, 'Customer payload does not expose internal enabled boolean');

    // -------------------------------------------------------------------------
    // SECTION 3: Admin GET Contact Settings (GET /api/admin/contact)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Admin GET Contact Settings ---');
    const adminGetRes = await fetch(`${baseUrl}/api/admin/contact`, { headers: adminHeaders });
    const adminGetData = await adminGetRes.json();
    assert(adminGetRes.status === 200, 'GET /api/admin/contact returns 200 OK with admin token');
    assert(adminGetData.success === true, 'Response confirms success: true');
    assert(adminGetData.data.phone.enabled === true, 'Admin view contains phone.enabled boolean');
    assert(adminGetData.data.email.enabled === true, 'Admin view contains email.enabled boolean');
    assert(adminGetData.data.whatsapp.enabled === true, 'Admin view contains whatsapp.enabled boolean');
    assert(typeof adminGetData.data.updatedAt === 'string', 'Admin view includes updatedAt timestamp');

    // -------------------------------------------------------------------------
    // SECTION 4: Admin PUT Validation Failures (Negative Tests)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Admin PUT Input Validations (Negative Cases) ---');
    // 1. Empty body
    const emptyBodyRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({}),
    });
    assert(emptyBodyRes.status === 400, 'Empty request body returns 400 Bad Request');

    // 2. Non-object body (array)
    const arrayBodyRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(['invalid']),
    });
    assert(arrayBodyRes.status === 400, 'Array body returns 400 Bad Request');

    // 3. Unexpected root fields
    const unknownRootRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ instagram: '@hestiia' }),
    });
    assert(unknownRootRes.status === 400, 'Unexpected root field rejected with 400 Bad Request');

    // 4. Invalid phone characters
    const invalidPhoneRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ phone: { number: 'call-me-now-123', enabled: true } }),
    });
    assert(invalidPhoneRes.status === 400, 'Invalid phone characters rejected with 400');

    // 5. Short phone digits (< 7 digits)
    const shortPhoneRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ phone: { number: '12345', enabled: true } }),
    });
    assert(shortPhoneRes.status === 400, 'Phone with < 7 digits rejected with 400');

    // 6. Empty phone number when enabled: true
    const emptyPhoneRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ phone: { number: '   ', enabled: true } }),
    });
    assert(emptyPhoneRes.status === 400, 'Empty phone number when enabled rejected with 400');

    // 7. Invalid email format
    const invalidEmailRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ email: { address: 'notanemail', enabled: true } }),
    });
    assert(invalidEmailRes.status === 400, 'Invalid email format rejected with 400');

    // 8. Empty email address when enabled: true
    const emptyEmailRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ email: { address: '', enabled: true } }),
    });
    assert(emptyEmailRes.status === 400, 'Empty email when enabled rejected with 400');

    // 9. Invalid WhatsApp digits (< 8 digits)
    const shortWaRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ whatsapp: { number: '9876', enabled: true } }),
    });
    assert(shortWaRes.status === 400, 'Short WhatsApp number rejected with 400');

    // 10. Empty WhatsApp number when enabled: true
    const emptyWaRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ whatsapp: { number: '', enabled: true } }),
    });
    assert(emptyWaRes.status === 400, 'Empty WhatsApp when enabled rejected with 400');

    // 11. Unexpected inner fields in phone object
    const unknownInnerRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ phone: { number: '+919876543210', enabled: true, extraField: 'bad' } }),
    });
    assert(unknownInnerRes.status === 400, 'Unexpected inner property in phone rejected with 400');

    // 12. Non-boolean enabled property
    const badBoolRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ phone: { number: '+919876543210', enabled: 'yes' } }),
    });
    assert(badBoolRes.status === 400, 'Non-boolean enabled property rejected with 400');

    // -------------------------------------------------------------------------
    // SECTION 5: Admin PUT Updates & Enable/Disable Matrix
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Admin PUT Updates & Enable/Disable Matrix ---');
    // Test 1: Full Update with new details
    const fullUpdateRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        phone: {
          number: '+91 91234 56789',
          enabled: true,
        },
        email: {
          address: 'support@hestiia.in',
          enabled: true,
        },
        whatsapp: {
          number: '+91 91234 56789',
          enabled: true,
        },
      }),
    });
    const fullUpdateData = await fullUpdateRes.json();
    assert(fullUpdateRes.status === 200, 'PUT /api/admin/contact returns 200 OK');
    assert(fullUpdateData.data.phone.number === '+91 91234 56789', 'Phone number updated');
    assert(fullUpdateData.data.email.address === 'support@hestiia.in', 'Email address updated and normalized');
    assert(fullUpdateData.data.whatsapp.number === '919123456789', 'WhatsApp number stored in clean international digits');

    // Verify Customer API reflects the updated values
    const custAfterUpdate = await (await fetch(`${baseUrl}/api/customer/contact`)).json();
    assert(custAfterUpdate.data.phone.number === '+91 91234 56789', 'Customer API reflects updated phone');
    assert(custAfterUpdate.data.email.address === 'support@hestiia.in', 'Customer API reflects updated email');
    assert(custAfterUpdate.data.whatsapp.number === '919123456789', 'Customer API reflects updated WhatsApp');
    assert(custAfterUpdate.data.whatsapp.action === 'https://wa.me/919123456789', 'WhatsApp URL cleanly formatted for wa.me');

    // Test 2: Partial Update - Disable WhatsApp only
    const disableWaRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        whatsapp: {
          enabled: false,
        },
      }),
    });
    const disableWaData = await disableWaRes.json();
    assert(disableWaRes.status === 200, 'Partial update disabling WhatsApp returns 200 OK');
    assert(disableWaData.data.whatsapp.enabled === false, 'Admin view confirms WhatsApp is disabled');
    assert(disableWaData.data.phone.enabled === true, 'Existing phone remains untouched');
    assert(disableWaData.data.email.enabled === true, 'Existing email remains untouched');

    // Customer API must NOT expose disabled WhatsApp option
    const custWaDisabled = await (await fetch(`${baseUrl}/api/customer/contact`)).json();
    assert(custWaDisabled.data.phone !== null, 'Phone option still active');
    assert(custWaDisabled.data.email !== null, 'Email option still active');
    assert(custWaDisabled.data.whatsapp === null, 'Disabled WhatsApp option is strictly NULL in customer response');

    // Test 3: Disable Phone as well
    await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        phone: {
          enabled: false,
        },
      }),
    });
    const custPhoneDisabled = await (await fetch(`${baseUrl}/api/customer/contact`)).json();
    assert(custPhoneDisabled.data.phone === null, 'Disabled phone option is strictly NULL');
    assert(custPhoneDisabled.data.email !== null, 'Email remains only enabled option');

    // Test 4: Disable all three options
    await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        email: {
          enabled: false,
        },
      }),
    });
    const custAllDisabled = await (await fetch(`${baseUrl}/api/customer/contact`)).json();
    assert(custAllDisabled.data.phone === null, 'All disabled: phone is null');
    assert(custAllDisabled.data.email === null, 'All disabled: email is null');
    assert(custAllDisabled.data.whatsapp === null, 'All disabled: whatsapp is null');

    // Test 5: Re-enable all options with fresh data
    const reEnableRes = await fetch(`${baseUrl}/api/admin/contact`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        phone: {
          number: '+919876543210',
          enabled: true,
        },
        email: {
          address: 'info@hestiiarestaurant.com',
          enabled: true,
        },
        whatsapp: {
          number: '919876543210',
          enabled: true,
        },
      }),
    });
    assert(reEnableRes.status === 200, 'Re-enabling all options returns 200 OK');
    const custReEnabled = await (await fetch(`${baseUrl}/api/customer/contact`)).json();
    assert(custReEnabled.data.phone !== null, 'Phone re-enabled');
    assert(custReEnabled.data.email !== null, 'Email re-enabled');
    assert(custReEnabled.data.whatsapp !== null, 'WhatsApp re-enabled');

    // -------------------------------------------------------------------------
    // SECTION 6: Canonical Routing & Alias Variations (No 404s)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Canonical Routing Variations ---');
    const aliasCustomer1 = await fetch(`${baseUrl}/api/customer/contact`);
    assert(aliasCustomer1.status === 200, '/api/customer/contact returns 200');

    const aliasCustomer2 = await fetch(`${baseUrl}/api/v1/customer/contact`);
    assert(aliasCustomer2.status === 200, '/api/v1/customer/contact returns 200');

    const aliasCustomer3 = await fetch(`${baseUrl}/api/contact`);
    assert(aliasCustomer3.status === 200, '/api/contact returns 200');

    const aliasAdmin1 = await fetch(`${baseUrl}/api/admin/contact`, { headers: adminHeaders });
    assert(aliasAdmin1.status === 200, '/api/admin/contact returns 200');

    const aliasAdmin2 = await fetch(`${baseUrl}/api/v1/admin/contact`, { headers: adminHeaders });
    assert(aliasAdmin2.status === 200, '/api/v1/admin/contact returns 200');

    // -------------------------------------------------------------------------
    // SECTION 7: Concurrency & Worst-Case Edge Cases
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Concurrency & Worst-Case Edge Cases ---');
    // Rapid concurrent updates
    const concurrentUpdates = await Promise.all([
      fetch(`${baseUrl}/api/admin/contact`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ phone: { number: '+91 99999 11111', enabled: true } }),
      }),
      fetch(`${baseUrl}/api/admin/contact`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ email: { address: 'conc1@hestiia.com', enabled: true } }),
      }),
      fetch(`${baseUrl}/api/customer/contact`),
    ]);
    assert(concurrentUpdates[0].status === 200, 'Concurrent update 1 completes with 200');
    assert(concurrentUpdates[1].status === 200, 'Concurrent update 2 completes with 200');
    assert(concurrentUpdates[2].status === 200, 'Concurrent customer GET returns 200');

    // Verify final state is consistent and valid
    const finalAdminCheck = await (await fetch(`${baseUrl}/api/admin/contact`, { headers: adminHeaders })).json();
    assert(typeof finalAdminCheck.data.phone.number === 'string', 'Final phone is valid string');
    assert(typeof finalAdminCheck.data.email.address === 'string', 'Final email is valid string');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`🎉 ALL CONTACT MODULE TESTS PASSED: ${passed}/${total}`);
    console.log('===============================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED UNEXPECTEDLY:', err);
  process.exit(1);
});
