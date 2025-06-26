import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';

import Home from './home';
import Camera from './camera';
import Settings from './settings';

const Tab = createBottomTabNavigator();

export default function Layout() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          flexDirection: 'row',
          justifyContent: 'space-around',
          borderTopWidth: 1,
          borderColor: '#ddd',
          backgroundColor: '#fff',
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontFamily: 'Poppins',
          marginBottom: 5,
        },
        tabBarActiveTintColor: '#FFBA00',
        tabBarInactiveTintColor: '#000',
      }}
    >
      <Tab.Screen
        name="home"
        component={Home}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#FFBA00' : '#000', fontSize: 14 }}>
              Home
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="camera"
        component={Camera}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#FFBA00' : '#000', fontSize: 14 }}>
              Camera
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="settings"
        component={Settings}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#FFBA00' : '#000', fontSize: 14 }}>
              Settings
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 70,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
});