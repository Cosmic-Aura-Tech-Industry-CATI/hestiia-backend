import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { db } from '../src/shared/config/db.js';
import { JWT_ACCESS_SECRET } from '../src/shared/config/utils.js';
import { eventBus, DOMAIN_EVENTS } from '../src/events/eventBus.js';
import { offersService } from '../src/modules/offers/services/offers.service.js';

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
  console.log('🧪 TESTING COMPLETE OFFERS MODULE (PRODUCTION BACKEND SUITE)');
  console.log('===============================================================\n');

  // Reset offers, carts, and redemptions in store for deterministic testing
  db.updateState((s: any) => {
    s.offers = [];
    s.offerRedemptions = [];
    s.carts = [];
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Admin Authentication & RBAC Authorization Guards
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

    // Customer JWT token
    const customerToken = jwt.sign(
      { id: 'cust_offers_1', role: 'customer', email: 'cust@hestiia.com' },
      JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
    const customerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    };

    // Unauthenticated calls must return 401
    const unauthGet = await fetch(`${baseUrl}/api/admin/offers`);
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/admin/offers returns 401');

    const unauthPost = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Offer' }),
    });
    assert(unauthPost.status === 401, 'Unauthenticated POST /api/admin/offers returns 401');

    const unauthSummary = await fetch(`${baseUrl}/api/admin/offers/summary`);
    assert(unauthSummary.status === 401, 'Unauthenticated GET /api/admin/offers/summary returns 401');

    // Customer token calls must return 403 Forbidden on admin routes
    const custOnAdmin = await fetch(`${baseUrl}/api/admin/offers`, { headers: customerHeaders });
    assert(custOnAdmin.status === 403, 'Customer token on GET /api/admin/offers returns 403 Forbidden');

    const custOnAdminPost = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ title: 'Hack' }),
    });
    assert(custOnAdminPost.status === 403, 'Customer token on POST /api/admin/offers returns 403 Forbidden');

    // -------------------------------------------------------------------------
    // SECTION 2: Admin Offer Creation & Validations (Service 1)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Admin Offer Creation & Validations ---');
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Negative validation 1: Missing title
    const invalidTitle = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        description: 'Test description',
        discountType: 'fixed',
        discountValue: 100,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
      }),
    });
    assert(invalidTitle.status === 400, 'POST offer without title returns 400 Bad Request');

    // Negative validation 2: Invalid discountType
    const invalidType = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Invalid Type',
        description: 'Test description',
        discountType: 'bogo',
        discountValue: 50,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
      }),
    });
    assert(invalidType.status === 400, 'POST offer with invalid discountType returns 400');

    // Negative validation 3: Percentage > 100
    const invalidPercent = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Over 100 Percent',
        description: 'Test description',
        discountType: 'percentage',
        discountValue: 120,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
      }),
    });
    assert(invalidPercent.status === 400, 'POST offer with percentage > 100 returns 400');

    // Negative validation 4: Negative discountValue
    const negValue = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Negative Discount',
        description: 'Test description',
        discountType: 'fixed',
        discountValue: -50,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
      }),
    });
    assert(negValue.status === 400, 'POST offer with negative discountValue returns 400');

    // Negative validation 5: endDate before startDate
    const invalidDates = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Time Traveler Offer',
        description: 'Test description',
        discountType: 'fixed',
        discountValue: 50,
        startDate: futureDate.toISOString(),
        endDate: now.toISOString(),
      }),
    });
    assert(invalidDates.status === 400, 'POST offer with endDate <= startDate returns 400');

    // Negative validation 6: Invalid placement
    const invalidPlacement = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Bad Placement',
        description: 'Test description',
        discountType: 'fixed',
        discountValue: 50,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
        placements: ['billboard'],
      }),
    });
    assert(invalidPlacement.status === 400, 'POST offer with invalid placement returns 400');

    // Positive Offer 1: Fixed Discount Offer (₹100 off on ₹400 min order)
    const createFixedRes = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Flat ₹100 Off Festive Treat',
        description: 'Enjoy ₹100 off on orders above ₹400',
        discountType: 'fixed',
        discountValue: 100,
        minOrderValue: 400,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
        placements: ['home', 'menu'],
        displayPriority: 10,
      }),
    });
    const fixedData = await createFixedRes.json();
    assert(createFixedRes.status === 201, 'Create fixed offer returns 201 Created');
    assert(fixedData.success === true, 'Response confirms success');
    assert(typeof fixedData.data._id === 'string', 'Offer has valid _id string');
    assert(fixedData.data.discountType === 'fixed' && fixedData.data.discountValue === 100, 'Fixed offer fields recorded correctly');
    const fixedOfferId = fixedData.data._id;

    // Positive Offer 2: Percentage Discount Offer (20% off up to ₹150 on ₹500 min order)
    const createPercentRes = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: '20% Chef Special Discount',
        description: 'Get 20% off up to ₹150 on orders above ₹500',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscount: 150,
        minOrderValue: 500,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
        placements: ['home'],
        displayPriority: 5,
      }),
    });
    const percentData = await createPercentRes.json();
    assert(createPercentRes.status === 201, 'Create percentage offer returns 201 Created');
    assert(percentData.data.maxDiscount === 150, 'Max discount cap recorded');
    const percentOfferId = percentData.data._id;

    // Positive Offer 3: Expired Offer for filter & validation tests
    const createExpiredRes = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Old Expired Offer',
        description: 'Past promo',
        discountType: 'fixed',
        discountValue: 50,
        minOrderValue: 200,
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: pastDate.toISOString(),
        placements: ['menu'],
      }),
    });
    const expiredData = await createExpiredRes.json();
    assert(createExpiredRes.status === 201, 'Create expired offer returns 201 Created');
    const expiredOfferId = expiredData.data._id;

    // -------------------------------------------------------------------------
    // SECTION 3: Admin Listing, Search & Filters (Service 2)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Admin Listing & Filtering ---');
    const listRes = await fetch(`${baseUrl}/api/admin/offers`, { headers: adminHeaders });
    const listData = await listRes.json();
    const offersList = listData.data.offers || listData.data;
    assert(listRes.status === 200, 'GET /api/admin/offers returns 200 OK');
    assert(Array.isArray(offersList), 'Returns array of offers');
    assert(offersList.length >= 3, 'Contains at least 3 created offers');
    assert(typeof (listData.data.total || listData.meta?.total) === 'number', 'Includes pagination metadata');

    // Filter by search
    const searchRes = await fetch(`${baseUrl}/api/admin/offers?search=Festive`, { headers: adminHeaders });
    const searchData = await searchRes.json();
    const searchList = searchData.data.offers || searchData.data;
    assert(searchRes.status === 200, 'Search filter returns 200');
    assert(searchList.some((o: any) => o.title.includes('Festive')), 'Search returns matching title');

    // Filter by placement
    const placementRes = await fetch(`${baseUrl}/api/admin/offers?placement=home`, { headers: adminHeaders });
    const placementData = await placementRes.json();
    const placementList = placementData.data.offers || placementData.data;
    assert(placementList.every((o: any) => o.placements.includes('home')), 'All returned offers have "home" placement');

    // Filter by discountType
    const typeRes = await fetch(`${baseUrl}/api/admin/offers?discountType=percentage`, { headers: adminHeaders });
    const typeData = await typeRes.json();
    const typeList = typeData.data.offers || typeData.data;
    assert(typeList.every((o: any) => o.discountType === 'percentage'), 'All returned offers are percentage discount');

    // Filter by status: active vs expired
    const activeFilterRes = await fetch(`${baseUrl}/api/admin/offers?status=active`, { headers: adminHeaders });
    const activeFilterData = await activeFilterRes.json();
    const activeList = activeFilterData.data.offers || activeFilterData.data;
    assert(activeList.every((o: any) => o.isActive && new Date(o.endDate) > now), 'status=active filter returns only non-expired active offers');

    const expiredFilterRes = await fetch(`${baseUrl}/api/admin/offers?status=expired`, { headers: adminHeaders });
    const expiredFilterData = await expiredFilterRes.json();
    const expiredList = expiredFilterData.data.offers || expiredFilterData.data;
    assert(expiredList.some((o: any) => o._id === expiredOfferId), 'status=expired filter includes expired offer');

    // -------------------------------------------------------------------------
    // SECTION 4: Single Offer Operations (Services 3, 4, 5, 6)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Single Offer Operations (Get, Update, Status, Archive) ---');
    // Service 3: Get single offer
    const getSingleRes = await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}`, { headers: adminHeaders });
    const getSingleData = await getSingleRes.json();
    assert(getSingleRes.status === 200, 'GET /api/admin/offers/:id returns 200 OK');
    assert(getSingleData.data._id === fixedOfferId, 'Fetched offer ID matches');

    // Malformed ObjectId check
    const badIdRes = await fetch(`${baseUrl}/api/admin/offers/not-a-valid-id`, { headers: adminHeaders });
    assert(badIdRes.status === 400, 'Malformed offer ID returns 400 Bad Request');

    // Nonexistent ObjectId check
    const notFoundRes = await fetch(`${baseUrl}/api/admin/offers/507f1f77bcf86cd799439011`, { headers: adminHeaders });
    assert(notFoundRes.status === 404, 'Nonexistent offer ID returns 404 Not Found');

    // Service 4: Update offer
    const updateRes = await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Flat ₹120 Off Super Festive Deal',
        discountValue: 120,
        minOrderValue: 450,
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'PUT /api/admin/offers/:id returns 200 OK');
    assert(updateData.data.title === 'Flat ₹120 Off Super Festive Deal', 'Title updated');
    assert(updateData.data.discountValue === 120, 'Discount value updated');
    assert(updateData.data.minOrderValue === 450, 'Min order value updated');

    // Service 5: Activate / Deactivate Toggle
    const deactivateRes = await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    const deactivateData = await deactivateRes.json();
    assert(deactivateRes.status === 200, 'PATCH /status deactivate returns 200 OK');
    assert(deactivateData.data.isActive === false, 'Offer status set to false');

    const reactivateRes = await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isActive: true }),
    });
    const reactivateData = await reactivateRes.json();
    assert(reactivateRes.status === 200, 'PATCH /status reactivate returns 200 OK');
    assert(reactivateData.data.isActive === true, 'Offer status set back to true');

    // Service 6: Archive offer (Soft delete)
    const toArchiveRes = await fetch(`${baseUrl}/api/admin/offers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Offer To Archive',
        description: 'Temporary offer destined for archival',
        discountType: 'fixed',
        discountValue: 20,
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
      }),
    });
    const toArchiveData = await toArchiveRes.json();
    const archiveId = toArchiveData.data._id;

    const archiveRes = await fetch(`${baseUrl}/api/admin/offers/${archiveId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(archiveRes.status === 200, 'DELETE /api/admin/offers/:id returns 200 OK');

    const checkArchived = await fetch(`${baseUrl}/api/admin/offers/${archiveId}`, { headers: adminHeaders });
    const checkArchivedData = await checkArchived.json();
    assert(checkArchivedData.data.isArchived === true, 'Offer marked isArchived: true');
    assert(checkArchivedData.data.isActive === false, 'Archived offer has isActive: false');

    // -------------------------------------------------------------------------
    // SECTION 5: Admin Analytics & Summary (Services 7, 8)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Admin Analytics & Dashboard Summary ---');
    // Service 7: Single offer analytics
    const analyticsRes = await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}/analytics`, { headers: adminHeaders });
    const analyticsData = await analyticsRes.json();
    assert(analyticsRes.status === 200, 'GET /api/admin/offers/:id/analytics returns 200 OK');
    assert(typeof analyticsData.data.totalRedemptions === 'number', 'Contains totalRedemptions number');
    assert(typeof analyticsData.data.totalDiscountProvided === 'number', 'Contains totalDiscountProvided number');
    assert(analyticsData.data.status === 'active', 'Analytics reports correct status');

    // Service 8: Dashboard summary
    const summaryRes = await fetch(`${baseUrl}/api/admin/offers/summary`, { headers: adminHeaders });
    const summaryData = await summaryRes.json();
    assert(summaryRes.status === 200, 'GET /api/admin/offers/summary returns 200 OK');
    assert(summaryData.data.totalOffers >= 4, 'Summary counts total offers');
    assert(summaryData.data.activeOffers >= 2, 'Summary counts active offers');
    assert(summaryData.data.archivedOffers >= 1, 'Summary counts archived offers');

    // -------------------------------------------------------------------------
    // SECTION 6: Customer Public Offer Discovery (Services 1, 2, 3, 4)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Customer Public Offer Discovery ---');
    // Customer Service 1: Current valid offers
    const custOffersRes = await fetch(`${baseUrl}/api/customer/offers`);
    const custOffersData = await custOffersRes.json();
    assert(custOffersRes.status === 200, 'GET /api/customer/offers returns 200 OK');
    assert(Array.isArray(custOffersData.data), 'Customer offers is an array');
    assert(!custOffersData.data.some((o: any) => o._id === archiveId), 'Archived offers excluded from customer discovery');
    assert(!custOffersData.data.some((o: any) => o._id === expiredOfferId), 'Expired offers excluded from customer discovery');

    // Customer Service 2: Home offers
    const homeOffersRes = await fetch(`${baseUrl}/api/customer/offers/home`);
    const homeOffersData = await homeOffersRes.json();
    assert(homeOffersRes.status === 200, 'GET /api/customer/offers/home returns 200 OK');
    assert(homeOffersData.data.every((o: any) => o.placements.includes('home')), 'Home endpoint returns only offers with "home" placement');

    // Customer Service 3: Menu offers
    const menuOffersRes = await fetch(`${baseUrl}/api/customer/offers/menu`);
    const menuOffersData = await menuOffersRes.json();
    assert(menuOffersRes.status === 200, 'GET /api/customer/offers/menu returns 200 OK');
    assert(menuOffersData.data.every((o: any) => o.placements.includes('menu')), 'Menu endpoint returns only offers with "menu" placement');

    // Customer Service 4: Single public offer details
    const singleCustOfferRes = await fetch(`${baseUrl}/api/customer/offers/${percentOfferId}`);
    const singleCustOfferData = await singleCustOfferRes.json();
    assert(singleCustOfferRes.status === 200, 'GET /api/customer/offers/:id returns 200 OK');
    assert(singleCustOfferData.data._id === percentOfferId, 'Customer offer ID matches');
    assert(singleCustOfferData.data.redemptionHistory === undefined, 'Internal redemption history omitted from customer payload');

    // -------------------------------------------------------------------------
    // SECTION 7: Customer Cart Operations & Offer Application (Services 5, 6)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Customer Cart & Offer Application ---');
    const guestHeader = { 'x-guest-id': 'gst_test_offers_user' };

    // Initialize cart with an item: 1x Butter Chicken @ ₹300
    const addItem1Res = await fetch(`${baseUrl}/api/customer/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({
        dishId: '507f1f77bcf86cd799439021',
        name: 'Butter Chicken',
        price: 300,
        quantity: 1,
      }),
    });
    const cartData1 = await addItem1Res.json();
    assert(addItem1Res.status === 200, 'Add item to cart returns 200');
    const cartId = cartData1.data._id;
    assert(cartData1.data.subtotal === 300, 'Cart subtotal is ₹300');

    // Attempt applying Fixed Offer (minOrderValue is ₹450) -> Must fail with 400
    const applyBelowMinRes = await fetch(`${baseUrl}/api/customer/cart/apply-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({ cartId, offerId: fixedOfferId }),
    });
    assert(applyBelowMinRes.status === 400, 'Applying offer below minOrderValue returns 400 Bad Request');

    // Attempt applying expired offer -> Must fail with 400
    const applyExpiredRes = await fetch(`${baseUrl}/api/customer/cart/apply-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({ cartId, offerId: expiredOfferId }),
    });
    assert(applyExpiredRes.status === 400, 'Applying expired offer returns 400 Bad Request');

    // Add another item to reach subtotal ₹600 (300 + 300)
    const addItem2Res = await fetch(`${baseUrl}/api/customer/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({
        cartId,
        dishId: '507f1f77bcf86cd799439022',
        name: 'Dal Makhani',
        price: 300,
        quantity: 1,
      }),
    });
    const cartData2 = await addItem2Res.json();
    assert(cartData2.data.subtotal === 600, 'Cart subtotal increased to ₹600');

    // Apply percentage offer (20% off up to ₹150 cap, minOrderValue ₹500)
    // 20% of 600 = 120. (Since 120 <= 150 cap, discount is ₹120)
    const applyPercentRes = await fetch(`${baseUrl}/api/customer/cart/apply-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({ cartId, offerId: percentOfferId }),
    });
    const percentApplied = await applyPercentRes.json();
    assert(applyPercentRes.status === 200, 'Apply percentage offer returns 200 OK');
    assert(percentApplied.data.appliedOffer.offerId === percentOfferId, 'Applied offer snapshot recorded');
    assert(percentApplied.data.discountAmount === 120, 'Discount calculated correctly as ₹120 (20% of 600)');
    // Subtotal 600 - 120 = 480 base. 5% GST = 24. Delivery = 0 (subtotal >= 300). Payable = 504.
    assert(percentApplied.data.payableAmount === 504, 'Payable amount is exactly ₹504 (600 - 120 + 24)');

    // Add 2 more items to push subtotal to ₹1200
    // 20% of 1200 = 240, but capped at maxDiscount ₹150!
    await fetch(`${baseUrl}/api/customer/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({
        cartId,
        dishId: '507f1f77bcf86cd799439023',
        name: 'Paneer Tikka',
        price: 600,
        quantity: 1,
      }),
    });
    const cartAfterCap = await (await fetch(`${baseUrl}/api/customer/cart?cartId=${cartId}`, { headers: guestHeader })).json();
    assert(cartAfterCap.data.subtotal === 1200, 'Cart subtotal is ₹1200');
    assert(cartAfterCap.data.discountAmount === 150, 'Percentage discount capped at maxDiscount ₹150');

    // Remove applied offer (Service 6)
    const removeRes = await fetch(`${baseUrl}/api/customer/cart/remove-offer`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...guestHeader },
      body: JSON.stringify({ cartId }),
    });
    const removedData = await removeRes.json();
    assert(removeRes.status === 200, 'Remove offer returns 200 OK');
    assert(removedData.data.appliedOffer === null, 'appliedOffer reset to null');
    assert(removedData.data.discountAmount === 0, 'discountAmount reset to 0');

    // -------------------------------------------------------------------------
    // SECTION 8: Orders & Payments Integration & Idempotent Redemption
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Orders Checkout & Idempotent Redemption ---');
    const dishes = db.getState().dishes || [];
    const orderDish = dishes.find((d: any) => d.available) || dishes[0] || { id: 'dish_test_1', price: 600, name: 'Butter Chicken', available: true };
    const orderQty = Math.ceil(500 / (orderDish.price || 100));

    // Place order with Fixed Offer (Flat ₹120 off)
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: 'Priya Sharma',
          phone: '9876543210',
          email: 'priya@gmail.com',
        },
        items: [
          {
            dishId: orderDish.id || (orderDish as any)._id,
            quantity: orderQty,
          },
        ],
        fulfillmentType: 'dining',
        paymentMethod: 'upi',
        offerId: fixedOfferId,
      }),
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 201, 'Order created with applied offer returns 201 Created');
    assert(orderData.order && orderData.order.offer, 'Order contains offer snapshot');
    assert(orderData.order.offer.offerId === fixedOfferId, 'Order offerId matches');
    assert(orderData.order.offer.discountAmount === 120, 'Order discountAmount is ₹120');
    assert(orderData.order.discountAmount === 120 || orderData.order.discount === 120, 'Order top-level discount matches ₹120');

    const createdOrderId = orderData.order._id || orderData.order.id;

    // Simulate Payment Confirmation event (DOMAIN_EVENTS.PAYMENT_PAID)
    eventBus.emit(DOMAIN_EVENTS.PAYMENT_PAID, {
      order: orderData.order,
      payment: {
        orderId: createdOrderId,
        orderNumber: orderData.order.orderNumber,
        amount: orderData.order.grandTotal,
        transactionId: 'txn_test_12345',
        paymentMethod: 'upi',
      },
    });

    // Allow event loop to process async listener
    await new Promise((r) => setTimeout(r, 300));

    // Verify redemption was recorded in analytics
    const analyticsAfterOrder = await (await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}/analytics`, { headers: adminHeaders })).json();
    assert(analyticsAfterOrder.data.totalRedemptions === 1, 'Offer analytics shows 1 redemption');
    assert(analyticsAfterOrder.data.totalDiscountProvided === 120, 'Offer analytics shows ₹120 total discount provided');

    // Test Idempotency: re-emit duplicate PAYMENT_PAID event
    eventBus.emit(DOMAIN_EVENTS.PAYMENT_PAID, {
      order: orderData.order,
      payment: {
        orderId: createdOrderId,
        orderNumber: orderData.order.orderNumber,
        amount: orderData.order.grandTotal,
        transactionId: 'txn_test_12345',
        paymentMethod: 'upi',
      },
    });
    await new Promise((r) => setTimeout(r, 300));

    const analyticsAfterDuplicate = await (await fetch(`${baseUrl}/api/admin/offers/${fixedOfferId}/analytics`, { headers: adminHeaders })).json();
    assert(analyticsAfterDuplicate.data.totalRedemptions === 1, 'Duplicate payment event ignored idempotently (still 1 redemption)');
    assert(analyticsAfterDuplicate.data.totalDiscountProvided === 120, 'Duplicate discount not double-counted (still ₹120)');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`🎉 ALL OFFERS MODULE TESTS PASSED: ${passed}/${total}`);
    console.log('===============================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED UNEXPECTEDLY:', err);
  process.exit(1);
});
