import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';

// Setup Screens
import ProfileSetupScreen from '../screens/setup/ProfileSetupScreen';

// Main Screens
import HomeScreen from '../screens/main/HomeScreen';
import MatchesScreen from '../screens/main/MatchesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Matches Stack
function MatchesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MatchesList"
        component={MatchesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Main Tabs con Safe Area
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10,
          height: Platform.OS === 'ios' ? 85 : 70 + insets.bottom,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        },
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: Platform.OS === 'ios' ? 0 : 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Explorar',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🔥' : '🔍'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesStack}
        options={{
          tabBarLabel: 'Matches',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '💕' : '💬'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '😊' : '👤'}</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main Navigator
export default function AppNavigator() {
  const { user, loading, isEmailVerified, hasProfile } = useAuth();

  if (loading) {
    return <Loading message="Cargando TecCitas..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : !isEmailVerified ? (
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        ) : !hasProfile ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}