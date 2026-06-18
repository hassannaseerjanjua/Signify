import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { COLORS } from './src/theme/colors';
import { firebaseService } from './src/services/firebase';
import { DocumentDraft } from './src/services/cache';
import { UserSession } from './src/types';
import { FullScreenShimmer } from './src/components/Shimmer';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EditorScreen } from './src/screens/EditorScreen';

function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'editor'>(
    'dashboard',
  );
  const [activeDraft, setActiveDraft] = useState<DocumentDraft | null>(null);

  useEffect(() => {
    // Listen to Firebase (or Sandbox local storage) authentication updates
    const unsubscribe = firebaseService.onAuthStateChanged(sessionUser => {
      setUser(sessionUser);
      setIsInitializing(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleNavigateToEditor = (draftToLoad?: DocumentDraft | null) => {
    setActiveDraft(draftToLoad || null);
    setCurrentScreen('editor');
  };

  const handleNavigateToDashboard = () => {
    setActiveDraft(null);
    setCurrentScreen('dashboard');
  };

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />
        <FullScreenShimmer />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {!user ? (
          <AuthScreen onSuccess={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'editor' ? (
          <EditorScreen
            user={user}
            initialDraft={activeDraft}
            onNavigateBack={handleNavigateToDashboard}
          />
        ) : (
          <DashboardScreen
            user={user}
            onNavigateToEditor={handleNavigateToEditor}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default App;
