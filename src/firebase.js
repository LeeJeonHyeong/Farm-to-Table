import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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
export const fbStorage = getStorage(app);

const LOCAL_KEYS = new Set(["current-user"]);

export const storage = {
  async get(key) {
    if (LOCAL_KEYS.has(key)) {
      const value = localStorage.getItem(key);
      return value !== null ? { key, value, shared: false } : null;
    }
    const snap = await getDoc(doc(db, "storage", key));
    return snap.exists() ? { key, value: snap.data().value, shared: true } : null;
  },
  async set(key, value) {
    if (LOCAL_KEYS.has(key)) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    }
    await setDoc(doc(db, "storage", key), { value });
    return { key, value, shared: true };
  },
};
