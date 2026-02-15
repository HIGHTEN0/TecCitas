import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const applyStyles = () => {
      try {
        // Ensure full-height layout on web so RNW flex:1 fills the viewport
        document.documentElement.style.height = '100%';
        document.body.style.height = '100%';
        document.body.style.margin = '0';
        document.body.style.overflow = 'auto';
        document.body.style.touchAction = 'auto';
        document.body.style['-webkit-overflow-scrolling'] = 'touch';

        const root = document.getElementById('root');
        if (root) {
          root.style.display = 'flex';
          root.style.flexDirection = 'column';
          root.style.height = '100%';
          root.style.minHeight = '100vh';
          root.style.overflow = 'auto';

          // Ensure the first child fills the available space and can scroll on iOS
          const first = root.firstElementChild;
          if (first && first.style) {
            first.style.display = 'flex';
            first.style.flex = '1 1 auto';
            first.style.minHeight = '100vh';
            first.style.overflow = 'auto';
            first.style.webkitOverflowScrolling = 'touch';
          }
        }
      } catch (e) {
        // noop
      }
    };

    applyStyles();

    // Observe attribute changes on body and root to re-apply styles if overwritten
    const observer = new MutationObserver(() => applyStyles());
    observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    const rootEl = document.getElementById('root');
    if (rootEl) observer.observe(rootEl, { attributes: true, attributeFilter: ['style', 'class'] });

    return () => observer.disconnect();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <AppNavigator />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}