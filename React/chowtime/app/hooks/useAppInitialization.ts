import { useEffect, useState, useCallback } from 'react';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

const useAppInitialization = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  const loadFonts = useCallback(async () => {
    try {
      await Font.loadAsync({
        'Poppins': require('../../assets/fonts/Poppins/Poppins-Regular.ttf'),
      });
      setFontsLoaded(true);
    } catch (error) {
      console.error("Error loading fonts:", error);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('http://192.168.1.7:8080');
      const contentType = response.headers.get('content-type');
  
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
  
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }, []);

  useEffect(() => {
    loadFonts();
    fetchSessions();
  }, [loadFonts, fetchSessions]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return { fontsLoaded, sessions };
};

export default useAppInitialization;
