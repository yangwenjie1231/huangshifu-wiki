export { auth, loginWithGoogle, loginWithWeChat, logout } from './lib/firebaseCompat/auth';
export {
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  addDoc,
  onSnapshot,
  limit,
  deleteDoc,
  Timestamp,
} from './lib/firebaseCompat/firestore';
export { storage, ref, uploadBytes, getDownloadURL } from './lib/firebaseCompat/storage';
