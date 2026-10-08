// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJSqDSSsWlEbCqtbaWIzIBOIpss2Cb6io",
  authDomain: "saferoute-26aeb.firebaseapp.com",
  projectId: "saferoute-26aeb",
  storageBucket: "saferoute-26aeb.firebasestorage.app",
  messagingSenderId: "54912528295",
  appId: "1:54912528295:web:fa20a82fc3986d5d5dd082"
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

console.log("🔥 SafeRoute Firebase initialized:", firebaseApp.name);