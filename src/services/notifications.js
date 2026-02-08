import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// 🔑 URL de tu backend en Vercel
const BACKEND_URL = 'https://teccitas-backend.vercel.app'; // ← Reemplaza con tu URL

// Configurar cómo se muestran las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Registrar para notificaciones push
export async function registerForPushNotificationsAsync(userId) {
  let token;

  // Verificar que es un dispositivo físico
  if (!Device.isDevice) {
    console.log('⚠️ Las notificaciones push requieren un dispositivo físico');
    return null;
  }

  // Configuración específica de Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  // Verificar/solicitar permisos
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Permiso de notificaciones denegado');
    return null;
  }

  // Obtener el token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId 
      ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.log('⚠️ No se encontró projectId, usando método alternativo');
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    
    console.log('🔔 Push token:', token);

    // Guardar token en Firestore
    if (userId && token) {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
      });
      console.log('✅ Token guardado en Firestore');
    }
  } catch (error) {
    console.error('❌ Error obteniendo push token:', error);
    return null;
  }

  return token;
}

// Enviar notificación de MATCH via backend
export async function sendMatchNotification(
  pushToken,
  matchId,
  fromUserId,
  fromUserName,
  fromUserPhoto
) {
  if (!pushToken) {
    console.log('⚠️ No hay push token para enviar notificación de match');
    return;
  }

  try {
    console.log('📤 Enviando notificación de match via backend...');
    
    const response = await fetch(`${BACKEND_URL}/api/send-match-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pushToken,
        matchId,
        fromUserId,
        fromUserName,
        fromUserPhoto,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Notificación de match enviada:', result);
    } else {
      console.error('❌ Error del backend:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error enviando notificación de match:', error);
  }
}

// Enviar notificación de MENSAJE via backend
export async function sendMessageNotification(
  pushToken,
  matchId,
  senderId,
  senderName,
  senderPhoto,
  messageText
) {
  if (!pushToken) {
    console.log('⚠️ No hay push token para enviar notificación de mensaje');
    return;
  }

  try {
    console.log('📤 Enviando notificación de mensaje via backend...');
    
    const response = await fetch(`${BACKEND_URL}/api/send-message-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pushToken,
        matchId,
        senderId,
        senderName,
        senderPhoto,
        messageText,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Notificación de mensaje enviada:', result);
    } else {
      console.error('❌ Error del backend:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error enviando notificación de mensaje:', error);
  }
}

// Listeners para notificaciones
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}