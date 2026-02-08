import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { registerForPushNotificationsAsync } from '../services/notifications';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 AuthContext: Iniciando listener de auth...');
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('👤 AuthContext: Estado de auth cambió');
      console.log('👤 Usuario:', currentUser ? currentUser.email : 'No hay usuario');
      
      try {
        if (currentUser) {
          setUser(currentUser);
          console.log('📧 Email verificado:', currentUser.emailVerified);
          
          // Obtener perfil
          console.log('📂 Buscando perfil en Firestore...');
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            console.log('✅ Perfil encontrado:', docSnap.data().name);
            setUserProfile(docSnap.data());
            
            // 🔔 Registrar para notificaciones push
            if (currentUser.emailVerified) {
              registerForPushNotificationsAsync(currentUser.uid);
            }
          } else {
            console.log('⚠️ No hay perfil creado');
            setUserProfile(null);
          }
        } else {
          console.log('🚫 No hay usuario logueado');
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('❌ Error en AuthContext:', error);
        setUser(currentUser);
        setUserProfile(null);
      } finally {
        console.log('✅ AuthContext: Carga completada');
        setLoading(false);
      }
    });

    return () => {
      console.log('🛑 AuthContext: Limpiando listener');
      unsubscribe();
    };
  }, []);

  console.log('📊 Estado actual - Loading:', loading, '| User:', !!user, '| Profile:', !!userProfile);

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      setUserProfile,
      loading,
      isEmailVerified: user?.emailVerified || false,
      hasProfile: !!userProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);