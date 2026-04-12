import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCvc1QTP6fp9dRX7mdPWLDktqyD9PdVzNs",
  authDomain: "certainid-family.firebaseapp.com",
  projectId: "certainid-family",
  storageBucket: "certainid-family.firebasestorage.app",
  messagingSenderId: "69250845754",
  appId: "1:69250845754:web:7c6808d84c9909de1a7903",
  measurementId: "G-9GYHYT7477"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
