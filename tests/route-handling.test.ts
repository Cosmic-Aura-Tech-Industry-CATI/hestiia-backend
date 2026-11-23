import http from 'http';
import { app } from '../src/app.js';

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
  console.log('🧪 RUNNING ROUTE ARCHITECTURE & ERROR HANDLING TEST SUITE');
  console.log('===============================================================\n');

  // Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Existing GET endpoint -> 200 Success
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Existing GET Endpoints ---');
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/v1/health returns HTTP 200 OK');
    assert(healthData.status === 'healthy', 'Health check body confirms healthy state');

    const menuRes = await fetch(`${baseUrl}/api/v1/customer/menu`);
    const menuData = await menuRes.json();
    assert(menuRes.status === 200, 'GET /api/v1/customer/menu returns HTTP 200 OK');
    assert(menuData.success === true && Array.isArray(menuData.dishes), 'Menu payload returns dishes array');

    const categoriesRes = await fetch(`${baseUrl}/api/categories`);
    assert(categoriesRes.status === 200, 'GET /api/categories (legacy namespace) returns HTTP 200 OK');

    // -------------------------------------------------------------------------
    // 2. Non-existent GET endpoint -> 404 Not Found (Never 200)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Non-Existent GET Endpoints ---');
    const invalidGet1 = await fetch(`${baseUrl}/api/does-not-exist`);
    const invalidGetData1 = await invalidGet1.json();
    assert(invalidGet1.status === 404, 'GET /api/does-not-exist returns 404 (NEVER 200)');
    assert(invalidGetData1.success === false, 'Error response has success: false');
    assert(invalidGetData1.statusCode === 404, 'Error response includes statusCode: 404');
    assert(typeof invalidGetData1.message === 'string', 'Error message is clear string');

    const invalidGet2 = await fetch(`${baseUrl}/api/v1/customer/unregistered-route`);
    const invalidGetData2 = await invalidGet2.json();
    assert(invalidGet2.status === 404, 'GET /api/v1/customer/unregistered-route returns 404');
    assert(invalidGetData2.statusCode === 404, 'Consistent statusCode 404 in body');

    const invalidRootGet = await fetch(`${baseUrl}/completely-unknown-page`);
    assert(invalidRootGet.status === 404, 'GET /completely-unknown-page returns 404 Not Found');

    // -------------------------------------------------------------------------
    // 3. Non-existent POST endpoint -> 404 Not Found (Never 200)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Non-Existent POST Endpoints ---');
    const invalidPost1 = await fetch(`${baseUrl}/api/v1/customer/invalid-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 123 }),
    });
    const invalidPostData1 = await invalidPost1.json();
    assert(invalidPost1.status === 404, 'POST /api/v1/customer/invalid-action returns 404');
    assert(invalidPostData1.statusCode === 404, 'POST error response has statusCode: 404');

    const invalidPost2 = await fetch(`${baseUrl}/api/unknown-module/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(invalidPost2.status === 404, 'POST /api/unknown-module/submit returns 404');

    // -------------------------------------------------------------------------
    // 4. Invalid Resource ID -> 400 or 404
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Invalid Resource ID Handling ---');
    const invalidDishRes = await fetch(`${baseUrl}/api/menu/dish-that-does-not-exist-99999`);
    const invalidDishData = await invalidDishRes.json();
    assert(invalidDishRes.status === 404, 'GET /api/menu/:id with invalid ID returns 404');
    assert(invalidDishData.success === false, 'Invalid dish returns success: false');
    assert(invalidDishData.message.includes('not found'), 'Clear resource not found error message');

    const invalidOrderRes = await fetch(`${baseUrl}/api/orders/HST-FAKE-ORDER-99999`);
    const invalidOrderData = await invalidOrderRes.json();
    assert(invalidOrderRes.status === 404, 'GET /api/orders/:id with non-existent order returns 404');
    assert(invalidOrderData.statusCode === 404, 'Order not found returns 404 statusCode');

    // -------------------------------------------------------------------------
    // 5. Unauthorized Requests -> 401 or 403
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Unauthorized Access Control ---');
    const unauthOrdersRes = await fetch(`${baseUrl}/api/v1/admin/orders`);
    const unauthOrdersData = await unauthOrdersRes.json();
    assert(unauthOrdersRes.status === 401, 'GET /api/v1/admin/orders without token returns 401 Unauthorized');
    assert(unauthOrdersData.success === false, 'Unauthorized response has success: false');
    assert(unauthOrdersData.statusCode === 401, 'Unauthorized response includes statusCode: 401');

    const unauthLegacyAdminRes = await fetch(`${baseUrl}/api/admin/dashboard/overview`);
    assert(unauthLegacyAdminRes.status === 401, 'GET /api/admin/dashboard/overview without token returns 401');

    const invalidTokenRes = await fetch(`${baseUrl}/api/v1/admin/orders`, {
      headers: { Authorization: 'Bearer this-is-an-invalid-jwt-token-string' },
    });
    const invalidTokenData = await invalidTokenRes.json();
    assert(invalidTokenRes.status === 401, 'Malformed JWT token returns 401 Unauthorized');
    assert(invalidTokenData.statusCode === 401, 'Malformed token returns statusCode: 401');

    // -------------------------------------------------------------------------
    // 6. Malformed JSON Body -> 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Malformed Request Body Handling ---');
    const malformedJsonRes = await fetch(`${baseUrl}/api/v1/customer/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"brokenJson": true,', // Invalid JSON
    });
    const malformedJsonData = await malformedJsonRes.json();
    assert(malformedJsonRes.status === 400, 'Malformed JSON payload returns 400 Bad Request');
    assert(malformedJsonData.statusCode === 400, 'Malformed JSON returns statusCode: 400');
    assert(malformedJsonData.message.includes('JSON'), 'Error identifies JSON syntax issue');

    // -------------------------------------------------------------------------
    // 7. Unsupported HTTP Methods on Registered Routes -> 404 / 405
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Unsupported HTTP Methods ---');
    const putHealthRes = await fetch(`${baseUrl}/api/health`, { method: 'PUT' });
    assert(putHealthRes.status === 404, 'PUT /api/health (unsupported verb) returns 404 Not Found (never 200)');

    const deleteMenuRes = await fetch(`${baseUrl}/api/v1/customer/menu`, { method: 'DELETE' });
    assert(deleteMenuRes.status === 404, 'DELETE /api/v1/customer/menu (unsupported verb) returns 404 Not Found');

    // -------------------------------------------------------------------------
    // 8. Internal Server Errors -> 500 (Never Converted to 200)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Server Error Normalization (Never 200) ---');
    // Simulate error handler directly to verify normalization
    const mockReq = { method: 'GET', originalUrl: '/api/test-crash' } as any;
    let sentStatus = 0;
    let sentJson: any = null;
    const mockRes = {
      headersSent: false,
      status(code: number) {
        sentStatus = code;
        return this;
      },
      json(data: any) {
        sentJson = data;
        return this;
      },
    } as any;

    const { errorHandler } = await import('../src/middleware/error.middleware.js');

    // 8a: Generic uncaught runtime exception
    errorHandler(new Error('Unexpected database socket disconnect'), mockReq, mockRes, (() => {}) as any);
    assert(sentStatus === 500, 'Uncaught runtime error results in HTTP 500 (NEVER 200)');
    assert(sentJson.success === false, 'Runtime error response has success: false');
    assert(sentJson.statusCode === 500, 'Runtime error response has statusCode: 500');

    // 8b: Error with invalid or falsy statusCode
    const corruptError: any = new Error('Corrupt error with status 200');
    corruptError.statusCode = 200; // Falsely claiming 200
    errorHandler(corruptError, mockReq, mockRes, (() => {}) as any);
    assert(sentStatus === 500, 'Error with corrupt statusCode: 200 is safely sanitized to HTTP 500');

    // 8c: Mongoose CastError (invalid ObjectId)
    const castError: any = new Error('Cast to ObjectId failed');
    castError.name = 'CastError';
    castError.path = 'dishId';
    castError.value = 'invalid-mongo-id-123';
    errorHandler(castError, mockReq, mockRes, (() => {}) as any);
    assert(sentStatus === 400, 'Mongoose CastError is normalized to HTTP 400 Bad Request');
    assert(sentJson.statusCode === 400, 'CastError returns statusCode: 400');

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
