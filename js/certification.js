/* ==========================================================================
   ZBH Pan & Plate — Cooking Certification Page Controller
   Handles form validation, image compression + parallel upload (Firebase
   Storage), submission storage (Firebase RTDB), and admin email
   notification (Firebase Function).
   ========================================================================== */

(function () {
  'use strict';

  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (original upload limit)
  const MAX_IMAGE_WIDTH = 1080; // max width for compressed uploads
  const COMPRESS_QUALITY = 0.85;
  const MAX_RETRIES = 3;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  let uploadedFiles = {}; // slotIndex -> file object

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function clearFieldError(fieldId) {
    const el = document.getElementById(fieldId + 'Error');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function setSlotError(slotIndex, message) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    if (slotEl) slotEl.classList.add('invalid');
  }

  function clearSlotError(slotIndex) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    if (slotEl) slotEl.classList.remove('invalid');
  }

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

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(function (blob) {
        blob.originalName = file.name;
        blob.lastModified = file.lastModified;
        callback(blob);
      }, mimeType, COMPRESS_QUALITY);
    };
    img.onerror = function () {
      callback(file);
    };
    img.src = URL.createObjectURL(file);
  }

  function handleFileSelect(e, slotIndex) {
    const input = e.target;
    const files = input.files;

    clearSlotError(slotIndex);
    clearPreview(slotIndex);

    if (!files || files.length === 0) return;

    const file = files[0];

    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      setSlotError(slotIndex, 'Please select a JPG, JPEG, or PNG image.');
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
      if (!name) {
        setSlotError(i, 'Please enter a recipe name');
        hasError = true;
      }
    }

    for (let i = 0; i < MAX_IMAGES; i++) {
      if (!uploadedFiles[i]) {
        setSlotError(i, 'Please upload an image');
        hasError = true;
      }
    }

    if (hasError) {
      showError('Please fill in all required fields and upload exactly 5 images.');
      return false;
    }

    return true;
  }

  /* -------------------- Upload with progress + retry -------------------- */

  let uploadProgress = {}; // slotIndex -> 0..100
  let uploadErrors = {};

  function showUploadProgress() {
    const prog = $('#certUploadProgress');
    if (prog) prog.classList.add('show');
    setSubmitLoading(true, true);
  }

  function hideUploadProgress() {
    const prog = $('#certUploadProgress');
    if (prog) prog.classList.remove('show');
  }

  function setSubmitLoading(isLoading, isUploading) {
    const btn = $('#certSubmitBtn');
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
    if (isUploading) {
      if (btnLoader) btnLoader.style.display = 'none';
    } else if (btnLoader) {
      btnLoader.style.display = isLoading ? 'inline-block' : 'none';
    }
    btn.disabled = isLoading || isUploading;
  }

  function updateProgressBar(percent, text) {
    const fill = $('#certProgressBar');
    const label = $('#certProgressText');
    if (fill) fill.style.width = Math.round(percent) + '%';
    if (label) label.textContent = text || ('Uploading… ' + Math.round(percent) + '%');
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
            uploadWithRetry(storageRef, file, slotIndex, attempt + 1).then(resolve, reject);
          } else {
            reject({ slot: slotIndex, error: err });
          }
        },
        function () {
          resolve();
        }
      );
    });
  }

  function refreshOverallProgress() {
    const values = Object.values(uploadProgress);
    const total = values.reduce(function (sum, v) { return sum + (v || 0); }, 0);
    const avg = values.length > 0 ? total / values.length : 0;
    const uploaded = Object.keys(uploadProgress).filter(function (k) { return uploadProgress[k] >= 100; }).length;
    updateProgressBar(avg, 'Uploading images ' + uploaded + '/' + MAX_IMAGES + ' complete...');
  }

  async function compressAllImages() {
    const promises = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      const file = uploadedFiles[i];
      if (!file) {
        promises.push(Promise.resolve(null));
        continue;
      }
      promises.push(new Promise(function (resolve) {
        compressImage(file, function (compressed) {
          resolve({ slot: i, file: compressed, originalName: file.name });
        });
      }));
    }
    return Promise.all(promises);
  }

  async function uploadAllImages(submissionId) {
    const storage = firebase.storage();
    const bucket = storage.ref();

    const compressedList = await compressAllImages();
    compressedList.forEach(function (item) {
      item && (uploadProgress[item.slot] = 0);
    });
    refreshOverallProgress();

    const uploadPromises = compressedList.map(function (item) {
      if (!item) return Promise.resolve(null);

      const fileName = submissionId + '/' + item.slot + '_' + item.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = bucket.child('certifications/' + fileName);

      return uploadWithRetry(storageRef, item.file, item.slot)
        .then(function () {
          return { slot: item.slot, path: 'certifications/' + fileName, name: item.originalName };
        })
        .catch(function (err) {
          uploadErrors[err.slot] = err.error;
          setSlotError(err.slot, 'Upload failed. Please try again.');
          throw err;
        });
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(function (r) { return r !== null; });
  }

  const SUCCESS_MESSAGE =
    'Application Submitted Successfully!\n\n' +
    'Thank you for applying for the ZBH Pan & Plate Cooking Certification.\n\n' +
    'Your cooking proof has been received successfully.\n\n' +
    'The website owner will carefully review your submitted dishes.\n\n' +
    'If your application is approved, you will be contacted on your WhatsApp number with the PKR 500 payment instructions.\n\n' +
    'After payment is confirmed, your official Cooking Certificate will be sent to you.\n\n' +
    'Please allow some time for the review process.';

  function showSuccess() {
    $('#certificationForm').style.display = 'none';
    const successEl = $('#certSuccess .cert-success-body');
    if (successEl) {
      successEl.textContent = SUCCESS_MESSAGE;
    }
    $('#certSuccess').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    showUploadProgress();
    updateProgressBar(0, 'Preparing images...');
    Object.keys(uploadProgress).forEach(function (k) { delete uploadProgress[k]; });
    Object.keys(uploadErrors).forEach(function (k) { delete uploadErrors[k]; });

    const submissionId = generateSubmissionId();
    const fullName = $('#certFullName').value.trim();
    const city = $('#certCity').value.trim();
    const country = $('#certCountry').value.trim();
    const whatsapp = $('#certWhatsApp').value.trim();
    const email = $('#certEmail').value.trim();
    const age = $('#certAge').value.trim();

    const recipeNames = [];
    for (let i = 0; i < MAX_IMAGES; i++) recipeNames.push(getRecipeName(i));

    try {
      updateProgressBar(0, 'Uploading 5 images...');
      const uploadResults = await uploadAllImages(submissionId);
      const imagePaths = uploadResults.map(function (r) { return r.path; });

      updateProgressBar(50, 'Saving submission...');
      const timestamp = firebase.database.ServerValue.TIMESTAMP;

      const submissionData = {
        submissionId: submissionId,
        fullName: fullName,
        email: email,
        city: city,
        country: country,
        whatsappNumber: whatsapp,
        age: age ? parseInt(age, 10) : null,
        recipeNames: recipeNames,
        imagePaths: imagePaths,
        status: 'pending',
        certificateIssued: false,
        submittedAt: timestamp,
        updatedAt: timestamp
      };

      await firebase.database().ref('certifications/' + submissionId).set(submissionData);

      updateProgressBar(75, 'Sending notification...');
      try {
        const notifyFn = firebase.functions().httpsCallable('notifyAdminCertification');
        await notifyFn({
          submissionId: submissionId,
          fullName: fullName,
          email: email,
          city: city,
          country: country,
          whatsappNumber: whatsapp,
          age: age ? parseInt(age, 10) : null,
          recipeNames: recipeNames,
          imagePaths: imagePaths,
          createdAt: Date.now()
        });
      } catch (notifyErr) {
        console.warn('Admin notification failed (submission still recorded):', notifyErr);
      }

      updateProgressBar(100, 'Done!');

      setTimeout(function () {
        hideUploadProgress();
        setSubmitLoading(false, false);
        showSuccess();
      }, 300);

    } catch (err) {
      const failedSlot = err.slot !== undefined ? err.slot : -1;
      let msg = 'Something went wrong during submission. ';
      if (failedSlot >= 0) {
        msg += 'Image upload for Recipe ' + (failedSlot + 1) + ' failed. Please try again.';
      } else {
        msg += (err.message || 'Please try again.');
      }
      hideUploadProgress();
      setSubmitLoading(false, false);
      showError(msg);
    }
  }

  function init() {
    const form = $('#certificationForm');
    if (!form) return;

    initUploadSlots();
    form.addEventListener('submit', handleSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Certification = {
    validateForm: validateForm,
    formatFileSize: formatFileSize
  };
})();
