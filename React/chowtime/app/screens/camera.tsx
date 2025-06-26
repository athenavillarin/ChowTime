import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import useAppInitialization from '../hooks/useAppInitialization';
import { WebView } from "react-native-webview";
import { ref, onValue, update, set } from 'firebase/database';
import firebaseConfig from "../firebase/firebaseConfig";
import moment from 'moment';

const { database } = firebaseConfig;

const logoUri = require('../../assets/images/applogo.png');

export default function Camera() {
  const router = useRouter();
  const { fontsLoaded } = useAppInitialization();
  
  // State to manage settings and status
  const [autoFeederStatus, setAutoFeederStatus] = useState<string>('Loading...');
  const [portionSize, setPortionSize] = useState<number>(1);
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [lastFeedingTime, setLastFeedingTime] = useState<string>('Loading...');
  const [cameraIp, setCameraIp] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isFeeding, setIsFeeding] = useState<boolean>(false);

  // Fetch data from Firebase
  useEffect(() => {
    const feederStatusRef = ref(database, 'feeder');
    const userSettingsRef = ref(database, '/settings/userSettings');
    const ipRef = ref(database, "camera/ip");
    const notificationsStatusRef = ref(database, 'notifications/status');
    
    // Get feeder status
    const unsubscribeFeederStatus = onValue(feederStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const result = snapshot.val();
        setAutoFeederStatus(result.enabled ? 'Enabled' : 'Disabled');
        setFlashOn(result.flash);
      } else {
        setAutoFeederStatus('Error');
      }
    });

    // Get user settings
    const unsubscribeUserSettings = onValue(userSettingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val();
        setPortionSize(settings.portionSize || 1);
      } else {
        console.log('User  settings not found in Firebase');
      }
    });

    // Get camera IP
    const unsubscribeIp = onValue(ipRef, (snapshot) => {
      if (snapshot.exists()) {
        const ipAddress = snapshot.val();
        setCameraIp(ipAddress);
      } else {
        console.error("No IP address found in Firebase");
      }
    });

    // Get notifications status
    const unsubscribeNotificationsStatus = onValue(notificationsStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const statusData = snapshot.val();
        setLastFeedingTime(statusData.lastFed || 'Never');

        // Handle portionSize correctly based on its type
        const fetchedPortionSize = statusData.portionSize;
        if (typeof fetchedPortionSize === 'string') {
          // Convert string to corresponding numeric value
          if (fetchedPortionSize === 'Small') {
            setPortionSize(1);
          } else if (fetchedPortionSize === 'Medium') {
            setPortionSize(2);
          } else if (fetchedPortionSize === 'Large') {
            setPortionSize(3);
          } else {
            setPortionSize(1); // Default to Small if unknown
          }
        } else {
          // If it's a number, just set it directly
          setPortionSize(fetchedPortionSize || 1);
        }
      } else {
        console.log('No notifications status found in Firebase');
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeFeederStatus();
      unsubscribeUserSettings();
      unsubscribeIp();
      unsubscribeNotificationsStatus();
    };
  }, []);

  // Function to handle WebView errors
  const handleWebViewError = () => {
    setIsConnected(false);
    console.log("WebView encountered an error. Attempting to reconnect...");
    // Retry logic
    setTimeout(() => {
      setIsConnected(true); // Attempt to reconnect
    }, 5000); // Retry after 5 seconds
  };

  // Function to render the WebView
  const renderWebView = () => {
    if (!cameraIp) {
      return <Text>No camera IP available.</Text>;
    }

    return (
      <WebView 
        source={{ uri: `http://${cameraIp}` }} 
        style={styles.webview} 
        onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('HTTP error: ', nativeEvent);
            handleWebViewError();
        }}
        onError={handleWebViewError}
        onLoadEnd={() => setIsConnected(true)}
      />
    );
  };

  const getFeedingDuration = (size: number): number => {
    switch (size) {
      case 1: // Small
        return 2000; // 2 seconds
      case 2: // Medium
        return 4000; // 4 seconds
      case 3: // Large
        return 6000; // 6 seconds
      default:
        return 2000; // Default to 2 seconds if size is not recognized
    }
  };

  const sendFeedCommand = async () => {
    if (isFeeding) return;
    setIsFeeding(true);

    try {
        const manualFeedCommandRef = ref(database, '/manual_feed');

        const isoTimestamp = new Date().toISOString();
        const portionSizeString = getPortionSizeText(portionSize);

        await set(manualFeedCommandRef, {
            portionSize: portionSize,
            timestamp: isoTimestamp,
            isFeeding: true,
        });

        setLastFeedingTime(isoTimestamp);

        console.log(`Feeding started for portion: ${portionSizeString}`);

        const feedingDuration = getFeedingDuration(portionSize);

        setTimeout(() => {
            console.log("Feeding complete, resetting isFeeding");
            setIsFeeding(false);
        }, feedingDuration);
    } catch (error) {
        console.error("Error during feeding:", error);
        alert("Failed to send feed command.");
    } finally {
        setIsFeeding(false); // Ensure reset even if error occurs
    }
};

  const toggleFlash = async () => {
    console.log("Toggling flash...");
    try {
      const flashRef = ref(database, 'feeder/flash');
      const newFlashState = !flashOn;

      // Update flash state in Firebase
      await set(flashRef, newFlashState);
      setFlashOn(newFlashState);

      console.log(`Flash is now ${newFlashState ? 'ON' : 'OFF'}`);
      alert(`Flash is now ${newFlashState ? 'ON' : 'OFF'}`);
    } catch (error) {
      alert("Failed to toggle flash. Please check the connection.");
      console.error("Error toggling flash:", error);
    }
  };

  const getPortionSizeText = (size: number) => {
    switch (size) {
      case 1:
        return 'Small';
      case 2:
        return 'Medium';
      case 3:
        return 'Large';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Feed</Text>
        <Image source={logoUri} style={styles.logo} />
      </View>

      {/* Video WebView */}
      <View style={styles.webviewContainer}>
        {isConnected ? renderWebView() : <Text>Attempting to reconnect...</Text>}
      </View>

      {/* Info and Buttons */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Information Section */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Last Feeding Session:</Text>
          <Text style={styles.infoValue}>{lastFeedingTime ? moment(lastFeedingTime).format('MMMM D, h:mm:ss A') : 'Loading...'}</Text>
          <Text style={styles.infoLabel}>Portion Size:</Text>
          <Text style={styles.infoValue}>{getPortionSizeText(portionSize)}</Text>
          <Text style={styles.infoLabel}>Auto-Feeder Status:</Text>
          <Text style={styles.infoValue}>{autoFeederStatus}</Text>
          <Text style={styles.infoLabel}>Flash Status:</Text>
          <Text style={styles.infoValue}>{flashOn ? 'ON' : 'OFF'}</Text>
        </View>

        {/* Buttons */}
      </ScrollView>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.feedButton} onPress={sendFeedCommand}>
          <Text style={styles.buttonText}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <Text style={styles.buttonText}>Flash</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    fontFamily: "Poppins",
  },
  logo: {
    width: 50,
    height: 50,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#212529',
  },
  webviewContainer: {
    height: 200,
    marginBottom: 20,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ddd',
    borderRadius: 10,
  },
  scrollContainer: {
    alignItems: "center",
  },
  infoContainer: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Poppins",
    color: '#212529',
  },
  infoValue: {
    fontSize: 16,
    marginBottom: 10,
    fontFamily: "Poppins",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 5,
  },
  feedButton: {
    flex: 1,
    backgroundColor: "#FFBA00",
    borderRadius: 25,
    alignItems: "center",
    padding: 15,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  flashButton: {
    flex: 1,
    backgroundColor: "#FFBA00",
    borderRadius: 25,
    alignItems: "center",
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Poppins",
  },
});