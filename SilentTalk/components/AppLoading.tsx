import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';

const AppLoading = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SilentTalk</Text>
      <Image 
        source={require('../assets/sign-language-icon.png')}
        style={styles.image}
        resizeMode="contain"
      />
      <ActivityIndicator 
        size="large" 
        color="#1a3b5d" 
        style={styles.loader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e7a1a7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1a3b5d',
    marginBottom: 40,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  }
});

export default AppLoading; 