/* ==========================================================================
   ZBH Pan & Plate — Data Layer
   Contains ingredient categories and the recipe database.
   Exposed globally as window.INGREDIENT_CATEGORIES and window.RECIPES.
   ========================================================================== */

/* -------------------- Ingredient categories -------------------- */
const INGREDIENT_CATEGORIES = {
  "Dairy & Eggs": ["Eggs", "Milk", "Butter", "Cheese", "Mozzarella", "Cheddar Cheese", "Cream", "Yogurt", "Ghee", "Paneer"],
  "Meat & Seafood": ["Chicken", "Beef", "Mutton", "Fish", "Shrimp", "Crab", "Minced Meat", "Sausage", "Turkey", "Tuna"],
  "Grains & Staples": ["Rice", "Basmati Rice", "Brown Rice", "Flour", "Whole Wheat Flour", "Corn Flour", "Semolina", "Oats", "Bread", "Pasta"],
  "Vegetables": ["Potato", "Onion", "Tomato", "Garlic", "Ginger", "Carrot", "Cabbage", "Cauliflower", "Broccoli", "Spinach", "Bell Pepper", "Green Chili", "Red Chili", "Cucumber", "Eggplant", "Okra", "Peas", "Corn", "Mushroom", "Lettuce"],
  "Fruits": ["Apple", "Banana", "Mango", "Orange", "Lemon", "Lime", "Pineapple", "Strawberry", "Blueberries", "Avocado"],
  "Beans & Legumes": ["Chickpeas", "Lentils", "Kidney Beans", "Black Beans", "White Beans", "Green Gram", "Split Peas", "Soybeans", "Peanuts", "Cashews"],
  "Herbs & Seasonings": ["Coriander", "Mint", "Parsley", "Basil", "Oregano", "Thyme", "Rosemary", "Curry Leaves", "Spring Onion", "Dill"],
  "Spices": ["Salt", "Black Pepper", "Red Chili Powder", "Turmeric", "Cumin", "Coriander Powder", "Garam Masala", "Paprika", "Cinnamon", "Cloves"],
  "Sauces & Condiments": ["Ketchup", "Mayonnaise", "Soy Sauce", "Vinegar", "Mustard", "Chili Sauce", "BBQ Sauce", "Hot Sauce", "Honey", "Olive Oil"]
};

/* Category visual themes for recipe cards (gradient + emoji fallback image) */
const CATEGORY_THEME = {
  "Pakistani": { color: "linear-gradient(135deg,#f7971e,#ffd200)", emoji: "\uD83C\uDF5B" },
  "Chinese":   { color: "linear-gradient(135deg,#ee0979,#ff6a00)", emoji: "\uD83C\uDF5C" },
  "International": { color: "linear-gradient(135deg,#11998e,#38ef7d)", emoji: "\uD83C\uDF55" },
  "Soup":      { color: "linear-gradient(135deg,#c94b4b,#4b134f)", emoji: "\uD83C\uDF72" },
  "Salad":     { color: "linear-gradient(135deg,#56ab2f,#a8e063)", emoji: "\uD83E\uDD57" },
  "Dessert":   { color: "linear-gradient(135deg,#f857a6,#ff5858)", emoji: "\uD83C\uDF70" }
};
