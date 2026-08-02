/* ==========================================================================
   ZBH Pan & Plate — Admin Dashboard Controller
   Lists users via a secure Cloud Function (admin-only). No privileged logic
   is trusted on the client; authorization is enforced server-side.
   ========================================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value || '').replace(/[&<>"']/g, (c) => map[c]);
  }

  const gate = $('adminGate');
  const panel = $('adminPanel');
  const tbody = $('adminTableBody');
  const summary = $('adminSummary');
  const search = $('adminSearch');
  const exportBtn = $('adminExportCsv');
  const loadMore = $('adminLoadMore');
  const loadMoreWrap = loadMore ? loadMore.parentNode : null;

  let allUsers = [];
  let pageToken = null;
  let loading = false;
  let sortCol = 'createdAt';
  let sortDir = -1;

  function showGate(messageHtml) {
    if (gate) { gate.innerHTML = messageHtml; gate.style.display = 'block'; }
    if (panel) panel.style.display = 'none';
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
  }

  function showPanel() {
    if (gate) gate.style.display = 'none';
    if (panel) panel.style.display = 'block';
  }

  function renderSummary() {
    if (summary) summary.textContent = allUsers.length + ' user(s) loaded';
  }

  function renderTable(rows) {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:16px;color:#888;">No users match your search.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (u) {
      return [
        '<tr>',
        '<td>' + escapeHtml(u.name) + '</td>',
        '<td>' + escapeHtml(u.email) + '</td>',
        '<td>' + escapeHtml(u.region) + '</td>',
        '<td>' + escapeHtml(u.provider) + '</td>',
        '<td>' + escapeHtml(u.createdAt) + '</td>',
        '<td>' + escapeHtml(u.lastLogin) + '</td>',
        '</tr>'
      ].join('');
    }).join('');
  }

  function getFilteredOrdered() {
    const q = (search ? search.value : '').toLowerCase();
    let rows = allUsers.slice();
    if (q) {
      rows = rows.filter(function (u) {
        return (u.name || '').toLowerCase().indexOf(q) !== -1 ||
          (u.email || '').toLowerCase().indexOf(q) !== -1 ||
          (u.region || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    rows.sort(function (a, b) {
      const av = (a[sortCol] || '').toString().toLowerCase();
      const bv = (b[sortCol] || '').toString().toLowerCase();
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return rows;
  }

  function applyFilter() {
    const rows = getFilteredOrdered();
    renderTable(rows);
  }

  function csvEscape(value) {
    const str = String(value == null ? '' : value);
    if (/[",\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function buildCsv(rows) {
    const header = ['Name', 'Email', 'Country/Region', 'Provider', 'Registration Date', 'Last Login'];
    const lines = [header.join(',')];
    rows.forEach(function (u) {
      lines.push([
        csvEscape(u.name),
        csvEscape(u.email),
        csvEscape(u.region),
        csvEscape(u.provider),
        csvEscape(u.createdAt),
        csvEscape(u.lastLogin)
      ].join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function downloadCsv(csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zbh-users-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function initSorting() {
    const thead = document.querySelector('.admin-table thead');
    if (!thead) return;
    const ths = thead.querySelectorAll('th[data-col]');
    ths.forEach(function (th) {
      th.style.cursor = 'pointer';
      th.title = 'Sort';
      th.addEventListener('click', function () {
        const col = th.getAttribute('data-col');
        if (sortCol === col) {
          sortDir = -sortDir;
        } else {
          sortCol = col;
          sortDir = -1;
        }
        ths.forEach(function (t) { t.removeAttribute('data-sort'); });
        th.setAttribute('data-sort', sortDir > 0 ? 'desc' : 'asc');
        applyFilter();
      });
    });
    const first = thead.querySelector('th[data-col="createdAt"]');
    if (first) first.setAttribute('data-sort', 'asc');
  }

  function callList() {
    if (loading) return;
    loading = true;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';

    if (typeof firebase === 'undefined' || !firebase.functions) {
      showGate('<p>Authentication service is unavailable.</p>');
      loading = false;
      return;
    }
    const listUsers = firebase.functions().httpsCallable('listUsersAdmin');
    listUsers({ limit: 100, pageToken: pageToken })
      .then(function (res) {
        const data = res.data || {};
        const users = data.users || [];
        users.forEach(function (u) {
          if (allUsers.findIndex(function (x) { return x.uid === u.uid; }) === -1) {
            allUsers.push(u);
          }
        });
        pageToken = data.pageToken || null;
        renderSummary();
        applyFilter();
        if (loadMoreWrap) {
          loadMoreWrap.style.display = pageToken ? 'block' : 'none';
        }
        loading = false;
      })
      .catch(function (err) {
        loading = false;
        const code = (err && err.code) ? String(err.code) : '';
        if (code.indexOf('permission-denied') !== -1) {
          showGate('<p>Access denied. This dashboard is restricted to administrators.</p>');
        } else if (code.indexOf('unauthenticated') !== -1) {
          showGate('<p>Please sign in as an administrator.</p>');
        } else {
          showGate('<p>Unable to load users: ' + escapeHtml(err.message || 'unexpected error') + '</p>');
        }
      });
  }

  function checkAuth(user) {
    const firebaseAuth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
    const currentUser = user || (firebaseAuth ? firebaseAuth.currentUser : null);
    if (!currentUser) {
      showGate(
        '<p>You are not signed in.</p>' +
        '<button class="btn btn-primary" id="adminLoginBtn" type="button">Sign in as admin</button>'
      );
      const lb = $('adminLoginBtn');
      if (lb) {
        lb.addEventListener('click', function () {
          if (typeof Auth !== 'undefined' && Auth && Auth.openLogin) Auth.openLogin();
        });
      }
      return;
    }
    showPanel();
    if (allUsers.length === 0) {
      callList();
    }
  }

  function init() {
    initSorting();
    if (search) {
      search.addEventListener('input', function () { applyFilter(); });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        const rows = getFilteredOrdered();
        if (!rows.length) {
          window.dispatchEvent(new CustomEvent('toast'));
          return;
        }
        downloadCsv(buildCsv(rows));
      });
    }
    if (loadMore) {
      loadMore.addEventListener('click', function () {
        callList();
      });
    }

    const firebaseAuth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
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
