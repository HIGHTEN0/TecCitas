import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { deleteUserAccount } from '../../services/deleteAccount';

// 🔑 Tu API key de ImgBB
const IMGBB_API_KEY = '1d91d20efe78d213c5a09391aa216d71'; // Reemplaza con tu key

const CAREERS = [
  'Ing. Sistemas Computacionales',
  'Ing. Industrial',
  'Ing. Electromecánica',
  'Ing. Gestión Empresarial',
  'Ing. Civil',
  'Ing. Energías Renovables',
];

export default function ProfileScreen() {
  const { user, userProfile, setUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Estados para edición
  const [name, setName] = useState(userProfile?.name || '');
  const [age, setAge] = useState(userProfile?.age?.toString() || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [career, setCareer] = useState(userProfile?.career || '');
  const [newPhoto, setNewPhoto] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setNewPhoto(result.assets[0]);
    }
  };

  const uploadImageToImgBB = async () => {
    if (!newPhoto || !newPhoto.base64) return userProfile.photoURL;

    try {
      console.log('📤 Subiendo nueva foto...');

      const formData = new FormData();
      formData.append('image', newPhoto.base64);
      formData.append('name', `teccitas_${user.uid}_${Date.now()}`);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log('✅ Foto subida:', data.data.url);
        return data.data.url;
      } else {
        throw new Error('Error al subir imagen');
      }
    } catch (error) {
      console.error('❌ Error uploading to ImgBB:', error);
      Alert.alert('Error', 'No se pudo subir la imagen');
      return userProfile.photoURL;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!age || parseInt(age) < 18 || parseInt(age) > 100) {
      Alert.alert('Error', 'Ingresa una edad válida (18+)');
      return;
    }
    if (!career) {
      Alert.alert('Error', 'Selecciona tu carrera');
      return;
    }

    setLoading(true);
    try {
      let photoURL = userProfile.photoURL;

      if (newPhoto) {
        photoURL = await uploadImageToImgBB();
      }

      const updatedData = {
        name: name.trim(),
        age: parseInt(age),
        bio: bio.trim(),
        career,
        photoURL,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'users', user.uid), updatedData);

      setUserProfile({ ...userProfile, ...updatedData });
      setNewPhoto(null);
      setEditing(false);

      Alert.alert('¡Listo!', 'Tu perfil ha sido actualizado');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'No se pudo actualizar tu perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(userProfile?.name || '');
    setAge(userProfile?.age?.toString() || '');
    setBio(userProfile?.bio || '');
    setCareer(userProfile?.career || '');
    setNewPhoto(null);
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      Alert.alert('Error', 'Escribe ELIMINAR para confirmar');
      return;
    }

    setDeleting(true);
    try {
      await deleteUserAccount();
      // La app automáticamente redirigirá al login porque el usuario ya no existe
    } catch (error) {
      console.error('Error deleting account:', error);

      // Si el error es de reautenticación
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Sesión expirada',
          'Por seguridad, necesitas volver a iniciar sesión antes de eliminar tu cuenta.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Cerrar sesión',
              onPress: async () => {
                await signOut(auth);
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'No se pudo eliminar la cuenta. Intenta de nuevo.');
      }
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    }
  };


  if (!userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          {!editing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Foto de perfil */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            onPress={editing ? pickImage : null}
            activeOpacity={editing ? 0.7 : 1}
          >
            <Image
              source={{ uri: newPhoto?.uri || userProfile.photoURL }}
              style={styles.profilePhoto}
            />
            {editing && (
              <View style={styles.photoOverlay}>
                <Text style={styles.photoOverlayText}>📷</Text>
                <Text style={styles.photoOverlayLabel}>Cambiar</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info del perfil */}
        <View style={styles.infoSection}>
          {/* Nombre */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NOMBRE</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.fieldValue}>{userProfile.name}</Text>
            )}
          </View>

          {/* Edad */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>EDAD</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Tu edad"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={2}
              />
            ) : (
              <Text style={styles.fieldValue}>{userProfile.age} años</Text>
            )}
          </View>

          {/* Carrera */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CARRERA</Text>
            {editing ? (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCareerModal(true)}
              >
                <Text style={[styles.selectButtonText, !career && styles.placeholder]}>
                  {career || 'Selecciona tu carrera'}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.fieldValue}>{userProfile.career}</Text>
            )}
          </View>

          {/* Bio */}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SOBRE MÍ</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Cuéntanos sobre ti..."
                placeholderTextColor="#999"
                multiline
                maxLength={200}
              />
            ) : (
              <Text style={styles.fieldValue}>
                {userProfile.bio || 'Sin descripción'}
              </Text>
            )}
          </View>


          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CORREO INSTITUCIONAL</Text>
            <Text style={[styles.fieldValue, styles.emailText]}>
              {userProfile.email}
            </Text>
            <Text style={styles.verifiedBadge}>✓ Verificado</Text>
          </View>

          {/* Género */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>GÉNERO</Text>
            <Text style={styles.fieldValue}>
              {userProfile.gender === 'male' && '👨 Hombre'}
              {userProfile.gender === 'female' && '👩 Mujer'}
              {userProfile.gender === 'other' && '🌈 Otro'}
            </Text>
          </View>

          {/* Intereses */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ME INTERESAN</Text>
            <Text style={styles.fieldValue}>
              {userProfile.interestedIn === 'male' && '👨 Hombres'}
              {userProfile.interestedIn === 'female' && '👩 Mujeres'}
              {userProfile.interestedIn === 'both' && '💕 Ambos'}
            </Text>
          </View>
        </View>

        {/* Botón guardar */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Acciones */}
        {!editing && (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>🚪 Cerrar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteAccountButtonText}>🗑️ Eliminar mi cuenta</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info de la app */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>💘 TecCitas</Text>
          <Text style={styles.appVersion}>Versión 1.0.0</Text>
          <Text style={styles.appCredits}>Hecho con ❤️ en TecNM Delicias</Text>
        </View>

        {/* Modal de selección de carrera */}
        <Modal
          visible={showCareerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCareerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Selecciona tu carrera</Text>

              <ScrollView style={styles.modalOptions}>
                {CAREERS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.modalOption,
                      career === c && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setCareer(c);
                      setShowCareerModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        career === c && styles.modalOptionTextSelected,
                      ]}
                    >
                      {c}
                    </Text>
                    {career === c && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCareerModal(false)}
              >
                <Text style={styles.modalCloseText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal de confirmación de eliminación */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={styles.deleteModalOverlay}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalIcon}>⚠️</Text>
              <Text style={styles.deleteModalTitle}>Eliminar cuenta</Text>
              <Text style={styles.deleteModalText}>
                Esta acción es <Text style={styles.boldText}>permanente</Text> y no se puede deshacer.
              </Text>
              <Text style={styles.deleteModalText}>
                Se eliminarán:
              </Text>
              <View style={styles.deleteList}>
                <Text style={styles.deleteListItem}>• Tu perfil y fotos</Text>
                <Text style={styles.deleteListItem}>• Todos tus matches</Text>
                <Text style={styles.deleteListItem}>• Todas tus conversaciones</Text>
                <Text style={styles.deleteListItem}>• Tu cuenta de acceso</Text>
              </View>

              <Text style={styles.deleteModalConfirmText}>
                Escribe <Text style={styles.boldText}>ELIMINAR</Text> para confirmar:
              </Text>
              <TextInput
                style={styles.deleteConfirmInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="ELIMINAR"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={styles.deleteModalCancelButton}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={deleting}
                >
                  <Text style={styles.deleteModalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteModalConfirmButton,
                    deleteConfirmText !== 'ELIMINAR' && styles.deleteModalConfirmDisabled,
                  ]}
                  onPress={confirmDeleteAccount}
                  disabled={deleteConfirmText !== 'ELIMINAR' || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.deleteModalConfirmButtonText}>
                      Eliminar cuenta
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profilePhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#FF6B6B',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlayText: {
    fontSize: 30,
  },
  photoOverlayLabel: {
    color: '#fff',
    marginTop: 5,
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: 20,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 17,
    color: '#333',
  },
  emailText: {
    color: '#666',
  },
  verifiedBadge: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 5,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectArrow: {
    color: '#999',
    fontSize: 12,
  },
  placeholder: {
    color: '#999',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ffaaaa',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsSection: {
    marginTop: 30,
    paddingHorizontal: 20,
    gap: 15,
  },
  logoutButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  deleteAccountButton: {
    backgroundColor: '#fff5f5',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    paddingVertical: 20,
  },
  appInfoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  appVersion: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  appCredits: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 5,
  },

  // Modal de carrera
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOptions: {
    paddingHorizontal: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#fff5f5',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  checkmark: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#999',
  },

  // Modal de eliminación
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalIcon: {
    fontSize: 50,
    textAlign: 'center',
    marginBottom: 15,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 15,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#333',
  },
  deleteList: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginVertical: 15,
  },
  deleteListItem: {
    fontSize: 14,
    color: '#666',
    marginVertical: 3,
  },
  deleteModalConfirmText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  deleteConfirmInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  deleteModalCancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  deleteModalConfirmButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  deleteModalConfirmDisabled: {
    backgroundColor: '#ffcccc',
  },
  deleteModalConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});