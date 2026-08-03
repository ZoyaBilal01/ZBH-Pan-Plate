/* ==========================================================================
   ZBH Pan & Plate — Firebase Configuration & Initialization
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyA0ahFrorvTUvWv2ziMQu3R--Oj1TexRpI",
  authDomain: "recipe-7debf.firebaseapp.com",
  databaseURL: "https://recipe-7debf-default-rtdb.firebaseio.com",
  projectId: "recipe-7debf",
  storageBucket: "recipe-7debf.firebasestorage.app",
  messagingSenderId: "157297346351",
  appId: "1:157297346351:web:4d7ef1d292ac107b54c3da",
  measurementId: "G-4JR91ZMNKP"
};

(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('[Firebase] SDK not loaded. Verify that the Firebase CDN script tags appear before this file.');
    return;
  }

  // --- Initialize Firebase app (guard against double-init) ---
  if (firebase.apps.length === 0) {
    try {
      firebase.initializeApp(firebaseConfig);
    } catch (error) {
      console.error('[Firebase] initializeApp failed:', error);
      return;
    }
  } else {
    console.warn('[Firebase] App already initialized; reusing existing instance.');
  }

  // --- Auth persistence (LOCAL = survives tab close, survives browser restart) ---
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(function (error) {
      console.warn('[Firebase] Could not set auth persistence to LOCAL:', error.code || error);
    });

  // --- Realtime Database (required for user profiles & favorites) ---
  const database = firebase.database();

  // --- Expose services for modules that need direct access ---
  window.Auth = window.Auth || {};
  window.Auth._services = { auth: auth, database: database };

  // --- Best-effort initialization of optional services ---
  // Each service is initialized independently so a failure in one
  // (e.g. Analytics not linked, Firestore not provisioned) does not
  // break auth or database functionality.
  if (typeof firebase.firestore === 'function') {
    try {
      window.Auth._services.firestore = firebase.firestore();
    } catch (e) {
      console.warn('[Firebase] Firestore unavailable:', e.message || e);
    }
  }
  if (typeof firebase.storage === 'function') {
    try {
      window.Auth._services.storage = firebase.storage();
    } catch (e) {
      console.warn('[Firebase] Storage unavailable:', e.message || e);
    }
  }
  if (typeof firebase.analytics === 'function') {
    try {
      window.Auth._services.analytics = firebase.analytics();
    } catch (e) {
      console.warn('[Firebase] Analytics unavailable:', e.message || e);
    }
  }

  console.log('[Firebase] Initialized — projectId:', firebaseConfig.projectId,
    '| authDomain:', firebaseConfig.authDomain);
})();
