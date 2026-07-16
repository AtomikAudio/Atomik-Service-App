import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TechDashboardScreen } from '../screens/technician/TechDashboardScreen';
import { JobDetailScreen } from '../screens/technician/JobDetailScreen';
import { MasterAssignScreen } from '../screens/technician/MasterAssignScreen';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { ProfileScreen } from '../screens/client/ProfileScreen';
import { defaultStackOptions } from './screenOptions';
import { PROFILE_SCREEN_NAMES, profileScreenComponents } from './profileScreens';
import { createTabBarScreenOptions } from './tabBarOptions';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const JobsStack = () => (
  <Stack.Navigator screenOptions={defaultStackOptions}>
    <Stack.Screen name="TechDashboard" component={TechDashboardScreen} />
    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    <Stack.Screen name="MasterAssign" component={MasterAssignScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

const TechTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator screenOptions={createTabBarScreenOptions(insets)}>
      <Tab.Screen
        name="Jobs"
        component={JobsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Jobs', { screen: 'TechDashboard' });
          },
        })}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const TechNavigator: React.FC = () => (
  <RootStack.Navigator screenOptions={defaultStackOptions}>
    <RootStack.Screen
      name="TechTabs"
      component={TechTabs}
      options={{ headerShown: false }}
    />
    {PROFILE_SCREEN_NAMES.map((name) => (
      <RootStack.Screen
        key={name}
        name={name}
        component={profileScreenComponents[name]}
      />
    ))}
  </RootStack.Navigator>
);
