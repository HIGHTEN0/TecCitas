// Agrega este import al inicio del archivo
import { sendMatchNotification } from '../../services/notifications';
import ReportModal from '../../components/ReportModal';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import MatchModal from '../../components/MatchModal';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [profileToReport, setProfileToReport] = useState(null);
  const swiperRef = useRef(null);

  useEffect(() => {
    if (userProfile) {
      fetchProfiles();
    }
  }, [userProfile]);

  const fetchProfiles = async () => {
  try {
    console.log('🔍 Buscando perfiles...');
    const currentUserId = auth.currentUser.uid;

    // Obtener usuarios que ya pasé (likes y dislikes)
    const passedSnapshot = await getDocs(
      collection(db, 'users', currentUserId, 'passed')
    );
    const passedIds = passedSnapshot.docs.map((doc) => doc.id);

    // Obtener usuarios bloqueados
    const blockedSnapshot = await getDocs(
      collection(db, 'users', currentUserId, 'blocked')
    );
    const blockedIds = blockedSnapshot.docs.map((doc) => doc.id);

    // Combinar IDs a excluir
    const excludeIds = [...passedIds, ...blockedIds, currentUserId];

    // Obtener todos los usuarios
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const fetchedProfiles = [];
    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Excluir usuarios ya vistos o bloqueados
      if (excludeIds.includes(docSnap.id)) return;

      // Filtrar por preferencias de género
      if (userProfile.interestedIn !== 'both') {
        if (data.gender !== userProfile.interestedIn) return;
      }

      // Verificar que el otro usuario esté interesado en mi género
      if (data.interestedIn !== 'both') {
        if (data.interestedIn !== userProfile.gender) return;
      }

      fetchedProfiles.push({
        id: docSnap.id,
        ...data,
      });
    });

    console.log(`✅ Encontrados ${fetchedProfiles.length} perfiles`);
    setProfiles(fetchedProfiles);
  } catch (error) {
    console.error('❌ Error fetching profiles:', error);
    Alert.alert('Error', 'No se pudieron cargar los perfiles');
  } finally {
    setLoading(false);
  }
};

 const handleSwipeRight = async (cardIndex) => {
  const likedProfile = profiles[cardIndex];
  const currentUserId = auth.currentUser.uid;

  console.log('💚 Like a:', likedProfile.name);

  try {
    // 1. Guardar MI like (escribo en MI subcolección)
    await setDoc(doc(db, 'users', currentUserId, 'likes', likedProfile.id), {
      timestamp: serverTimestamp(),
    });
    console.log('✅ Like guardado');

    // 2. Marcar como "pasado" (escribo en MI subcolección)
    await setDoc(doc(db, 'users', currentUserId, 'passed', likedProfile.id), {
      action: 'like',
      timestamp: serverTimestamp(),
    });
    console.log('✅ Passed guardado');

    // 3. Verificar si el OTRO usuario me dio like (leo SU subcolección)
    const otherUserLikeRef = doc(db, 'users', likedProfile.id, 'likes', currentUserId);
    const otherUserLike = await getDoc(otherUserLikeRef);

    if (otherUserLike.exists()) {
      console.log('🎉 ¡Es un match!');
      await createMatch(currentUserId, likedProfile);
    } else {
      console.log('⏳ Esperando que el otro de like...');
    }
  } catch (error) {
    console.error('❌ Error handling like:', error);
  }
};

 // Modifica la función createMatch:
