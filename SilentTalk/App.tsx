import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';
import AppLoading from './components/AppLoading';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Show splash screen for exactly 5 seconds
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <AppLoading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <HomeScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
}); 