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
  console.log('🧪 TESTING COMPLETE GALLERY & MEDIA MODULE');
  console.log('===============================================================\n');

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

    // -------------------------------------------------------------------------
    // TEST 2: Security & Authorization Guards
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Security & Authorization Guards ---');
    const unauthGetAdmin = await fetch(`${baseUrl}/api/v1/admin/gallery/photos`);
    assert(unauthGetAdmin.status === 401, 'GET /api/v1/admin/gallery/photos without token returns 401');

    const unauthCreateSec = await fetch(`${baseUrl}/api/v1/admin/gallery/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VIP Lounge' }),
    });
    assert(unauthCreateSec.status === 401, 'POST /api/v1/admin/gallery/sections without token returns 401');

    const unauthModeration = await fetch(`${baseUrl}/api/v1/admin/gallery/customer-uploads`);
    assert(unauthModeration.status === 401, 'GET /api/v1/admin/gallery/customer-uploads without token returns 401');

    // -------------------------------------------------------------------------
    // TEST 3: Public Sections & Gallery Discovery
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Public Sections & Gallery Discovery ---');
    const publicSectionsRes = await fetch(`${baseUrl}/api/v1/gallery/sections`);
    const publicSectionsData = await publicSectionsRes.json();
    assert(publicSectionsRes.status === 200, 'GET /api/v1/gallery/sections returns 200 OK');
    assert(Array.isArray(publicSectionsData.sections), 'Returns sections array');
    assert(publicSectionsData.sections.length >= 5, 'Contains default seed sections');
    assert(publicSectionsData.sections.some((s: any) => s.slug === 'interior'), 'Includes Interior section');
    assert(publicSectionsData.sections.some((s: any) => s.slug === 'dining-area'), 'Includes Dining Area section');

    const publicPhotosRes = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const publicPhotosData = await publicPhotosRes.json();
    assert(publicPhotosRes.status === 200, 'GET /api/v1/gallery/photos returns 200 OK');
    assert(Array.isArray(publicPhotosData.photos), 'Returns photos array');

    // Verify customer namespace alias
    const custGalleryAlias = await fetch(`${baseUrl}/api/v1/customer/gallery/sections`);
    assert(custGalleryAlias.status === 200, 'GET /api/v1/customer/gallery/sections alias returns 200 OK');

    // -------------------------------------------------------------------------
    // TEST 4: Admin Section Management & Safeguards
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Admin Section Management ---');
    // Create new section
    const createSecRes = await fetch(`${baseUrl}/api/v1/admin/gallery/sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Royal Heritage Banquet',
        description: 'Exquisite royal banquet hall setups and chandeliers',
        displayOrder: 10,
      }),
    });
    const createSecData = await createSecRes.json();
    assert(createSecRes.status === 201, 'POST /api/v1/admin/gallery/sections returns 201 Created');
    assert(createSecData.section.slug === 'royal-heritage-banquet', 'Slug generated accurately');
    const customSectionId = createSecData.section.id;

    // Duplicate slug prevention
    const duplicateSecRes = await fetch(`${baseUrl}/api/v1/admin/gallery/sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Royal Heritage Banquet',
      }),
    });
    assert(duplicateSecRes.status === 400, 'Duplicate section slug rejected with 400');

    // Update section
    const updateSecRes = await fetch(`${baseUrl}/api/v1/admin/gallery/sections/${customSectionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        description: 'Updated banquet description',
      }),
    });
    assert(updateSecRes.status === 200, 'PUT /api/v1/admin/gallery/sections/:id returns 200');

    // -------------------------------------------------------------------------
    // TEST 5: Admin Official Photo Upload & Status Management
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Admin Official Photo Management ---');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const mockImageContent = Buffer.from('fake-jpeg-image-data-official');
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="title"\r\n\r\n` +
        `Grand Awadhi Chandelier Hall\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="caption"\r\n\r\n` +
        `Majestic dining under hand-crafted glass chandeliers\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="sectionId"\r\n\r\n` +
        `${customSectionId}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="photo"; filename="hall.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ),
      mockImageContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadOfficialRes = await fetch(`${baseUrl}/api/v1/admin/gallery/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: multipartBody,
    });
    const uploadOfficialData = await uploadOfficialRes.json();
    assert(uploadOfficialRes.status === 201, 'POST /api/v1/admin/gallery/photos returns 201 Created');
    assert(uploadOfficialData.photo.uploaderType === 'admin', 'Uploader type is admin');
    assert(uploadOfficialData.photo.mediaSource === 'official', 'Media source is official');
    assert(uploadOfficialData.photo.publicationStatus === 'published', 'Defaults to published');
    const officialPhotoId = uploadOfficialData.photo.id;

    // Check public gallery immediately displays the official published photo
    const checkPublicAfterOfficial = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const checkPublicAfterOfficialData = await checkPublicAfterOfficial.json();
    const foundOfficial = checkPublicAfterOfficialData.photos.find((p: any) => p.id === officialPhotoId);
    assert(Boolean(foundOfficial), 'Official published photo visible in public gallery');
    assert(foundOfficial.postedBy === 'Hestiia Restaurant', 'Attribution correctly states Hestiia Restaurant');

    // Section deletion safety guard: Cannot delete section containing active photos!
    const deleteSecAttempt = await fetch(`${baseUrl}/api/v1/admin/gallery/sections/${customSectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteSecAttempt.status === 400, 'Deleting section with active photos rejected with 400');

    // Unpublish photo & verify it disappears from public view
    const unpublishRes = await fetch(`${baseUrl}/api/v1/admin/gallery/photos/${officialPhotoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'draft' }),
    });
    assert(unpublishRes.status === 200, 'PATCH /status to draft returns 200');

    const checkPublicAfterDraft = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const checkPublicAfterDraftData = await checkPublicAfterDraft.json();
    assert(!checkPublicAfterDraftData.photos.some((p: any) => p.id === officialPhotoId), 'Draft photo hidden from public');

    // -------------------------------------------------------------------------
    // TEST 6: Guest Customer Upload & Anonymous Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Guest Customer Photo Upload ---');
    const guestCookie = 'hestiia_guest_id=gst_0123456789abcdef0123456789abcdef';

    const custBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const custMultipartBody = Buffer.concat([
      Buffer.from(
        `--${custBoundary}\r\n` +
        `Content-Disposition: form-data; name="caption"\r\n\r\n` +
        `Unforgettable family anniversary celebration at Hestiia!\r\n` +
        `--${custBoundary}\r\n` +
        `Content-Disposition: form-data; name="photo"; filename="family_dinner.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ),
      mockImageContent,
      Buffer.from(`\r\n--${custBoundary}--\r\n`),
    ]);

    const uploadCustRes = await fetch(`${baseUrl}/api/v1/gallery/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${custBoundary}`,
        Cookie: guestCookie,
      },
      body: custMultipartBody,
    });
    const uploadCustData = await uploadCustRes.json();
    assert(uploadCustRes.status === 201, 'POST /api/v1/gallery/uploads returns 201 Created');
    assert(uploadCustData.submission.moderationStatus === 'pending', 'Customer upload defaults to "pending"');
    const customerPhotoId = uploadCustData.submission.id;

    // Verify pending customer photo is strictly HIDDEN from public gallery
    const publicCheckCust = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const publicCheckCustData = await publicCheckCust.json();
    assert(!publicCheckCustData.photos.some((p: any) => p.id === customerPhotoId), 'Pending customer photo is strictly HIDDEN from public');

    // Guest retrieves own uploads
    const myUploadsRes = await fetch(`${baseUrl}/api/v1/gallery/my-uploads`, {
      headers: { Cookie: guestCookie },
    });
    const myUploadsData = await myUploadsRes.json();
    assert(myUploadsRes.status === 200, 'GET /api/v1/gallery/my-uploads returns 200');
    assert(myUploadsData.uploads.some((u: any) => u.id === customerPhotoId), 'Guest sees own submission in my-uploads');

    // Guest B isolation check
    const guestBCookie = 'hestiia_guest_id=gst_fedcba9876543210fedcba9876543210';
    const guestBMyUploads = await fetch(`${baseUrl}/api/v1/gallery/my-uploads`, {
      headers: { Cookie: guestBCookie },
    });
    const guestBData = await guestBMyUploads.json();
    assert(!guestBData.uploads.some((u: any) => u.id === customerPhotoId), 'Guest B cannot see Guest A uploads');

    // Guest B cannot delete Guest A's upload
    const guestBDeleteAttempt = await fetch(`${baseUrl}/api/v1/gallery/my-uploads/${customerPhotoId}`, {
      method: 'DELETE',
      headers: { Cookie: guestBCookie },
    });
    assert(guestBDeleteAttempt.status === 403, 'Guest B cannot delete Guest A upload (returns 403 Forbidden)');

    // -------------------------------------------------------------------------
    // TEST 7: Admin Moderation Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Admin Customer Photo Moderation ---');
    const adminUploadsList = await fetch(`${baseUrl}/api/v1/admin/gallery/customer-uploads`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUploadsListData = await adminUploadsList.json();
    assert(adminUploadsList.status === 200, 'GET /api/v1/admin/gallery/customer-uploads returns 200');
    assert(adminUploadsListData.submissions.some((s: any) => s.id === customerPhotoId), 'Customer submission listed for admin review');

    // Admin approves photo
    const approveRes = await fetch(`${baseUrl}/api/v1/admin/gallery/customer-uploads/${customerPhotoId}/moderate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'approved' }),
    });
    assert(approveRes.status === 200, 'PATCH /moderate to approved returns 200 OK');

    // Verify approved customer photo is NOW LIVE in public gallery
    const publicCheckApproved = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const publicCheckApprovedData = await publicCheckApproved.json();
    const approvedPublicPhoto = publicCheckApprovedData.photos.find((p: any) => p.id === customerPhotoId);
    assert(Boolean(approvedPublicPhoto), 'Approved customer photo is now LIVE in public gallery');
    assert(approvedPublicPhoto.postedBy === 'Posted by a customer', 'Public attribution says "Posted by a customer"');
    assert(!approvedPublicPhoto.guestId, 'guestId is strictly STRIPPED from public output');
    assert(!approvedPublicPhoto.uploadedByAdmin, 'admin metadata stripped from public output');

    // Admin removes previously approved photo
    const removeRes = await fetch(`${baseUrl}/api/v1/admin/gallery/customer-uploads/${customerPhotoId}/moderate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'removed', reason: 'TOS violation' }),
    });
    assert(removeRes.status === 200, 'PATCH /moderate to removed returns 200 OK');

    // Verify removed photo disappears from public gallery
    const publicCheckRemoved = await fetch(`${baseUrl}/api/v1/gallery/photos`);
    const publicCheckRemovedData = await publicCheckRemoved.json();
    assert(!publicCheckRemovedData.photos.some((p: any) => p.id === customerPhotoId), 'Removed photo no longer publicly visible');

    // -------------------------------------------------------------------------
    // TEST 8: Cleanup & Deletion
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Media Deletion & Cleanup ---');
    const deleteOfficialRes = await fetch(`${baseUrl}/api/v1/admin/gallery/photos/${officialPhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteOfficialRes.status === 200, 'Official photo deleted successfully');

    const deleteCustAdminRes = await fetch(`${baseUrl}/api/v1/admin/gallery/customer-uploads/${customerPhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteCustAdminRes.status === 200, 'Customer photo deleted by admin successfully');

    // Now that photos are deleted, section can be deleted safely
    const deleteSecRes = await fetch(`${baseUrl}/api/v1/admin/gallery/sections/${customSectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteSecRes.status === 200, 'Empty gallery section deleted successfully');

    console.log('\n===============================================================');
    console.log(`🎉 ALL GALLERY & MEDIA TESTS PASSED: ${passed}/${total}`);
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE RUNNER ABORTED:', err);
  process.exit(1);
});
