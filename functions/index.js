'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

const AUTH = admin.auth();
const DB = admin.database();

const appCfg = (functions.config().app) || {};
const ADMIN_EMAILS = String(appCfg.admin_emails || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const SENDGRID_KEY = appCfg.sendgrid_key || '';
const EMAIL_FROM = appCfg.email_from || 'notifications@zbhpanandplate.com';
const DEFAULT_ADMIN_EMAIL = 'zoyabilal01@gmail.com';

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
}

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value || '').replace(/[&<>"']/g, (c) => map[c]);
}

function formatTimestamp(value) {
  if (!value && value !== 0) return '';
  const num = Number(value);
  if (!isNaN(num) && (num > 100000000000)) {
    return new Date(num).toISOString();
  }
  return String(value);
}

function isEmailAdmin(email) {
  const normalized = String(email || '').toLowerCase();
  return ADMIN_EMAILS.indexOf(normalized) !== -1 || normalized === DEFAULT_ADMIN_EMAIL;
}

exports.sendNewUserNotification = functions.database
  .ref('users/{uid}/profile')
  .onCreate(async (snap, context) => {
    const profile = (snap.val && snap.val()) || {};
    const name = profile.name || 'Unknown';
    const email = profile.email || context.params.uid;
    const region = profile.region || 'Unknown';
    const provider = profile.provider || 'unknown';
    const providerLabel = (provider === 'email' || provider === 'password') ? 'Email' : (provider === 'google' ? 'Google' : provider);
    const createdAt = formatTimestamp(profile.createdAt);

    const to = ADMIN_EMAILS.length ? ADMIN_EMAILS[0] : DEFAULT_ADMIN_EMAIL;

    if (!SENDGRID_KEY) {
      functions.logger.warn('sendNewUserNotification: SendGrid key not configured; notification not sent.');
      return null;
    }

    const subject = `New ZBH Pan & Plate account - ${name}`;
    const nameEsc = escapeHtml(name);
    const emailEsc = escapeHtml(email);
    const regionEsc = escapeHtml(region);
    const providerEsc = escapeHtml(providerLabel);
    const createdAtEsc = escapeHtml(createdAt);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>New Account Sign-up Notification</h2>
        <table style="border-collapse: collapse;">
          <tr><td style="padding:4px 8px;"><strong>Name:</strong></td><td>${nameEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Email:</strong></td><td>${emailEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Country/Region:</strong></td><td>${regionEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Sign-up date &amp; time:</strong></td><td>${createdAtEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Authentication Provider:</strong></td><td>${providerEsc}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;">This notification was sent from a secure backend (Firebase Cloud Functions). No passwords or authentication tokens are included.</p>
      </div>
    `;

    const msg = {
      to: to,
      from: EMAIL_FROM,
      subject: subject,
      text: `New ZBH Pan & Plate sign-up\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Country/Region: ${region}\n` +
        `Sign-up date & time: ${createdAt}\n` +
        `Authentication Provider: ${providerLabel}\n` +
        `(No passwords or tokens included.)`,
      html: html
    };

    try {
      await sgMail.send(msg);
      functions.logger.info('New-user notification sent to', to, { uid: context.params.uid, provider: provider, name: name });
    } catch (err) {
      functions.logger.error('Failed to send new-user notification to', to, { uid: context.params.uid, provider: provider, name: name }, err);
    }
    return null;
  });

exports.listUsersAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = String(context.auth.token.email || '').toLowerCase();
  if (!isEmailAdmin(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  }

  const limit = Math.min(Math.max(Number(data && data.limit) || 100, 1), 1000);
  const pageToken = (data && data.pageToken) || undefined;

  const list = await AUTH.listUsers(limit, pageToken);

  let profiles = {};
  try {
    const snap = await DB.ref('users').once('value');
    if (snap.exists()) {
      profiles = snap.val() || {};
    }
  } catch (err) {
    functions.logger.error('listUsersAdmin: error reading profiles:', err);
  }

  const users = list.users.map((u) => {
    const record = profiles[u.uid] || {};
    const profile = record.profile || {};
    const provider = profile.provider || (u.providerData && u.providerData[0] && u.providerData[0].providerId) || '';
    return {
      uid: u.uid,
      name: profile.name || u.displayName || '',
      email: u.email || profile.email || '',
      region: profile.region || 'Unknown',
      provider: provider,
      createdAt: profile.createdAt ? formatTimestamp(profile.createdAt) : (u.metadata && u.metadata.creationTime) || '',
      lastLogin: profile.lastLogin ? formatTimestamp(profile.lastLogin) : (u.metadata && u.metadata.lastSignInTime) || ''
    };
  });

  return { users: users, pageToken: list.pageToken || null, count: users.length };
});

/* -------------------- Certification Functions -------------------- */
const CERTIFICATIONS_PATH = 'certifications';

function generateSubmissionId(data) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return ts + '-' + rand;
}

exports.notifyAdminCertification = functions.https.onCall(async (data, context) => {
  if (!data || !data.submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }

  const submissionId = String(data.submissionId);

  const existing = await DB.ref(CERTIFICATIONS_PATH + '/' + submissionId).once('value');
  if (!existing.exists()) {
    throw new functions.https.HttpsError('not-found', 'Submission not found in database.');
  }

  const fullName = String(data.fullName || '').trim();
  const email = String(data.email || '').trim();
  const city = String(data.city || '').trim();
  const country = String(data.country || '').trim();
  const whatsappNumber = String(data.whatsappNumber || '').trim();
  const age = data.age != null ? String(data.age) : 'Not provided';
  const recipeNames = Array.isArray(data.recipeNames) ? data.recipeNames : [];
  const imagePaths = Array.isArray(data.imagePaths) ? data.imagePaths : [];
  const createdAt = formatTimestamp(data.createdAt || Date.now());

  if (!fullName || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Full name and email are required.');
  }

  const to = ADMIN_EMAILS.length ? ADMIN_EMAILS[0] : DEFAULT_ADMIN_EMAIL;

  const storage = admin.storage();
  const bucket = storage.bucket();

  const rawRequest = (context && context.rawRequest) || {};
  const headers = (rawRequest.headers) || {};
  const ip = headers['x-forwarded-for'] || headers['x-appengine-user-ip'] || (context && context.ip) || 'Not available';
  const userAgent = headers['user-agent'] || 'Not available';
  const acceptLang = headers['accept-language'] || 'Not available';

  const siteUrl = (functions.config().app && functions.config().app.site_url) ? functions.config().app.site_url : 'zbhpanandplate.com';

  const downloadLinks = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const path = imagePaths[i];
    const recipeName = recipeNames[i] || ('Recipe ' + (i + 1));
    if (!path) {
      downloadLinks.push({ label: recipeName, url: null, error: 'No file recorded' });
      continue;
    }
    try {
      const file = bucket.file(path);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000
      });
      downloadLinks.push({ label: recipeName, url: signedUrl });
    } catch (err) {
      functions.logger.warn('notifyAdminCertification: could not generate signed URL', { path: path, error: err.message });
      downloadLinks.push({ label: recipeName, url: null, error: err.message });
    }
  }

  const subject = `New Cooking Certification Request - ${fullName}`;

  const nameEsc = escapeHtml(fullName);
  const emailEsc = escapeHtml(email);
  const cityEsc = escapeHtml(city);
  const countryEsc = escapeHtml(country);
  const whatsappEsc = escapeHtml(whatsappNumber);
  const ageEsc = escapeHtml(age);
  const createdAtEsc = escapeHtml(createdAt);
  const submissionIdEsc = escapeHtml(submissionId);
  const ipEsc = escapeHtml(ip);
  const uaEsc = escapeHtml(userAgent);
  const langEsc = escapeHtml(acceptLang);

  let recipeLinksHtml = '';
  for (let i = 0; i < downloadLinks.length; i++) {
    const dl = downloadLinks[i];
    const linkHtml = dl.url
      ? `<a href="${dl.url}" style="color:var(--primary);word-break:break-all;">View Photo ${i + 1}</a>`
      : `<span style="color:#dc2626;">Photo ${i + 1} - unavailable</span>`;
    recipeLinksHtml += `<tr><td style="padding:4px 8px;">${escapeHtml(dl.label)}</td><td style="padding:4px 8px;">${linkHtml}</td></tr>`;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>New Cooking Certification Request</h2>
      <table style="border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding:4px 8px;"><strong>Submission ID:</strong></td><td>${submissionIdEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Name:</strong></td><td>${nameEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Email:</strong></td><td>${emailEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>WhatsApp:</strong></td><td>${whatsappEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>City:</strong></td><td>${cityEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Country:</strong></td><td>${countryEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Age:</strong></td><td>${ageEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Date &amp; Time:</strong></td><td>${createdAtEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>IP Address:</strong></td><td>${ipEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>User Agent:</strong></td><td>${uaEsc}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Language:</strong></td><td>${langEsc}</td></tr>
      </table>
      <table style="border-collapse: collapse; margin-bottom: 16px;">
        <tr><th style="padding:4px 8px;text-align:left;">Recipe Name</th><th style="padding:4px 8px;text-align:left;">Photo</th></tr>
        ${recipeLinksHtml}
      </table>
      <p style="margin-top: 16px;">Review this submission at: <a href="https://${siteUrl}/pages/certification-admin.html">Certification Admin Panel</a></p>
      <p style="color:#888;font-size:12px;">This notification was sent from a secure backend (Firebase Cloud Functions). Personal information is used only for certificate verification. Links expire in 1 hour.</p>
    </div>
  `;

  const text =
    `New Cooking Certification Request\n` +
    `Submission ID: ${submissionId}\n` +
    `Name: ${fullName}\n` +
    `Email: ${email}\n` +
    `WhatsApp: ${whatsappNumber}\n` +
    `City: ${city}\n` +
    `Country: ${country}\n` +
    `Age: ${age}\n` +
    `Date & Time: ${createdAt}\n` +
    `IP Address: ${ip}\n` +
    `User Agent: ${userAgent}\n` +
    `Language: ${acceptLang}\n` +
    `Recipe Names:\n${recipeNames.map((r, i) => `  ${i + 1}. ${r || '(empty)'}`).join('\n')}\n` +
    `Images: ${imagePaths.length} uploaded\n` +
    `\nPhoto download links:\n${downloadLinks.map((dl, i) => `  ${i + 1}. ${dl.url || '(unavailable)'}`).join('\n')}\n` +
    `\nReview at: https://${siteUrl}/pages/certification-admin.html\n` +
    `(Personal information is used only for certificate verification. Links expire in 1 hour.)`;

  const msg = {
    to: to,
    from: EMAIL_FROM,
    subject: subject,
    text: text,
    html: html
  };

  if (!SENDGRID_KEY) {
    functions.logger.warn('notifyAdminCertification: SendGrid key not configured; notification not sent.');
    return { success: false, warning: 'SendGrid key not configured' };
  }

  try {
    await sgMail.send(msg);
    functions.logger.info('Certification notification sent to', to, { submissionId: submissionId, name: fullName });
    return { success: true, sentTo: to };
  } catch (err) {
    functions.logger.error('Failed to send certification notification to', to, { submissionId: submissionId, name: fullName }, err);
    throw new functions.https.HttpsError('internal', 'Failed to send notification.');
  }
});

exports.getCertificationRequests = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = String(context.auth.token.email || '').toLowerCase();
  if (!isEmailAdmin(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  }

  const snap = await DB.ref(CERTIFICATIONS_PATH).once('value');
  if (!snap.exists()) {
    return { submissions: [] };
  }

  const raw = snap.val();
  const submissions = Object.keys(raw).map((id) => {
    const record = raw[id] || {};
    return {
      id: id,
      fullName: record.fullName || '',
      email: record.email || '',
      city: record.city || '',
      country: record.country || '',
      whatsappNumber: record.whatsappNumber || '',
      age: record.age || null,
      recipeNames: Array.isArray(record.recipeNames) ? record.recipeNames : [],
      imagePaths: Array.isArray(record.imagePaths) ? record.imagePaths : [],
      status: record.status || 'pending',
      certificateIssued: record.certificateIssued === true,
      submittedAt: formatTimestamp(record.submittedAt),
      updatedAt: formatTimestamp(record.updatedAt || record.submittedAt),
      adminNotes: record.adminNotes || '',
      userId: record.userId || null
    };
  });

  submissions.sort((a, b) => {
    const ta = new Date(b.submittedAt || b.updatedAt || 0);
    const tb = new Date(a.submittedAt || a.updatedAt || 0);
    return ta - tb;
  });

  return { submissions: submissions };
});

exports.getCertificationImages = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = String(context.auth.token.email || '').toLowerCase();
  if (!isEmailAdmin(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  }

  const submissionId = String(data && data.submissionId || '');
  if (!submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }

  const snap = await DB.ref(CERTIFICATIONS_PATH + '/' + submissionId).once('value');
  if (!snap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Submission not found.');
  }

  const record = snap.val() || {};
  const imagePaths = Array.isArray(record.imagePaths) ? record.imagePaths : [];

  const storage = admin.storage();
  const bucket = storage.bucket();

  const urls = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const path = imagePaths[i];
    if (!path) {
      urls.push({ index: i, url: null, error: 'No path recorded' });
      continue;
    }
    try {
      const file = bucket.file(path);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000
      });
      urls.push({ index: i, url: signedUrl });
    } catch (err) {
      functions.logger.error('getCertificationImages: signed URL error', { path: path, error: err.message });
      urls.push({ index: i, url: null, error: err.message });
    }
  }

  return { submissionId: submissionId, urls: urls };
});

exports.updateCertificationStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = String(context.auth.token.email || '').toLowerCase();
  if (!isEmailAdmin(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  }

  const submissionId = String(data && data.submissionId || '');
  const newStatus = String(data && data.status || '');
  const adminNotes = String(data && data.adminNotes || '');
  const markIssued = data && data.markIssued === true;

  if (!submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }
  if (['pending', 'approved', 'rejected'].indexOf(newStatus) === -1) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status value.');
  }

  const ref = DB.ref(CERTIFICATIONS_PATH + '/' + submissionId);
  const snap = await ref.once('value');
  if (!snap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Submission not found.');
  }

  const updates = {
    status: newStatus,
    updatedAt: admin.database.ServerValue.TIMESTAMP
  };
  if (adminNotes) {
    updates.adminNotes = adminNotes;
  }
  if (markIssued) {
    updates.certificateIssued = true;
    updates.certificateIssuedAt = admin.database.ServerValue.TIMESTAMP;
  }

  await ref.update(updates);

  functions.logger.info('Certification status updated', {
    submissionId: submissionId,
    newStatus: newStatus,
    markIssued: markIssued,
    adminEmail: callerEmail
  });

  return { success: true, submissionId: submissionId, status: newStatus, certificateIssued: markIssued };
});
