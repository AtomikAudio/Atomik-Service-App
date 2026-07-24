import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/client/ProfileScreen';
import { UpcomingServicesScreen } from '../screens/client/UpcomingServicesScreen';
import { CompletedServicesScreen } from '../screens/client/CompletedServicesScreen';
import { ServiceDetailsScreen } from '../screens/client/ServiceDetailsScreen';
import { TrackingScreen } from '../screens/client/TrackingScreen';
import { profileScreenComponents, PROFILE_SCREEN_NAMES } from './profileScreens';
import { defaultStackOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export const AccountStack: React.FC = () => (
  <Stack.Navigator screenOptions={defaultStackOptions} initialRouteName="ProfileMain">
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="UpcomingServices" component={UpcomingServicesScreen} />
    <Stack.Screen name="CompletedServices" component={CompletedServicesScreen} />
    <Stack.Screen name="PastServices" component={CompletedServicesScreen} />
    <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
    <Stack.Screen name="TrackService" component={TrackingScreen} />
    {PROFILE_SCREEN_NAMES.map((name) => (
      <Stack.Screen
        key={name}
        name={name}
        component={profileScreenComponents[name]}
      />
    ))}
  </Stack.Navigator>
);
