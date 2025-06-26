import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ScrollView, LayoutRectangle } from 'react-native';
import { useRouter } from 'expo-router';
import useAppInitialization from '../hooks/useAppInitialization';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import firebaseConfig from '../firebase/firebaseConfig';
import moment from 'moment';

const { app, database } = firebaseConfig;

const logoUri = require('../../assets/images/appname.png');
const homeImageUri = require('../../assets/images/home.png');

export default function Home() {

  const router = useRouter();
  const { fontsLoaded } = useAppInitialization();
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notifications, setNotifications] = useState<string[]>([]);  
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

  const fetchData = () => {
    const notificationsRef = ref(database, 'notifications/status');
    const lastFedRef = ref(database, 'pet/lastfed');
  
    // Fetch notifications
    onValue(notificationsRef, (snapshot) => {
      const newNotifications: string[] = [];
      let newUnreadNotificationsCount = 0;
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val();
        if (typeof notification === 'object') {
          const { portionSize, lastFed } = notification;
          const formattedTime = moment(lastFed).format('MMMM Do YYYY, h:mm a');
          newNotifications.push(`Feeding ${portionSize} portion on ${formattedTime}`);
          if (!childSnapshot.key.startsWith('read_')) {
            newUnreadNotificationsCount++;
          }
        }
      });
      setNotifications(newNotifications);
      setUnreadNotifications(newUnreadNotificationsCount);
    });
  
    // Fetch last fed time and format it
    onValue(lastFedRef, (snapshot) => {
      const lastFedTime = snapshot.val();
      if (lastFedTime) {
        const formattedLastFed = moment(lastFedTime).fromNow();
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          `Last fed: ${formattedLastFed}`,
        ]);
      }
    });
  };

  useEffect(() => {
    fetchData(); // Call the consolidated fetchData function
    return () => {
      // Cleanup Firebase listeners (if needed)
    };
  }, [database]);

  const handleNotificationPress = () => {
    setDropdownVisible(!dropdownVisible);
    if (unreadNotifications > 0 && !dropdownVisible) {
      setUnreadNotifications(0);
    }
  };

  const handleClearLogs = () => {
    const notificationsRef = ref(database, '/notifications');
    set(notificationsRef, null)
      .then(() => {
        setNotifications([]);
        setUnreadNotifications(0);
      })
      .catch((error) => {
        console.error('Error clearing notifications:', error);
      });
  };

  const feedPet = () => {
    router.push('./camera');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={logoUri} style={styles.appNameImage} resizeMode="contain" />
        </View>
      </View>

      {/* Image Container for home.png */}
      <View style={styles.imageContainer}>
        <Image source={homeImageUri} style={styles.homeImage} resizeMode="cover" />
      </View>

      {/* Centered Feed Pet Button below the image */}
      <View style={styles.centeredButtonContainer}>
        <TouchableOpacity style={styles.feedButton} onPress={feedPet}>
          <Text style={styles.feedButtonText}>Feed Pet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appNameImage: {
    width: 250,
    height: 80,
    marginLeft: 20
  },
  timestampText: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  },
  // Styles for the image container
  imageContainer: {
    width: '100%',
    height: 430, 
    overflow: 'hidden',
    borderColor: '#ddd',
  },
  homeImage: {
    width: '100%',
    height: '100%',
  },
  centeredButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  feedButton: {
    backgroundColor: '#FFBA00',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  feedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
