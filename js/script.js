/* ==========================================================================
   ZBH Pan & Plate — Main Application Script
   ========================================================================== */

(function () {
  'use strict';

  /* -------------------- State -------------------- */
  let currentPage = 'home';
  let favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');

  /* -------------------- DOM References -------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const navbar = $('#navbar');
  const navLinks = $('#navLinks');
  const mobileMenuBtn = $('#mobileMenuBtn');
  const themeToggle = $('#themeToggle');
  const heroSearch = $('#heroSearch');
  const heroSearchBtn = $('#heroSearchBtn');
  const heroCuisineFilter = $('#heroCuisineFilter');
  const heroCategoryFilter = $('#heroCategoryFilter');
  const heroDifficultyFilter = $('#heroDifficultyFilter');
  const homeRecipeGrid = $('#homeRecipeGrid');
  const homeEmpty = $('#homeEmpty');
  const homeRecipeTitle = $('#homeRecipeTitle');
  const browseSearch = $('#browseSearch');
  const browseSearchBtn = $('#browseSearchBtn');
  const browseCuisine = $('#browseCuisine');
  const browseCategory = $('#browseCategory');
  const browseDifficulty = $('#browseDifficulty');
  const browseSort = $('#browseSort');
  const browseRecipeGrid = $('#browseRecipeGrid');
  const browseEmpty = $('#browseEmpty');
  const browseStats = $('#browseStats');
  const favoritesGrid = $('#favoritesGrid');
  const favoritesEmpty = $('#favoritesEmpty');
  const favCount = $('#favCount');
  const goBrowseBtn = $('#goBrowseBtn');
  const recipeModal = $('#recipeModal');
  const modalClose = $('#modalClose');
  const modalBody = $('#modalBody');
  const modalContainer = $('#modalContainer');
  const toastContainer = $('#toastContainer');
  const contactForm = $('#contactForm');
  const contactSuccess = $('#contactSuccess');

  /* Auth references */
  const authButtons = $('#authButtons');
  const userMenu = $('#userMenu');
  const userMenuBtn = $('#userMenuBtn');
  const userDropdown = $('#userDropdown');
  const loginBtn = $('#loginBtn');
  const signupBtn = $('#signupBtn');
  const logoutBtn = $('#logoutBtn');

  /* -------------------- Initialization -------------------- */
  function init() {
    loadTheme();
    bindNavigation();
    bindMobileMenu();
    bindThemeToggle();
    bindHeroSearch();
    bindBrowseControls();
    bindFavoritesNav();
    bindFridgeFinder();
    bindModalClose();
    bindContactForm();
    bindGoBrowse();
    bindAuthButtons();
    bindAuthFavoritesSync();
    renderHome();
    renderBrowse();
    renderFavorites();
  }

  /* -------------------- Theme -------------------- */
  function loadTheme() {
    const saved = localStorage.getItem('zbh_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      updateThemeIcon(true);
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('zbh_theme', 'light');
      updateThemeIcon(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('zbh_theme', 'dark');
      updateThemeIcon(true);
    }
  }

  function updateThemeIcon(isDark) {
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
  }

  /* -------------------- Navigation -------------------- */
  function bindNavigation() {
    $$('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        navigateTo(page);
      });
    });

    $$('.logo').forEach(logo => {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('home');
      });
    });
  }

  function navigateTo(page) {
    currentPage = page;

    $$('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    $$('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');

    if (page === 'home') renderHome();
    if (page === 'browse') renderBrowse();
    if (page === 'favorites') renderFavorites();
    if (page === 'fridge') renderFridgeResults();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile menu
    navLinks.classList.remove('open');
    mobileMenuBtn.classList.remove('open');
  }

  /* -------------------- Mobile Menu -------------------- */
  function bindMobileMenu() {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      mobileMenuBtn.classList.toggle('open');
    });
  }

  /* -------------------- Theme Toggle -------------------- */
  function bindThemeToggle() {
    themeToggle.addEventListener('click', toggleTheme);
  }

  /* -------------------- Data Helpers -------------------- */
  function getRecipes() {
    return typeof RECIPES !== 'undefined' ? RECIPES : [];
  }

  function getCategoryTheme(category) {
    const themes = typeof CATEGORY_THEME !== 'undefined' ? CATEGORY_THEME : {};
    if (themes[category]) return themes[category];
    return { color: 'linear-gradient(135deg, #a8a8a8, #d4d4d4)', emoji: '🍽️' };
  }

  function isFavorited(id) {
    return favorites.includes(id);
  }

  function toggleFavorite(id, event) {
    if (event) event.stopPropagation();
    const idx = favorites.indexOf(id);
    if (idx > -1) {
      favorites.splice(idx, 1);
      showToast('Removed from favorites');
    } else {
      favorites.push(id);
      showToast('Added to favorites');
    }
    localStorage.setItem('zbh_favorites', JSON.stringify(favorites));
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.syncFavorites(favorites).catch((err) => {
        console.error('Failed to sync favorites:', err);
      });
    }
    if (currentPage === 'home') renderHome();
    if (currentPage === 'browse') renderBrowse();
    if (currentPage === 'favorites') renderFavorites();
  }

  /* -------------------- Search & Filter -------------------- */
  function filterRecipes(recipes, query, cuisine, category, difficulty) {
    const q = (query || '').toLowerCase().trim();
    return recipes.filter(r => {
      if (cuisine && r.cuisine !== cuisine) return false;
      if (category && r.category !== category) return false;
      if (difficulty && r.difficulty !== difficulty) return false;
      if (q) {
        const haystack = [
          r.name,
          r.cuisine,
          r.category,
          r.description,
          ...(r.ingredients || [])
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function sortRecipes(recipes, sortValue) {
    const sorted = [...recipes];
    switch (sortValue) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'calories-asc':
        sorted.sort((a, b) => (a.calories || 0) - (b.calories || 0));
        break;
      case 'calories-desc':
        sorted.sort((a, b) => (b.calories || 0) - (a.calories || 0));
        break;
      case 'prep-asc':
        sorted.sort((a, b) => extractMinutes(a.prep) - extractMinutes(b.prep));
        break;
      case 'cook-asc':
        sorted.sort((a, b) => extractMinutes(a.cook) - extractMinutes(b.cook));
        break;
      default:
        break;
    }
    return sorted;
  }

  function extractMinutes(timeStr) {
    if (!timeStr) return 9999;
    const match = String(timeStr).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 9999;
  }

  /* -------------------- Card Rendering -------------------- */
  function createRecipeCard(recipe) {
    const theme = getCategoryTheme(recipe.category);
    const favClass = isFavorited(recipe.id) ? 'favorited' : '';
    const favIcon = isFavorited(recipe.id) ? '❤️' : '🤍';
    const diffClass = `difficulty-${(recipe.difficulty || '').toLowerCase()}`;

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.setAttribute('data-id', recipe.id);

    card.innerHTML = `
      <div class="recipe-card-image" style="background:${theme.color};">
        <span>${theme.emoji}</span>
        <span class="recipe-card-badge">${recipe.category || 'Recipe'}</span>
        <button class="recipe-card-fav ${favClass}" data-id="${recipe.id}" aria-label="Toggle favorite">${favIcon}</button>
      </div>
      <div class="recipe-card-body">
        <div class="recipe-card-meta">
          <span>🍳 ${recipe.prep || '-'}</span>
          <span>🔥 ${recipe.cook || '-'}</span>
          <span>🔥 ${recipe.calories || '-'} cal</span>
        </div>
        <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
        <p class="recipe-card-desc">${escapeHtml(recipe.description || '')}</p>
        <div class="recipe-card-footer">
          <div class="recipe-card-tags">
            <span class="recipe-tag ${diffClass}">${recipe.difficulty || '-'}</span>
            <span class="recipe-tag">${recipe.cuisine || ''}</span>
          </div>
          <button class="recipe-card-action" data-id="${recipe.id}">View Recipe</button>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.recipe-card-fav')) return;
      const id = card.getAttribute('data-id');
      openRecipeModal(id);
    });

    const favBtn = card.querySelector('.recipe-card-fav');
    favBtn.addEventListener('click', (e) => {
      toggleFavorite(recipe.id, e);
    });

    const actionBtn = card.querySelector('.recipe-card-action');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRecipeModal(recipe.id);
    });

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* -------------------- Render Home -------------------- */
  function renderHome() {
    const query = heroSearch.value;
    const cuisine = heroCuisineFilter.value;
    const category = heroCategoryFilter.value;
    const difficulty = heroDifficultyFilter.value;
    const recipes = getRecipes();
    const filtered = filterRecipes(recipes, query, cuisine, category, difficulty);

    homeRecipeGrid.innerHTML = '';
    if (filtered.length === 0) {
      homeEmpty.style.display = 'block';
      homeRecipeTitle.textContent = 'Featured Recipes';
    } else {
      homeEmpty.style.display = 'none';
      homeRecipeTitle.textContent = query || cuisine || category || difficulty ? 'Search Results' : 'Featured Recipes';
      filtered.forEach(r => homeRecipeGrid.appendChild(createRecipeCard(r)));
    }
  }

  function bindHeroSearch() {
    heroSearchBtn.addEventListener('click', renderHome);
    heroSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renderHome();
    });
    heroCuisineFilter.addEventListener('change', renderHome);
    heroCategoryFilter.addEventListener('change', renderHome);
    heroDifficultyFilter.addEventListener('change', renderHome);
  }

  /* -------------------- Render Browse -------------------- */
  function renderBrowse() {
    const query = browseSearch.value;
    const cuisine = browseCuisine.value;
    const category = browseCategory.value;
    const difficulty = browseDifficulty.value;
    const sort = browseSort.value;
    const recipes = getRecipes();
    let filtered = filterRecipes(recipes, query, cuisine, category, difficulty);
    filtered = sortRecipes(filtered, sort);

    browseRecipeGrid.innerHTML = '';
    if (filtered.length === 0) {
      browseEmpty.style.display = 'block';
      browseStats.textContent = '';
    } else {
      browseEmpty.style.display = 'none';
      browseStats.textContent = `Showing ${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
      filtered.forEach(r => browseRecipeGrid.appendChild(createRecipeCard(r)));
    }
  }

  function bindBrowseControls() {
    browseSearchBtn.addEventListener('click', renderBrowse);
    browseSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renderBrowse();
    });
    browseCuisine.addEventListener('change', renderBrowse);
    browseCategory.addEventListener('change', renderBrowse);
    browseDifficulty.addEventListener('change', renderBrowse);
    browseSort.addEventListener('change', renderBrowse);
  }

  /* -------------------- Render Favorites -------------------- */
  function renderFavorites() {
    const recipes = getRecipes();
    const favRecipes = recipes.filter(r => favorites.includes(r.id));
    favoritesGrid.innerHTML = '';
    favCount.textContent = `${favRecipes.length} recipe${favRecipes.length !== 1 ? 's' : ''} saved`;

    if (favRecipes.length === 0) {
      favoritesEmpty.style.display = 'block';
    } else {
      favoritesEmpty.style.display = 'none';
      favRecipes.forEach(r => favoritesGrid.appendChild(createRecipeCard(r)));
    }
  }

  function bindFavoritesNav() {
    // Nav already bound via bindNavigation()
  }

  function bindGoBrowse() {
    goBrowseBtn.addEventListener('click', () => navigateTo('browse'));
  }

  /* -------------------- Fridge Finder -------------------- */
  let fridgeIngredients = [];
  let fridgeUserIngredients = [];
  const MAX_FRIDGE = 10;
  const MIN_FRIDGE = 2;

  function normalizeIngredient(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }

  function fridgeRenderTags() {
    const container = $('#fridgeTags');
    container.innerHTML = '';
    fridgeIngredients.forEach((ing, idx) => {
      const tag = document.createElement('span');
      tag.className = 'fridge-tag';
      tag.textContent = ing;
      const remove = document.createElement('button');
      remove.className = 'fridge-tag-remove';
      remove.innerHTML = '&times;';
      remove.setAttribute('aria-label', 'Remove ' + ing);
      remove.addEventListener('click', () => {
        fridgeIngredients.splice(idx, 1);
        fridgeRenderTags();
      });
      tag.appendChild(remove);
      container.appendChild(tag);
    });
  }

  function fridgeAddIngredient(raw) {
    const val = raw.trim();
    if (!val) return;
    const norm = normalizeIngredient(val);
    if (!norm) return;
    if (fridgeIngredients.length >= MAX_FRIDGE) {
      showToast('You can add up to ' + MAX_FRIDGE + ' ingredients.');
      return;
    }
    if (fridgeIngredients.some(i => normalizeIngredient(i) === norm)) {
      showToast('"' + val + '" is already added.');
      return;
    }
    fridgeIngredients.push(val);
    fridgeRenderTags();
    $('#fridgeInput').value = '';
  }

  function fridgeMatchScore(recipe) {
    const ings = (recipe.ingredients || []).map(normalizeIngredient).filter(Boolean);
    if (!ings.length) return 0;
    let matched = 0;
    const userSet = new Set(fridgeIngredients.map(normalizeIngredient).filter(Boolean));
    ings.forEach(ri => {
      if (userSet.has(ri)) matched++;
      else {
        const riTokens = ri.split(/\s+/);
        let tokenHit = false;
        for (const t of riTokens) {
          if (t.length < 3) continue;
          for (const u of userSet) {
            if (u.includes(t) || t.includes(u)) { tokenHit = true; break; }
          }
          if (tokenHit) break;
        }
        if (tokenHit) matched += 0.5;
      }
    });
    return matched;
  }

  function renderFridgeResults() {
    const grid = $('#fridgeRecipeGrid');
    const empty = $('#fridgeEmpty');
    grid.innerHTML = '';
    if (fridgeIngredients.length < MIN_FRIDGE) {
      empty.style.display = 'none';
      return;
    }
    const all = getRecipes();
    const scored = all.map(r => ({ recipe: r, score: fridgeMatchScore(r) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    fridgeUserIngredients = fridgeIngredients.slice();
    scored.forEach(x => grid.appendChild(createRecipeCard(x.recipe)));
  }

  function bindFridgeFinder() {
    const input = $('#fridgeInput');
    const addBtn = $('#fridgeAddBtn');
    const findBtn = $('#fridgeFindBtn');
    const clearBtn = $('#fridgeClearBtn');

    addBtn.addEventListener('click', () => fridgeAddIngredient(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fridgeAddIngredient(input.value);
    });
    findBtn.addEventListener('click', renderFridgeResults);
    clearBtn.addEventListener('click', () => {
      fridgeIngredients = [];
      fridgeRenderTags();
      $('#fridgeRecipeGrid').innerHTML = '';
      $('#fridgeEmpty').style.display = 'none';
    });
  }

  /* -------------------- Recipe Modal -------------------- */
  function openRecipeModal(id, fridgeOverride) {
    const recipes = getRecipes();
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const theme = getCategoryTheme(recipe.category);
    const isFav = isFavorited(recipe.id);
    const favLabel = isFav ? 'Remove from Favorites' : 'Add to Favorites';
    const favIcon = isFav ? '❤️' : '🤍';

    const fridgeUserIngredients = fridgeOverride || fridgeIngredients || [];

    let ingredientsHtml = '';
    if (fridgeUserIngredients && fridgeUserIngredients.length) {
      const userSet = new Set(fridgeUserIngredients.map(normalizeIngredient).filter(Boolean));
      ingredientsHtml = (recipe.ingredients || []).map(i => {
        const norm = normalizeIngredient(i);
        const matched = userSet.has(norm) ? 'fridge-match' : 'fridge-missing';
        return `<li class="${matched}">${escapeHtml(i)}</li>`;
      }).join('');
    } else {
      ingredientsHtml = (recipe.ingredients || []).map(i => `<li>${escapeHtml(i)}</li>`).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-hero" style="background:${theme.color};">
        <span>${theme.emoji}</span>
      </div>
      <div class="modal-header">
        <h2>${escapeHtml(recipe.name)}</h2>
        <div class="modal-meta">
          <span>🍳 Prep: ${escapeHtml(recipe.prep || '-')}</span>
          <span>🔥 Cook: ${escapeHtml(recipe.cook || '-')}</span>
          <span>🍽️ Serves: ${recipe.servings || '-'}</span>
          <span>⚡ ${escapeHtml(recipe.difficulty || '-')}</span>
          <span>🔥 ${recipe.calories || '-'} cal</span>
        </div>
      </div>
      <div class="modal-section">
        <h3>Description</h3>
        <p>${escapeHtml(recipe.description || 'No description available.')}</p>
      </div>
      <div class="modal-section">
        <h3>Ingredients</h3>
        <ul class="modal-ingredients">
          ${ingredientsHtml}
        </ul>
      </div>
      <div class="modal-section">
        <h3>Instructions</h3>
        <ol style="padding-left:20px;color:var(--text-light);line-height:1.8;">
          ${(recipe.steps || []).map(s => `<li style="margin-bottom:8px;">${escapeHtml(s)}</li>`).join('')}
        </ol>
      </div>
      ${recipe.tips && recipe.tips.length > 0 ? `
      <div class="modal-section">
        <h3>Pro Tips</h3>
        <ul>
          ${recipe.tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>` : ''}
      <div class="modal-section">
        <h3>Nutrition (per serving)</h3>
        <div class="modal-nutrition">
          <div class="nutrition-item"><strong>${escapeHtml(recipe.nutrition?.protein || '-')}</strong><span>Protein</span></div>
          <div class="nutrition-item"><strong>${escapeHtml(recipe.nutrition?.carbs || '-')}</strong><span>Carbs</span></div>
          <div class="nutrition-item"><strong>${escapeHtml(recipe.nutrition?.fat || '-')}</strong><span>Fat</span></div>
          <div class="nutrition-item"><strong>${escapeHtml(recipe.nutrition?.fiber || '-')}</strong><span>Fiber</span></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary modal-fav-btn" data-id="${recipe.id}">
          <span>${favIcon}</span> ${favLabel}
        </button>
        <button class="btn btn-secondary modal-close-btn">Close</button>
      </div>
    `;

    recipeModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    const favBtn = modalBody.querySelector('.modal-fav-btn');
    favBtn.addEventListener('click', () => toggleFavorite(recipe.id));

    const closeBtn = modalBody.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', closeRecipeModal);
  }

  function closeRecipeModal() {
    recipeModal.classList.remove('open');
    document.body.style.overflow = '';
    fridgeUserIngredients = [];
  }

  function bindModalClose() {
    modalClose.addEventListener('click', closeRecipeModal);
    recipeModal.addEventListener('click', (e) => {
      if (e.target === recipeModal) closeRecipeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && recipeModal.classList.contains('open')) {
        closeRecipeModal();
      }
    });
  }

  /* -------------------- Toast -------------------- */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  /* -------------------- Contact Form -------------------- */
  function bindContactForm() {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      contactSuccess.style.display = 'block';
      contactForm.reset();
      setTimeout(() => {
        contactSuccess.style.display = 'none';
      }, 4000);
    });
  }

  /* -------------------- Auth UI -------------------- */
  function bindAuthButtons() {
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (typeof Auth !== 'undefined') Auth.openLogin();
      });
    }
    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        if (typeof Auth !== 'undefined') Auth.openSignup();
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (typeof Auth !== 'undefined') Auth.logout();
      });
    }
  }

  function bindAuthFavoritesSync() {
    document.addEventListener('auth:favoritesUpdated', () => {
      favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
      if (currentPage === 'home') renderHome();
      if (currentPage === 'browse') renderBrowse();
      if (currentPage === 'favorites') renderFavorites();
    });
  }

  /* -------------------- Start -------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
