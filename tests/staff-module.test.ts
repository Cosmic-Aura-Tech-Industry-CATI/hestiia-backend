import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { db } from '../src/shared/config/db.js';
import { JWT_ACCESS_SECRET } from '../src/shared/config/utils.js';

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
  console.log('🧪 TESTING COMPLETE STAFF & ROLES MODULE');
  console.log('===============================================================\n');

  // Reset staff table in db.json for deterministic testing
  db.updateState((s: any) => {
    s.staff = [];
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Admin Authentication
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Admin Authentication ---');
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

    // Generate a simulated customer token to test 403 authorization guard
    const customerToken = jwt.sign(
      { id: 'cust_test_1', role: 'customer', email: 'cust@hestiia.com' },
      JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // -------------------------------------------------------------------------
    // TEST 2: Security & Authorization Guards
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Security & Authorization Guards ---');
    // Unauthenticated requests -> 401
    const unauthGet = await fetch(`${baseUrl}/api/admin/staff`);
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/admin/staff returns 401');

    const unauthPost = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: '9876543210', email: 'test@gmail.com' }),
    });
    assert(unauthPost.status === 401, 'Unauthenticated POST /api/admin/staff returns 401');

    const unauthGetId = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439011`);
    assert(unauthGetId.status === 401, 'Unauthenticated GET /api/admin/staff/:id returns 401');

    const unauthPut = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439011`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Update' }),
    });
    assert(unauthPut.status === 401, 'Unauthenticated PUT /api/admin/staff/:id returns 401');

    const unauthDelete = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439011`, {
      method: 'DELETE',
    });
    assert(unauthDelete.status === 401, 'Unauthenticated DELETE /api/admin/staff/:id returns 401');

    // Customer / non-admin token -> 403 Forbidden
    const customerGet = await fetch(`${baseUrl}/api/admin/staff`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerGet.status === 403, 'Customer token GET /api/admin/staff returns 403 Forbidden');

    const customerPost = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ name: 'Test', phone: '9876543210', email: 'test@gmail.com' }),
    });
    assert(customerPost.status === 403, 'Customer token POST /api/admin/staff returns 403 Forbidden');

    // -------------------------------------------------------------------------
    // TEST 3: Service 1 - Create Staff
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Service 1 - Create Staff ---');
    // Valid creation
    const createRes1 = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Rahul Sharma',
        phone: '9876543210',
        email: 'rahul@gmail.com',
      }),
    });
    const createData1 = await createRes1.json();
    assert(createRes1.status === 201, 'Create staff returns 201 Created');
    assert(createData1.success === true, 'Response contains success: true');
    assert(createData1.data.name === 'Rahul Sharma', 'Staff name matches input');
    assert(createData1.data.phone === '9876543210', 'Staff phone matches input');
    assert(createData1.data.email === 'rahul@gmail.com', 'Staff email matches input');
    assert(createData1.data.role === 'staff', 'Staff role is strictly "staff"');
    assert(createData1.data.isActive === true, 'Staff isActive is true by default');
    assert(typeof createData1.data._id === 'string' && createData1.data._id.length === 24, 'Valid 24-character ObjectId generated');
    const staff1Id = createData1.data._id;

    // Normalization check: Uppercase email and +91 formatted phone
    const createRes2 = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Priya Verma',
        phone: '+91 9876543211',
        email: '  PRIYA.VERMA@GMAIL.COM  ',
      }),
    });
    const createData2 = await createRes2.json();
    assert(createRes2.status === 201, 'Create staff with +91 phone and uppercase email returns 201');
    assert(createData2.data.email === 'priya.verma@gmail.com', 'Email normalized to lowercase and trimmed');
    assert(createData2.data.phone === '9876543211', 'Phone normalized to 10 digits without prefix');
    const staff2Id = createData2.data._id;

    // Validation Failures
    // Empty body
    const emptyBodyRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(emptyBodyRes.status === 400, 'Empty request body returns 400 Bad Request');

    // Missing name
    const missingNameRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ phone: '9876543212', email: 'test1@gmail.com' }),
    });
    assert(missingNameRes.status === 400, 'Missing name returns 400 Bad Request');

    // Numbers-only name
    const numNameRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: '123456', phone: '9876543212', email: 'test1@gmail.com' }),
    });
    assert(numNameRes.status === 400, 'Numbers-only name returns 400 Bad Request');

    // Missing phone
    const missingPhoneRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Test User', email: 'test1@gmail.com' }),
    });
    assert(missingPhoneRes.status === 400, 'Missing phone returns 400 Bad Request');

    // Invalid phone digits (<10 digits)
    const shortPhoneRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Test User', phone: '98765', email: 'test1@gmail.com' }),
    });
    assert(shortPhoneRes.status === 400, 'Phone with <10 digits returns 400 Bad Request');

    // Phone starting with invalid digit (e.g. 1)
    const invalidPrefixPhoneRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Test User', phone: '1234567890', email: 'test1@gmail.com' }),
    });
    assert(invalidPrefixPhoneRes.status === 400, 'Phone starting with invalid digit returns 400 Bad Request');

    // Missing email
    const missingEmailRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Test User', phone: '9876543212' }),
    });
    assert(missingEmailRes.status === 400, 'Missing email returns 400 Bad Request');

    // Invalid email format
    const invalidEmailRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Test User', phone: '9876543212', email: 'notanemail' }),
    });
    assert(invalidEmailRes.status === 400, 'Invalid email format returns 400 Bad Request');

    // Duplicate email check (case-insensitive)
    const dupEmailRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Another Rahul', phone: '9876543299', email: 'RAHUL@GMAIL.COM' }),
    });
    assert(dupEmailRes.status === 409, 'Duplicate email returns 409 Conflict');

    // Duplicate phone check
    const dupPhoneRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Another Rahul', phone: '9876543210', email: 'unique@gmail.com' }),
    });
    assert(dupPhoneRes.status === 409, 'Duplicate phone returns 409 Conflict');

    // Attempt to pass unauthorized role (manager/admin/kitchen)
    const unauthorizedRoleRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Chef Vikas', phone: '9876543212', email: 'vikas@gmail.com', role: 'kitchen' }),
    });
    assert(unauthorizedRoleRes.status === 400, 'Submitting non-staff role returns 400 Bad Request');

    // Attempt to pass unexpected fields
    const unexpectedFieldsRes = await fetch(`${baseUrl}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Amit Singh', phone: '9876543212', email: 'amit@gmail.com', salary: 50000 }),
    });
    assert(unexpectedFieldsRes.status === 400, 'Submitting unexpected fields returns 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 4: Service 2 - Get All Staff
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Service 2 - Get All Staff ---');
    // Fetch all active staff
    const getAllRes = await fetch(`${baseUrl}/api/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getAllData = await getAllRes.json();
    assert(getAllRes.status === 200, 'Get all staff returns 200 OK');
    assert(Array.isArray(getAllData.data.staff), 'data.staff is an array');
    assert(getAllData.data.staff.length >= 2, 'Returns at least 2 created staff members');
    assert(getAllData.data.pagination.total >= 2, 'Pagination metadata total is correct');

    // Pagination query
    const pageRes = await fetch(`${baseUrl}/api/admin/staff?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pageData = await pageRes.json();
    assert(pageRes.status === 200, 'Get paginated staff returns 200 OK');
    assert(pageData.data.staff.length === 1, 'Limit=1 returns exactly 1 item');
    assert(pageData.data.pagination.limit === 1, 'Pagination limit is 1');
    assert(pageData.data.pagination.totalPages >= 2, 'Pagination totalPages >= 2');

    // Search by name
    const searchNameRes = await fetch(`${baseUrl}/api/admin/staff?search=Rahul`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchNameData = await searchNameRes.json();
    assert(searchNameRes.status === 200, 'Search by name returns 200 OK');
    assert(searchNameData.data.staff.some((s: any) => s.name === 'Rahul Sharma'), 'Finds Rahul Sharma');

    // Search by phone
    const searchPhoneRes = await fetch(`${baseUrl}/api/admin/staff?search=9876543210`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchPhoneData = await searchPhoneRes.json();
    assert(searchPhoneRes.status === 200, 'Search by phone returns 200 OK');
    assert(searchPhoneData.data.staff.some((s: any) => s.phone === '9876543210'), 'Finds matching phone');

    // Search by email
    const searchEmailRes = await fetch(`${baseUrl}/api/admin/staff?search=priya.verma`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchEmailData = await searchEmailRes.json();
    assert(searchEmailRes.status === 200, 'Search by email returns 200 OK');
    assert(searchEmailData.data.staff.some((s: any) => s.email === 'priya.verma@gmail.com'), 'Finds matching email');

    // Status filter
    const statusFilterRes = await fetch(`${baseUrl}/api/admin/staff?status=active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statusFilterData = await statusFilterRes.json();
    assert(statusFilterRes.status === 200, 'Filter status=active returns 200 OK');
    assert(statusFilterData.data.staff.every((s: any) => s.isActive === true), 'All returned staff are active');

    // Sorting
    const sortRes = await fetch(`${baseUrl}/api/admin/staff?sortBy=name&order=asc`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sortData = await sortRes.json();
    assert(sortRes.status === 200, 'Sort by name asc returns 200 OK');

    // Invalid query parameters
    const invalidStatusRes = await fetch(`${baseUrl}/api/admin/staff?status=invalid_status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(invalidStatusRes.status === 400, 'Invalid status filter returns 400 Bad Request');

    const invalidPageRes = await fetch(`${baseUrl}/api/admin/staff?page=0`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(invalidPageRes.status === 400, 'Invalid page=0 returns 400 Bad Request');

    const invalidSortRes = await fetch(`${baseUrl}/api/admin/staff?sortBy=hackField`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(invalidSortRes.status === 400, 'Invalid sortBy field returns 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 5: Service 3 - Get Staff by ID
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Service 3 - Get Staff by ID ---');
    // Valid ID
    const getByIdRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getByIdData = await getByIdRes.json();
    assert(getByIdRes.status === 200, 'Get staff by ID returns 200 OK');
    assert(getByIdData.data._id === staff1Id, 'Returned staff ID matches requested ID');
    assert(getByIdData.data.name === 'Rahul Sharma', 'Returned staff name matches');

    // Malformed ID
    const malformedIdRes = await fetch(`${baseUrl}/api/admin/staff/not-a-valid-id`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(malformedIdRes.status === 400, 'Malformed ObjectId returns 400 Bad Request');

    // Nonexistent ID (valid 24-hex string)
    const nonexistentIdRes = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439099`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonexistentIdRes.status === 404, 'Nonexistent staff ID returns 404 Not Found');

    // -------------------------------------------------------------------------
    // TEST 6: Service 4 - Update Staff
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Service 4 - Update Staff ---');
    // Valid update
    const updateRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Rahul Kumar Sharma',
        phone: '9876543299',
        email: 'rahul.kumar@gmail.com',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'Update staff returns 200 OK');
    assert(updateData.data.name === 'Rahul Kumar Sharma', 'Name updated successfully');
    assert(updateData.data.phone === '9876543299', 'Phone updated successfully');
    assert(updateData.data.email === 'rahul.kumar@gmail.com', 'Email updated successfully');
    assert(updateData.data.role === 'staff', 'Role remains strictly staff');

    // Attempt role escalation
    const escalateRoleRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'manager' }),
    });
    assert(escalateRoleRes.status === 400, 'Attempting role change to manager returns 400 Bad Request');

    // Attempt modifying isActive via PUT
    const modifyActiveRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(modifyActiveRes.status === 400, 'Attempting direct isActive modification returns 400 Bad Request');

    // Attempt modifying _id
    const modifyIdRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ _id: '507f1f77bcf86cd799439088' }),
    });
    assert(modifyIdRes.status === 400, 'Attempting ID modification returns 400 Bad Request');

    // Duplicate email conflict with another staff member
    const dupEmailUpdateRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: 'priya.verma@gmail.com' }), // Belongs to staff2
    });
    assert(dupEmailUpdateRes.status === 409, 'Updating to existing staff email returns 409 Conflict');

    // Duplicate phone conflict with another staff member
    const dupPhoneUpdateRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ phone: '9876543211' }), // Belongs to staff2
    });
    assert(dupPhoneUpdateRes.status === 409, 'Updating to existing staff phone returns 409 Conflict');

    // Invalid phone format in update
    const invalidPhoneUpdateRes = await fetch(`${baseUrl}/api/admin/staff/${staff1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ phone: '123' }),
    });
    assert(invalidPhoneUpdateRes.status === 400, 'Invalid phone format in update returns 400 Bad Request');

    // Update nonexistent staff ID
    const updateNonexistentRes = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439099`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Nobody' }),
    });
    assert(updateNonexistentRes.status === 404, 'Updating nonexistent staff returns 404 Not Found');

    // -------------------------------------------------------------------------
    // TEST 7: Service 5 - Soft Delete (Deactivate) Staff
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Service 5 - Soft Delete (Deactivate) Staff ---');
    // Soft delete existing employee
    const deleteRes = await fetch(`${baseUrl}/api/admin/staff/${staff2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200, 'Delete staff returns 200 OK');
    assert(deleteData.success === true, 'Response contains success: true');
    assert(deleteData.message.includes('deactivated'), 'Message indicates staff deactivated');

    // Verify deactivated staff no longer in default active list
    const activeListAfterDelete = await fetch(`${baseUrl}/api/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const activeListData = await activeListAfterDelete.json();
    assert(!activeListData.data.staff.some((s: any) => s._id === staff2Id), 'Deactivated staff absent from active list');

    // Verify deactivated staff appears in inactive listing
    const inactiveListRes = await fetch(`${baseUrl}/api/admin/staff?status=inactive`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inactiveListData = await inactiveListRes.json();
    assert(inactiveListData.data.staff.some((s: any) => s._id === staff2Id), 'Deactivated staff present in inactive list');

    // Verify historical record still preserved when retrieved by ID
    const getDeletedById = await fetch(`${baseUrl}/api/admin/staff/${staff2Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deletedByIdData = await getDeletedById.json();
    assert(getDeletedById.status === 200, 'Deactivated staff record still retrievable by ID for history');
    assert(deletedByIdData.data.isActive === false, 'Deactivated staff has isActive: false');

    // Repeated delete on already inactive employee -> 400 Bad Request
    const repeatDeleteRes = await fetch(`${baseUrl}/api/admin/staff/${staff2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(repeatDeleteRes.status === 400, 'Repeated delete on already inactive staff returns 400 Bad Request');

    // Delete nonexistent staff -> 404
    const deleteNonexistentRes = await fetch(`${baseUrl}/api/admin/staff/507f1f77bcf86cd799439099`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteNonexistentRes.status === 404, 'Deleting nonexistent staff returns 404 Not Found');

    // Delete with invalid ObjectId -> 400
    const deleteMalformedRes = await fetch(`${baseUrl}/api/admin/staff/bad-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteMalformedRes.status === 400, 'Deleting with malformed ID returns 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 8: Canonical Routing & Alternate Route Aliases
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Canonical Routing Variations ---');
    const aliases = [
      '/api/admin/staff',
      '/api/v1/admin/staff',
      '/api/staff',
      '/api/v1/staff',
    ];
    for (const alias of aliases) {
      const aliasRes = await fetch(`${baseUrl}${alias}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(aliasRes.status === 200, `Endpoint alias ${alias} returns 200 OK without 404`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Concurrency & Worst-Case Edge Cases
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Concurrency & Worst-Case Edge Cases ---');
    // Two simultaneous requests creating employee with same email
    const concurrentEmail = 'concurrent.test@gmail.com';
    const [c1, c2] = await Promise.all([
      fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: 'Concurrent 1', phone: '9876543301', email: concurrentEmail }),
      }),
      fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: 'Concurrent 2', phone: '9876543302', email: concurrentEmail }),
      }),
    ]);
    const statuses = [c1.status, c2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      'Concurrent duplicate creation safely allows exactly one 201 and rejects other with 409'
    );

    console.log(`\n===============================================================`);
    console.log(`🎉 ALL STAFF MODULE TESTS PASSED: ${passed}/${total}`);
    console.log(`===============================================================\n`);
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
