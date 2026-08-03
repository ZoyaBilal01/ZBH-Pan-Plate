/* ==========================================================================
   ZBH Pan & Plate — EmailJS Integration
   Uses the website owner's EmailJS credentials for client-side email sending.
    The public key is designed for frontend use; Service ID and Template ID
   control what emails can be sent and to whom.
   ========================================================================== */

(function () {
  'use strict';

  const EMAILJS_CONFIG = {
    publicKey: 'bT9lDDE2RTnAELUSl',
    serviceId: 'service_1olscao',
    templateId: 'template_kakm23g'
  };

  let _sdkLoaded = false;
  let _sdkError = null;

  function loadEmailJsSdk(callback) {
    if (typeof window.emailjs !== 'undefined') {
      _sdkLoaded = true;
      if (typeof window.emailjs.init === 'function') {
        try { window.emailjs.init(EMAILJS_CONFIG.publicKey); } catch (e) { _sdkError = e; }
      }
      callback(_sdkError || null);
      return;
    }

    var existing = document.querySelector('script[data-emailjs-sdk]');
    if (existing) {
      existing.addEventListener('load', function () {
        _sdkLoaded = true;
        try { window.emailjs.init(EMAILJS_CONFIG.publicKey); } catch (e) { _sdkError = e; }
        callback(_sdkError || null);
      });
      existing.addEventListener('error', function () { callback(new Error('EmailJS SDK failed to load')); });
      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/emailjs-com@4/dist/emailjs.min.js';
    script.setAttribute('data-emailjs-sdk', 'true');
    script.async = true;
    script.onload = function () {
      _sdkLoaded = true;
      if (typeof window.emailjs !== 'undefined' && typeof window.emailjs.init === 'function') {
        try { window.emailjs.init(EMAILJS_CONFIG.publicKey); } catch (e) { _sdkError = e; }
      }
      callback(_sdkError || null);
    };
    script.onerror = function () {
      callback(new Error('Failed to load EmailJS SDK'));
    };
    document.head.appendChild(script);
  }

  function sendEmail(templateParams) {
    return new Promise(function (resolve, reject) {
      if (!_sdkLoaded) {
        loadEmailJsSdk(function (err) {
          if (err) return reject(err);
          doSend(templateParams, resolve, reject);
        });
      } else {
        doSend(templateParams, resolve, reject);
      }
    });

    function doSend(params, resolve, reject) {
      if (typeof window.emailjs === 'undefined') {
        return reject(new Error('EmailJS SDK not available'));
      }
      window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, params)
        .then(function (response) { resolve(response); })
        .catch(function (error) { reject(error); });
    }
  }

  window.EmailJSConfig = {
    config: EMAILJS_CONFIG,
    loadEmailJsSdk: loadEmailJsSdk,
    sendEmail: sendEmail,
    getSdkLoaded: function () { return _sdkLoaded; }
  };
})();
