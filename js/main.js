/* ==========================================================================
   ZBH Pan & Plate — Page Controller
   Detects current page from URL and initializes only relevant components.
   ========================================================================== */

(function () {
  'use strict';

  /* -------------------- Page Detection -------------------- */
  function getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('/pages/browse.html')) return 'browse';
    if (path.includes('/pages/favorites.html')) return 'favorites';
    if (path.includes('/pages/fridge.html')) return 'fridge';
    if (path.includes('/pages/diet-plans.html')) return 'diet-plans';
    if (path.includes('/pages/about.html')) return 'about';
    if (path.includes('/pages/contact.html')) return 'contact';
    if (path.includes('/pages/login.html')) return 'login';
    if (path.includes('/pages/signup.html')) return 'signup';
    if (path.includes('/pages/recipe.html')) return 'recipe';
    return 'home';
  }

  const currentPage = getCurrentPage();

  /* -------------------- State -------------------- */
  let favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
  let activeCategory = '';
  let homeRenderFn = null;

  /* -------------------- Shared Init -------------------- */
  SharedComponents.initShared(currentPage);

  /* -------------------- DOM References -------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* -------------------- Page-Specific Initialization -------------------- */
  function init() {
    switch (currentPage) {
      case 'home':
        initHome();
        break;
      case 'browse':
        initBrowse();
        break;
      case 'favorites':
        initFavorites();
        break;
      case 'fridge':
        initFridge();
        break;
      case 'diet-plans':
        initDietPlans();
        break;
      case 'contact':
        initContact();
        break;
      case 'login':
        initAuthPage('login');
        break;
      case 'signup':
        initAuthPage('signup');
        break;
      default:
        break;
    }
  }

  /* -------------------- Home Page -------------------- */
  const CATEGORY_META = [
    { name: 'Main Course', emoji: '🍽️' },
    { name: 'Curry', emoji: '🍛' },
    { name: 'BBQ', emoji: '🍖' },
    { name: 'Appetizer', emoji: '🥟' },
    { name: 'Dessert', emoji: '🍰' },
    { name: 'Soup', emoji: '🥣' },
    { name: 'Rice', emoji: '🍚' },
    { name: 'Salad', emoji: '🥗' },
    { name: 'Noodles', emoji: '🍜' },
    { name: 'Breakfast', emoji: '🍳' }
  ];

  const CATEGORY_VALUES = ['Main Course', 'Curry', 'BBQ', 'Appetizer', 'Dessert', 'Soup', 'Rice', 'Salad', 'Noodles', 'Breakfast'];

  function normalizeRecipeCategory(recipe) {
    if (!recipe) return 'Main Course';

    const rawCategory = String(recipe.category || '').trim();
    if (CATEGORY_VALUES.includes(rawCategory)) return rawCategory;

    const searchText = [
      recipe.name || '',
      recipe.description || '',
      recipe.cuisine || '',
      ...(recipe.ingredients || [])
    ].join(' ').toLowerCase();

    if (/(curry|korma|masala|dal|butter chicken|karahi|vindaloo)/.test(searchText)) return 'Curry';
    if (/(bbq|barbecue|grill|grilled|kebab|tikka|ribs|wings|skewers)/.test(searchText)) return 'BBQ';
    if (/(soup|stew|broth|ramen|tom yum|gazpacho|miso)/.test(searchText)) return 'Soup';
    if (/(salad|caesar|greek salad|papaya salad|caprese)/.test(searchText)) return 'Salad';
    if (/(dessert|cake|pudding|cookie|pastry|custard|creme|brulee|tiramisu|ice cream|sticky rice)/.test(searchText)) return 'Dessert';
    if (/(noodle|ramen|mein|pad thai|hakka|udon|soba|pad see|lo mein)/.test(searchText)) return 'Noodles';
    if (/(breakfast|omelette|omelet|toast|pancake|waffle|idli|dosa|paratha|frittata)/.test(searchText)) return 'Breakfast';
    if (/(biryani|pulao|fried rice|rice|pilaf)/.test(searchText)) return 'Rice';
    if (/(appetizer|starter|samosa|spring roll|dumpling|guacamole|nugget|quesadilla|wrap)/.test(searchText)) return 'Appetizer';

    return 'Main Course';
  }

  function normalizeRecipes(recipes) {
    return recipes.map(recipe => {
      const normalized = { ...recipe };
      normalized.category = normalizeRecipeCategory(recipe);
      return normalized;
    });
  }

  function renderCategories(selectedCategory = '', recipesToCount = null) {
    const grid = $('#categoryGrid');
    if (!grid) return;

    const allRecipes = normalizeRecipes(SharedComponents.getRecipes());
    const visibleRecipes = recipesToCount ? normalizeRecipes(recipesToCount) : allRecipes;
    const totalCounts = {};
    allRecipes.forEach(r => {
      const cat = r.category || 'Main Course';
      totalCounts[cat] = (totalCounts[cat] || 0) + 1;
    });

    const items = [{ name: 'All Categories', emoji: '🍽️' }, ...CATEGORY_META];
    grid.innerHTML = items.map(meta => {
      const isAll = meta.name === 'All Categories';
      const value = isAll ? '' : meta.name;
      let count = totalCounts[meta.name] || 0;

      if (isAll) {
        count = allRecipes.length;
      } else if (selectedCategory && meta.name === selectedCategory) {
        count = visibleRecipes.length;
      }

      const activeClass = selectedCategory === value ? ' active' : '';
      return `<div class="category-item${activeClass}" data-category="${value}" role="button" tabindex="0">
        <span class="category-emoji">${meta.emoji}</span>
        <span class="category-name">${meta.name}</span>
        <span class="category-count">${count}</span>
      </div>`;
    }).join('');

    grid.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        const nextCategory = item.getAttribute('data-category') || '';
        activeCategory = nextCategory;
        const heroCategoryFilter = document.getElementById('heroCategoryFilter');
        if (heroCategoryFilter) heroCategoryFilter.value = nextCategory;
        if (typeof homeRenderFn === 'function') {
          homeRenderFn(nextCategory);
        }
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
  }

  function initHome() {
    const heroSearch = $('#heroSearch');
    const heroSearchBtn = $('#heroSearchBtn');
    const heroCuisineFilter = $('#heroCuisineFilter');
    const heroCategoryFilter = $('#heroCategoryFilter');
    const heroDifficultyFilter = $('#heroDifficultyFilter');
    const homeRecipeGrid = $('#homeRecipeGrid');
    const homeEmpty = $('#homeEmpty');
    const homeRecipeTitle = $('#homeRecipeTitle');

    homeRenderFn = (categoryOverride = null) => {
      const query = heroSearch.value;
      const cuisine = heroCuisineFilter.value;
      const category = categoryOverride !== null && categoryOverride !== undefined ? categoryOverride : (heroCategoryFilter.value || activeCategory || '');
      const difficulty = heroDifficultyFilter.value;
      const recipes = normalizeRecipes(SharedComponents.getRecipes());
      const filtered = filterRecipes(recipes, query, cuisine, category, difficulty);

      homeRecipeGrid.innerHTML = '';
      renderCategories(category, filtered);
      if (filtered.length === 0) {
        homeEmpty.style.display = 'block';
        homeRecipeTitle.textContent = 'Featured Recipes';
      } else {
        homeEmpty.style.display = 'none';
        homeRecipeTitle.textContent = query || cuisine || category || difficulty ? 'Search Results' : 'Featured Recipes';
        filtered.forEach(r => homeRecipeGrid.appendChild(SharedComponents.createRecipeCard(r)));
      }
    };

    heroSearchBtn.addEventListener('click', () => homeRenderFn());
    heroSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') homeRenderFn();
    });
    heroCuisineFilter.addEventListener('change', () => homeRenderFn());
    heroCategoryFilter.addEventListener('change', () => {
      activeCategory = heroCategoryFilter.value || '';
      homeRenderFn(activeCategory);
    });
    heroDifficultyFilter.addEventListener('change', () => homeRenderFn());

    activeCategory = heroCategoryFilter.value || '';
    homeRenderFn(activeCategory);
  }

  /* -------------------- Browse Page -------------------- */
  function initBrowse() {
    const browseSearch = $('#browseSearch');
    const browseSearchBtn = $('#browseSearchBtn');
    const browseCuisine = $('#browseCuisine');
    const browseCategory = $('#browseCategory');
    const browseDifficulty = $('#browseDifficulty');
    const browseSort = $('#browseSort');
    const browseRecipeGrid = $('#browseRecipeGrid');
    const browseEmpty = $('#browseEmpty');
    const browseStats = $('#browseStats');

    function renderBrowse() {
      const query = browseSearch.value;
      const cuisine = browseCuisine.value;
      const category = browseCategory.value;
      const difficulty = browseDifficulty.value;
      const sort = browseSort.value;
      const recipes = normalizeRecipes(SharedComponents.getRecipes());
      let filtered = filterRecipes(recipes, query, cuisine, category, difficulty);
      filtered = sortRecipes(filtered, sort);

      browseRecipeGrid.innerHTML = '';
      if (filtered.length === 0) {
        browseEmpty.style.display = 'block';
        browseStats.textContent = '';
      } else {
        browseEmpty.style.display = 'none';
        browseStats.textContent = `Showing ${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
        filtered.forEach(r => browseRecipeGrid.appendChild(SharedComponents.createRecipeCard(r)));
      }
    }

    browseSearchBtn.addEventListener('click', renderBrowse);
    browseSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renderBrowse();
    });
    browseCuisine.addEventListener('change', renderBrowse);
    browseCategory.addEventListener('change', renderBrowse);
    browseDifficulty.addEventListener('change', renderBrowse);
    browseSort.addEventListener('change', renderBrowse);

    renderBrowse();
  }

  /* -------------------- Favorites Page -------------------- */
  function initFavorites() {
    const favoritesGrid = $('#favoritesGrid');
    const favoritesEmpty = $('#favoritesEmpty');
    const favCount = $('#favCount');
    const goBrowseBtn = $('#goBrowseBtn');

    function renderFavorites() {
      const recipes = SharedComponents.getRecipes();
      const favRecipes = recipes.filter(r => favorites.includes(r.id));
      favoritesGrid.innerHTML = '';
      favCount.textContent = `${favRecipes.length} recipe${favRecipes.length !== 1 ? 's' : ''} saved`;

      if (favRecipes.length === 0) {
        favoritesEmpty.style.display = 'block';
      } else {
        favoritesEmpty.style.display = 'none';
        favRecipes.forEach(r => favoritesGrid.appendChild(SharedComponents.createRecipeCard(r)));
      }
    }

    goBrowseBtn.addEventListener('click', () => {
      window.location.href = '../pages/browse.html';
    });

    renderFavorites();

    document.addEventListener('favorites:updated', renderFavorites);
    document.addEventListener('auth:favoritesUpdated', renderFavorites);
  }

  /* -------------------- Fridge Finder Page -------------------- */
  function initFridge() {
    const fridgeInput = $('#fridgeInput');
    const fridgeAddBtn = $('#fridgeAddBtn');
    const fridgeFindBtn = $('#fridgeFindBtn');
    const fridgeClearBtn = $('#fridgeClearBtn');
    const fridgeTags = $('#fridgeTags');
    const fridgeRecipeGrid = $('#fridgeRecipeGrid');
    const fridgeEmpty = $('#fridgeEmpty');

    let fridgeIngredients = [];
    const MAX_FRIDGE = 10;
    const MIN_FRIDGE = 2;

    function normalizeIngredient(str) {
      return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    }

    function fridgeRenderTags() {
      fridgeTags.innerHTML = '';
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
        fridgeTags.appendChild(tag);
      });
    }

    function fridgeAddIngredient(raw) {
      const val = raw.trim();
      if (!val) return;
      const norm = normalizeIngredient(val);
      if (!norm) return;
      if (fridgeIngredients.length >= MAX_FRIDGE) {
        SharedComponents.showToast('You can add up to ' + MAX_FRIDGE + ' ingredients.');
        return;
      }
      if (fridgeIngredients.some(i => normalizeIngredient(i) === norm)) {
        SharedComponents.showToast('"' + val + '" is already added.');
        return;
      }
      fridgeIngredients.push(val);
      fridgeRenderTags();
      fridgeInput.value = '';
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
      fridgeRecipeGrid.innerHTML = '';
      if (fridgeIngredients.length < MIN_FRIDGE) {
        fridgeEmpty.style.display = 'none';
        return;
      }
      const all = SharedComponents.getRecipes();
      const scored = all.map(r => ({ recipe: r, score: fridgeMatchScore(r) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

      if (!scored.length) {
        fridgeEmpty.style.display = 'block';
        return;
      }
      fridgeEmpty.style.display = 'none';
      scored.forEach(x => fridgeRecipeGrid.appendChild(SharedComponents.createRecipeCard(x.recipe, fridgeIngredients)));
    }

    fridgeAddBtn.addEventListener('click', () => fridgeAddIngredient(fridgeInput.value));
    fridgeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fridgeAddIngredient(fridgeInput.value);
    });
    fridgeFindBtn.addEventListener('click', renderFridgeResults);
    fridgeClearBtn.addEventListener('click', () => {
      fridgeIngredients = [];
      fridgeRenderTags();
      fridgeRecipeGrid.innerHTML = '';
      fridgeEmpty.style.display = 'none';
    });
  }

  /* -------------------- Contact Page -------------------- */
  function initContact() {
    const contactForm = $('#contactForm');
    const contactSuccess = $('#contactSuccess');

    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        contactSuccess.style.display = 'block';
        contactForm.reset();
        setTimeout(() => {
          contactSuccess.style.display = 'none';
        }, 4000);
      });
    }
  }

  /* -------------------- Diet Plans Page -------------------- */
  function initDietPlans() {
    const container = $('#dietPlansContainer');
    if (!container) return;

    const recipes = SharedComponents.getRecipes();
    const findRecipe = (name) => {
      const lowerName = name.toLowerCase();
      const exactMatch = recipes.find(r => r.name.toLowerCase() === lowerName);
      if (exactMatch) return exactMatch;
      return recipes.find(r => r.name.toLowerCase().includes(lowerName));
    };

    const dietPlans = [
      {
        name: 'Weight Loss',
        icon: '🥗',
        color: 'linear-gradient(135deg,#56ab2f,#a8e063)',
        description: 'Low-calorie, high-fiber meals that keep you full while promoting healthy weight loss.',
        totalCalories: 1500,
        totalProtein: '100 g',
        totalCarbs: '150 g',
        totalFat: '50 g',
        meals: [
          { time: '7:00 AM', name: 'Breakfast', portion: '1 bowl', recipe: 'Oatmeal', calories: 300, protein: '12 g', carbs: '50 g', fat: '6 g' },
          { time: '10:30 AM', name: 'Mid-Morning Snack', portion: '1 medium', recipe: 'Banana Milkshake', calories: 260, protein: '8 g', carbs: '44 g', fat: '6 g' },
          { time: '1:00 PM', name: 'Lunch', portion: '1 plate', recipe: 'Chicken Salad Wrap', calories: 430, protein: '30 g', carbs: '28 g', fat: '20 g' },
          { time: '4:00 PM', name: 'Evening Snack', portion: '1 cup', recipe: 'Green Tea', calories: 50, protein: '0 g', carbs: '0 g', fat: '0 g' },
          { time: '7:30 PM', name: 'Dinner', portion: '1 bowl', recipe: 'Daal Chawal', calories: 430, protein: '16 g', carbs: '70 g', fat: '10 g' }
        ]
      },
      {
        name: 'Weight Gain',
        icon: '🍖',
        color: 'linear-gradient(135deg,#f7971e,#ffd200)',
        description: 'Calorie-dense, nutrient-rich meals to support healthy weight gain and muscle development.',
        totalCalories: 3000,
        totalProtein: '140 g',
        totalCarbs: '300 g',
        totalFat: '100 g',
        meals: [
          { time: '7:00 AM', name: 'Breakfast', portion: '2 parathas', recipe: 'Aloo Paratha', calories: 720, protein: '16 g', carbs: '116 g', fat: '20 g' },
          { time: '10:30 AM', name: 'Mid-Morning Snack', portion: '1 large', recipe: 'Chicken Burger', calories: 540, protein: '32 g', carbs: '44 g', fat: '24 g' },
          { time: '1:00 PM', name: 'Lunch', portion: '2 servings', recipe: 'Chicken Biryani', calories: 1280, protein: '68 g', carbs: '144 g', fat: '44 g' },
          { time: '4:00 PM', name: 'Evening Snack', portion: '1 smoothie', recipe: 'Mango Shake', calories: 280, protein: '7 g', carbs: '50 g', fat: '6 g' },
          { time: '7:30 PM', name: 'Dinner', portion: '1 plate', recipe: 'Beef Burrito', calories: 620, protein: '34 g', carbs: '58 g', fat: '26 g' }
        ]
      },
      {
        name: 'Muscle Building',
        icon: '💪',
        color: 'linear-gradient(135deg,#ee0979,#ff6a00)',
        description: 'High-protein meals designed to support muscle growth and recovery after workouts.',
        totalCalories: 2800,
        totalProtein: '180 g',
        totalCarbs: '250 g',
        totalFat: '80 g',
        meals: [
          { time: '6:30 AM', name: 'Pre-Workout', portion: '1 bowl', recipe: 'Oatmeal', calories: 300, protein: '11 g', carbs: '50 g', fat: '7 g' },
          { time: '8:30 AM', name: 'Post-Workout', portion: '2 scoops', recipe: 'Banana Milkshake', calories: 520, protein: '16 g', carbs: '88 g', fat: '12 g' },
          { time: '12:30 PM', name: 'Lunch', portion: '1 plate', recipe: 'Chicken Pasta', calories: 560, protein: '32 g', carbs: '54 g', fat: '22 g' },
          { time: '3:30 PM', name: 'Afternoon Snack', portion: '1 plate', recipe: 'Egg Fried Rice', calories: 430, protein: '14 g', carbs: '68 g', fat: '12 g' },
          { time: '5:30 PM', name: 'Pre-Dinner', portion: '1 bowl', recipe: 'Cheese Pasta', calories: 540, protein: '22 g', carbs: '56 g', fat: '24 g' },
          { time: '7:00 PM', name: 'Dinner', portion: '1 bowl', recipe: 'Grilled Cheese Sandwich', calories: 520, protein: '22 g', carbs: '38 g', fat: '30 g' }
        ]
      },
      {
        name: 'Diabetic-Friendly',
        icon: '🩺',
        color: 'linear-gradient(135deg,#11998e,#38ef7d)',
        description: 'Low-glycemic, balanced meals that help maintain stable blood sugar levels.',
        totalCalories: 1800,
        totalProtein: '90 g',
        totalCarbs: '180 g',
        totalFat: '60 g',
        meals: [
          { time: '7:30 AM', name: 'Breakfast', portion: '2 slices', recipe: 'Butter Toast', calories: 440, protein: '12 g', carbs: '48 g', fat: '22 g' },
          { time: '10:30 AM', name: 'Mid-Morning', portion: '1 small bowl', recipe: 'Greek Salad', calories: 220, protein: '8 g', carbs: '12 g', fat: '16 g' },
          { time: '1:00 PM', name: 'Lunch', portion: '1 plate', recipe: 'Daal Chawal', calories: 430, protein: '16 g', carbs: '70 g', fat: '10 g' },
          { time: '4:00 PM', name: 'Evening Snack', portion: '1 handful', recipe: 'Oatmeal', calories: 150, protein: '5 g', carbs: '25 g', fat: '3 g' },
          { time: '7:30 PM', name: 'Dinner', portion: '1 bowl', recipe: 'Mushroom Soup', calories: 280, protein: '8 g', carbs: '18 g', fat: '20 g' }
        ]
      },
      {
        name: 'Balanced Healthy Diet',
        icon: '🥙',
        color: 'linear-gradient(135deg,#667eea,#764ba2)',
        description: 'A well-rounded mix of proteins, carbs, and fats for overall health and energy.',
        totalCalories: 2000,
        totalProtein: '120 g',
        totalCarbs: '200 g',
        totalFat: '70 g',
        meals: [
          { time: '7:00 AM', name: 'Breakfast', portion: '2 slices', recipe: 'French Toast', calories: 840, protein: '32 g', carbs: '96 g', fat: '36 g' },
          { time: '10:30 AM', name: 'Snack', portion: '1 piece', recipe: 'Cheese Omelette', calories: 390, protein: '24 g', carbs: '4 g', fat: '30 g' },
          { time: '1:00 PM', name: 'Lunch', portion: '1 bowl', recipe: 'Fried Rice', calories: 450, protein: '14 g', carbs: '70 g', fat: '12 g' },
          { time: '4:00 PM', name: 'Snack', portion: '1 wrap', recipe: 'Veg Wrap', calories: 320, protein: '8 g', carbs: '42 g', fat: '12 g' },
          { time: '7:30 PM', name: 'Dinner', portion: '1 bowl', recipe: 'Chana Masala', calories: 360, protein: '14 g', carbs: '52 g', fat: '10 g' }
        ]
      }
    ];

    container.innerHTML = dietPlans.map(plan => {
      const mealsHtml = plan.meals.map(meal => {
        const recipeCard = findRecipe(meal.recipe);
        const recipeImage = recipeCard ? recipeCard.image : '';
        const imageStyle = recipeImage ? `background-image: url('${recipeImage}'), ${plan.color};` : `background: ${plan.color};`;
        return `
          <div class="diet-meal">
            <div class="diet-meal-time">${meal.time}</div>
            <div class="diet-meal-card" data-recipe="${meal.recipe}">
              <div class="diet-meal-image" style="${imageStyle}">
                <span class="diet-meal-icon">${plan.icon}</span>
              </div>
              <div class="diet-meal-info">
                <h4>${meal.name}</h4>
                <p class="diet-meal-recipe">${meal.recipe}</p>
                <p class="diet-meal-portion">${meal.portion}</p>
                <div class="diet-meal-nutrition">
                  <span>🔥 ${meal.calories} cal</span>
                  <span>💪 ${meal.protein} protein</span>
                  <span>🍞 ${meal.carbs} carbs</span>
                  <span>🥑 ${meal.fat} fat</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="diet-plan">
          <div class="diet-plan-header" style="background:${plan.color}">
            <span class="diet-plan-icon">${plan.icon}</span>
            <h2>${plan.name}</h2>
            <p>${plan.description}</p>
            <div class="diet-plan-totals">
              <span>🔥 ${plan.totalCalories} cal/day</span>
              <span>💪 ${plan.totalProtein} protein</span>
              <span>🍞 ${plan.totalCarbs} carbs</span>
              <span>🥑 ${plan.totalFat} fat</span>
            </div>
          </div>
          <div class="diet-plan-meals">
            ${mealsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.addEventListener('click', (e) => {
      const card = e.target.closest('.diet-meal-card');
      if (!card) return;
      const recipeName = card.getAttribute('data-recipe');
      if (!recipeName) return;
      const recipe = findRecipe(recipeName);
      if (recipe) {
        SharedComponents.openRecipeModal(recipe);
      } else {
        SharedComponents.showToast('Recipe not found: ' + recipeName);
      }
    });
  }

  /* -------------------- Auth Pages -------------------- */
  function initAuthPage(type) {
    if (typeof Auth !== 'undefined' && Auth && Auth.isLoggedIn()) {
      window.location.href = '../index.html';
      return;
    }
    const placeholder = document.querySelector('.auth-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    if (typeof Auth !== 'undefined' && Auth) {
      if (type === 'login') Auth.openLogin();
      if (type === 'signup') Auth.openSignup();
    }
  }

  /* -------------------- Search & Filter Helpers -------------------- */
  const SEARCH_ALIASES = {
    'bbq': ['barbecue', 'barbeque'],
    'barbecue': ['bbq', 'barbeque'],
    'barbeque': ['bbq', 'barbecue'],
    'burger': ['burger', 'burgers'],
    'burgers': ['burger'],
    'fries': ['fries', 'french fries'],
    'fry': ['fries'],
    'mac n cheese': ['mac and cheese', 'mac cheese'],
    'mac and cheese': ['mac n cheese', 'mac cheese'],
    'mac cheese': ['mac and cheese', 'mac n cheese'],
    'aloo': ['aloo'],
    'paratha': ['paratha', 'parathas'],
    'shawarma': ['shawarma', 'shawerma'],
    'shawerma': ['shawarma'],
    'biry': ['biryani'],
    'biryani': ['biry'],
    'piza': ['pizza'],
    'pizza': ['piza'],
    'omlet': ['omelette', 'omelet'],
    'omelette': ['omlet', 'omelet'],
    'omelet': ['omelette', 'omlet'],
    'spageti': ['spaghetti'],
    'spaghetti': ['spageti'],
    'past': ['pasta'],
    'pasta': ['past'],
    'pastas': ['pasta']
  };

  function normalizeSearchText(value) {
    if (value == null) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenizeSearchText(value) {
    return normalizeSearchText(value).split(/\s+/).filter(Boolean);
  }

  function getSearchVariants(query) {
    const base = normalizeSearchText(query);
    const variants = new Set([base]);

    if (!base) return [];

    const tokens = tokenizeSearchText(base);
    tokens.forEach(token => {
      const aliases = SEARCH_ALIASES[token] || [];
      aliases.forEach(alias => variants.add(normalizeSearchText(alias)));
    });

    Object.keys(SEARCH_ALIASES).forEach(key => {
      if (base === key || base.includes(key) || key.includes(base)) {
        (SEARCH_ALIASES[key] || []).forEach(alias => variants.add(normalizeSearchText(alias)));
      }
    });

    return Array.from(variants).filter(Boolean);
  }

  function levenshteinDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[a.length][b.length];
  }

  function getTokenSimilarity(tokenA, tokenB) {
    if (!tokenA || !tokenB) return 0;
    if (tokenA === tokenB) return 30;
    if (tokenA.includes(tokenB) || tokenB.includes(tokenA)) return 22;
    if (tokenA.startsWith(tokenB) || tokenB.startsWith(tokenA)) return 20;

    const dist = levenshteinDistance(tokenA, tokenB);
    const maxLen = Math.max(tokenA.length, tokenB.length);
    if (maxLen <= 3) return dist <= 1 ? 14 : 0;
    if (dist <= 1) return 14;
    if (dist <= 2) return 9;
    return 0;
  }

  function scoreTextMatch(query, text, weight) {
    const normalizedQuery = normalizeSearchText(query);
    const normalizedText = normalizeSearchText(text);
    if (!normalizedQuery || !normalizedText) return 0;

    if (normalizedText === normalizedQuery) return 120 * weight;
    if (normalizedText.includes(normalizedQuery)) return 90 * weight;
    if (normalizedQuery.includes(normalizedText)) return 80 * weight;

    const queryTokens = tokenizeSearchText(normalizedQuery);
    const textTokens = tokenizeSearchText(normalizedText);
    let score = 0;

    if (queryTokens.length && textTokens.length) {
      let matchedTokens = 0;
      queryTokens.forEach(qToken => {
        let best = 0;
        textTokens.forEach(tToken => {
          best = Math.max(best, getTokenSimilarity(qToken, tToken));
        });
        if (best >= 14) matchedTokens += 1;
        score += best;
      });

      if (matchedTokens === queryTokens.length) score += 35 * weight;
      if (matchedTokens >= Math.max(1, Math.ceil(queryTokens.length / 2))) score += 10 * weight;
    }

    const dist = levenshteinDistance(normalizedQuery, normalizedText);
    const maxLen = Math.max(normalizedQuery.length, normalizedText.length);
    if (maxLen) {
      score += Math.max(0, (1 - dist / maxLen) * 16 * weight);
    }

    return score;
  }

  function getRecipeSearchScore(recipe, query) {
    const variants = getSearchVariants(query);
    if (!variants.length) return 0;

    const name = normalizeSearchText(recipe.name || '');
    const ingredientsText = normalizeSearchText((recipe.ingredients || []).join(' '));
    const description = normalizeSearchText(recipe.description || '');
    const cuisine = normalizeSearchText(recipe.cuisine || '');
    const category = normalizeSearchText(recipe.category || '');
    const keywordsText = normalizeSearchText(Array.isArray(recipe.keywords) ? recipe.keywords.join(' ') : (recipe.tags || ''));

    const fields = [
      { text: name, weight: 6 },
      { text: ingredientsText, weight: 2.4 },
      { text: description, weight: 1.5 },
      { text: cuisine, weight: 1.3 },
      { text: category, weight: 1.1 },
      { text: keywordsText, weight: 1.3 }
    ];

    let score = 0;
    let strongNameMatch = false;

    fields.forEach(field => {
      let fieldScore = 0;
      variants.forEach(variant => {
        const normalizedVariant = normalizeSearchText(variant);
        if (!normalizedVariant || !field.text) return;

        if (field.text === normalizedVariant) {
          fieldScore = Math.max(fieldScore, 140 * field.weight);
          return;
        }

        if (field.text.includes(normalizedVariant) || normalizedVariant.includes(field.text)) {
          fieldScore = Math.max(fieldScore, 90 * field.weight);
          return;
        }

        const queryTokens = tokenizeSearchText(normalizedVariant);
        const textTokens = tokenizeSearchText(field.text);
        let tokenScore = 0;

        queryTokens.forEach(qToken => {
          let best = 0;
          textTokens.forEach(tToken => {
            best = Math.max(best, getTokenSimilarity(qToken, tToken));
          });
          tokenScore += best;
        });

        const dist = levenshteinDistance(normalizedVariant, field.text);
        const maxLen = Math.max(normalizedVariant.length, field.text.length);
        if (tokenScore >= 35 || (dist <= 2 && maxLen <= 8)) {
          fieldScore = Math.max(fieldScore, 32 * field.weight);
        }
      });

      if (field.weight >= 6 && fieldScore >= 90 * field.weight) {
        strongNameMatch = true;
      }
      score += fieldScore;
    });

    return strongNameMatch ? score : (score >= 90 ? score : 0);
  }

  function filterRecipes(recipes, query, cuisine, category, difficulty) {
    const normalizedQuery = normalizeSearchText(query);
    const filtered = recipes.filter(r => {
      if (cuisine && r.cuisine !== cuisine) return false;
      if (category && r.category !== category) return false;
      if (difficulty && r.difficulty !== difficulty) return false;
      return true;
    });

    if (!normalizedQuery) return filtered;

    const scored = filtered
      .map(recipe => ({ recipe, score: getRecipeSearchScore(recipe, normalizedQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length) {
      return scored.slice(0, Math.min(40, scored.length)).map(item => item.recipe);
    }

    return filtered.slice(0, 12);
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

  /* -------------------- Favorites Sync -------------------- */
  document.addEventListener('auth:favoritesUpdated', () => {
    favorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');
    if (currentPage === 'home') renderHome();
    if (currentPage === 'browse') renderBrowse();
    if (currentPage === 'favorites') renderFavorites();
  });

  /* -------------------- Start -------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
