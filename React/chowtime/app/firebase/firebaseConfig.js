import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';
import { DataSnapshot } from 'firebase/database';
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence, signInWithEmailAndPassword } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyA8VvMTmvf-X6GcD0RdceVBsnaeqVGNeqA",
  authDomain: "chowtime-de032.firebaseapp.com",
  databaseURL: "https://chowtime-de032-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chowtime-de032",
  storageBucket: "chowtime-de032.firebasestorage.app",
  messagingSenderId: "167125020178",
  appId: "1:167125020178:web:ba85d8dac921069f73b2cb",
  measurementId: "G-94TW1CZCZP"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Database
const database = getDatabase(app);

// Initialize Firestore
const firestore = getFirestore(app);

// Initialize Firebase Auth with React Native Persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Firebase Auth Wrapper
const firebaseAuth = {
  email: "athena.villarin2004@gmail.com",
  password: "3.14159265359",
  login: async function () {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        this.email,
        this.password
      );
      console.log("User signed in:", userCredential.user);
    } catch (error) {
      console.error("Authentication error:", error.message);
    }
  }
};

export default { app, database, db: firestore, ref, set, get, child, firebaseAuth,DataSnapshot };
