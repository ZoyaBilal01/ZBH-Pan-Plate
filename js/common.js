/* ==========================================================================
   ZBH Pan & Plate — Shared Components
   ========================================================================== */

const SharedComponents = (function () {
  'use strict';

  function getNavbar(currentPage) {
    currentPage = currentPage || 'home';
    const isRoot = !window.location.pathname.includes('/pages/');
    const prefix = isRoot ? '' : '../';
    const pages = [
      { id: 'home', label: 'Home', href: isRoot ? 'index.html' : '../index.html' },
      { id: 'browse', label: 'Browse Recipes', href: prefix + 'pages/browse.html' },
      { id: 'favorites', label: 'Favorites', href: prefix + 'pages/favorites.html' },
      { id: 'fridge', label: 'Fridge Finder', href: prefix + 'pages/fridge.html' },
      { id: 'diet-plans', label: 'Diet Plans', href: prefix + 'pages/diet-plans.html' },
      { id: 'certification', label: 'Cooking Certification', href: prefix + 'pages/cooking-certification.html' },
      { id: 'about', label: 'About', href: prefix + 'pages/about.html' },
      { id: 'contact', label: 'Contact', href: prefix + 'pages/contact.html' }
    ];

    const navLinks = pages.map(p => {
      const activeClass = p.id === currentPage ? ' active' : '';
      return `<li><a href="${p.href}" class="nav-link${activeClass}" data-page="${p.id}">${p.label}</a></li>`;
    }).join('');

    return `
      <nav class="navbar" id="navbar">
        <div class="nav-container">
          <a href="${isRoot ? 'index.html' : '../index.html'}" class="logo" data-page="home">
            <span class="logo-icon">🍳</span>
            <span class="logo-text">ZBH Pan <span class="amp">&</span> Plate</span>
          </a>
          <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Toggle menu">
            <span></span><span></span><span></span>
          </button>
          <ul class="nav-links" id="navLinks">
            ${navLinks}
          </ul>
          <div class="nav-actions">
            <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
              <span class="theme-icon">🌙</span>
            </button>
            <div class="auth-buttons" id="authButtons">
              <button class="btn btn-sm btn-secondary" id="loginBtn">Login</button>
              <button class="btn btn-sm btn-primary" id="signupBtn">Sign Up</button>
            </div>
            <div class="user-menu" id="userMenu" style="display:none;">
              <button class="user-menu-btn" id="userMenuBtn">
                <span class="user-avatar" id="userAvatar">👤</span>
                <span class="user-name" id="userName">User</span>
                <span class="user-arrow">▼</span>
              </button>
              <div class="user-dropdown" id="userDropdown" style="display:none;">
                <div class="user-dropdown-header">
                  <span class="user-avatar-large" id="userAvatarLarge">👤</span>
                  <div>
                    <div class="user-dropdown-name" id="userDropdownName">User Name</div>
                    <div class="user-dropdown-email" id="userDropdownEmail">user@email.com</div>
                    <div class="user-dropdown-region" id="userDropdownRegion">Region</div>
                  </div>
                </div>
                <div class="user-dropdown-divider"></div>
                <button class="user-dropdown-item" id="logoutBtn">🚪 Logout</button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  function getFooter() {
    return `
      <footer class="footer">
        <div class="container">
          <p>&copy; 2026 ZBH Pan & Plate. All rights reserved.</p>
        </div>
      </footer>
    `;
  }

  function getModals() {
    return `
      <div class="modal-overlay" id="authModal">
        <div class="modal-container auth-modal-container" id="authModalContainer">
          <button class="modal-close auth-modal-close" id="authModalClose">&times;</button>
          <div class="modal-body" id="authModalBody"></div>
        </div>
      </div>
      <div class="modal-overlay" id="recipeModal">
        <div class="modal-container" id="modalContainer">
          <button class="modal-close" id="modalClose">&times;</button>
          <div class="modal-body" id="modalBody"></div>
        </div>
      </div>
      <div class="toast-container" id="toastContainer"></div>
    `;
  }

  function injectSharedElements(currentPage) {
    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');
    const modalsPlaceholder = document.getElementById('modals-placeholder');

    if (navbarPlaceholder) {
      navbarPlaceholder.innerHTML = getNavbar(currentPage);
    }
    if (footerPlaceholder) {
      footerPlaceholder.innerHTML = getFooter();
    }
    if (modalsPlaceholder) {
      modalsPlaceholder.innerHTML = getModals();
    }
  }

  function initShared(currentPage) {
    injectSharedElements(currentPage);
    initTheme();
    initMobileMenu();
    initAuthUI();
    initDropdown();
    initModalClose();
  }

  function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const saved = localStorage.getItem('zbh_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const icon = themeToggle.querySelector('.theme-icon');
      if (icon) icon.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('zbh_theme', 'light');
        const icon = themeToggle.querySelector('.theme-icon');
        if (icon) icon.textContent = '🌙';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('zbh_theme', 'dark');
        const icon = themeToggle.querySelector('.theme-icon');
        if (icon) icon.textContent = '☀️';
      }
    });
  }

  function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    if (!mobileMenuBtn || !navLinks) return;

    mobileMenuBtn.addEventListener('click', () => {
      mobileMenuBtn.classList.toggle('open');
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuBtn.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  function initAuthUI() {
    if (typeof Auth === 'undefined' || !Auth) return;
    
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    
    function updateUI() {
      if (Auth.isLoggedIn()) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        const user = Auth.getUser();
        if (user) {
          const displayName = user.displayName || 'User';
          const initial = displayName.charAt(0).toUpperCase();
          const userNameEl = document.getElementById('userName');
          const userAvatarEl = document.getElementById('userAvatar');
          const userAvatarLargeEl = document.getElementById('userAvatarLarge');
          const userDropdownNameEl = document.getElementById('userDropdownName');
          const userDropdownEmailEl = document.getElementById('userDropdownEmail');
          if (userNameEl) userNameEl.textContent = displayName;
          if (userAvatarEl) userAvatarEl.textContent = initial;
          if (userAvatarLargeEl) userAvatarLargeEl.textContent = initial;
          if (userDropdownNameEl) userDropdownNameEl.textContent = displayName;
          if (userDropdownEmailEl) userDropdownEmailEl.textContent = user.email || '';
        }
      } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
      }
    }

    updateUI();
    if (Auth.onFavoritesUpdated) {
      Auth.onFavoritesUpdated(updateUI);
    }

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (Auth && Auth.openLogin) Auth.openLogin();
      });
    }

    const signupBtn = document.getElementById('signupBtn');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        if (Auth && Auth.openSignup) Auth.openSignup();
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (Auth && Auth.logout) Auth.logout();
      });
    }
  }

  function initDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (!userMenuBtn || !userDropdown) return;

    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = userDropdown.style.display === 'block';
      userDropdown.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (userMenuBtn && !userMenuBtn.contains(e.target)) {
        userDropdown.style.display = 'none';
      }
    });
  }

  function initModalClose() {
    const modalClose = document.getElementById('modalClose');
    const recipeModal = document.getElementById('recipeModal');
    const authModalClose = document.getElementById('authModalClose');
    const authModal = document.getElementById('authModal');

    if (modalClose && recipeModal) {
      modalClose.addEventListener('click', () => {
        recipeModal.classList.remove('open');
        document.body.style.overflow = '';
      });
    }

    if (authModalClose && authModal) {
      authModalClose.addEventListener('click', () => {
        authModal.classList.remove('open');
        document.body.style.overflow = '';
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (recipeModal && recipeModal.classList.contains('open')) {
          recipeModal.classList.remove('open');
          document.body.style.overflow = '';
        }
        if (authModal && authModal.classList.contains('open')) {
          authModal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });
  }

  function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  function getRecipes() {
    return typeof RECIPES !== 'undefined' ? RECIPES : [];
  }

  function createRecipeCard(recipe, fridgeOverride) {
    const themes = typeof CATEGORY_THEME !== 'undefined' ? CATEGORY_THEME : {};
    const theme = themes[recipe.cuisine] || { color: 'linear-gradient(135deg,#667eea,#764ba2)', emoji: '🍽️' };
    const difficultyClass = recipe.difficulty ? 'difficulty-' + recipe.difficulty.toLowerCase() : '';

    const card = document.createElement('div');
    card.className = 'recipe-card';
    const imageStyle = recipe.image ? `background-image: url('${recipe.image}'), ${theme.color};` : `background: ${theme.color};`;
    card.innerHTML = `
      <div class="recipe-card-image" style="${imageStyle}">
        <span class="recipe-card-badge">${recipe.category || 'Recipe'}</span>
        <button class="recipe-card-fav" data-id="${recipe.id}" aria-label="Add to favorites">♡</button>
        ${recipe.image ? '' : `<span style="font-size:4.5rem">${theme.emoji}</span>`}
      </div>
      <div class="recipe-card-body">
        <div class="recipe-card-meta">
          <span>⏱️ ${recipe.prep || '-'}</span>
          <span>🔥 ${recipe.cook || '-'}</span>
          <span>😊 ${recipe.difficulty || '-'}</span>
        </div>
        <h3 class="recipe-card-title">${recipe.name}</h3>
        <p class="recipe-card-desc">${recipe.description || ''}</p>
        <div class="recipe-card-footer">
          <div class="recipe-card-tags">
            <span class="recipe-tag ${difficultyClass}">${recipe.difficulty || 'N/A'}</span>
            <span class="recipe-tag">${recipe.servings ? recipe.servings + ' servings' : ''}</span>
          </div>
          <button class="recipe-card-action" data-id="${recipe.id}">View Recipe</button>
        </div>
      </div>
    `;

    const favBtn = card.querySelector('.recipe-card-fav');
    const favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
    if (favorites.includes(recipe.id)) {
      favBtn.classList.add('favorited');
      favBtn.textContent = '♥';
    }

    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(recipe.id, favBtn);
    });

    const viewBtn = card.querySelector('.recipe-card-action');
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRecipeModal(recipe, fridgeOverride);
    });

    card.addEventListener('click', () => {
      openRecipeModal(recipe, fridgeOverride);
    });

    return card;
  }

  function toggleFavorite(id, btn) {
    let favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
    const index = favorites.indexOf(id);
    if (index > -1) {
      favorites.splice(index, 1);
      if (btn) {
        btn.classList.remove('favorited');
        btn.textContent = '♡';
      }
    } else {
      favorites.push(id);
      if (btn) {
        btn.classList.add('favorited');
        btn.textContent = '♥';
      }
    }
    localStorage.setItem('zbh_favorites', JSON.stringify(favorites));
    if (typeof Auth !== 'undefined' && Auth && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.syncFavorites(favorites);
    }
    document.dispatchEvent(new CustomEvent('favorites:updated'));
  }

  function openRecipeModal(recipe, fridgeOverride) {
    const recipeModal = document.getElementById('recipeModal');
    const modalBody = document.getElementById('modalBody');
    if (!recipeModal || !modalBody) return;

    const themes = typeof CATEGORY_THEME !== 'undefined' ? CATEGORY_THEME : {};
    const theme = themes[recipe.cuisine] || { color: 'linear-gradient(135deg,#667eea,#764ba2)', emoji: '🍽️' };

    const favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
    const isFav = favorites.includes(recipe.id);

    const stepsHtml = (recipe.steps || []).map(s => `<li>${s}</li>`).join('');
    const tipsHtml = (recipe.tips || []).map(t => `<li>${t}</li>`).join('');
    const nutrition = recipe.nutrition || {};

    let ingredientsHtml = '';
    if (fridgeOverride && Array.isArray(fridgeOverride) && fridgeOverride.length > 0) {
      const normalizedUserIngredients = fridgeOverride.map(normalizeIngredient);
      const ingredients = recipe.ingredients || [];
      ingredientsHtml = ingredients.map(ing => {
        const normIng = normalizeIngredient(ing);
        const has = normalizedUserIngredients.some(u => normIng.includes(u) || u.includes(normIng));
        const cls = has ? 'fridge-match' : 'fridge-missing';
        const icon = has ? '✅' : '❌';
        return `<li class="${cls}">${icon} ${ing}</li>`;
      }).join('');
    } else {
      ingredientsHtml = (recipe.ingredients || []).map(i => `<li>${i}</li>`).join('');
    }

    const imageStyle = recipe.image ? `background-image: url('${recipe.image}'), ${theme.color};` : `background: ${theme.color};`;
    const heroContent = recipe.image ? '' : `<span>${theme.emoji}</span>`;

    modalBody.innerHTML = `
      <div class="modal-hero" style="${imageStyle}">
        ${heroContent}
      </div>
      <div class="modal-header">
        <h2>${recipe.name}</h2>
        <div class="modal-meta">
          <span>🍳 ${recipe.category || 'Recipe'}</span>
          <span>⏱️ Prep: ${recipe.prep || '-'}</span>
          <span>🔥 Cook: ${recipe.cook || '-'}</span>
          <span>😊 ${recipe.difficulty || '-'}</span>
          <span>🍽️ ${recipe.servings ? recipe.servings + ' servings' : ''}</span>
          <span>🔥 ${recipe.calories ? recipe.calories + ' cal' : ''}</span>
        </div>
      </div>
      <div class="modal-section">
        <p>${recipe.description || ''}</p>
      </div>
      <div class="modal-section">
        <h3>Ingredients</h3>
        <ul>${ingredientsHtml}</ul>
      </div>
      <div class="modal-section">
        <h3>Instructions</h3>
        <ul>${stepsHtml}</ul>
      </div>
      ${tipsHtml ? `<div class="modal-section"><h3>Tips</h3><ul>${tipsHtml}</ul></div>` : ''}
      <div class="modal-section">
        <h3>Nutrition</h3>
        <div class="modal-nutrition">
          <div class="nutrition-item"><strong>${nutrition.protein || '-'}</strong><span>Protein</span></div>
          <div class="nutrition-item"><strong>${nutrition.carbs || '-'}</strong><span>Carbs</span></div>
          <div class="nutrition-item"><strong>${nutrition.fat || '-'}</strong><span>Fat</span></div>
          <div class="nutrition-item"><strong>${nutrition.fiber || '-'}</strong><span>Fiber</span></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="modalFavBtn" data-id="${recipe.id}">
          ${isFav ? '♥ Saved to Favorites' : '♡ Save to Favorites'}
        </button>
        <button class="btn btn-secondary" id="modalCloseBtn">Close</button>
      </div>
    `;

    recipeModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    const favBtn = document.getElementById('modalFavBtn');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        toggleFavorite(recipe.id, favBtn);
        const newFavorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
        const nowFav = newFavorites.includes(recipe.id);
        favBtn.innerHTML = nowFav ? '♥ Saved to Favorites' : '♡ Save to Favorites';
      });
    }

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        recipeModal.classList.remove('open');
        document.body.style.overflow = '';
      });
    }
  }

  function normalizeIngredient(ingredient) {
    return ingredient.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }

  return {
    getNavbar,
    getFooter,
    getModals,
    injectSharedElements,
    initShared,
    initTheme,
    initMobileMenu,
    initAuthUI,
    initDropdown,
    initModalClose,
    showToast,
    getQueryParam,
    getRecipes,
    createRecipeCard,
    toggleFavorite,
    openRecipeModal,
    normalizeIngredient
  };
})();
