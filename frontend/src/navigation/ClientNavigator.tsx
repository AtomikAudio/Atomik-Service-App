import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreen } from '../screens/client/HomeScreen';
import { PaymentScreen } from '../screens/client/PaymentScreen';
import { TrackingScreen } from '../screens/client/TrackingScreen';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { AccountStack } from './AccountStack';
import { PaymentsHubScreen } from '../screens/client/PaymentsHubScreen';
import { ServiceDetailsScreen } from '../screens/client/ServiceDetailsScreen';
import { UpcomingServicesScreen } from '../screens/client/UpcomingServicesScreen';
import { CompletedServicesScreen } from '../screens/client/CompletedServicesScreen';
import { ServiceCategoriesScreen } from '../screens/client/booking/ServiceCategoriesScreen';
import { PlaceOrderScreen } from '../screens/client/booking/PlaceOrderScreen';
import { SelectLocationScreen } from '../screens/client/booking/SelectLocationScreen';
import { OrderDetailsScreen } from '../screens/client/booking/OrderDetailsScreen';
import { AddPhotoScreen } from '../screens/client/booking/AddPhotoScreen';
import { ScheduleBookingScreen } from '../screens/client/booking/ScheduleBookingScreen';
import { ServiceSubcategoriesScreen } from '../screens/client/booking/ServiceSubcategoriesScreen';
import { BookingDraftProvider, useBookingDraft } from '../context/BookingDraftContext';
import { BookingLeaveConfirmModal } from '../components/booking/BookingLeaveConfirmModal';
import { defaultStackOptions } from './screenOptions';
import { createTabBarScreenOptions } from './tabBarOptions';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const bookingScreens = (
  <>
    <Stack.Screen name="ServiceCategories" component={ServiceCategoriesScreen} />
    <Stack.Screen name="ServiceSubcategories" component={ServiceSubcategoriesScreen} />
    <Stack.Screen name="PlaceOrder" component={PlaceOrderScreen} />
    <Stack.Screen name="SelectLocation" component={SelectLocationScreen} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
    <Stack.Screen name="AddPhoto" component={AddPhotoScreen} />
    <Stack.Screen name="ScheduleBooking" component={ScheduleBookingScreen} />
    <Stack.Screen name="Payment" component={PaymentScreen} />
    <Stack.Screen name="TrackService" component={TrackingScreen} />
    <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
    <Stack.Screen name="UpcomingServices" component={UpcomingServicesScreen} />
    <Stack.Screen name="CompletedServices" component={CompletedServicesScreen} />
  </>
);

const ServicesStack = () => (
  <Stack.Navigator screenOptions={defaultStackOptions}>
    {bookingScreens}
  </Stack.Navigator>
);

const HomeStack = () => (
  <Stack.Navigator screenOptions={defaultStackOptions}>
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    {bookingScreens}
  </Stack.Navigator>
);

const PaymentsStack = () => (
  <Stack.Navigator screenOptions={defaultStackOptions}>
    <Stack.Screen name="PaymentsHub" component={PaymentsHubScreen} />
    <Stack.Screen name="Payment" component={PaymentScreen} />
    <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
    <Stack.Screen name="TrackService" component={TrackingScreen} />
  </Stack.Navigator>
);

const tabBarIcon = (routeName: string, focused: boolean, color: string, size: number) => {
  const icons: Record<string, { focused: string; outline: string }> = {
    Home: { focused: 'home', outline: 'home-outline' },
    Services: { focused: 'calendar', outline: 'calendar-outline' },
    Payments: { focused: 'card', outline: 'card-outline' },
    Account: { focused: 'person', outline: 'person-outline' },
  };
  const icon = icons[routeName];
  const name = (focused ? icon?.focused : icon?.outline) ?? 'help-circle-outline';
  return <Ionicons name={name as any} size={size} color={color} />;
};

const ClientTabs = () => {
  const insets = useSafeAreaInsets();
  const { isBookingInProgress, requestLeaveBooking } = useBookingDraft();

  const guardTabPress = (
    e: { preventDefault: () => void },
    proceed: () => void
  ) => {
    if (!isBookingInProgress) {
      proceed();
      return;
    }
    e.preventDefault();
    requestLeaveBooking(proceed);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) =>
          createTabBarScreenOptions(insets, {
            tabBarIcon: ({ focused, color, size }) =>
              tabBarIcon(route.name, focused, color, size),
          })
        }
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              guardTabPress(e, () => {
                navigation.navigate('Home', { screen: 'HomeMain' });
              });
            },
          })}
        />
        <Tab.Screen
          name="Services"
          component={ServicesStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              guardTabPress(e, () => {
                navigation.navigate('Services', {
                  screen: 'ServiceCategories',
                  params: { reset: true },
                });
              });
            },
          })}
        />
        <Tab.Screen
          name="Payments"
          component={PaymentsStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              guardTabPress(e, () => {
                navigation.navigate('Payments');
              });
            },
          })}
        />
        <Tab.Screen
          name="Account"
          component={AccountStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              guardTabPress(e, () => {
                navigation.navigate('Account');
              });
            },
          })}
        />
      </Tab.Navigator>
      <BookingLeaveConfirmModal />
    </>
  );
};

export const ClientNavigator: React.FC = () => (
  <BookingDraftProvider>
    <Stack.Navigator screenOptions={defaultStackOptions}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
    </Stack.Navigator>
  </BookingDraftProvider>
);
