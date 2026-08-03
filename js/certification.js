/* ==========================================================================
   ZBH Pan & Plate — Cooking Certification Page Controller
   Handles form validation, image upload (Firebase Storage), submission
   storage (Firebase RTDB), and admin email notification (Firebase Function).
   ========================================================================== */

(function () {
  'use strict';

  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  let uploadedFiles = {}; // slotIndex -> file object

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(phone);
  }

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
      $('#certFileError-' + slotIndex).textContent = '';
      $('#certFileError-' + slotIndex).parentElement.classList.remove('invalid');
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
    if (previewWrapper) {
      previewWrapper.innerHTML = '';
    }
    delete uploadedFiles[slotIndex];
  }

  function setSlotError(slotIndex, message) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    if (slotEl) {
      slotEl.classList.add('invalid');
    }
  }

  function clearSlotError(slotIndex) {
    const errorEl = $('#certFileError-' + slotIndex);
    const slotEl = $('#certSlot-' + slotIndex);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    if (slotEl) {
      slotEl.classList.remove('invalid');
    }
  }

  function handleFileSelect(e, slotIndex) {
    const input = e.target;
    const files = input.files;

    clearSlotError(slotIndex);
    clearPreview(slotIndex);

    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // Validate file type
    const isValidType = ALLOWED_TYPES.indexOf(file.type) !== -1;
    if (!isValidType) {
      setSlotError(slotIndex, 'Please select a JPG, JPEG, or PNG image.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setSlotError(slotIndex, 'File is too large. Maximum size is 5MB.');
      return;
    }

    uploadedFiles[slotIndex] = file;
    renderPreview(slotIndex, file);
  }

  function initUploadSlots() {
    const fileInputs = $$('.cert-file-input');
    fileInputs.forEach(function (input) {
      const slotIndex = parseInt(input.getAttribute('data-slot'), 10);
      input.addEventListener('change', function (e) {
        handleFileSelect(e, slotIndex);
      });
    });

    // Click-to-upload for upload areas
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

    const fullName = $('#certFullName').value.trim();
    const city = $('#certCity').value.trim();
    const country = $('#certCountry').value.trim();
    const whatsapp = $('#certWhatsApp').value.trim();
    const email = $('#certEmail').value.trim();
    const age = $('#certAge').value.trim();

    if (!fullName) {
      showFieldError('certFullName', 'Please enter your full name');
      hasError = true;
    }
    if (!city) {
      showFieldError('certCity', 'Please enter your city');
      hasError = true;
    }
    if (!country) {
      showFieldError('certCountry', 'Please enter your country');
      hasError = true;
    }
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

    // Validate recipe names
    for (let i = 0; i < MAX_IMAGES; i++) {
      const name = getRecipeName(i);
      if (!name) {
        setSlotError(i, 'Please enter a recipe name');
        hasError = true;
      }
    }

    // Validate images
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

  function setSubmitLoading(isLoading) {
    const btn = $('#certSubmitBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
    if (btnLoader) btnLoader.style.display = isLoading ? 'inline-block' : 'none';
    if (btn) btn.disabled = isLoading;
  }

  async function uploadImages(submissionId) {
    const storage = firebase.storage();
    const bucket = storage.ref();
    const uploadResults = [];

    for (let i = 0; i < MAX_IMAGES; i++) {
      const file = uploadedFiles[i];
      if (!file) {
        throw new Error('Missing image for slot ' + i);
      }

      const fileName = submissionId + '/' + i + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = bucket.child('certifications/' + fileName);

      try {
        const snapshot = await storageRef.put(file);
        uploadResults.push({ slot: i, path: 'certifications/' + fileName, name: file.name });
      } catch (err) {
         console.error('Upload failed for slot', i, err);
        throw err;
      }
    }

    return uploadResults;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);

    const submissionId = generateSubmissionId();
    const fullName = $('#certFullName').value.trim();
    const city = $('#certCity').value.trim();
    const country = $('#certCountry').value.trim();
    const whatsapp = $('#certWhatsApp').value.trim();
    const email = $('#certEmail').value.trim();
    const age = $('#certAge').value.trim();

    const recipeNames = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      recipeNames.push(getRecipeName(i));
    }

    try {
      const uploadResults = await uploadImages(submissionId);
      const imagePaths = uploadResults.map(r => r.path);

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

      try {
        const notifyFn = firebase.functions().httpsCallable('notifyAdminCertification');
        const result = await notifyFn({
          submissionId: submissionId,
          fullName: fullName,
          email: email,
          city: city,
          country: country,
          whatsappNumber: whatsapp,
          recipeNames: recipeNames,
          imagePaths: imagePaths,
          createdAt: Date.now()
        });
        if (result.data && result.data.warning) {
          console.warn('Notification warning:', result.data.warning);
        }
      } catch (notifyErr) {
        console.warn('Admin notification failed (submission still recorded):', notifyErr);
      }

      $('#certificationForm').style.display = 'none';
      $('#certSuccess').classList.add('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submission error:', err);
      showError('Something went wrong during submission. Please try again. ' + (err.message || ''));
    } finally {
      setSubmitLoading(false);
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
    escapeHtml: escapeHtml,
    formatFileSize: formatFileSize
  };
})();
