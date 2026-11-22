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
  console.log('🧪 TESTING GUEST WISHLIST MODULE (ALL TEST CATEGORIES)');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Pick two valid dishes from the menu
    const dishes = db.getState().dishes || [];
    assert(dishes.length >= 2, 'Menu contains at least 2 dishes for testing');
    const dish1 = dishes[0];
    const dish2 = dishes[1];

    // -------------------------------------------------------------------------
    // TEST CATEGORY A — Guest Session & Cookie Tests
    // -------------------------------------------------------------------------
    console.log('--- CATEGORY A: Guest Session & Cookie Tests ---');

    // 1. First-time session initialization without cookie
    const initRes = await fetch(`${baseUrl}/api/v1/wishlist/session`);
    const initData = await initRes.json();
    const setCookieHeader = initRes.headers.get('set-cookie') || '';

    assert(initRes.status === 200, 'GET /session returns 200 OK');
    assert(initData.success === true, 'Session response confirms success');
    assert(typeof initData.guestId === 'string' && initData.guestId.startsWith('gst_'), 'Generates valid gst_ identifier');
    assert(setCookieHeader.includes('hestiia_guest_id='), 'Set-Cookie header sets hestiia_guest_id');
    assert(setCookieHeader.toLowerCase().includes('httponly'), 'Cookie is configured as HttpOnly');
    assert(setCookieHeader.includes('Path=/'), 'Cookie path is set to /');

    const guestIdA = initData.guestId;
    const guestCookieA = `hestiia_guest_id=${guestIdA}`;

    // 2. Cookie persistence & reuse
    const reuseRes = await fetch(`${baseUrl}/api/v1/wishlist/session`, {
      headers: { Cookie: guestCookieA },
    });
    const reuseData = await reuseRes.json();
    assert(reuseData.guestId === guestIdA, 'Existing guest ID reused from cookie');

    // 3. Invalid/tampered cookie handling (safely regenerates fresh ID)
    const tamperedRes = await fetch(`${baseUrl}/api/v1/wishlist/session`, {
      headers: { Cookie: 'hestiia_guest_id=hacked_arbitrary_string' },
    });
    const tamperedData = await tamperedRes.json();
    assert(tamperedData.guestId !== 'hacked_arbitrary_string', 'Tampered cookie rejected');
    assert(tamperedData.guestId.startsWith('gst_'), 'New secure guest ID issued for tampered request');

    // 4. Guest isolation: Second distinct guest receives different ID
    const guestBRes = await fetch(`${baseUrl}/api/v1/wishlist/session`);
    const guestBData = await guestBRes.json();
    const guestIdB = guestBData.guestId;
    const guestCookieB = `hestiia_guest_id=${guestIdB}`;
    assert(guestIdA !== guestIdB, 'Guest A and Guest B have distinct cryptographically secure IDs');

    // -------------------------------------------------------------------------
    // TEST CATEGORY B — POST Tests (Add Items & Duplicate Prevention)
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY B: POST Tests (Add Items & Validation) ---');

    // 1. Add valid menu item
    const addRes1 = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'POST',
      headers: { Cookie: guestCookieA },
    });
    const addData1 = await addRes1.json();
    assert(addRes1.status === 201, 'POST /items/:id for new item returns 201 Created');
    assert(addData1.success === true, 'Response confirms success: true');
    assert(addData1.alreadyExists === false, 'alreadyExists is false for initial addition');
    assert(addData1.item && addData1.item.menu_item_id === dish1.id, 'Response returns added item details');
    assert(addData1.item.name === dish1.name, 'Item name matches menu catalog');
    assert(addData1.item.price === dish1.price, 'Item price matches menu catalog');

    // 2. Add second menu item
    const addRes2 = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish2.id}`, {
      method: 'POST',
      headers: { Cookie: guestCookieA },
    });
    assert(addRes2.status === 201, 'Second distinct item added with 201 Created');

    // 3. Add same item twice (Duplicate Prevention)
    const addDupRes = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'POST',
      headers: { Cookie: guestCookieA },
    });
    const addDupData = await addDupRes.json();
    assert(addDupRes.status === 200, 'Duplicate item addition returns 200 OK (idempotent)');
    assert(addDupData.alreadyExists === true, 'alreadyExists flag is true on duplicate');

    // 4. Add non-existent menu item
    const addInvalidRes = await fetch(`${baseUrl}/api/v1/wishlist/items/non-existent-dish-99999`, {
      method: 'POST',
      headers: { Cookie: guestCookieA },
    });
    assert(addInvalidRes.status === 404, 'Adding non-existent food item returns 404 Not Found');

    // -------------------------------------------------------------------------
    // TEST CATEGORY C — GET Tests (Retrieve & Populate Wishlist)
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY C: GET Tests (Retrieval & Population) ---');

    // 1. Retrieve Guest A wishlist
    const getWishlistRes = await fetch(`${baseUrl}/api/v1/wishlist`, {
      headers: { Cookie: guestCookieA },
    });
    const getWishlistData = await getWishlistRes.json();
    assert(getWishlistRes.status === 200, 'GET /api/v1/wishlist returns 200 OK');
    assert(getWishlistData.totalItems === 2, 'Guest A wishlist contains exactly 2 items');
    assert(Array.isArray(getWishlistData.items), 'items is an array');

    // Verify current menu fields are properly populated
    const firstItem = getWishlistData.items.find((i: any) => i.menu_item_id === dish1.id);
    assert(Boolean(firstItem), 'Dish 1 found in populated wishlist');
    assert(firstItem.name === dish1.name, 'Live dish name populated');
    assert(firstItem.price === dish1.price, 'Live dish price populated');
    assert(typeof firstItem.available === 'boolean', 'Live availability status included');
    assert(Boolean(firstItem.added_at), 'Item addition timestamp present');

    // 2. Guest isolation on GET: Guest B wishlist must be completely empty
    const getWishlistBRes = await fetch(`${baseUrl}/api/v1/wishlist`, {
      headers: { Cookie: guestCookieB },
    });
    const getWishlistBData = await getWishlistBRes.json();
    assert(getWishlistBData.totalItems === 0, 'Guest B wishlist is isolated and empty (0 items)');

    // 3. Check specific item status (Heart icon state)
    const statusDish1Res = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}/status`, {
      headers: { Cookie: guestCookieA },
    });
    const statusDish1Data = await statusDish1Res.json();
    assert(statusDish1Data.isWishlisted === true, 'Dish 1 status isWishlisted === true for Guest A');

    const statusDishBRes = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}/status`, {
      headers: { Cookie: guestCookieB },
    });
    const statusDishBData = await statusDishBRes.json();
    assert(statusDishBData.isWishlisted === false, 'Dish 1 status isWishlisted === false for Guest B');

    // 4. Test customer namespace alias
    const customerAliasRes = await fetch(`${baseUrl}/api/v1/customer/wishlist`, {
      headers: { Cookie: guestCookieA },
    });
    assert(customerAliasRes.status === 200, 'GET /api/v1/customer/wishlist alias returns 200 OK');

    // -------------------------------------------------------------------------
    // TEST CATEGORY D — DELETE Tests (Remove Item & Clear Wishlist)
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY D: DELETE Tests ---');

    // 1. Remove single existing item
    const removeRes = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'DELETE',
      headers: { Cookie: guestCookieA },
    });
    const removeData = await removeRes.json();
    assert(removeRes.status === 200, 'DELETE /items/:id returns 200 OK');
    assert(removeData.success === true, 'Response confirms removal success');

    // Verify item count decreased to 1
    const checkAfterRemove = await fetch(`${baseUrl}/api/v1/wishlist`, {
      headers: { Cookie: guestCookieA },
    });
    const checkAfterRemoveData = await checkAfterRemove.json();
    assert(checkAfterRemoveData.totalItems === 1, 'Wishlist count accurately reduced to 1');
    assert(!checkAfterRemoveData.items.some((i: any) => i.menu_item_id === dish1.id), 'Dish 1 no longer in wishlist');

    // 2. Remove an item that is not in the wishlist
    const removeNonExistent = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'DELETE',
      headers: { Cookie: guestCookieA },
    });
    assert(removeNonExistent.status === 404, 'Deleting item not in wishlist returns 404 Not Found');

    // 3. Clear the complete wishlist
    const clearRes = await fetch(`${baseUrl}/api/v1/wishlist`, {
      method: 'DELETE',
      headers: { Cookie: guestCookieA },
    });
    const clearData = await clearRes.json();
    assert(clearRes.status === 200, 'DELETE /api/v1/wishlist returns 200 OK');
    assert(clearData.totalItems === 0, 'Clear response reports totalItems === 0');

    // 4. Verify wishlist is empty
    const checkAfterClear = await fetch(`${baseUrl}/api/v1/wishlist`, {
      headers: { Cookie: guestCookieA },
    });
    const checkAfterClearData = await checkAfterClear.json();
    assert(checkAfterClearData.totalItems === 0, 'Wishlist is now completely empty');

    // -------------------------------------------------------------------------
    // TEST CATEGORY E — PUT and PATCH Tests (Method Rejection)
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY E: Unsupported HTTP Methods Rejection ---');

    const putRes = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'PUT',
      headers: { Cookie: guestCookieA },
      body: JSON.stringify({ fake: 'data' }),
    });
    assert(putRes.status === 405, 'PUT /items/:id returns 405 Method Not Allowed (never 200)');

    const patchRes = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish1.id}`, {
      method: 'PATCH',
      headers: { Cookie: guestCookieA },
      body: JSON.stringify({ fake: 'data' }),
    });
    assert(patchRes.status === 405, 'PATCH /items/:id returns 405 Method Not Allowed');

    const putRootRes = await fetch(`${baseUrl}/api/v1/wishlist`, {
      method: 'PUT',
      headers: { Cookie: guestCookieA },
    });
    assert(putRootRes.status === 405, 'PUT /api/v1/wishlist returns 405 Method Not Allowed');

    // -------------------------------------------------------------------------
    // TEST CATEGORY F & G — Security & Concurrency Tests
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY F & G: Security & Concurrency Tests ---');

    // 1. Concurrent additions of the same item (Race Condition Protection)
    const concurrentPromises = Array.from({ length: 5 }).map(() =>
      fetch(`${baseUrl}/api/v1/wishlist/items/${dish2.id}`, {
        method: 'POST',
        headers: { Cookie: guestCookieB },
      })
    );
    const concurrentResponses = await Promise.all(concurrentPromises);
    const statuses = concurrentResponses.map((r) => r.status);
    assert(statuses.every((s) => s === 200 || s === 201), 'All concurrent requests handled cleanly');

    // Verify Guest B still has exactly 1 entry for dish2
    const verifyConcurrent = await fetch(`${baseUrl}/api/v1/wishlist`, {
      headers: { Cookie: guestCookieB },
    });
    const verifyConcurData = await verifyConcurrent.json();
    assert(verifyConcurData.totalItems === 1, 'Race condition prevented: exactly 1 item saved despite 5 concurrent requests');

    // 2. Guest cross-access prevention: Guest A cannot delete Guest B's item
    const guestACrossDelete = await fetch(`${baseUrl}/api/v1/wishlist/items/${dish2.id}`, {
      method: 'DELETE',
      headers: { Cookie: guestCookieA }, // Guest A does not have dish2
    });
    assert(guestACrossDelete.status === 404, 'Guest A cannot delete Guest B item (returns 404)');

    // Clean up Guest B test records
    await fetch(`${baseUrl}/api/v1/wishlist`, {
      method: 'DELETE',
      headers: { Cookie: guestCookieB },
    });

    console.log('\n===============================================================');
    console.log(`🎉 ALL GUEST WISHLIST TESTS PASSED: ${passed}/${total}`);
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE RUNNER ABORTED:', err);
  process.exit(1);
});
