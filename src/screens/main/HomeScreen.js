import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
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
import ReportModal from '../../components/ReportModal';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.6;
const SWIPE_THRESHOLD = width * 0.25;

export default function HomeScreen({ navigation }) {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Animaciones
  const position = useRef(new Animated.ValueXY()).current;
  const [isAnimating, setIsAnimating] = useState(false);

  // Rotación basada en posición X
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });

  // Opacidad de los labels LIKE/NOPE
  const likeOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Escala de la siguiente carta
  const nextCardScale = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp',
  });

  // PanResponder para el swipe manual
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimating,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return !isAnimating && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5);
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  // Cargar perfiles
  useEffect(() => {
    if (userProfile) {
      fetchProfiles();
    }
  }, [userProfile]);

  const fetchProfiles = async () => {
    try {
      console.log('🔍 Buscando perfiles...');
      const currentUserId = auth.currentUser.uid;

      // Obtener usuarios que ya pasé
      const passedSnapshot = await getDocs(
        collection(db, 'users', currentUserId, 'passed')
      );
      const passedIds = passedSnapshot.docs.map((doc) => doc.id);

      // Obtener usuarios bloqueados
      const blockedSnapshot = await getDocs(
        collection(db, 'users', currentUserId, 'blocked')
      );
      const blockedIds = blockedSnapshot.docs.map((doc) => doc.id);

      const excludeIds = [...passedIds, ...blockedIds, currentUserId];

      // Obtener todos los usuarios
      const usersSnapshot = await getDocs(collection(db, 'users'));

      const fetchedProfiles = [];
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        if (excludeIds.includes(docSnap.id)) return;

        // Filtrar por preferencias
        if (userProfile.interestedIn !== 'both') {
          if (data.gender !== userProfile.interestedIn) return;
        }

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
      setCurrentIndex(0);
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      Alert.alert('Error', 'No se pudieron cargar los perfiles');
    } finally {
      setLoading(false);
    }
  };

  // Resetear posición
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      useNativeDriver: false,
    }).start();
  };

  // Animar swipe hacia la derecha (LIKE)
  const swipeRight = useCallback(() => {
    if (isAnimating || currentIndex >= profiles.length) return;

    setIsAnimating(true);
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      handleSwipeRight(currentIndex);
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
    });
  }, [isAnimating, currentIndex, profiles.length]);

  // Animar swipe hacia la izquierda (NOPE)
  const swipeLeft = useCallback(() => {
    if (isAnimating || currentIndex >= profiles.length) return;

    setIsAnimating(true);
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      handleSwipeLeft(currentIndex);
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
    });
  }, [isAnimating, currentIndex, profiles.length]);

  // Manejar Like
  const handleSwipeRight = async (cardIndex) => {
    const likedProfile = profiles[cardIndex];
    if (!likedProfile) return;

    const currentUserId = auth.currentUser.uid;
    console.log('💚 Like a:', likedProfile.name);

    try {
      // Guardar el like
      await setDoc(doc(db, 'users', currentUserId, 'likes', likedProfile.id), {
        timestamp: serverTimestamp(),
      });

      // Marcar como pasado
      await setDoc(doc(db, 'users', currentUserId, 'passed', likedProfile.id), {
        action: 'like',
        timestamp: serverTimestamp(),
      });

      // Verificar match
      const otherUserLikeRef = doc(db, 'users', likedProfile.id, 'likes', currentUserId);
      const otherUserLike = await getDoc(otherUserLikeRef);

      if (otherUserLike.exists()) {
        console.log('🎉 ¡Es un match!');
        await createMatch(currentUserId, likedProfile);
      }
    } catch (error) {
      console.error('❌ Error handling like:', error);
    }
  };

  // Manejar Nope
  const handleSwipeLeft = async (cardIndex) => {
    const dislikedProfile = profiles[cardIndex];
    if (!dislikedProfile) return;

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

  // Crear match
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

        setMatchedProfile(likedProfile);
        setShowMatch(true);
      }
    } catch (error) {
      console.error('❌ Error creating match:', error);
    }
  };

  // Renderizar carta
  const renderCard = (profile, index) => {
    if (!profile) return null;

    const isCurrentCard = index === currentIndex;
    const isNextCard = index === currentIndex + 1;

    if (!isCurrentCard && !isNextCard) return null;

    const cardStyle = isCurrentCard
      ? {
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { rotate },
        ],
        zIndex: 2,
      }
      : {
        transform: [{ scale: nextCardScale }],
        zIndex: 1,
      };

    return (
      <Animated.View
        key={profile.id}
        style={[styles.card, cardStyle]}
        {...(isCurrentCard ? panResponder.panHandlers : {})}
      >
        {/* Imagen */}
        <Image
          source={{ uri: profile.photoURL }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        {/* Gradiente y info */}
        <View style={styles.cardOverlay}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>
              {profile.name}, {profile.age}
            </Text>
            <Text style={styles.cardCareer}>{profile.career}</Text>
            {profile.bio ? (
              <Text style={styles.cardBio} numberOfLines={2}>
                {profile.bio}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Label LIKE */}
        {isCurrentCard && (
          <Animated.View style={[styles.labelContainer, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.likeLabelText}>LIKE</Text>
          </Animated.View>
        )}

        {/* Label NOPE */}
        {isCurrentCard && (
          <Animated.View style={[styles.labelContainer, styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={styles.nopeLabelText}>NOPE</Text>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  // Obtener perfil actual
  const currentProfile = profiles[currentIndex];

  if (loading) {
    return <Loading message="Buscando perfiles..." />;
  }

  if (profiles.length === 0 || currentIndex >= profiles.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>💘 TecCitas</Text>
        </View>
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
            <Text style={styles.refreshButtonText}>🔄 Actualizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💘 TecCitas</Text>
      </View>

      {/* Cards Container */}
      <View style={styles.cardsContainer}>
        {profiles
          .slice(currentIndex, currentIndex + 2)
          .reverse()
          .map((profile, i) => renderCard(profile, currentIndex + (1 - i)))}
      </View>

      {/* Action Buttons */}
      <View style={[styles.buttonsContainer, { paddingBottom: insets.bottom + 10 }]}>
        {/* Botón Reportar */}
        <TouchableOpacity
          style={[styles.actionButton, styles.reportButton]}
          onPress={() => setShowReportModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.reportButtonText}>⚠️</Text>
        </TouchableOpacity>

        {/* Botón NOPE */}
        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={swipeLeft}
          activeOpacity={0.8}
          disabled={isAnimating}
        >
          <Text style={styles.nopeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Botón LIKE */}
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={swipeRight}
          activeOpacity={0.8}
          disabled={isAnimating}
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

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={currentProfile?.id}
        reportedUserName={currentProfile?.name}
        reportedUserPhoto={currentProfile?.photoURL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
  },
  cardInfo: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    marginTop: 8,
  },
  labelContainer: {
    position: 'absolute',
    top: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderRadius: 10,
  },
  likeLabel: {
    left: 20,
    borderColor: '#4CCC93',
    transform: [{ rotate: '-20deg' }],
  },
  likeLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CCC93',
  },
  nopeLabel: {
    right: 20,
    borderColor: '#FF6B6B',
    transform: [{ rotate: '20deg' }],
  },
  nopeLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 30,
    backgroundColor: '#fff',
    gap: 20,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  reportButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  reportButtonText: {
    fontSize: 22,
  },
  nopeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  nopeButtonText: {
    fontSize: 35,
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  likeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF6B6B',
  },
  likeButtonText: {
    fontSize: 35,
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});