/* ==========================================================================
   ZBH Pan & Plate — Cooking Certification Page Controller
   Handles form validation, image compression + parallel upload (Firebase
   Storage), submission storage (Firebase RTDB), and email notification
   via EmailJS (primary) with SendGrid Cloud Function fallback.
   ========================================================================== */

(function () {
  'use strict';

  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const MAX_IMAGE_WIDTH = 1080;
  const COMPRESS_QUALITY = 0.85;
  const MAX_RETRIES = 3;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const SUBMISSION_COOLDOWN_MS = 60000;
  const DUPLICATE_CHECK_WINDOW_MS = 300000;

  let uploadedFiles = {}; // slotIndex -> file object
  let uploadProgress = {}; // slotIndex -> 0..100
  let uploadErrors = {};
  let uploadedUrls = {}; // slotIndex -> download URL
  let isSubmitting = false;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatTime(ms) {
    const d = new Date(ms);
    return d.toLocaleString();
  }

  function generateSubmissionId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return 'cert-' + ts + '-' + rand;
  }

  function getRecipeName(slotIndex) {
    const input = document.querySelector('.cert-recipe-name[data-slot="' + slotIndex + '"]');
    return input ? input.value.trim() : '';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone);
  }

  /* -------------------- Error handling -------------------- */

  function showError(message) {
    const errEl = $('#certFormError');
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.add('show');
    }
  }

  function clearError() {
    const errEl = $('#certFormError');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('show');
    }
  }

  function showFieldError(fieldId, message) {
    const el = document.getElementById(fieldId + 'Error');
    if (el) { el.textContent = message; el.style.display = 'block'; }
  }

  function clearFieldError(fieldId) {
    const el = document.getElementById(fieldId + 'Error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function setSlotError(slotIndex, message) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) { errorEl.textContent = message; errorEl.style.display = 'block'; }
    if (slotEl) slotEl.classList.add('invalid');
  }

  function clearSlotError(slotIndex) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (slotEl) slotEl.classList.remove('invalid');
  }

  /* -------------------- Image compression -------------------- */

  function compressImage(file, callback) {
    const img = new Image();
    img.onload = function () {
      let { width, height } = img;
      const ratio = width / height;

      if (width > MAX_IMAGE_WIDTH) {
        width = MAX_IMAGE_WIDTH;
        height = Math.round(width / ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
      canvas.toBlob(function (blob) {
        blob.originalName = file.name;
        blob.lastModified = file.lastModified;
        callback(blob);
      }, mimeType, COMPRESS_QUALITY);
    };
    img.onerror = function () { callback(file); };
    img.src = URL.createObjectURL(file);
  }

  /* -------------------- File handling -------------------- */

  function handleFileSelect(e, slotIndex) {
    const input = e.target;
    const files = input.files;

    clearSlotError(slotIndex);
    clearPreview(slotIndex);

    if (!files || files.length === 0) return;

    const file = files[0];

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
    const previewWrapper = $('#certPreview-' + slotIndex);
    if (!previewWrapper) return;

    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Preview';

    const info = document.createElement('div');
    info.className = 'cert-preview-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'cert-preview-name';
    nameEl.textContent = file.name;
    const sizeEl = document.createElement('span');
    sizeEl.className = 'cert-preview-size';
    sizeEl.textContent = formatFileSize(file.size);
    info.appendChild(nameEl);
    info.appendChild(sizeEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'cert-preview-remove';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '🗑';
    removeBtn.setAttribute('aria-label', 'Remove photo');
    removeBtn.addEventListener('click', function () {
      URL.revokeObjectURL(url);
      delete uploadedFiles[slotIndex];
      previewWrapper.innerHTML = '';
      const errEl = $('#certFileError-' + slotIndex);
      if (errEl) errEl.textContent = '';
      const slotEl = $('#certSlot-' + slotIndex);
      if (slotEl) slotEl.classList.remove('invalid');
    });

    const row = document.createElement('div');
    row.className = 'cert-preview';
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(removeBtn);

    previewWrapper.innerHTML = '';
    previewWrapper.appendChild(row);
  }

  function clearPreview(slotIndex) {
    const previewWrapper = $('#certPreview-' + slotIndex);
    if (previewWrapper) previewWrapper.innerHTML = '';
    delete uploadedFiles[slotIndex];
  }

  function initUploadSlots() {
    const fileInputs = $$('.cert-file-input');
    fileInputs.forEach(function (input) {
      const slotIndex = parseInt(input.getAttribute('data-slot'), 10);
      input.addEventListener('change', function (e) {
        handleFileSelect(e, slotIndex);
      });
    });

    const uploadAreas = $$('.cert-upload-area');
    uploadAreas.forEach(function (area) {
      area.addEventListener('click', function () {
        const slotIndex = parseInt(this.getAttribute('for').replace('certFile-', ''), 10);
        const fileInput = document.getElementById('certFile-' + slotIndex);
        if (fileInput) fileInput.click();
      });
    });
  }

  /* -------------------- Validation -------------------- */

  function validateForm() {
    clearError();
    let hasError = false;

    ['certFullName', 'certCity', 'certCountry', 'certWhatsApp', 'certEmail'].forEach(function (id) {
      clearFieldError(id);
    });

    const fullName = $('#certFullName').value.trim();
    const city = $('#certCity').value.trim();
    const country = $('#certCountry').value.trim();
    const whatsapp = $('#certWhatsApp').value.trim();
    const email = $('#certEmail').value.trim();
    const age = $('#certAge').value.trim();
    const notes = $('#certNotes').value.trim();

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
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        showFieldError('certAge', 'Please enter a valid age');
        hasError = true;
      }
    }

    for (let i = 0; i < MAX_IMAGES; i++) {
      const name = getRecipeName(i);
      if (!name) { setSlotError(i, 'Please enter a recipe name'); hasError = true; }
    }

    for (let i = 0; i < MAX_IMAGES; i++) {
      if (!uploadedFiles[i]) { setSlotError(i, 'Please upload an image'); hasError = true; }
    }

    if (hasError) {
      showError('Please fill in all required fields and upload exactly 5 images.');
      return false;
    }

    return {
      fullName: fullName,
      city: city,
      country: country,
      whatsappNumber: whatsapp,
      email: email,
      age: age ? parseInt(age, 10) : null,
      notes: notes
    };
  }

  /* -------------------- Submission cooldown / spam prevention -------------------- */

  function checkSubmissionCooldown() {
    const key = 'zbh_cert_last_submit';
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    const now = Date.now();
    if (now - last < SUBMISSION_COOLDOWN_MS) {
      return Math.ceil((SUBMISSION_COOLDOWN_MS - (now - last)) / 1000);
    }
    localStorage.setItem(key, String(now));
    return 0;
  }

  function checkDuplicateSubmission(formData) {
    const key = 'zbh_cert_dup_' + btoa(formData.email || '') + '_' + btoa(formData.fullName || '');
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    const now = Date.now();
    if (now - last < DUPLICATE_CHECK_WINDOW_MS) return true;
    localStorage.setItem(key, String(now));
    return false;
  }

  /* -------------------- Upload progress UI -------------------- */

  function showUploadProgress() {
    const prog = $('#certUploadProgress');
    if (prog) prog.classList.add('show');
    setSubmitLoading(true, true);
  }

  function hideUploadProgress() {
    const prog = $('#certUploadProgress');
    if (prog) prog.classList.remove('show');
    setSubmitLoading(false, false);
  }

  function setSubmitLoading(loading, disabled) {
    const btn = $('#certSubmitBtn');
    const btnText = $('.btn-text');
    const btnLoader = $('.btn-loader');
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
    const stepEl = $('#certUploadStep');
    if (stepEl) stepEl.textContent = text;
  }

  function updateProgressBar(percent, text) {
    const fill = $('#certProgressBar');
    const label = $('#certProgressText');
    if (fill) fill.style.width = Math.round(percent) + '%';
    if (label) label.textContent = text || ('Uploading… ' + Math.round(percent) + '%');
  }

  function refreshOverallProgress() {
    const values = Object.keys(uploadProgress).map(function (k) { return uploadProgress[k] || 0; });
    const total = values.reduce(function (sum, v) { return sum + v; }, 0);
    const avg = values.length > 0 ? total / values.length : 0;
    const completed = Object.keys(uploadProgress).filter(function (k) { return uploadProgress[k] >= 100; }).length;
    const current = Math.min(completed + 1, MAX_IMAGES);
    updateProgressBar(avg, 'Image ' + current + ' of ' + MAX_IMAGES);
  }

  /* -------------------- Parallel upload with retry -------------------- */

  async function compressAllImages() {
    const promises = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      const file = uploadedFiles[i];
      if (!file) { promises.push(Promise.resolve(null)); continue; }
      promises.push(new Promise(function (resolve) {
        compressImage(file, function (compressed) {
          resolve({ slot: i, file: compressed, originalName: file.name });
        });
      }));
    }
    return Promise.all(promises);
  }

  function uploadWithRetry(storageRef, file, slotIndex, attempt) {
    attempt = attempt || 1;
    return new Promise(function (resolve, reject) {
      const task = storageRef.put(file);

      task.on('state_changed',
        function (snapshot) {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          uploadProgress[slotIndex] = pct;
          refreshOverallProgress();
        },
        function (err) {
          if (attempt < MAX_RETRIES) {
            uploadProgress[slotIndex] = 0;
            setTimeout(function () {
              uploadWithRetry(storageRef, file, slotIndex, attempt + 1).then(resolve, reject);
            }, 1000);
          } else {
            uploadProgress[slotIndex] = 0;
            delete uploadProgress[slotIndex];
            reject({ slot: slotIndex, error: err });
          }
        },
        function () {
          uploadProgress[slotIndex] = 100;
          refreshOverallProgress();
          resolve();
        }
      );
    });
  }

  async function uploadAllImages(submissionId) {
    const storage = firebase.storage();
    const bucket = storage.ref();

    setStep('Uploading…');
    const compressedList = await compressAllImages();
    compressedList.forEach(function (item) {
      if (item) uploadProgress[item.slot] = 0;
    });
    refreshOverallProgress();

    const uploadPromises = compressedList.map(function (item) {
      if (!item) return Promise.resolve(null);

      const fileName = submissionId + '/' + item.slot + '_' + item.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = bucket.child('certifications/' + fileName);

      return uploadWithRetry(storageRef, item.file, item.slot)
        .then(async function () {
          const url = await storageRef.getDownloadURL();
          uploadedUrls[item.slot] = url;
          return { slot: item.slot, path: 'certifications/' + fileName, name: item.originalName, url: url };
        })
        .catch(function (err) {
          uploadErrors[err.slot] = err.error;
          setSlotError(err.slot, 'Upload failed after ' + MAX_RETRIES + ' attempts.');
          throw err;
        });
    });

    let results = [];
    try {
      results = await Promise.all(uploadPromises);
    } catch (err) {
      throw { type: 'upload', slot: err.slot };
    }

    return results.filter(function (r) { return r !== null; });
  }

  /* -------------------- Email notification via EmailJS -------------------- */

  function buildEmailParams(submissionId, formData, recipeNames, imageResults) {
    const imageLinks = imageResults.map(function (r, idx) {
      return 'Image ' + (idx + 1) + ' (' + (recipeNames[idx] || 'Recipe ' + (idx + 1)) + '): ' + r.url;
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
      date_time: formatTime(Date.now()),
      recipe_names: recipeNames.join(', '),
      image_links: imageLinks
    };
  }

  async function sendEmailViaEmailJS(submissionId, formData, recipeNames, imageResults) {
    if (typeof EmailJSConfig === 'undefined') {
      throw new Error('EmailJS not configured');
    }

    const params = buildEmailParams(submissionId, formData, recipeNames, imageResults);

    return new Promise(function (resolve, reject) {
      EmailJSConfig.loadEmailJsSdk(function (err) {
        if (err) return reject(err);
        EmailJSConfig.sendEmail(params)
          .then(function (response) { resolve(response); })
          .catch(function (error) { reject(error); });
      });
    });
  }

  async function sendEmailViaFunction(submissionId, formData, recipeNames, imagePaths) {
    const notifyFn = firebase.functions().httpsCallable('notifyAdminCertification');
    return notifyFn({
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

  /* -------------------- Success message -------------------- */

  const SUCCESS_MESSAGES = {
    one: '✅ Application Submitted Successfully!',
    two: '👨‍🍳 Your cooking dishes have been received and are now under review.',
    three: '📱 If approved, the owner will contact you on WhatsApp with the PKR 500 payment details. After payment is confirmed, your official Cooking Certificate will be sent to you.'
  };

  function showSuccess() {
    $('#certificationForm').style.display = 'none';
    const successOne = $('#certSuccessOne');
    const successTwo = $('#certSuccessTwo');
    const successThree = $('#certSuccessThree');
    if (successOne) successOne.textContent = SUCCESS_MESSAGES.one;
    if (successTwo) successTwo.textContent = SUCCESS_MESSAGES.two;
    if (successThree) successThree.textContent = SUCCESS_MESSAGES.three;
    $('#certSuccess').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* -------------------- Main submit handler -------------------- */

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const cooldownSeconds = checkSubmissionCooldown();
    if (cooldownSeconds > 0) {
      showError('Please wait ' + cooldownSeconds + ' more seconds before submitting again.');
      return;
    }

    const formData = validateForm();
    if (!formData) return;

    if (checkDuplicateSubmission(formData)) {
      showError('A recent submission with this information was already sent. Please wait before submitting again.');
      return;
    }

    isSubmitting = true;
    showUploadProgress();
    setStep('Uploading…');
    updateProgressBar(0, 'Image 1 of ' + MAX_IMAGES);
    Object.keys(uploadProgress).forEach(function (k) { delete uploadProgress[k]; });
    Object.keys(uploadErrors).forEach(function (k) { delete uploadErrors[k]; });
    Object.keys(uploadedUrls).forEach(function (k) { delete uploadedUrls[k]; });

    const submissionId = generateSubmissionId();
    const recipeNames = [];
    for (let i = 0; i < MAX_IMAGES; i++) recipeNames.push(getRecipeName(i));

    try {
      const uploadResults = await uploadAllImages(submissionId);
      const imagePaths = uploadResults.map(function (r) { return r.path; });

      setStep('Preparing Email…');
      updateProgressBar(55, 'Preparing Email…');

      const timestamp = firebase.database.ServerValue.TIMESTAMP;
      const submissionData = {
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

      await firebase.database().ref('certifications/' + submissionId).set(submissionData);

      setStep('Sending Email…');
      updateProgressBar(70, 'Sending Email…');

      let emailSent = false;
      try {
        await sendEmailViaEmailJS(submissionId, formData, recipeNames, uploadResults);
        emailSent = true;
      } catch (emailjsErr) {
        console.warn('EmailJS failed, falling back to SendGrid:', emailjsErr);
        try {
          await sendEmailViaFunction(submissionId, formData, recipeNames, imagePaths);
          emailSent = true;
        } catch (funcErr) {
          console.warn('SendGrid fallback also failed:', funcErr);
        }
      }

      updateProgressBar(100, 'Completed Successfully');
      setStep('Completed Successfully');

      if (emailSent) {
        setTimeout(function () {
          hideUploadProgress();
          setStep('');
          showSuccess();
        }, 500);
      } else {
        hideUploadProgress();
        setStep('');
        showError('Your application was received, but the notification email could not be sent. Please try again later.');
        $('#certificationForm').style.display = 'none';
        isSubmitting = false;
      }

    } catch (err) {
      hideUploadProgress();
      setStep('');

      if (err && err.type === 'upload') {
        showError('One or more images failed to upload.');
      } else if (err && err.message && (err.message.indexOf('network') !== -1 || err.message.indexOf('Network') !== -1)) {
        showError('Connection lost. Please try again.');
      } else {
        showError('Something went wrong during submission. Please try again.');
      }

      isSubmitting = false;
    }
  }

  /* -------------------- Init -------------------- */

  function init() {
    const form = $('#certificationForm');
    if (!form) return;

    initUploadSlots();

    window.addEventListener('offline', function () {
      showError('Connection lost. Please try again.');
    });
    window.addEventListener('online', function () {
      const errEl = $('#certFormError');
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
    formatTime: formatTime
  };
})();
