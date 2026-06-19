import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc, query, where, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, setPersistence } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Detectar WebView iOS (Instagram, WhatsApp, etc.) e usar persistência em memória
// pois esses browsers bloqueiam indexedDB e localStorage
const isIOSWebView = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream &&
  /(Instagram|WhatsApp|FBAN|FBAV|Twitter|Line|Snapchat)/.test(navigator.userAgent);

if (isIOSWebView) {
  setPersistence(auth, inMemoryPersistence).catch(() => {});
} else {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // fallback para sessão se localStorage estiver bloqueado
    setPersistence(auth, browserSessionPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });
  });
}

// getMessaging pode falhar em WebViews sem suporte a SW
let messaging;
try {
  messaging = getMessaging(app);
} catch (e) {
  messaging = null;
}

export { messaging };
export const storage = getStorage(app);
export { ref, uploadBytes, getDownloadURL };

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  query,
  where,
  limit,
  addDoc,
  deleteDoc,
  getToken,
  onMessage,
};
