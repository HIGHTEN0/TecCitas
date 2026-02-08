import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Loading from '../../components/Loading';

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const buildMatchesData = (docs, currentUserId) => {
    const matchesData = docs.map((doc) => {
      const data = doc.data();
      const otherUserId = data.users.find((id) => id !== currentUserId);
      const otherUserData = data.usersData?.[otherUserId];

      return {
        id: doc.id,
        otherUserId,
        otherUserName: otherUserData?.name || 'Usuario',
        otherUserPhoto: otherUserData?.photoURL,
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime?.toDate(),
        createdAt: data.createdAt?.toDate(),
      };
    });

    matchesData.sort((a, b) => {
      const timeA = a.lastMessageTime || a.createdAt || new Date(0);
      const timeB = b.lastMessageTime || b.createdAt || new Date(0);
      return timeB - timeA;
    });

    return matchesData;
  };

  const loadMatches = async () => {
    if (!auth.currentUser) {
      console.log('⚠️ No hay usuario, saltando recarga de matches');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const currentUserId = auth.currentUser.uid;

    try {
      const matchesQuery = query(
        collection(db, 'matches'),
        where('users', 'array-contains', currentUserId)
      );

      const snapshot = await getDocs(matchesQuery);
      const matchesData = buildMatchesData(snapshot.docs, currentUserId);

      setMatches(matchesData);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error reloading matches:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
  let unsubscribe = null;

  // Verificar que hay usuario antes de hacer la query
  if (!auth.currentUser) {
    console.log('⚠️ No hay usuario, saltando query de matches');
    setLoading(false);
    return;
  }

  const currentUserId = auth.currentUser.uid;
  console.log('🔍 Buscando matches...');

  try {
    const matchesQuery = query(
      collection(db, 'matches'),
      where('users', 'array-contains', currentUserId)
    );

    unsubscribe = onSnapshot(
      matchesQuery,
      (snapshot) => {
        // Verificar de nuevo por si cerró sesión mientras cargaba
        if (!auth.currentUser) {
          console.log('⚠️ Usuario cerró sesión, ignorando resultados');
          return;
        }
        
        const matchesData = buildMatchesData(snapshot.docs, currentUserId);

        console.log(`✅ Encontrados ${matchesData.length} matches`);
        setMatches(matchesData);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        // Ignorar errores de permisos cuando se cierra sesión
        if (error.code === 'permission-denied' || !auth.currentUser) {
          console.log('⚠️ Query cancelada (sesión cerrada)');
          return;
        }
        console.error('❌ Error fetching matches:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );
  } catch (error) {
    console.error('❌ Error setting up matches listener:', error);
    setLoading(false);
  }

  // Cleanup: desuscribir cuando el componente se desmonte
  return () => {
    if (unsubscribe) {
      console.log('🧹 Limpiando listener de matches');
      unsubscribe();
    }
  };
}, []);

  const handleMatchPress = (match) => {
    navigation.navigate('Chat', {
      matchId: match.id,
      otherUserId: match.otherUserId,
      otherUserName: match.otherUserName,
      otherUserPhoto: match.otherUserPhoto,
    });
  };

  const formatTime = (date) => {
    if (!date) return '';

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const renderNewMatches = () => {
    const newMatches = matches.filter((m) => !m.lastMessage);
    
    if (newMatches.length === 0) return null;

    return (
      <View style={styles.newMatchesSection}>
        <Text style={styles.sectionTitle}>Nuevos Matches ✨</Text>
        <FlatList
          horizontal
          data={newMatches}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.newMatchesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.newMatchItem}
              onPress={() => handleMatchPress(item)}
            >
              <View style={styles.newMatchAvatarContainer}>
                {item.otherUserPhoto ? (
                  <Image
                    source={{ uri: item.otherUserPhoto }}
                    style={styles.newMatchAvatar}
                  />
                ) : (
                  <View style={styles.newMatchAvatarPlaceholder}>
                    <Text style={styles.newMatchAvatarText}>
                      {item.otherUserName?.charAt(0)?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.newMatchRing} />
              </View>
              <Text style={styles.newMatchName} numberOfLines={1}>
                {item.otherUserName?.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderMatchItem = ({ item }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => handleMatchPress(item)}
      activeOpacity={0.7}
    >
      {/* Foto de perfil */}
      <View style={styles.avatarContainer}>
        {item.otherUserPhoto ? (
          <Image
            source={{ uri: item.otherUserPhoto }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {item.otherUserName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Info del match */}
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchName} numberOfLines={1}>
            {item.otherUserName}
          </Text>
          {item.lastMessageTime && (
            <Text style={styles.matchTime}>
              {formatTime(item.lastMessageTime)}
            </Text>
          )}
        </View>

        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || '¡Nuevo match! Di hola 👋'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💔</Text>
      <Text style={styles.emptyTitle}>Aún no tienes matches</Text>
      <Text style={styles.emptySubtitle}>
        Sigue dando swipe para encontrar a alguien especial
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.exploreButtonText}>Explorar perfiles</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <Loading message="Cargando matches..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches halcones</Text>
        <Text style={styles.headerSubtitle}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </Text>
      </View>

      {matches.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={matches.filter((m) => m.lastMessage)}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchItem}
          ListHeaderComponent={renderNewMatches}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF6B6B']}
              tintColor="#FF6B6B"
            />
          }
          ListEmptyComponent={() => {
            const newMatches = matches.filter((m) => !m.lastMessage);
            if (newMatches.length > 0) {
              return (
                <View style={styles.noMessagesContainer}>
                  <Text style={styles.noMessagesText}>
                    ¡Tienes {newMatches.length} {newMatches.length === 1 ? 'nuevo match' : 'nuevos matches'}!{'\n'}
                    Inicia una conversación 💬
                  </Text>
                </View>
              );
            }
            return null;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  listContent: {
    flexGrow: 1,
  },
  newMatchesSection: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  newMatchesList: {
    paddingHorizontal: 15,
  },
  newMatchItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 75,
  },
  newMatchAvatarContainer: {
    position: 'relative',
  },
  newMatchAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
  },
  newMatchAvatarPlaceholder: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newMatchAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  newMatchRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  newMatchName: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 15,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  matchName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  matchTime: {
    fontSize: 13,
    color: '#999',
    marginLeft: 10,
  },
  lastMessage: {
    fontSize: 15,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
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
  exploreButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noMessagesContainer: {
    padding: 30,
    alignItems: 'center',
  },
  noMessagesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});