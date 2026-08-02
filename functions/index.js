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
  return ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.indexOf(normalized) !== -1;
}

exports.sendNewUserNotification = functions.database
  .ref('users/{uid}/profile')
  .onCreate(async (snap, context) => {
    const profile = (snap.val && snap.val()) || {};
    const name = profile.name || 'Unknown';
    const email = profile.email || context.params.uid;
    const region = profile.region || 'Unknown';
    const provider = profile.provider || 'unknown';
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
    const providerEsc = escapeHtml(provider);
    const createdAtEsc = escapeHtml(createdAt);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>New Account Sign-up Notification</h2>
        <table style="border-collapse: collapse;">
          <tr><td style="padding:4px 8px;"><strong>Name:</strong></td><td>${nameEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Email:</strong></td><td>${emailEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Country/Region:</strong></td><td>${regionEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Sign-up date &amp; time:</strong></td><td>${createdAtEsc}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Login method:</strong></td><td>${providerEsc}</td></tr>
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
        `Login method: ${provider}\n` +
        `(No passwords or tokens included.)`,
      html: html
    };

    try {
      await sgMail.send(msg);
      functions.logger.info('New-user notification sent to', to);
    } catch (err) {
      functions.logger.error('Failed to send new-user notification:', err);
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
