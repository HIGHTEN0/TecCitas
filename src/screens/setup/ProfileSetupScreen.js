import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

// 🔑 Reemplaza con tu API key de ImgBB
const IMGBB_API_KEY = '1d91d20efe78d213c5a09391aa216d71';

const CAREERS = [
  'Ing. Sistemas Computacionales',
  'Ing. Industrial',
  'Ing. Electromecánica',
  'Ing. Gestión Empresarial',
  'Ing. Energías Renovables',
  'Ing. Civil',
];

export default function ProfileSetupScreen() {
  const { user, setUserProfile } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [career, setCareer] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

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
      base64: true, // Importante: necesitamos base64 para ImgBB
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  //  Subir imagen a ImgBB
  const uploadImageToImgBB = async () => {
    if (!image || !image.base64) {
      Alert.alert('Error', 'No se pudo procesar la imagen');
      return null;
    }

    try {
      console.log('📤 Subiendo imagen a ImgBB...');

      const formData = new FormData();
      formData.append('image', image.base64);
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
        console.log('✅ Imagen subida:', data.data.url);
        return data.data.url;
      } else {
        console.error('❌ Error de ImgBB:', data);
        throw new Error('Error al subir imagen');
      }
    } catch (error) {
      console.error('❌ Error uploading to ImgBB:', error);
      Alert.alert('Error', 'No se pudo subir la imagen. Intenta de nuevo.');
      return null;
    }
  };

  const handleSaveProfile = async () => {
    // Validaciones
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa tu nombre');
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
    if (!gender) {
      Alert.alert('Error', 'Selecciona tu género');
      return;
    }
    if (!interestedIn) {
      Alert.alert('Error', 'Selecciona en quién estás interesado/a');
      return;
    }
    if (!image) {
      Alert.alert('Error', 'Sube una foto de perfil');
      return;
    }

    setLoading(true);
    try {
      // Subir imagen a ImgBB
      const photoURL = await uploadImageToImgBB();

      if (!photoURL) {
        setLoading(false);
        return;
      }

      const profileData = {
        name: name.trim(),
        age: parseInt(age),
        career,
        bio: bio.trim(),
        gender,
        interestedIn,
        photoURL,
        email: user.email,
        createdAt: new Date(),
        uid: user.uid,
      };

      await setDoc(doc(db, 'users', user.uid), profileData);
      setUserProfile(profileData);

      Alert.alert('¡Perfil creado!', 'Ya puedes empezar a conocer gente 💘');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar tu perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Crea tu perfil</Text>
          <Text style={styles.subtitle}>Cuéntanos sobre ti</Text>
        </View>

        {/* Foto de perfil */}
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>📷</Text>
              <Text style={styles.imagePlaceholderLabel}>Agregar foto</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Nombre */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="¿Cómo te llamas?"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />

        {/* Edad */}
        <Text style={styles.label}>Edad</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu edad"
          placeholderTextColor="#999"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          maxLength={2}
        />

        {/* Carrera */}
        <Text style={styles.label}>Carrera</Text>
        <View style={styles.optionsContainer}>
          {CAREERS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.option, career === c && styles.optionSelected]}
              onPress={() => setCareer(c)}
            >
              <Text style={[styles.optionText, career === c && styles.optionTextSelected]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Género */}
        <Text style={styles.label}>Soy</Text>
        <View style={styles.genderContainer}>
          {[
            { value: 'male', label: '👨 Hombre' },
            { value: 'female', label: '👩 Mujer' },
          ].map((g) => (
            <TouchableOpacity
              key={g.value}
              style={[styles.genderOption, gender === g.value && styles.optionSelected]}
              onPress={() => setGender(g.value)}
            >
              <Text style={[styles.optionText, gender === g.value && styles.optionTextSelected]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Interesado en */}
        <Text style={styles.label}>Me interesan</Text>
        <View style={styles.genderContainer}>
          {[
            { value: 'male', label: '👨 Hombres' },
            { value: 'female', label: '👩 Mujeres' },
            { value: 'both', label: '💕 Ambos' },
          ].map((g) => (
            <TouchableOpacity
              key={g.value}
              style={[styles.genderOption, interestedIn === g.value && styles.optionSelected]}
              onPress={() => setInterestedIn(g.value)}
            >
              <Text style={[styles.optionText, interestedIn === g.value && styles.optionTextSelected]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bio */}
        <Text style={styles.label}>Sobre mí (opcional)</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Cuéntanos algo interesante..."
          placeholderTextColor="#999"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={200}
        />

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Guardando...' : 'Crear perfil'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  imageContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 40,
  },
  imagePlaceholderLabel: {
    color: '#999',
    marginTop: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  option: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  optionSelected: {
    backgroundColor: '#FF6B6B',
  },
  optionText: {
    color: '#666',
    fontSize: 14,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderOption: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonDisabled: {
    backgroundColor: '#ffaaaa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});