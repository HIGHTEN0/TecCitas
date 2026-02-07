import { 
  doc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  writeBatch 
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../config/firebase';

export async function deleteUserAccount() {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('No hay usuario autenticado');
  }

  const userId = user.uid;
  console.log('🗑️ Iniciando eliminación de cuenta:', userId);

  try {
    // 1. Eliminar subcolecciones del usuario (likes, passed, blocked)
    console.log('📂 Eliminando subcolecciones...');
    await deleteSubcollection(userId, 'likes');
    await deleteSubcollection(userId, 'passed');
    await deleteSubcollection(userId, 'blocked');

    // 2. Eliminar matches donde participa el usuario
    console.log('💔 Eliminando matches...');
    await deleteUserMatches(userId);

    // 3. Eliminar reportes hechos por el usuario
    console.log('🚨 Eliminando reportes...');
    await deleteUserReports(userId);

    // 4. Eliminar documento del usuario
    console.log('👤 Eliminando perfil...');
    await deleteDoc(doc(db, 'users', userId));

    // 5. Eliminar cuenta de autenticación
    console.log('🔐 Eliminando cuenta de autenticación...');
    await deleteUser(user);

    console.log('✅ Cuenta eliminada completamente');
    return { success: true };

  } catch (error) {
    console.error('❌ Error eliminando cuenta:', error);
    throw error;
  }
}

// Eliminar subcolección
async function deleteSubcollection(userId, subcollectionName) {
  try {
    const subcollectionRef = collection(db, 'users', userId, subcollectionName);
    const snapshot = await getDocs(subcollectionRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`  ✅ Subcolección ${subcollectionName} eliminada`);
  } catch (error) {
    console.log(`  ⚠️ Error eliminando ${subcollectionName}:`, error.message);
  }
}

// Eliminar matches del usuario
async function deleteUserMatches(userId) {
  try {
    const matchesQuery = query(
      collection(db, 'matches'),
      where('users', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(matchesQuery);
    
    for (const matchDoc of snapshot.docs) {
      // Eliminar mensajes del match
      const messagesRef = collection(db, 'matches', matchDoc.id, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      messagesSnapshot.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      await batch.commit();
      
      // Eliminar el match
      await deleteDoc(matchDoc.ref);
    }
    
    console.log(`  ✅ ${snapshot.docs.length} matches eliminados`);
  } catch (error) {
    console.log('  ⚠️ Error eliminando matches:', error.message);
  }
}

// Eliminar reportes hechos por el usuario
async function deleteUserReports(userId) {
  try {
    const reportsQuery = query(
      collection(db, 'reports'),
      where('reporterId', '==', userId)
    );
    
    const snapshot = await getDocs(reportsQuery);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`  ✅ ${snapshot.docs.length} reportes eliminados`);
  } catch (error) {
    console.log('  ⚠️ Error eliminando reportes:', error.message);
  }
}