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
  console.log('🧪 TESTING COMPLETE EVENTS & INQUIRIES MODULE');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Admin Authentication for Setup
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
    assert(typeof loginData.token === 'string', 'Received JWT admin token');
    const adminToken = loginData.token;

    // -------------------------------------------------------------------------
    // TEST 2: Unauthorized Security Checks
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Security & Authorization Guards ---');
    const unauthGetEvents = await fetch(`${baseUrl}/api/v1/admin/events`);
    assert(unauthGetEvents.status === 401, 'GET /api/v1/admin/events without token returns 401');

    const unauthCreateEvent = await fetch(`${baseUrl}/api/v1/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: 'Hacker Gala' }),
    });
    assert(unauthCreateEvent.status === 401, 'POST /api/v1/admin/events without token returns 401');

    const unauthGetInquiries = await fetch(`${baseUrl}/api/v1/admin/event-inquiries`);
    assert(unauthGetInquiries.status === 401, 'GET /api/v1/admin/event-inquiries without token returns 401');

    // -------------------------------------------------------------------------
    // TEST 3: Public Events Empty / Initial Listing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Public Event Portfolio Access ---');
    const publicEventsRes = await fetch(`${baseUrl}/api/v1/events`);
    const publicEventsData = await publicEventsRes.json();
    assert(publicEventsRes.status === 200, 'GET /api/v1/events returns 200 OK');
    assert(publicEventsData.success === true, 'Public events response success is true');
    assert(Array.isArray(publicEventsData.events), 'Public events contains events array');

    // Also verify customer namespace
    const customerEventsRes = await fetch(`${baseUrl}/api/v1/customer/events`);
    assert(customerEventsRes.status === 200, 'GET /api/v1/customer/events returns 200 OK');

    // -------------------------------------------------------------------------
    // TEST 4: Create Event as Draft & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Create Event (Draft) & Input Validation ---');
    // Missing required fields
    const invalidEventRes = await fetch(`${baseUrl}/api/v1/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        event_name: '',
      }),
    });
    assert(invalidEventRes.status === 400, 'POST /api/v1/admin/events with empty name returns 400');

    // Valid event creation
    const createEventRes = await fetch(`${baseUrl}/api/v1/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        event_name: 'Royal Heritage Wedding Reception',
        description: 'An elegant evening celebration with royal Awadhi banquet dining and bespoke floral arrangements.',
        event_date: '2026-12-15T18:00:00.000Z',
        attendee_count: 250,
        services_provided: [
          { name: 'Catering', description: '7-course traditional Mughlai buffet' },
          { name: 'Live Music', description: 'Classical instrumental performance' },
          { name: 'Floral Decor', description: 'Grand stage and royal banquet seating' },
        ],
        location: 'Hestiia Grand Lawn & Banquet',
      }),
    });
    const createEventData = await createEventRes.json();
    assert(createEventRes.status === 201, 'POST /api/v1/admin/events returns 201 Created');
    assert(createEventData.success === true, 'Event creation confirmed success');
    assert(createEventData.event && createEventData.event.id, 'Event record assigned valid ID');
    assert(createEventData.event.status === 'draft', 'Newly created event defaults to "draft" status');
    assert(createEventData.event.attendee_count === 250, 'Attendee count recorded accurately');
    const createdEventId = createEventData.event.id;

    // -------------------------------------------------------------------------
    // TEST 5: Draft Isolation from Public Customer Portal
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Draft Isolation Safeguard ---');
    const publicCheckRes = await fetch(`${baseUrl}/api/v1/events`);
    const publicCheckData = await publicCheckRes.json();
    const isDraftVisible = (publicCheckData.events || []).some((e: any) => e.id === createdEventId);
    assert(!isDraftVisible, 'Draft event is strictly HIDDEN from public GET /api/v1/events');

    const publicDetailDraftRes = await fetch(`${baseUrl}/api/v1/events/${createdEventId}`);
    assert(publicDetailDraftRes.status === 404, 'Direct public access GET /api/v1/events/:id returns 404 for draft');

    // -------------------------------------------------------------------------
    // TEST 6: Publishing Safeguard (Rejects publish without photographs)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Publishing Safeguard Verification ---');
    const publishAttemptRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'published' }),
    });
    assert(publishAttemptRes.status === 400, 'Publishing rejected with 400 when event has no photos or cover image');

    // -------------------------------------------------------------------------
    // TEST 7: Photograph Upload & Media Management
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Photograph Upload & Media Management ---');
    // Upload multipart photo using multipart form payload
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const mockImageContent = Buffer.from('fake-jpeg-image-binary-data');
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="photos"; filename="reception_stage.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ),
      mockImageContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadPhotoRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: multipartBody,
    });
    const uploadPhotoData = await uploadPhotoRes.json();
    assert(uploadPhotoRes.status === 201, 'POST /api/v1/admin/events/:id/photos returns 201 Created');
    assert(uploadPhotoData.success === true, 'Photo upload confirmed success');
    assert(Array.isArray(uploadPhotoData.media) && uploadPhotoData.media.length === 1, 'Uploaded 1 photograph record');
    assert(uploadPhotoData.media[0].is_cover === true, 'First uploaded photograph auto-assigned as cover');
    const firstMediaId = uploadPhotoData.media[0].id;

    // Upload second photograph
    const boundary2 = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const multipartBody2 = Buffer.concat([
      Buffer.from(
        `--${boundary2}\r\n` +
        `Content-Disposition: form-data; name="photos"; filename="dining_buffet.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ),
      mockImageContent,
      Buffer.from(`\r\n--${boundary2}--\r\n`),
    ]);
    const uploadPhoto2Res = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary2}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: multipartBody2,
    });
    const uploadPhoto2Data = await uploadPhoto2Res.json();
    assert(uploadPhoto2Res.status === 201, 'Second photo uploaded successfully');
    const secondMediaId = uploadPhoto2Data.media[0].id;

    // Test get media
    const getMediaRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/photos`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getMediaData = await getMediaRes.json();
    assert(getMediaRes.status === 200, 'GET /api/v1/admin/events/:id/photos returns 200');
    assert(getMediaData.media.length === 2, 'Event now has 2 media items');

    // Test set cover image
    const setCoverRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/photos/${secondMediaId}/cover`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const setCoverData = await setCoverRes.json();
    assert(setCoverRes.status === 200, 'PATCH /photos/:mediaId/cover returns 200');
    assert(setCoverData.media.is_cover === true, 'Second photo is now designated cover');

    // Test reorder photos
    const reorderRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/photos/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ orderedMediaIds: [secondMediaId, firstMediaId] }),
    });
    assert(reorderRes.status === 200, 'PATCH /photos/reorder returns 200');

    // -------------------------------------------------------------------------
    // TEST 8: Publishing Event & Public Discovery
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Publish Event & Customer Discovery ---');
    const publishRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'published' }),
    });
    const publishData = await publishRes.json();
    assert(publishRes.status === 200, 'PATCH /status returns 200 OK');
    assert(publishData.event.status === 'published', 'Event status successfully changed to "published"');

    // Check public list now contains the event
    const publicListAfterRes = await fetch(`${baseUrl}/api/v1/events`);
    const publicListAfterData = await publicListAfterRes.json();
    const publishedFound = (publicListAfterData.events || []).some((e: any) => e.id === createdEventId);
    assert(publishedFound, 'Published event is now LIVE in public GET /api/v1/events');

    // Check public detail
    const publicDetailRes = await fetch(`${baseUrl}/api/v1/events/${createdEventId}`);
    const publicDetailData = await publicDetailRes.json();
    assert(publicDetailRes.status === 200, 'GET /api/v1/events/:id returns 200 for published event');
    assert(publicDetailData.event && publicDetailData.event.event_name === 'Royal Heritage Wedding Reception', 'Event details match created record');
    assert(Array.isArray(publicDetailData.event.media) && publicDetailData.event.media.length === 2, 'Media gallery returned with photographs');

    // -------------------------------------------------------------------------
    // TEST 9: Update Event Information
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Update Event Details ---');
    const updateEventRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        attendee_count: 300,
        location: 'Hestiia Main Lawn, Shyam Nagar, Kanpur',
      }),
    });
    const updateEventData = await updateEventRes.json();
    assert(updateEventRes.status === 200, 'PUT /api/v1/admin/events/:id returns 200');
    assert(updateEventData.event.attendee_count === 300, 'Updated attendee count to 300');
    assert(updateEventData.event.location.includes('Shyam Nagar'), 'Updated location details');

    // -------------------------------------------------------------------------
    // TEST 10: Event Inquiries Workflow (Customer Submission & Validation)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Event Inquiry Submission & Validation ---');
    // Invalid inquiry
    const invalidInquiryRes = await fetch(`${baseUrl}/api/v1/event-inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: '' }),
    });
    assert(invalidInquiryRes.status === 400, 'Inquiry without customer_name returns 400');

    // Valid inquiry submission
    const inquiryRes = await fetch(`${baseUrl}/api/v1/event-inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Vikramaditya Singhania',
        phone: '9876543210',
        email: 'vikram.singhania@gmail.com',
        event_type: 'Anniversary Banquet',
        preferred_date: '2026-12-28T19:00:00.000Z',
        expected_attendees: 80,
        requirements: 'Pure vegetarian Jain food options required for 20 guests.',
        message: 'Looking for terrace garden seating with lighting.',
      }),
    });
    const inquiryData = await inquiryRes.json();
    assert(inquiryRes.status === 201, 'POST /api/v1/event-inquiries returns 201 Created');
    assert(inquiryData.success === true, 'Inquiry creation confirmed');
    assert(inquiryData.inquiry && inquiryData.inquiry.id, 'Inquiry assigned unique ID');
    assert(inquiryData.inquiry.status === 'pending', 'Inquiry initialized in "pending" status');
    const createdInquiryId = inquiryData.inquiry.id;

    // Verify submission through customer route as well
    const custInquiryRes = await fetch(`${baseUrl}/api/v1/customer/event-inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Ananya Sharma',
        phone: '9123456780',
        event_type: 'Corporate Dinner',
        preferred_date: '2027-01-10T19:30:00.000Z',
        expected_attendees: 45,
      }),
    });
    assert(custInquiryRes.status === 201, 'POST /api/v1/customer/event-inquiries returns 201 Created');

    // -------------------------------------------------------------------------
    // TEST 11: Admin Inquiry Management, Notes & Confirmation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Admin Inquiry Review & Status Updates ---');
    const adminInquiriesRes = await fetch(`${baseUrl}/api/v1/admin/event-inquiries`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminInquiriesData = await adminInquiriesRes.json();
    assert(adminInquiriesRes.status === 200, 'GET /api/v1/admin/event-inquiries returns 200');
    assert(Array.isArray(adminInquiriesData.inquiries), 'Admin inquiries returns array');
    const foundInq = adminInquiriesData.inquiries.some((i: any) => i.id === createdInquiryId);
    assert(foundInq, 'Newly submitted inquiry found in admin inquiries list');

    // Update admin notes
    const updateNotesRes = await fetch(`${baseUrl}/api/v1/admin/event-inquiries/${createdInquiryId}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ admin_notes: 'Spoke with Mr. Singhania. Budget agreed. Table reserved.' }),
    });
    const updateNotesData = await updateNotesRes.json();
    assert(updateNotesRes.status === 200, 'PATCH /notes returns 200');
    assert(updateNotesData.inquiry.admin_notes.includes('Singhania'), 'Admin notes updated');

    // Confirm inquiry (links to table booking service)
    const confirmInqRes = await fetch(`${baseUrl}/api/v1/admin/event-inquiries/${createdInquiryId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'confirmed',
        extra: { timeSlot: '19:30' },
      }),
    });
    const confirmInqData = await confirmInqRes.json();
    assert(confirmInqRes.status === 200, 'PATCH /status to "confirmed" returns 200');
    assert(confirmInqData.inquiry.status === 'confirmed', 'Inquiry marked as confirmed');
    assert(confirmInqData.inquiry.booking_id, 'Inquiry automatically generated linked booking_id');

    // -------------------------------------------------------------------------
    // TEST 12: Delete Event & Media Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: Delete Event & Media Cleanup ---');
    const deleteEventRes = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteEventRes.status === 200, 'DELETE /api/v1/admin/events/:id returns 200');

    // Verify event is gone
    const getDeletedAdmin = await fetch(`${baseUrl}/api/v1/admin/events/${createdEventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getDeletedAdmin.status === 404, 'Admin GET of deleted event returns 404');

    const getDeletedPublic = await fetch(`${baseUrl}/api/v1/events/${createdEventId}`);
    assert(getDeletedPublic.status === 404, 'Public GET of deleted event returns 404');

    console.log('\n===============================================================');
    console.log(`🎉 ALL EVENTS MODULE TESTS PASSED: ${passed}/${total}`);
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE RUNNER ABORTED:', err);
  process.exit(1);
});
