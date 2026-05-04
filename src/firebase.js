import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCC5a-yhc0myEnlhcs5pgCXOSx1h6b5CmU",
  authDomain: "servos-peniel.firebaseapp.com",
  projectId: "servos-peniel",
  storageBucket: "servos-peniel.firebasestorage.app",
  messagingSenderId: "743267134560",
  appId: "1:743267134560:web:b3a1b2282eb3970f856705"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export { signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc };