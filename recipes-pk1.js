/* Pakistani recipes — batch 1 (rice, pulao, stews) */
addRecipe({ name: "Chicken Biryani", cuisine: "Pakistani", category: "Rice",
  description: "Fragrant layered basmati rice cooked with spiced chicken, caramelised onions and saffron.",
  ingredients: ["Basmati Rice", "Chicken", "Onion", "Tomato", "Yogurt", "Garlic", "Ginger", "Garam Masala", "Red Chili Powder", "Turmeric", "Salt", "Ghee", "Mint", "Coriander"],
  prep: "30 min", cook: "50 min", servings: 5, calories: 640, difficulty: "Medium",
  steps: ["Marinate chicken in yogurt, ginger-garlic and spices for 30 minutes.", "Fry onions until golden and set half aside for layering.", "Cook the marinated chicken in the onion masala until oil separates.", "Boil basmati rice with whole spices until 70% done, then drain.", "Layer rice and chicken masala, top with saffron milk, fried onions and herbs.", "Cover and steam on low heat (dum) for 20 minutes."],
  tips: ["Soak rice for 30 minutes for longer grains.", "Do not fully cook the rice before layering."],
  nutrition: { protein: "34 g", carbs: "72 g", fat: "22 g", fiber: "4 g" } });

addRecipe({ name: "Beef Biryani", cuisine: "Pakistani", category: "Rice",
  description: "Rich, spicy biryani made with tender slow-cooked beef and aromatic basmati rice.",
  ingredients: ["Basmati Rice", "Beef", "Onion", "Tomato", "Yogurt", "Garlic", "Ginger", "Garam Masala", "Red Chili Powder", "Salt", "Ghee", "Mint"],
  prep: "30 min", cook: "80 min", servings: 5, calories: 700, difficulty: "Hard",
  steps: ["Marinate beef with yogurt, ginger-garlic and spices.", "Slow cook beef until fork-tender.", "Boil rice with whole spices until par-cooked.", "Layer beef masala with rice and herbs.", "Steam on dum for 25 minutes."],
  tips: ["Use a pressure cooker to tenderise beef faster."],
  nutrition: { protein: "38 g", carbs: "70 g", fat: "26 g", fiber: "4 g" } });

addRecipe({ name: "Mutton Biryani", cuisine: "Pakistani", category: "Rice",
  description: "Festive biryani with succulent mutton pieces and layered saffron rice.",
  ingredients: ["Basmati Rice", "Mutton", "Onion", "Yogurt", "Garlic", "Ginger", "Garam Masala", "Red Chili Powder", "Salt", "Ghee", "Mint", "Coriander"],
  prep: "35 min", cook: "90 min", servings: 5, calories: 720, difficulty: "Hard",
  steps: ["Marinate mutton in yogurt and spices.", "Cook mutton until tender in masala.", "Par-boil rice with whole spices.", "Layer and garnish with fried onions and herbs.", "Dum for 25 minutes on low heat."],
  tips: ["Bone-in mutton adds deeper flavour."],
  nutrition: { protein: "36 g", carbs: "71 g", fat: "28 g", fiber: "4 g" } });

addRecipe({ name: "Chicken Pulao", cuisine: "Pakistani", category: "Rice",
  description: "Lightly spiced one-pot rice cooked in flavourful chicken stock.",
  ingredients: ["Basmati Rice", "Chicken", "Onion", "Garlic", "Ginger", "Cumin", "Black Pepper", "Cloves", "Cinnamon", "Salt"],
  prep: "20 min", cook: "40 min", servings: 4, calories: 560, difficulty: "Easy",
  steps: ["Fry onions golden, add chicken and whole spices.", "Add water to make stock and cook chicken.", "Add soaked rice to the stock.", "Cook until water evaporates, then steam on low heat."],
  tips: ["Measure stock precisely: 1.5 cups liquid per cup of rice."],
  nutrition: { protein: "30 g", carbs: "66 g", fat: "16 g", fiber: "3 g" } });

addRecipe({ name: "Yakhni Pulao", cuisine: "Pakistani", category: "Rice",
  description: "Aromatic rice simmered in a spiced meat broth (yakhni) for deep flavour.",
  ingredients: ["Basmati Rice", "Mutton", "Onion", "Garlic", "Ginger", "Coriander", "Cumin", "Black Pepper", "Cloves", "Salt"],
  prep: "25 min", cook: "70 min", servings: 4, calories: 610, difficulty: "Medium",
  steps: ["Boil meat with spice pouch to make yakhni.", "Strain and reserve the stock.", "Fry onions, add meat and reserved yakhni.", "Add rice and cook until done, then steam."],
  tips: ["Tie whole spices in muslin for a clear, clean broth."],
  nutrition: { protein: "32 g", carbs: "64 g", fat: "20 g", fiber: "3 g" } });

addRecipe({ name: "Nihari", cuisine: "Pakistani", category: "Curry",
  description: "Slow-cooked beef shank stew with a rich, spicy, thickened gravy.",
  ingredients: ["Beef", "Flour", "Onion", "Ginger", "Garlic", "Red Chili Powder", "Turmeric", "Garam Masala", "Salt", "Ghee"],
  prep: "20 min", cook: "180 min", servings: 6, calories: 520, difficulty: "Hard",
  steps: ["Brown beef shank in ghee with spices.", "Add water and simmer for hours until tender.", "Thicken gravy with a flour slurry.", "Temper with fried onions and serve with naan."],
  tips: ["Garnish with ginger, green chili and lemon."],
  nutrition: { protein: "40 g", carbs: "18 g", fat: "30 g", fiber: "2 g" } });

addRecipe({ name: "Paya", cuisine: "Pakistani", category: "Curry",
  description: "Traditional trotters curry slow-cooked to a gelatinous, spicy broth.",
  ingredients: ["Mutton", "Onion", "Garlic", "Ginger", "Red Chili Powder", "Turmeric", "Garam Masala", "Salt"],
  prep: "20 min", cook: "240 min", servings: 6, calories: 480, difficulty: "Hard",
  steps: ["Clean trotters thoroughly.", "Cook with onion, ginger-garlic and spices.", "Simmer for several hours until gelatinous.", "Finish with garam masala and fresh herbs."],
  tips: ["Best made a day ahead for richer flavour."],
  nutrition: { protein: "34 g", carbs: "10 g", fat: "28 g", fiber: "1 g" } });

addRecipe({ name: "Haleem", cuisine: "Pakistani", category: "Curry",
  description: "Hearty porridge of wheat, lentils and shredded meat, richly spiced.",
  ingredients: ["Beef", "Whole Wheat Flour", "Lentils", "Split Peas", "Onion", "Ginger", "Garlic", "Garam Masala", "Red Chili Powder", "Salt"],
  prep: "30 min", cook: "180 min", servings: 8, calories: 450, difficulty: "Hard",
  steps: ["Cook meat with spices until tender and shred.", "Boil wheat and lentils until soft.", "Blend everything to a thick, smooth consistency.", "Temper with fried onions and garnish."],
  tips: ["Stir often to prevent sticking as it thickens."],
  nutrition: { protein: "26 g", carbs: "48 g", fat: "16 g", fiber: "8 g" } });
