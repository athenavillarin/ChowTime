import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Switch, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from "expo-router";
import firebaseConfig from "../firebase/firebaseConfig";
import { ref, set, get, update, onValue } from 'firebase/database';
import useAppInitialization from '../hooks/useAppInitialization';

const { database } = firebaseConfig;

const logoUri = require('../../assets/images/applogo.png');

type PortionSize = 'Small' | 'Medium' | 'Large';

export default function Settings() {
  const router = useRouter();
  const { fontsLoaded } = useAppInitialization();

  const [portionSize, setPortionSize] = useState<PortionSize>('Small');
  const [autoFeederEnabled, setAutoFeederEnabled] = useState(false);
  const [hours, setHours] = useState(''); 
  const [minutes, setMinutes] = useState(''); 
  const [seconds, setSeconds] = useState(''); 
  const [feedingIntervalId, setFeedingIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
        try {
            const settingsRef = ref(database, 'settings/userSettings');
            const snapshot = await get(settingsRef);
            
            if (snapshot.exists()) {
                const { enabled, interval, portionSize: fetchedPortionSize } = snapshot.val();
                setAutoFeederEnabled(enabled);
                const totalSeconds = interval / 1000;
                setHours(Math.floor(totalSeconds / 3600).toString());
                setMinutes(Math.floor((totalSeconds % 3600) / 60).toString());
                setSeconds((totalSeconds % 60).toString());
                setPortionSize(fetchedPortionSize || 'Small');
            } else {
                console.log("No settings found, using defaults.");
            }
        } catch (error) {
            console.error('Failed to load settings from Firebase:', error);
        }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const feedRef = ref(database, 'feed');

    const unsubscribe = onValue(feedRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const { enabled } = data;

            if (feedingIntervalId && !enabled) {
                clearInterval(feedingIntervalId);
                setFeedingIntervalId(null);
            }

            if (enabled && !feedingIntervalId) {
                const id = setInterval(() => {
                    feed(portionSize);
                }, data.interval);
                setFeedingIntervalId(id);
            }
        }
    });

    return () => {
        unsubscribe();
        if (feedingIntervalId) {
            clearInterval(feedingIntervalId);
        }
    };
  }, [feedingIntervalId, portionSize]);

  const feed = async (portionSize: PortionSize) => {
    try {
        const notificationMessage = `Feeding ${portionSize} portion!`;
        
        // Update the feed status
        await update(ref(database, 'notifications/status'), {
            lastFed: new Date().toISOString(),
            portionSize: portionSize,
        });

        // Add a notification to Firebase
        await set(ref(database, 'notifications/' + new Date().getTime()), notificationMessage);

        console.log(notificationMessage); // Log the feeding action
    } catch (error) {
        console.error('Error updating feed status in Firebase:', error);
    }
  };

  const handlePortionSelect = (size: PortionSize) => {
    setPortionSize(size);
  };

  const handleSaveSettings = async () => {
    if (!hours || !minutes || !seconds) {
      Alert.alert('Error', 'Please fill in all time fields.');
      return;
    }
  
    if (isNaN(Number(hours)) || isNaN(Number(minutes)) || isNaN(Number(seconds))) {
      Alert.alert('Error', 'Please enter valid numeric values for time.');
      return;
    }
  
    const intervalInMilliseconds = (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
  
    let portionSizeNumber = 1;
    if (portionSize === 'Medium') {
      portionSizeNumber = 2;
    } else if (portionSize === 'Large') {
      portionSizeNumber = 3;
    }
  
    try {
      // Save user settings
      await set(ref(database, 'settings/userSettings'), {
        enabled: autoFeederEnabled,
        interval: intervalInMilliseconds,
        portionSize: portionSizeNumber,  // Save portion size here
      });
  
      // Update the feed settings
      await update(ref(database, 'feed'), {
        enabled: autoFeederEnabled,  // Ensure feed enabled status matches user settings
        interval: intervalInMilliseconds,
        portionSize: portionSizeNumber,  // Update feed with the correct portion size
      });
  
      console.log("Feed settings updated: enabled =", autoFeederEnabled, "portionSize =", portionSizeNumber);
  
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings to Firebase:', error);
      Alert.alert('Error', 'Could not save settings.');
    }
  };


  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Image source={logoUri} style={styles.logo} />
      </View>

      <View style={styles.portionContainer}>
        <Text style={styles.label}>Food Portion Size</Text>
        <View style={styles.radioGroup}>
          {['Small', 'Medium', 'Large'].map((size) => (
            <TouchableOpacity key={size} onPress={() => handlePortionSelect(size as PortionSize)}>
              <Text style={[styles.buttonText, portionSize === size && styles.selectedText]}>
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.settingsContainer}>
        <View style={styles.autoFeederContainer}>
          <Text style={styles.label}>Auto Feeder</Text>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>{autoFeederEnabled ? 'On' : 'Off'}</Text>
            <Switch
              value={autoFeederEnabled}
              onValueChange={setAutoFeederEnabled}
              trackColor={{ true: '#FFBA00', false: '#ccc' }}
              thumbColor={autoFeederEnabled ? '#FFBA00' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.timerContainer}>
          <View style={styles.timerInputs}>
            {['Hours', 'Minutes', 'Seconds'].map((label) => (
              <TextInput
                key={label}
                value={label === 'Hours' ? hours : label === 'Minutes' ? minutes : seconds}
                onChangeText={(value) =>
                  label === 'Hours' ? setHours(value) : label === 'Minutes' ? setMinutes(value) : setSeconds(value)
                }
                keyboardType="numeric"
                placeholder={label}
                style={styles.timerInput}
              />
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity>
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
  label: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#212529',
  },
  portionContainer: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Poppins",
    color: '#212529',
  },
  selectedText: {
    color: '#FFBA00',
    fontFamily: "Poppins",
  },
  settingsContainer: {
    width: "100 %", 
    backgroundColor: "#f9f9f9", 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 20 
  },
  autoFeederContainer: {
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 18,
    color: '#212529',
  },
  timerContainer: {
    marginTop: 20,
  },
  timerInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerInput: {
    borderWidth: 1,
    borderRadius: 8,
    width: '30%',
    padding: 10,
    fontSize: 16,
    borderColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#FFBA00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});