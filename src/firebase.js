import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export { app };

// getAuth() 는 소셜 로그인용 popupRedirectResolver 를 함께 올린다. 그 과정에서
// __/auth/iframe.js(93KB)와 apis.google.com(41KB)을 초기 로드에 끌어와 모바일에서
// 체감이 크게 나빠진다. 이 앱은 이메일/비밀번호만 쓰므로 리졸버 없이 초기화한다.
// 소셜 로그인을 붙이게 되면 popupRedirectResolver 를 지정해야 한다.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// ── Firestore 지연 로드 ─────────────────────────────────────────────
// 로그인 화면에는 Firestore 가 필요 없는데, 정적 import 하면 초기 번들에 묶여
// 첫 진입마다 120KB 가량을 더 받는다. 동적 import 로 돌리고 모듈 평가 시점에
// 다운로드만 미리 걸어 둔다(렌더는 막지 않는다). 사용자가 아이디를 입력하는
// 동안 내려받히므로 로그인 시점에는 대개 준비가 끝나 있다.
//
// db 는 let 으로 내보낸다. ES 모듈의 라이브 바인딩 덕분에 로드가 끝나면
// import 한 쪽에서도 자동으로 최신 값이 보여, 호출부를 고치지 않아도 된다.
export let db = null;
// 로드되면 firebase/firestore 네임스페이스(doc·collection·onSnapshot …)가 채워진다.
export const FS = {};

let _loading = null;

export function loadFirestore() {
  if (!_loading) {
    _loading = import("firebase/firestore").then((m) => {
      Object.assign(FS, m);
      db = m.getFirestore(app);
      return m;
    });
  }
  return _loading;
}

// 배경 선로드. await 하지 않으므로 모듈 평가를 지연시키지 않는다.
loadFirestore();

const LOCAL_KEYS = new Set(["current-user"]);

export const storage = {
  async get(key) {
    if (LOCAL_KEYS.has(key)) {
      const value = localStorage.getItem(key);
      return value !== null ? { key, value, shared: false } : null;
    }
    const { doc, getDoc } = await loadFirestore();
    const snap = await getDoc(doc(db, "storage", key));
    return snap.exists() ? { key, value: snap.data().value, shared: true } : null;
  },
  async set(key, value) {
    if (LOCAL_KEYS.has(key)) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    }
    const { doc, setDoc } = await loadFirestore();
    await setDoc(doc(db, "storage", key), { value });
    return { key, value, shared: true };
  },
};
