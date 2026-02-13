import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import ReportModal from '../../components/ReportModal';

export default function ChatScreen({ route, navigation }) {
  const { matchId, otherUserId, otherUserName, otherUserPhoto } = route.params;
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  const currentUser = auth.currentUser;

  // Escuchar teclado para hacer scroll
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);



  // Configurar header
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <View style={styles.headerTitle}>
          {otherUserPhoto ? (
            <Image source={{ uri: otherUserPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {otherUserName?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.headerName}>{otherUserName}</Text>
        </View>
      ),
      headerLeft: () => (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.reportHeaderButton}
          onPress={() => setShowReportModal(true)}
        >
          <Text style={styles.reportHeaderButtonText}>⚠️</Text>
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: '#fff',
        elevation: 1,
        shadowOpacity: 0.1,
      },
      headerStatusBarHeight: insets.top,
    });
  }, [navigation, otherUserName, otherUserPhoto, insets]);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!auth.currentUser) {
      console.log('⚠️ No hay usuario, saltando carga de mensajes');
      return;
    }

    console.log('💬 Cargando mensajes del match:', matchId);

    const messagesRef = collection(db, 'matches', matchId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (!auth.currentUser) return;

        const fetchedMessages = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            text: data.text,
            createdAt: data.createdAt?.toDate() || new Date(),
            senderId: data.senderId,
            senderName: data.senderName,
            senderPhoto: data.senderPhoto,
          };
        });
        console.log(`✅ ${fetchedMessages.length} mensajes cargados`);
        setMessages(fetchedMessages);
      },
      (error) => {
        if (error.code === 'permission-denied' || !auth.currentUser) {
          console.log('⚠️ Query cancelada (sesión cerrada)');
          return;
        }
        console.error('❌ Error fetching messages:', error);
      }
    );

    return () => unsubscribe();
  }, [matchId]);

  // Scroll al último mensaje
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);



  // Enviar mensaje
  const sendMessage = async () => {
    if (!auth.currentUser || !inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    console.log('📤 Enviando mensaje:', messageText);

    try {
      await addDoc(collection(db, 'matches', matchId, 'messages'), {
        text: messageText,
        createdAt: serverTimestamp(),
        senderId: currentUser.uid,
        senderName: userProfile?.name || 'Usuario',
        senderPhoto: userProfile?.photoURL || null,
      });

      await updateDoc(doc(db, 'matches', matchId), {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
      });

      console.log('✅ Mensaje enviado');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  // Formatear hora
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Renderizar mensaje
  const renderMessage = ({ item, index }) => {
    const isMyMessage = item.senderId === currentUser.uid;
    const showDate = index === 0 ||
      (messages[index - 1] &&
        new Date(item.createdAt).toDateString() !==
        new Date(messages[index - 1].createdAt).toDateString());

    return (
      <View>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {item.createdAt.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.theirMessageTime,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  // Pantalla vacía
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      {otherUserPhoto && (
        <Image source={{ uri: otherUserPhoto }} style={styles.emptyAvatar} />
      )}
      <Text style={styles.emptyTitle}>¡Hiciste match con {otherUserName}!</Text>
      <Text style={styles.emptySubtitle}>
        Envía el primer mensaje y rompe el hielo 💬
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 90}
    >
      <View style={styles.innerContainer}>
        {/* Lista de mensajes */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmptyChat}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />

        {/* Input de mensaje */}
        <View style={[
          styles.inputContainer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10 }
        ]}>
          <TextInput
            style={styles.textInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onFocus={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={otherUserId}
        reportedUserName={otherUserName}
        reportedUserPhoto={otherUserPhoto}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  innerContainer: {
    flex: 1,
  },

  // Header
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  backButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 28,
    color: '#FF6B6B',
  },
  reportHeaderButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  reportHeaderButtonText: {
    fontSize: 20,
  },

  // Messages list
  messagesList: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: 'center',
  },

  // Date separator
  dateContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    textTransform: 'capitalize',
  },

  // Message bubbles
  messageContainer: {
    maxWidth: '75%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 3,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B6B',
    borderBottomRightRadius: 5,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 5,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#999',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Input container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#ffaaaa',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 2,
  },
});