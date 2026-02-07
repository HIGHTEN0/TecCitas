import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const REPORT_REASONS = [
  { id: 'fake', label: '👤 Perfil falso / Spam', icon: '👤' },
  { id: 'inappropriate', label: '🔞 Contenido inapropiado', icon: '🔞' },
  { id: 'offensive', label: '😤 Comportamiento ofensivo', icon: '😤' },
  { id: 'harassment', label: '⚠️ Acoso', icon: '⚠️' },
  { id: 'impersonation', label: '🎭 Suplantación de identidad', icon: '🎭' },
  { id: 'underage', label: '🔒 Menor de edad', icon: '🔒' },
  { id: 'other', label: '📝 Otro', icon: '📝' },
];

export default function ReportModal({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  reportedUserPhoto,
}) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockUser, setBlockUser] = useState(true);

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Por favor selecciona un motivo');
      return;
    }

    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      Alert.alert('Error', 'Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      // 1. Guardar el reporte en Firestore
      const reportData = {
        reportedUserId,
        reportedUserName,
        reportedUserPhoto,
        reporterId: currentUserId,
        reason: selectedReason,
        reasonLabel: REPORT_REASONS.find(r => r.id === selectedReason)?.label,
        details: details.trim(),
        status: 'pending', // pending, reviewed, resolved, dismissed
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'reports'), reportData);
      console.log('✅ Reporte guardado');

      // 2. Si el usuario eligió bloquear, guardar en su lista de bloqueados
      if (blockUser) {
        await setDoc(
          doc(db, 'users', currentUserId, 'blocked', reportedUserId),
          {
            blockedAt: serverTimestamp(),
            reason: selectedReason,
          }
        );
        console.log('✅ Usuario bloqueado');
      }

      Alert.alert(
        '✅ Reporte enviado',
        blockUser
          ? `Gracias por tu reporte. ${reportedUserName} ha sido bloqueado y ya no verás su perfil.`
          : 'Gracias por tu reporte. Nuestro equipo lo revisará pronto.',
        [{ text: 'OK', onPress: onClose }]
      );

      // Limpiar estado
      setSelectedReason(null);
      setDetails('');
      setBlockUser(true);

    } catch (error) {
      console.error('❌ Error enviando reporte:', error);
      Alert.alert('Error', 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    setBlockUser(true);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🚨 Reportar usuario</Text>
            <Text style={styles.subtitle}>
              Reportar a {reportedUserName}
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Razones */}
            <Text style={styles.sectionTitle}>¿Por qué reportas a este usuario?</Text>
            
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonOption,
                  selectedReason === reason.id && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason.id && styles.reasonTextSelected,
                  ]}
                >
                  {reason.label.split(' ').slice(1).join(' ')}
                </Text>
                {selectedReason === reason.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Detalles adicionales */}
            <Text style={styles.sectionTitle}>Detalles adicionales (opcional)</Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Cuéntanos más sobre lo sucedido..."
              placeholderTextColor="#999"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
            />

            {/* Opción de bloquear */}
            <TouchableOpacity
              style={styles.blockOption}
              onPress={() => setBlockUser(!blockUser)}
            >
              <View style={[styles.checkbox, blockUser && styles.checkboxChecked]}>
                {blockUser && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.blockText}>
                También bloquear a {reportedUserName}
              </Text>
            </TouchableOpacity>

            <Text style={styles.blockHint}>
              Si bloqueas a este usuario, no podrán ver tu perfil ni contactarte.
            </Text>
          </ScrollView>

          {/* Botones */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmitReport}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar reporte</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 10,
  },
  reasonOptionSelected: {
    backgroundColor: '#fff5f5',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  reasonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  reasonTextSelected: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  detailsInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  blockOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  blockText: {
    fontSize: 16,
    color: '#333',
  },
  blockHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 5,
    marginLeft: 36,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ffaaaa',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});