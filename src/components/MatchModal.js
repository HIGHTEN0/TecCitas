import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function MatchModal({
  visible,
  matchedProfile,
  currentUserProfile,
  onClose,
  onSendMessage,
}) {
  if (!matchedProfile || !currentUserProfile) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>¡Es un Match! 💕</Text>
          <Text style={styles.subtitle}>
            Tú y {matchedProfile.name} se gustaron mutuamente
          </Text>

          <View style={styles.imagesContainer}>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: currentUserProfile.photoURL }}
                style={styles.profileImage}
              />
            </View>
            <View style={styles.heartContainer}>
              <Text style={styles.heart}>💘</Text>
            </View>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: matchedProfile.photoURL }}
                style={styles.profileImage}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.messageButton} onPress={onSendMessage}>
            <Text style={styles.messageButtonText}>Enviar mensaje</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.keepSwipingButton} onPress={onClose}>
            <Text style={styles.keepSwipingText}>Seguir buscando</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 107, 107, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  imagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF6B6B',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  heartContainer: {
    marginHorizontal: -15,
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 5,
  },
  heart: {
    fontSize: 30,
  },
  messageButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    width: '100%',
    marginBottom: 15,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  keepSwipingButton: {
    paddingVertical: 10,
  },
  keepSwipingText: {
    color: '#666',
    fontSize: 16,
  },
});