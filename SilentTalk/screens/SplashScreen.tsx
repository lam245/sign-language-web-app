import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

type Props = {
  onFinish: () => void;
};

const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  useEffect(() => {
    // Set to exactly 5 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SilentTalk</Text>
      <Image 
        source={require('../assets/sign-language-icon.png')}
        style={styles.image}
        resizeMode="contain"
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
    color: 'black',
    marginBottom: 40,
    textAlign: 'center',
  },
  image: {
    width: 200,
    height: 200,
  }
});

export default SplashScreen; 