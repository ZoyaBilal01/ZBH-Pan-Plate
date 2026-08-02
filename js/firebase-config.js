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

try {
  firebase.initializeApp(firebaseConfig);

  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.Auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  }

  const auth = firebase.auth();
  const database = firebase.database();
  const firestore = firebase.firestore();
  const storage = firebase.storage();
  const analytics = firebase.analytics();

  window.Auth = window.Auth || {};
  window.Auth._services = { auth, database, firestore, storage, analytics };

  database.ref("test").set({
    message: "Hello Firebase!",
    connected: true,
    time: new Date().toISOString()
  }).then(() => {
    console.log("✅ Data written successfully!");
  }).catch((error) => {
    console.error("❌ Error:", error);
  });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}