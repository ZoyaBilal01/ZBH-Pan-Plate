/* ==========================================================================
   ZBH Pan & Plate — Cooking Certification Page Controller
   Handles: validation, image compression, parallel upload, RTDB save,
   EmailJS notification, success/error display.
   ========================================================================== */

(function () {
  'use strict';

  var MAX_IMAGES = 5;
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var MAX_IMAGE_WIDTH = 1080;
  var COMPRESS_QUALITY = 0.85;
  var MAX_RETRIES = 3;
  var ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  var SUBMISSION_COOLDOWN_MS = 60000;
  var DUPLICATE_CHECK_WINDOW_MS = 300000;
  var UPLOAD_TIMEOUT_MS = 30000;
  var COMPRESS_TIMEOUT_MS = 10000;
  var DOWNLOAD_URL_TIMEOUT_MS = 10000;
  var EMAIL_TIMEOUT_MS = 15000;

  var uploadedFiles = {};
  var uploadProgress = {};
  var uploadErrors = {};
  var uploadedUrls = {};
  var isSubmitting = false;
  var hasErrorOccurred = false;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatTimestamp(ms) {
    var d = new Date(ms);
    return d.toLocaleString();
  }

  function generateSubmissionId() {
    var ts = Date.now().toString(36);
    var rand = Math.random().toString(36).slice(2, 8);
    return 'cert-' + ts + '-' + rand;
  }

  function getRecipeName(slotIndex) {
    var input = document.querySelector('.cert-recipe-name[data-slot="' + slotIndex + '"]');
    return input ? input.value.trim() : '';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone);
  }

  function withTimeout(promise, ms, errorMessage, id) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          console.error('[Certification] Timeout (' + ms + 'ms) for ' + (id || 'operation'));
          reject(new Error(errorMessage || 'Operation timed out'));
        }, ms);
      })
    ]);
  }

  /* -------------------- Error display -------------------- */

  function showError(message) {
    var errEl = $('#certFormError');
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.add('show');
    }
    console.error('[Certification]', message);
  }

  function clearError() {
    var errEl = $('#certFormError');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('show');
    }
  }

  function showFieldError(fieldId, message) {
    var el = document.getElementById(fieldId + 'Error');
    if (el) { el.textContent = message; el.style.display = 'block'; }
  }

  function clearFieldError(fieldId) {
    var el = document.getElementById(fieldId + 'Error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function setSlotError(slotIndex, message) {
    var errorEl = $('#certFileError-' + slotIndex);
    var slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) { errorEl.textContent = message; errorEl.style.display = 'block'; }
    if (slotEl) slotEl.classList.add('invalid');
  }

  function clearSlotError(slotIndex) {
    var errorEl = $('#certFileError-' + slotIndex);
    var slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (slotEl) slotEl.classList.remove('invalid');
  }

  /* -------------------- Upload progress UI -------------------- */

  function showUploadProgress() {
    var prog = $('#certUploadProgress');
    if (prog) prog.classList.add('show');
    setSubmitLoading(true, true);
  }

  function hideUploadProgress() {
    var prog = $('#certUploadProgress');
    if (prog) prog.classList.remove('show');
    setSubmitLoading(false, false);
  }

  function setSubmitLoading(loading, disabled) {
    var btn = $('#certSubmitBtn');
    var btnText = $('.btn-text');
    var btnLoader = $('.btn-loader');
    if (btn) btn.disabled = disabled;
    if (loading) {
      if (btnText) btnText.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline-block';
    } else {
      if (btnText) btnText.style.display = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  }

  function setStep(text) {
    var stepEl = $('#certUploadStep');
    if (stepEl) stepEl.textContent = text;
  }

  function updateProgressBar(percent, text) {
    var fill = $('#certProgressBar');
    var label = $('#certProgressText');
    if (fill) fill.style.width = Math.round(percent) + '%';
    if (label) label.textContent = text || ('Uploading… ' + Math.round(percent) + '%');
  }

  function refreshOverallProgress() {
    var values = Object.keys(uploadProgress).map(function (k) { return uploadProgress[k] || 0; });
    var total = values.reduce(function (sum, v) { return sum + v; }, 0);
    var avg = values.length > 0 ? total / values.length : 0;
    var completed = Object.keys(uploadProgress).filter(function (k) { return uploadProgress[k] >= 100; }).length;
    var current = Math.min(completed + 1, MAX_IMAGES);
    var pct = Math.round(avg);
    if (pct >= 100) {
      updateProgressBar(100, 'Completed Successfully');
    } else {
      updateProgressBar(pct, 'Image ' + current + ' of ' + MAX_IMAGES);
    }
  }

  /* -------------------- Image compression -------------------- */

  function compressImage(file, callback) {
    var img = new Image();
    var timeoutFired = false;
    var alreadyDone = false;

    function finish(result) {
      if (alreadyDone) return;
      alreadyDone = true;
      clearTimeout(timeoutId);
      callback(result);
    }

    img.onload = function () {
      URL.revokeObjectURL(img.src);
      if (img.width === 0 || img.height === 0) {
        console.error('[Certification] Invalid image dimensions:', file.name);
        finish(file);
        return;
      }
      var width = img.width;
      var height = img.height;
      var ratio = width / height;

      if (width > MAX_IMAGE_WIDTH) {
        width = MAX_IMAGE_WIDTH;
        height = Math.round(width / ratio);
      }

      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      var mimeType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
      try {
        canvas.toBlob(function (blob) {
          if (!blob) {
            console.error('[Certification] Canvas compression failed for file:', file.name);
            finish(file);
            return;
          }
          blob.originalName = file.name;
          blob.lastModified = file.lastModified;
          finish(blob);
        }, mimeType, COMPRESS_QUALITY);
      } catch (e) {
        console.error('[Certification] Compression error for file:', file.name, e);
        finish(file);
      }
    };

    img.onerror = function () {
      URL.revokeObjectURL(img.src);
      console.error('[Certification] Image load error for file:', file.name);
      finish(file);
    };

    var timeoutId = setTimeout(function () {
      if (alreadyDone) return;
      timeoutFired = true;
      URL.revokeObjectURL(img.src);
      console.warn('[Certification] Image load timeout, using original file:', file.name);
      finish(file);
    }, COMPRESS_TIMEOUT_MS);

    try {
      img.src = URL.createObjectURL(file);
    } catch (e) {
      console.error('[Certification] Failed to create object URL for file:', file.name, e);
      finish(file);
    }
  }

  /* -------------------- File handling -------------------- */

  function handleFileSelect(e, slotIndex) {
    var input = e.target;
    var files = input.files;

    clearSlotError(slotIndex);
    clearPreview(slotIndex);

    if (!files || !files.length) return;

    var file = files[0];

    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      setSlotError(slotIndex, 'Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSlotError(slotIndex, 'File is too large. Maximum size is 5MB.');
      return;
    }

    uploadedFiles[slotIndex] = file;
    renderPreview(slotIndex, file);
  }

  function renderPreview(slotIndex, file) {
    var previewWrapper = $('#certPreview-' + slotIndex);
    if (!previewWrapper) return;

    var url = URL.createObjectURL(file);
    var img = document.createElement('img');
    img.src = url;
    img.alt = 'Preview';

    var info = document.createElement('div');
    info.className = 'cert-preview-info';
    var nameEl = document.createElement('span');
    nameEl.className = 'cert-preview-name';
    nameEl.textContent = file.name;
    var sizeEl = document.createElement('span');
    sizeEl.className = 'cert-preview-size';
    sizeEl.textContent = formatFileSize(file.size);
    info.appendChild(nameEl);
    info.appendChild(sizeEl);

    var removeBtn = document.createElement('button');
    removeBtn.className = 'cert-preview-remove';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '×';
    removeBtn.setAttribute('aria-label', 'Remove photo');
    removeBtn.addEventListener('click', function () {
      URL.revokeObjectURL(url);
      delete uploadedFiles[slotIndex];
      previewWrapper.innerHTML = '';
      var errEl = $('#certFileError-' + slotIndex);
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      var slotEl = $('#certSlot-' + slotIndex);
      if (slotEl) slotEl.classList.remove('invalid');
    });

    var row = document.createElement('div');
    row.className = 'cert-preview';
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(removeBtn);

    previewWrapper.innerHTML = '';
    previewWrapper.appendChild(row);
  }

  function clearPreview(slotIndex) {
    var previewWrapper = $('#certPreview-' + slotIndex);
    if (previewWrapper) previewWrapper.innerHTML = '';
    delete uploadedFiles[slotIndex];
  }

  function initUploadSlots() {
    var fileInputs = $$('.cert-file-input');
    fileInputs.forEach(function (input) {
      var slotIndex = parseInt(input.getAttribute('data-slot'), 10);
      input.addEventListener('change', function (e) {
        handleFileSelect(e, slotIndex);
      });
    });

    var uploadAreas = $$('.cert-upload-area');
    uploadAreas.forEach(function (area) {
      area.addEventListener('click', function () {
        var slotIndex = parseInt(this.getAttribute('for').replace('certFile-', ''), 10);
        var fileInput = document.getElementById('certFile-' + slotIndex);
        if (fileInput) fileInput.click();
      });
    });
  }

  /* -------------------- Validation -------------------- */

  function validateForm() {
    clearError();
    var hasError = false;

    ['certFullName', 'certCity', 'certCountry', 'certWhatsApp', 'certEmail', 'certAge'].forEach(function (id) {
      clearFieldError(id);
    });
    ['certNotes'].forEach(function (id) {
      var el = document.getElementById(id + 'Error');
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });

    var fullName = $('#certFullName').value.trim();
    var city = $('#certCity').value.trim();
    var country = $('#certCountry').value.trim();
    var whatsapp = $('#certWhatsApp').value.trim();
    var email = $('#certEmail').value.trim();
    var age = $('#certAge').value.trim();

    if (!fullName) { showFieldError('certFullName', 'Please enter your full name'); hasError = true; }
    if (!city) { showFieldError('certCity', 'Please enter your city'); hasError = true; }
    if (!country) { showFieldError('certCountry', 'Please enter your country'); hasError = true; }
    if (!whatsapp) {
      showFieldError('certWhatsApp', 'Please enter your WhatsApp number');
      hasError = true;
    } else if (!isValidPhone(whatsapp)) {
      showFieldError('certWhatsApp', 'Please enter a valid phone number');
      hasError = true;
    }
    if (!email) {
      showFieldError('certEmail', 'Please enter your email address');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError('certEmail', 'Please enter a valid email address');
      hasError = true;
    }
    if (age) {
      var ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        showFieldError('certAge', 'Please enter a valid age');
        hasError = true;
      }
    }

    for (var i = 0; i < MAX_IMAGES; i++) {
      var name = getRecipeName(i);
      if (!name) { setSlotError(i, 'Please enter a recipe name'); hasError = true; }
    }

    for (var j = 0; j < MAX_IMAGES; j++) {
      if (!uploadedFiles[j]) { setSlotError(j, 'Please upload an image'); hasError = true; }
    }

    if (hasError) {
      showError('Please fill in all required fields and upload 5 images.');
      return null;
    }

    return {
      fullName: fullName,
      city: city,
      country: country,
      whatsappNumber: whatsapp,
      email: email,
      age: age ? parseInt(age, 10) : null,
      notes: $('#certNotes').value.trim()
    };
  }

  /* -------------------- Spam prevention -------------------- */

  function checkSubmissionCooldown() {
    var key = 'zbh_cert_last_submit';
    var last = parseInt(localStorage.getItem(key) || '0', 10);
    var now = Date.now();
    if (now - last < SUBMISSION_COOLDOWN_MS) {
      return Math.ceil((SUBMISSION_COOLDOWN_MS - (now - last)) / 1000);
    }
    localStorage.setItem(key, String(now));
    return 0;
  }

  function checkDuplicateSubmission(formData) {
    var key = 'zbh_cert_dup_' + btoa(formData.email || '') + '_' + btoa(formData.fullName || '');
    var last = parseInt(localStorage.getItem(key) || '0', 10);
    var now = Date.now();
    if (now - last < DUPLICATE_CHECK_WINDOW_MS) return true;
    localStorage.setItem(key, String(now));
    return false;
  }

  /* -------------------- Upload + Email -------------------- */

  function uploadImageWithRetry(file, slotIndex, submissionId, bucket) {
    var compressed = null;
    var originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var fileName = submissionId + '/' + slotIndex + '_' + originalName;
    var storageRef = bucket.child('certifications/' + fileName);
    var attempt = 0;

    function tryUpload() {
      attempt++;
      uploadProgress[slotIndex] = 0;

      var task = storageRef.put(compressed);
      var taskTimeout = null;

      return new Promise(function (resolve, reject) {
        taskTimeout = setTimeout(function () {
          console.error('[Certification] Upload timeout (slot ' + slotIndex + ')');
          try { task.cancel(); } catch (e) { /* ignore */ }
          handleUploadError(new Error('Upload timeout'));
        }, UPLOAD_TIMEOUT_MS);

        task.on('state_changed',
          function (snapshot) {
            if (taskTimeout) clearTimeout(taskTimeout);
            var pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            uploadProgress[slotIndex] = pct;
            refreshOverallProgress();
          },
          function (err) {
            if (taskTimeout) clearTimeout(taskTimeout);
            console.error('[Certification] Upload error (slot ' + slotIndex + ', attempt ' + attempt + '):', err);
            handleUploadError(err);
          },
          function () {
            if (taskTimeout) clearTimeout(taskTimeout);
            uploadProgress[slotIndex] = 100;
            refreshOverallProgress();

            storageRef.getDownloadURL().then(function (url) {
              uploadedUrls[slotIndex] = url;
              resolve({ slot: slotIndex, path: 'certifications/' + fileName, name: file.name, url: url });
            }).catch(function (urlErr) {
              console.error('[Certification] getDownloadURL failed (slot ' + slotIndex + '):', urlErr);
              resolve({ slot: slotIndex, path: 'certifications/' + fileName, name: file.name, url: null });
            });
          }
        );
      });

      function handleUploadError(err) {
        if (attempt < MAX_RETRIES) {
          setTimeout(function () {
            tryUpload().then(resolve, reject);
          }, 500);
        } else {
          delete uploadProgress[slotIndex];
          setSlotError(slotIndex, 'Upload failed after ' + MAX_RETRIES + ' attempts.');
          reject({ slot: slotIndex, error: err });
        }
      }
    }

    return new Promise(function (resolve, reject) {
      compressImage(file, function (compressedResult) {
        compressed = compressedResult;
        tryUpload().then(resolve, reject);
      });
    });
  }

  async function uploadAllImages(submissionId) {
    if (typeof firebase === 'undefined' || !firebase.storage) {
      console.error('[Certification] Firebase Storage not available');
      throw { type: 'upload', slot: -1, error: 'Firebase Storage not available' };
    }
    var storage = firebase.storage();
    var bucket = storage.ref();

    var uploadPromises = [];
    for (var i = 0; i < MAX_IMAGES; i++) {
      var file = uploadedFiles[i];
      if (!file) { uploadPromises.push(Promise.resolve(null)); continue; }
      uploadProgress[i] = 0;
      uploadPromises.push(uploadImageWithRetry(file, i, submissionId, bucket));
    }
    refreshOverallProgress();

    var results;
    try {
      results = await withTimeout(Promise.all(uploadPromises), UPLOAD_TIMEOUT_MS * MAX_IMAGES, 'Upload timed out', 'overall-upload');
    } catch (err) {
      console.error('[Certification] Upload failed:', err);
      throw { type: 'upload', slot: (err && err.slot !== undefined) ? err.slot : -1, error: err };
    }

    return results.filter(function (r) { return r !== null; });
  }

  /* -------------------- Email -------------------- */

  var EMAILJS_CONFIG_LOCAL = {
    publicKey: 'bT9lDDE2RTnAELUSl',
    serviceId: 'service_1olscao',
    templateId: 'template_kakm23g'
  };

  function buildEmailParams(submissionId, formData, recipeNames, imageResults) {
    var imageLinks = imageResults.map(function (r, idx) {
      var recipeName = recipeNames[idx] || ('Recipe ' + (idx + 1));
      var url = r.url || '(upload failed - see admin panel for details)';
      return 'Image ' + (idx + 1) + ' (' + recipeName + '): ' + url;
    }).join('\n');

    return {
      to_email: 'zoyabilal01@gmail.com',
      submission_id: submissionId,
      applicant_name: formData.fullName,
      applicant_email: formData.email,
      whatsapp_number: formData.whatsappNumber,
      applicant_city: formData.city,
      applicant_country: formData.country,
      applicant_age: formData.age ? String(formData.age) : 'Not provided',
      applicant_notes: formData.notes || '',
      date_time: formatTimestamp(Date.now()),
      recipe_names: recipeNames.join(', '),
      image_links: imageLinks
    };
  }

  function sendEmailViaEmailJS(params) {
    return new Promise(function (resolve, reject) {
      if (typeof window.emailjs === 'undefined') {
        console.error('[Certification] EmailJS SDK not loaded');
        reject(new Error('EmailJS SDK not loaded'));
        return;
      }
      try {
        window.emailjs.send(EMAILJS_CONFIG_LOCAL.serviceId, EMAILJS_CONFIG_LOCAL.templateId, params)
          .then(function (response) {
            console.log('[Certification] EmailJS send successful:', response);
            resolve(response);
          })
          .catch(function (error) {
            console.error('[Certification] EmailJS send failed:', error);
            reject(error);
          });
      } catch (e) {
        console.error('[Certification] EmailJS send exception:', e);
        reject(e);
      }
    });
  }

  function sendEmailViaFunction(submissionId, formData, recipeNames, imagePaths) {
    var fn = firebase.functions().httpsCallable('notifyAdminCertification');
    return fn({
      submissionId: submissionId,
      fullName: formData.fullName,
      email: formData.email,
      city: formData.city,
      country: formData.country,
      whatsappNumber: formData.whatsappNumber,
      age: formData.age,
      notes: formData.notes,
      recipeNames: recipeNames,
      imagePaths: imagePaths,
      createdAt: Date.now()
    });
  }

  /* -------------------- Success display -------------------- */

  var SUCCESS_MESSAGES = {
    one: '✅ Application Submitted Successfully!',
    two: '👨‍🍳 Your cooking dishes have been received.\nThe website owner will now review your cooking proof.',
    three: '📱 If your application is approved, you will receive a WhatsApp message with the PKR 500 payment details.\nAfter payment is confirmed, your official ZBH Pan & Plate Cooking Certificate will be sent to you.'
  };

  function showSuccess() {
    $('#certificationForm').style.display = 'none';
    var successOne = $('#certSuccessOne');
    var successTwo = $('#certSuccessTwo');
    var successThree = $('#certSuccessThree');
    if (successOne) { successOne.textContent = SUCCESS_MESSAGES.one; successOne.style.display = 'block'; }
    if (successTwo) { successTwo.textContent = SUCCESS_MESSAGES.two; successTwo.style.display = 'block'; }
    if (successThree) { successThree.textContent = SUCCESS_MESSAGES.three; successThree.style.display = 'block'; }
    $('#certSuccess').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* -------------------- Main submit handler -------------------- */

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearError();
    var cooldownSeconds = checkSubmissionCooldown();
    if (cooldownSeconds > 0) {
      showError('Please wait ' + cooldownSeconds + ' more seconds before submitting again.');
      return;
    }

    var formData = validateForm();
    if (!formData) return;

    if (checkDuplicateSubmission(formData)) {
      showError('A recent submission with this information was already sent. Please wait before submitting again.');
      return;
    }

    isSubmitting = true;
    hasErrorOccurred = false;
    showUploadProgress();
    setStep('Uploading…');
    updateProgressBar(0, 'Image 1 of ' + MAX_IMAGES);
    Object.keys(uploadProgress).forEach(function (k) { delete uploadProgress[k]; });
    Object.keys(uploadErrors).forEach(function (k) { delete uploadErrors[k]; });
    Object.keys(uploadedUrls).forEach(function (k) { delete uploadedUrls[k]; });

    var submissionId = generateSubmissionId();
    var recipeNames = [];
    for (var i = 0; i < MAX_IMAGES; i++) recipeNames.push(getRecipeName(i));

    var uploadResults, imagePaths;

    try {
      uploadResults = await uploadAllImages(submissionId);
      imagePaths = uploadResults.map(function (r) { return r.path; });

      setStep('Preparing Email…');
      updateProgressBar(55, 'Preparing Email…');

      if (typeof firebase === 'undefined' || !firebase.database) {
        console.error('[Certification] Firebase database not available');
        throw new Error('Database not available');
      }
      var timestamp = firebase.database.ServerValue.TIMESTAMP;
      var submissionData = {
        submissionId: submissionId,
        fullName: formData.fullName,
        email: formData.email,
        city: formData.city,
        country: formData.country,
        whatsappNumber: formData.whatsappNumber,
        age: formData.age,
        notes: formData.notes,
        recipeNames: recipeNames,
        imagePaths: imagePaths,
        status: 'pending',
        certificateIssued: false,
        submittedAt: timestamp,
        updatedAt: timestamp
      };

      try {
        await firebase.database().ref('certifications/' + submissionId).set(submissionData);
      } catch (dbErr) {
        console.error('[Certification] Failed to save submission to RTDB:', dbErr);
      }

      setStep('Sending Email…');
      updateProgressBar(70, 'Sending Email…');

      var emailSent = false;
      try {
        var params = buildEmailParams(submissionId, formData, recipeNames, uploadResults);
        await withTimeout(sendEmailViaEmailJS(params), EMAIL_TIMEOUT_MS, 'EmailJS send timed out', 'emailjs-send');
        emailSent = true;
      } catch (emailjsErr) {
        console.error('[Certification] EmailJS failed, falling back to SendGrid:', emailjsErr);
        try {
          await withTimeout(sendEmailViaFunction(submissionId, formData, recipeNames, imagePaths), EMAIL_TIMEOUT_MS, 'SendGrid fallback timed out', 'sendgrid-fallback');
          emailSent = true;
        } catch (funcErr) {
          console.error('[Certification] SendGrid fallback also failed:', funcErr);
        }
      }

      updateProgressBar(100, 'Completed Successfully');
      setStep('Completed Successfully');

      if (emailSent) {
        setTimeout(function () {
          hideUploadProgress();
          setStep('');
          showSuccess();
        }, 100);
      } else {
        hideUploadProgress();
        setStep('');
        showError('Your application was saved successfully! However, the notification email could not be sent. Please try again later or contact support.');
        $('#certificationForm').style.display = 'none';
        isSubmitting = false;
      }

    } catch (err) {
      hasErrorOccurred = true;
      hideUploadProgress();
      setStep('');

      if (err && err.type === 'upload') {
        showError('One or more images failed to upload. Please check your files and try again.');
      } else if (err && err.message && (err.message.indexOf('network') !== -1 || err.message.indexOf('Network') !== -1)) {
        showError('Connection lost. Please check your internet connection and try again.');
      } else {
        console.error('[Certification] Submission error:', err);
        showError('Something went wrong during submission: ' + (err && err.message ? err.message : err));
      }

      isSubmitting = false;
    }
  }

  /* -------------------- Init -------------------- */

  function init() {
    var form = $('#certificationForm');
    if (!form) return;

    initUploadSlots();

    window.addEventListener('offline', function () {
      showError('Connection lost. Please check your internet connection and try again.');
    });
    window.addEventListener('online', function () {
      var errEl = $('#certFormError');
      if (errEl && errEl.classList.contains('show') && errEl.textContent.indexOf('Connection lost') !== -1) {
        clearError();
      }
    });

    form.addEventListener('submit', handleSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Certification = {
    validateForm: validateForm,
    formatFileSize: formatFileSize,
    formatTimestamp: formatTimestamp
  };
})();
