import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace with your actual config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyA-JUAQtZkc0qFzmFunmagV16IHTcKU01c",
  authDomain: "musicapp-2cddd.firebaseapp.com",
  projectId: "musicapp-2cddd",
  storageBucket: "musicapp-2cddd.firebasestorage.app",
  messagingSenderId: "571365438720",
  appId: "1:571365438720:web:052711bd9e143c65a16fe5",
  measurementId: "G-FBTXVEPLZH"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();