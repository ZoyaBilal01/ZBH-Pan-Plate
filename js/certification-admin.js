/* ==========================================================================
   ZBH Pan & Plate — Certification Admin Controller
   Secure admin panel for reviewing cooking certification submissions.
   Access is restricted to the administrator email via Cloud Functions.
   ========================================================================== */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value || '').replace(/[&<>"']/g, (c) => map[c]);
  }

  function formatTimestamp(value) {
    if (!value && value !== 0) return '-';
    const num = Number(value);
    if (!isNaN(num) && num > 100000000000) {
      return new Date(num).toLocaleString();
    }
    return String(value || '-');
  }

  var gate = $('certAdminGate');
  var panel = $('certAdminPanel');
  var tbody = $('certAdminTableBody');
  var summary = $('certAdminSummary');
  var search = $('certAdminSearch');
  var refreshBtn = $('certAdminRefresh');
  var statusFilter = $('certAdminStatusFilter');
  var issuedFilter = $('certAdminIssuedFilter');

  var allSubmissions = [];
  var sortCol = 'submittedAt';
  var sortDir = -1;
  var currentDetailModal = null;

  function showGate(messageHtml) {
    if (gate) { gate.innerHTML = messageHtml; gate.style.display = 'block'; }
    if (panel) panel.style.display = 'none';
  }

  function showPanel() {
    if (gate) gate.style.display = 'none';
    if (panel) panel.style.display = 'block';
  }

  function showToast(message) {
    if (typeof SharedComponents !== 'undefined' && SharedComponents.showToast) {
      SharedComponents.showToast(message);
      return;
    }
    var toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  function renderSummary() {
    if (!summary) return;
    var pending = allSubmissions.filter(function (s) { return s.status === 'pending'; }).length;
    var approved = allSubmissions.filter(function (s) { return s.status === 'approved'; }).length;
    var rejected = allSubmissions.filter(function (s) { return s.status === 'rejected'; }).length;
    var issued = allSubmissions.filter(function (s) { return s.certificateIssued; }).length;
    summary.textContent =
      allSubmissions.length + ' submission(s) total — ' +
      pending + ' pending, ' +
      approved + ' approved, ' +
      rejected + ' rejected, ' +
      issued + ' certificate(s) issued';
  }

  function getFilteredSorted() {
    var q = (search ? search.value.toLowerCase() : '');
    var statusVal = statusFilter ? statusFilter.value : 'all';
    var issuedVal = issuedFilter ? issuedFilter.value : 'all';

    var rows = allSubmissions.slice();

    if (q) {
      rows = rows.filter(function (s) {
        return (s.fullName || '').toLowerCase().indexOf(q) !== -1 ||
               (s.email || '').toLowerCase().indexOf(q) !== -1 ||
               (s.city || '').toLowerCase().indexOf(q) !== -1 ||
               (s.country || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    if (statusVal !== 'all') {
      rows = rows.filter(function (s) { return s.status === statusVal; });
    }

    if (issuedVal === 'issued') {
      rows = rows.filter(function (s) { return s.certificateIssued === true; });
    } else if (issuedVal === 'not-issued') {
      rows = rows.filter(function (s) { return s.certificateIssued !== true; });
    }

    rows.sort(function (a, b) {
      var av = (a[sortCol] != null) ? a[sortCol].toString().toLowerCase() : '';
      var bv = (b[sortCol] != null) ? b[sortCol].toString().toLowerCase() : '';
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });

    return rows;
  }

  function renderTable(rows) {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:16px;color:#888;">No submissions match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (s) {
      var statusClass = 'cert-status-' + (s.status || 'pending');
      var recipeCount = (s.recipeNames || []).filter(function (r) { return r && r.trim(); }).length;
      var issuedBadge = s.certificateIssued
        ? '<span class="cert-status-badge issued">Issued</span>'
        : '<span style="color:var(--text-muted);font-size:0.85rem;">Not issued</span>';

      return '<tr>' +
        '<td>' + escapeHtml(formatTimestamp(s.submittedAt)) + '</td>' +
        '<td>' + escapeHtml(s.fullName || '') + '</td>' +
        '<td>' + escapeHtml(s.email || '') + '</td>' +
        '<td>' + escapeHtml(s.city || '') + '</td>' +
        '<td>' + escapeHtml(s.country || '') + '</td>' +
        '<td>' + escapeHtml(s.whatsappNumber || '') + '</td>' +
        '<td>' + recipeCount + ' / 5</td>' +
        '<td><span class="cert-status-badge ' + statusClass + '">' + escapeHtml(s.status || 'pending') + '</span></td>' +
        '<td>' + issuedBadge + '</td>' +
        '<td><a href="#" class="cert-view-details" data-id="' + escapeHtml(s.id || '') + '">View Details</a></td>' +
        '</tr>';
    }).join('');
  }

  function applyFilters() {
    var rows = getFilteredSorted();
    renderTable(rows);
  }

  function initSorting() {
    var thead = document.querySelector('.cert-admin-table thead');
    if (!thead) return;
    var ths = thead.querySelectorAll('th[data-col]');
    ths.forEach(function (th) {
      th.style.cursor = 'pointer';
      th.title = 'Sort';
      th.addEventListener('click', function () {
        var col = th.getAttribute('data-col');
        if (sortCol === col) {
          sortDir = -sortDir;
        } else {
          sortCol = col;
          sortDir = -1;
        }
        ths.forEach(function (t) { t.removeAttribute('data-sort'); });
        th.setAttribute('data-sort', sortDir > 0 ? 'desc' : 'asc');
        applyFilters();
      });
    });
    var first = thead.querySelector('th[data-col="submittedAt"]');
    if (first) first.setAttribute('data-sort', 'asc');
  }

  function fetchSubmissions() {
    if (typeof firebase === 'undefined' || !firebase.functions) {
      showGate('<p>Authentication service is unavailable.</p>');
      return;
    }

    var getReqs = firebase.functions().httpsCallable('getCertificationRequests');
    getReqs({})
      .then(function (res) {
        var data = res.data || {};
        allSubmissions = data.submissions || [];
        renderSummary();
        applyFilters();
      })
      .catch(function (err) {
        var code = (err && err.code) ? String(err.code) : '';
        if (code.indexOf('permission-denied') !== -1) {
          showGate('<p>Access denied. This panel is restricted to administrators.</p>');
        } else if (code.indexOf('unauthenticated') !== -1) {
          showGate('<p>Please sign in as an administrator.</p>');
        } else {
          showGate('<p>Unable to load submissions: ' + escapeHtml(err.message || 'unexpected error') + '</p>');
        }
      });
  }

  function openDetailModal(submission) {
    if (currentDetailModal) {
      currentDetailModal.remove();
      currentDetailModal = null;
    }

    var statusClass = 'cert-status-' + (submission.status || 'pending');

    var recipeRows = (submission.recipeNames || []).map(function (name, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(name || '') + '</td>' +
        '<td><span class="cert-photo-status" data-id="' + escapeHtml(submission.id || '') + '" data-index="' + i + '">Load Photo</span></td>' +
        '</tr>';
    }).join('');

    var modal = document.createElement('div');
    modal.className = 'cert-detail-modal-overlay';
    modal.innerHTML =
      '<div class="cert-detail-modal">' +
      '  <div class="cert-detail-header">' +
      '    <h3>' + escapeHtml(submission.fullName || '') + ' — ' + escapeHtml(submission.status || 'pending') + '</h3>' +
      '    <button class="cert-detail-close">&times;</button>' +
      '  </div>' +
      '  <div class="cert-detail-body">' +
      '    <div class="cert-detail-section">' +
      '      <h4>Applicant Information</h4>' +
      '      <table class="cert-detail-table">' +
      '        <tr><td><strong>Name:</strong></td><td>' + escapeHtml(submission.fullName || '') + '</td></tr>' +
      '        <tr><td><strong>Email:</strong></td><td>' + escapeHtml(submission.email || '') + '</td></tr>' +
      '        <tr><td><strong>WhatsApp:</strong></td><td>' + escapeHtml(submission.whatsappNumber || '') + '</td></tr>' +
      '        <tr><td><strong>City:</strong></td><td>' + escapeHtml(submission.city || '') + '</td></tr>' +
      '        <tr><td><strong>Country:</strong></td><td>' + escapeHtml(submission.country || '') + '</td></tr>' +
      '        <tr><td><strong>Age:</strong></td><td>' + escapeHtml(submission.age != null ? String(submission.age) : '') + '</td></tr>' +
      '        <tr><td><strong>Notes:</strong></td><td>' + escapeHtml(submission.notes || '') + '</td></tr>' +
      '        <tr><td><strong>Submitted:</strong></td><td>' + escapeHtml(formatTimestamp(submission.submittedAt)) + '</td></tr>' +
      '      </table>' +
      '    </div>' +
      '    <div class="cert-detail-section">' +
      '      <h4>Recipe Photos</h4>' +
      '      <table class="cert-detail-table">' +
      '        <thead><tr><th>#</th><th>Recipe Name</th><th>Photo</th></tr></thead>' +
      '        <tbody>' + recipeRows + '</tbody>' +
      '      </table>' +
      '      <div class="cert-photo-gallery" id="certPhotoGallery"></div>' +
      '    </div>' +
      '    <div class="cert-detail-section">' +
      '      <h4>Admin Notes</h4>' +
      '      <textarea class="cert-admin-notes" id="certAdminNotes" placeholder="Add notes..."></textarea>' +
      '    </div>' +
      '  </div>' +
      '  <div class="cert-detail-actions">' +
      '    <button class="btn btn-secondary" id="certActionReject">Reject</button>' +
      '    <button class="btn btn-primary" id="certActionApprove">Approve</button>' +
      '    <button class="btn" id="certActionIssue" style="background:#10b981;color:#fff;">Mark as Issued</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);
    currentDetailModal = modal;
    modal.classList.add('show');

    modal.querySelector('.cert-detail-close').addEventListener('click', closeDetailModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeDetailModal();
    });

    document.getElementById('certActionReject').addEventListener('click', function () {
      updateStatus(submission, 'rejected');
    });
    document.getElementById('certActionApprove').addEventListener('click', function () {
      updateStatus(submission, 'approved');
    });
    document.getElementById('certActionIssue').addEventListener('click', function () {
      updateStatus(submission, submission.status, true);
    });

    modal.querySelectorAll('.cert-photo-status').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        loadPhoto(submission.id, parseInt(el.getAttribute('data-index'), 10), el);
      });
    });
  }

  function closeDetailModal() {
    var modal = currentDetailModal;
    if (modal) {
      modal.classList.remove('show');
      setTimeout(function () {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 200);
      currentDetailModal = null;
    }
  }

  function loadPhoto(submissionId, index, statusEl) {
    statusEl.textContent = 'Loading…';
    statusEl.style.color = 'var(--text-light)';

    var getImages = firebase.functions().httpsCallable('getCertificationImages');
    getImages({ submissionId: submissionId })
      .then(function (res) {
        var urls = (res.data && res.data.urls) || [];
        var entry = urls.find(function (u) { return u.index === index; });
        if (entry && entry.url) {
          var gallery = $('#certPhotoGallery');
          if (gallery) {
            gallery.innerHTML = '';
            var img = document.createElement('img');
            img.src = entry.url;
            img.alt = 'Certification photo';
            gallery.appendChild(img);
          }
          statusEl.innerHTML = '<span style="color:#15803d;">✓ Loaded</span>';
        } else {
          statusEl.innerHTML = '<span style="color:#dc2626;">✗ Unavailable</span>';
        }
      })
      .catch(function () {
        statusEl.innerHTML = '<span style="color:#dc2626;">✗ Error</span>';
      });
  }

  function updateStatus(submission, newStatus, markIssued) {
    var notes = $('#certAdminNotes') ? $('#certAdminNotes').value.trim() : '';

    var updateFn = firebase.functions().httpsCallable('updateCertificationStatus');
    updateFn({
      submissionId: submission.id,
      status: newStatus,
      adminNotes: notes,
      markIssued: !!markIssued
    })
      .then(function (res) {
        if (res.data && res.data.success) {
          showToast('Status updated: ' + newStatus + (markIssued ? ' (certificate issued)' : ''));
          fetchSubmissions();
          closeDetailModal();
        }
      })
      .catch(function (err) {
        showToast('Error updating status: ' + (err.message || 'Please try again.'));
      });
  }

  function checkAuth(user) {
    var firebaseAuth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
    var currentUser = user || (firebaseAuth ? firebaseAuth.currentUser : null);

    if (!currentUser) {
      showGate(
        '<p>You are not signed in.</p>' +
        '<button class="btn btn-primary" id="certAdminLoginBtn" type="button">Sign in as admin</button>'
      );
      var lb = $('certAdminLoginBtn');
      if (lb) {
        lb.addEventListener('click', function () {
          if (typeof Auth !== 'undefined' && Auth && Auth.openLogin) Auth.openLogin();
        });
      }
      return;
    }

    showPanel();
    if (allSubmissions.length === 0) {
      fetchSubmissions();
    }
  }

  function init() {
    initSorting();

    if (search) {
      search.addEventListener('input', applyFilters);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', fetchSubmissions);
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', applyFilters);
    }
    if (issuedFilter) {
      issuedFilter.addEventListener('change', applyFilters);
    }

    tbody && tbody.addEventListener('click', function (e) {
      var link = e.target.closest('.cert-view-details');
      if (!link) return;
      e.preventDefault();
      var id = link.getAttribute('data-id');
      var submission = allSubmissions.find(function (s) { return s.id === id; });
      if (submission) openDetailModal(submission);
    });

    var firebaseAuth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
    if (firebaseAuth) {
      firebaseAuth.onAuthStateChanged(checkAuth);
    } else {
      showGate('<p>Authentication service is unavailable.</p>');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') {
    init();
  }
})();
