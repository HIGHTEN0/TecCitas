// firebase.js - VERSIÓN SUPER ROBUSTA
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBEHL7EHHWlqqduvJ1QjXD1Eu6_GkgeiyA",
  authDomain: "tecdeliciasdate.firebaseapp.com",
  projectId: "tecdeliciasdate",
  storageBucket: "tecdeliciasdate.firebasestorage.app",
  messagingSenderId: "280909178530",
  appId: "1:280909178530:android:02096ca9a3db6abb9659fb"
};

// Variables globales
let app = null;
let auth = null;
let db = null;
let storage = null;

// Función para inicializar solo una vez
export const initializeFirebase = () => {
  if (app) {
    console.log('✅ Firebase ya está inicializado, retornando instancias existentes');
    return { app, auth, db, storage };
  }

  try {
    console.log('🚀 Inicializando Firebase...');
    
    // Inicializar app
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('📱 App de Firebase creada');
    } else {
      app = getApps()[0];
      console.log('🔄 Reutilizando app existente');
    }

    // Inicializar auth con persistencia (solo primera vez)
    if (!auth) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log('🔐 Auth inicializado con persistencia AsyncStorage');
    }

    // Inicializar Firestore y Storage
    if (!db) db = getFirestore(app);
    if (!storage) storage = getStorage(app);

    console.log('🎯 Firebase completamente inicializado');
    return { app, auth, db, storage };
    
  } catch (error) {
    console.error('💥 Error fatal al inicializar Firebase:', error);
    throw error;
  }
};

// Inicializar inmediatamente
const firebase = initializeFirebase();

// Exportar las instancias
export { auth, db, storage };
export default app;