import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB3YRi2RTYCUPFMXU6CLDkB2iHiEKgMRIs",
  authDomain: "around-the-world-with-floyd.firebaseapp.com",
  databaseURL: "https://around-the-world-with-floyd-default-rtdb.firebaseio.com",
  projectId: "around-the-world-with-floyd",
  storageBucket: "around-the-world-with-floyd.firebasestorage.app",
  messagingSenderId: "578154995892",
  appId: "1:578154995892:web:daf42e7f813f551eaf37e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user);
      }
    });
  });
}
