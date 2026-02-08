import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function VerifyEmailScreen() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || sending) return;

    setSending(true);
    try {
      setResendCooldown(60);
      await sendEmailVerification(user);
      Alert.alert('Correo enviado', 'Revisa tu bandeja de entrada');
    } catch (error) {
      Alert.alert('Error', 'Espera un momento antes de reenviar el correo');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await user.reload();
      if (user.emailVerified) {
        Alert.alert('¡Verificado!', 'Tu correo ha sido verificado', [
          { text: 'OK', onPress: () => handleLogout },
        ]);
      } else {
        Alert.alert('Aún no verificado', 'Por favor verifica tu correo institucional');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo verificar el estado');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📧</Text>
      <Text style={styles.title}>Verifica tu correo</Text>
      <Text style={styles.subtitle}>
        Enviamos un enlace de verificación a:
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleRefresh}
        >
          <Text style={styles.buttonText}>Ya verifiqué mi correo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleResendEmail}
          disabled={sending || resendCooldown > 0}
        >
          <Text style={styles.buttonTextSecondary}>
            {sending
              ? 'Enviando...'
              : resendCooldown > 0
              ? `Reenviar en ${resendCooldown}s`
              : 'Reenviar correo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleLogout}
        >
          <Text style={styles.linkText}>Usar otra cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginTop: 5,
    marginBottom: 40,
  },
  buttons: {
    width: '100%',
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#666',
    fontSize: 14,
  },
});