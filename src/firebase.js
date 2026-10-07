import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";
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
// getAuth() 는 소셜 로그인용 popupRedirectResolver 를 함께 올린다. 그 과정에서
// __/auth/iframe.js(93KB)와 apis.google.com(41KB)을 초기 로드에 끌어와 모바일에서
// 체감이 크게 나빠진다. 이 앱은 이메일/비밀번호만 쓰므로 리졸버 없이 초기화한다.
// 소셜 로그인을 붙이게 되면 popupRedirectResolver 를 지정해야 한다.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
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
