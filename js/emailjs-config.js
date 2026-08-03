/* ==========================================================================
   ZBH Pan & Plate — EmailJS Configuration
   
   For static hosting (GitHub Pages) where no backend is available, this module
   integrates EmailJS as a fallback email provider. When a Firebase backend
   exists (Cloud Functions + SendGrid), the keys are stored in Functions
   environment config and retrieved via a secure callable — they are NEVER
   hardcoded in this file.

   Setup (store keys in Firebase Functions config):
     firebase functions:config --set emailjs.public_key="YOUR_KEY" \
       emailjs.service_id="YOUR_SERVICE_ID" \
       emailjs.template_id="YOUR_TEMPLATE_ID"

   Then deploy: firebase deploy --only functions

   To use the EmailJS fallback directly (not recommended for production
   when a backend exists), set window.__EMAILJS_FALLBACK__ = {
     publicKey: '...', serviceId: '...', templateId: '...'
   } before this script loads.
   ========================================================================== */

(function () {
  'use strict';

  let _config = null;
  let _sdkLoaded = false;

  function loadEmailJsSdk(callback) {
    if (typeof window.emailjs !== 'undefined') {
      _sdkLoaded = true;
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/emailjs-com@4/dist/emailjs.min.js';
    script.onload = function () {
      _sdkLoaded = true;
      if (typeof window.emailjs !== 'undefined') {
        callback();
      } else {
        callback(new Error('EmailJS SDK failed to load'));
      }
    };
    script.onerror = function () {
      callback(new Error('Failed to load EmailJS SDK'));
    };
    document.head.appendChild(script);
  }

  function getConfigViaFunction() {
    return firebase.functions().httpsCallable('getEmailJsConfig')()
      .then(function (result) {
        if (result.data && result.data.configured) {
          return result.data;
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  function sendViaEmailJs(config, params) {
    return new Promise(function (resolve, reject) {
      loadEmailJsSdk(function (err) {
        if (err) return reject(err);
        if (typeof window.emailjs === 'undefined') return reject(new Error('EmailJS not available'));
        window.emailjs.init(config.publicKey);
        window.emailjs.send(config.serviceId, config.templateId, params)
          .then(function () { resolve(); })
          .catch(function (e) { reject(e); });
      });
    });
  }

  window.EmailJSConfig = {
    loadEmailJsSdk: loadEmailJsSdk,
    getConfigViaFunction: getConfigViaFunction,
    sendViaEmailJs: sendViaEmailJs,
    getSdkLoaded: function () { return _sdkLoaded; }
  };
})();
