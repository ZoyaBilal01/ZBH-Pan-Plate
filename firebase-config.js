const firebaseConfig = {
  apiKey: "AIzaSyA0ahFrorvTUvWv2ziMQu3R--Oj1TexRpI",
  authDomain: "recipe-7debf.firebaseapp.com",
  databaseURL: "https://recipe-7debf-default-rtdb.firebaseio.com",
  projectId: "recipe-7debf",
  storageBucket: "recipe-7debf.firebasestorage.app",
  messagingSenderId: "157297346351",
  appId: "1:157297346351:web:4d7ef1d292ac107b54c3da",
  measurementId: "G-4JR91ZMNKP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const database = firebase.database();
const firestore = firebase.firestore();
const storage = firebase.storage();
const analytics = firebase.analytics();

// 👇 ADD THIS PART AT THE VERY BOTTOM
database.ref("test").set({
  message: "Hello Firebase!",
  connected: true,
  time: new Date().toISOString()
}).then(() => {
  console.log("✅ Data written successfully!");
}).catch((error) => {
  console.error("❌ Error:", error);
});