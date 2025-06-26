import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import useAppInitialization from './hooks/useAppInitialization';



const logoUri = require('../assets/images/appname.png');
const containerImageUri = require('../assets/images/home.png');

export default function GetStarted() {
  const router = useRouter();
  const { fontsLoaded } = useAppInitialization();

  const handleGetStarted = () => {
    router.push('/screens/home');
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.roundContainer}>
        <Image source={containerImageUri} style={styles.containerImage} resizeMode="cover" />
      </View>
      <Image source={logoUri} style={styles.appNameImage} resizeMode="contain" />
      <Text style={styles.subtext}>Feed your furry friend anywhere and anytime!</Text>
      <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  roundContainer: {
    position: 'absolute',
    top: 0,
    left: -40,
    right: -40,
    height: 425,
    backgroundColor: '#FFBA00',
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  containerImage: {
    width: '100%',
    height: '70%',
    marginBottom: 90,
  },
  appNameImage: {
    width: 350,
    height: 100,
    marginBottom: 15,
    marginTop: 400,
  },
  subtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    fontFamily: 'Poppins',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FFBA00',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