const createMatch = async (currentUserId, likedProfile) => {
  try {
    const matchId = [currentUserId, likedProfile.id].sort().join('_');
    const matchRef = doc(db, 'matches', matchId);
    const existingMatch = await getDoc(matchRef);

    if (!existingMatch.exists()) {
      await setDoc(matchRef, {
        users: [currentUserId, likedProfile.id],
        usersData: {
          [currentUserId]: {
            name: userProfile.name,
            photoURL: userProfile.photoURL,
          },
          [likedProfile.id]: {
            name: likedProfile.name,
            photoURL: likedProfile.photoURL,
          },
        },
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: serverTimestamp(),
      });

      // 🔔 ENVIAR NOTIFICACIÓN AL OTRO USUARIO VIA BACKEND
      if (likedProfile.pushToken) {
        sendMatchNotification(
          likedProfile.pushToken,
          matchId,
          currentUserId,
          userProfile.name,
          userProfile.photoURL
        );
      }

      setMatchedProfile(likedProfile);
      setShowMatch(true);
    }
  } catch (error) {
    console.error('❌ Error creating match:', error);
  }
};

  const handleSwipeLeft = async (cardIndex) => {
    const dislikedProfile = profiles[cardIndex];
    const currentUserId = auth.currentUser.uid;

    console.log('❌ Nope a:', dislikedProfile.name);

    try {
      await setDoc(doc(db, 'users', currentUserId, 'passed', dislikedProfile.id), {
        action: 'dislike',
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error handling dislike:', error);
    }
  };

  const handleLikePress = () => {
    if (swiperRef.current && currentIndex < profiles.length) {
      swiperRef.current.swipeRight();
    }
  };

  const handleDislikePress = () => {
    if (swiperRef.current && currentIndex < profiles.length) {
      swiperRef.current.swipeLeft();
    }
  };

  if (loading) {
    return <Loading message="Buscando perfiles..." />;
  }

  if (profiles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>😢</Text>
        <Text style={styles.emptyTitle}>No hay más perfiles</Text>
        <Text style={styles.emptySubtitle}>
          Vuelve más tarde, quizás haya alguien nuevo
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => {
            setLoading(true);
            setCurrentIndex(0);
            fetchProfiles();
          }}
        >
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleReportPress = () => {
  if (profiles.length > 0 && currentIndex < profiles.length) {
    setProfileToReport(profiles[currentIndex]);
    setShowReportModal(true);
  }
};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💘 TecCitas</Text>
      </View>

      {/* Cards */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={profiles}
          renderCard={(card) => {
            if (!card) return null;
            return (
              <View style={styles.card}>
                <Image
                  source={{ uri: card.photoURL }}
                  style={styles.cardImage}
                />
                <View style={styles.cardGradient}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {card.name}, {card.age}
                    </Text>
                    <Text style={styles.cardCareer}>{card.career}</Text>
                    {card.bio ? (
                      <Text style={styles.cardBio} numberOfLines={2}>
                        {card.bio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          onSwipedRight={handleSwipeRight}
          onSwipedLeft={handleSwipeLeft}
          onSwiped={(cardIndex) => setCurrentIndex(cardIndex + 1)}
          onSwipedAll={() => {
            console.log('📭 No hay más perfiles');
            setProfiles([]);
          }}
          cardIndex={0}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={15}
          animateCardOpacity
          animateOverlayLabelsOpacity
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#FF6B6B',
                  color: '#FF6B6B',
                  borderWidth: 2,
                  fontSize: 24,
                  fontWeight: 'bold',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: -30,
                },
              },
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#4CCC93',
                  color: '#4CCC93',
                  borderWidth: 2,
                  fontSize: 24,
                  fontWeight: 'bold',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: 30,
                },
              },
            },
          }}
          disableBottomSwipe
          disableTopSwipe
        />
      </View>

      {/* Action Buttons */}
<View style={styles.buttonsContainer}>
  {/* Botón Reporte */}
  <TouchableOpacity
    style={[styles.actionButton, styles.reportButton]}
    onPress={handleReportPress}
  >
    <Text style={styles.reportButtonText}>⚠️</Text>
  </TouchableOpacity>

  {/* Botón Dislike */}
  <TouchableOpacity
    style={[styles.actionButton, styles.dislikeButton]}
    onPress={handleDislikePress}
  >
    <Text style={styles.dislikeButtonText}>✕</Text>
  </TouchableOpacity>

  {/* Botón Like */}
  <TouchableOpacity
    style={[styles.actionButton, styles.likeButton]}
    onPress={handleLikePress}
  >
    <Text style={styles.likeButtonText}>♥</Text>
  </TouchableOpacity>
</View>

      {/* Match Modal */}
      <MatchModal
        visible={showMatch}
        matchedProfile={matchedProfile}
        currentUserProfile={userProfile}
        onClose={() => setShowMatch(false)}
        onSendMessage={() => {
          setShowMatch(false);
          navigation.navigate('Matches');
        }}
      />
   {/* Report Modal - AGREGAR AQUÍ */}
      <ReportModal
        visible={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setProfileToReport(null);
        }}
        reportedUserId={profileToReport?.id}
        reportedUserName={profileToReport?.name}
        reportedUserPhoto={profileToReport?.photoURL}
      />
    </View> // <-- Este es el cierre del contenedor principal
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  swiperContainer: {
    flex: 1,
  },
  card: {
    height: height * 0.55,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  cardInfo: {
    padding: 20,
  },
  cardName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardCareer: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  cardBio: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 30,
    backgroundColor: '#fff',
    gap: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  dislikeButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  dislikeButtonText: {
    fontSize: 30,
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  likeButton: {
    backgroundColor: '#FF6B6B',
  },
  likeButtonText: {
    fontSize: 30,
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportButton: {
  backgroundColor: '#fff',
  borderWidth: 2,
  borderColor: '#FFA500',
  width: 50,
  height: 50,
  borderRadius: 25,
},
reportButtonText: {
  fontSize: 20,
},
});