// ═══════════════════════════════════════════════════════════
//  OHM TRADING JOURNAL — Firebase Config & Utilities
//  ───────────────────────────────────────────────────────────
//  الإعداد: استبدل القيم أدناه بمعلومات مشروعك من Firebase Console
//  ═══════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyDkG3HY-k95On20C5ypb7ufCgl6Ej3NJhk",
  authDomain:        "ohm-journal-18853.firebaseapp.com",
  projectId:         "ohm-journal-18853",
  storageBucket:     "ohm-journal-18853.firebasestorage.app",
  messagingSenderId: "933376840438",
  appId:             "1:933376840438:web:c4baff5b9cdb9eb6ba92d7",
  measurementId:     "G-DFEPGDD4QR",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  client_id: "933376840438-t7dev8ci692ojbepmgppcq2122uvkoch.apps.googleusercontent.com",
});

/* ─── Auth helpers ─── */

/** تسجيل حساب جديد + حفظ بيانات المستخدم في Firestore */
export async function registerUser({ name, email, phone, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  // إنشاء مستند المستخدم في Firestore
  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    phone: phone || "",
    createdAt: serverTimestamp(),
    trades: [],
    settings: { dark: true },
    motivations: [],
  });
  return cred.user;
}

/** تسجيل الدخول بالإيميل وكلمة المرور */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** تسجيل الدخول بـ Google */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  // إنشاء مستند للمستخدم إن لم يكن موجوداً
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name:  user.displayName || "",
      email: user.email,
      phone: "",
      createdAt: serverTimestamp(),
      trades: [],
      settings: { dark: true },
      motivations: [],
    });
  }
  return user;
}

/** تسجيل الخروج */
export async function logoutUser() {
  await signOut(auth);
}

/** إرسال رابط استعادة كلمة المرور */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/* ─── Firestore helpers ─── */

/** تحميل بيانات المستخدم من Firestore (مرة واحدة) */
export async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) return snap.data();
  return null;
}

/** حفظ بيانات الصفقات */
export async function saveTrades(uid, trades) {
  await updateDoc(doc(db, "users", uid), { trades });
}

/** حفظ إعدادات المستخدم (الثيم، إلخ) */
export async function saveSettings(uid, settings) {
  await updateDoc(doc(db, "users", uid), { settings });
}

/** حفظ الدوافع الشخصية */
export async function saveMotivations(uid, motivations) {
  await updateDoc(doc(db, "users", uid), { motivations });
}

/** مراقبة التغييرات في بيانات المستخدم في الوقت الفعلي */
export function subscribeUserData(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

/** مراقبة حالة تسجيل الدخول */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
