import React from 'react';
import { EditProfileScreen } from '../screens/client/account/EditProfileScreen';
import { SavedVenuesScreen } from '../screens/client/account/SavedVenuesScreen';
import { AddAddressScreen } from '../screens/client/account/AddAddressScreen';
import { AddressDetailsScreen } from '../screens/client/account/AddressDetailsScreen';
import { NotificationSettingsScreen } from '../screens/client/account/NotificationSettingsScreen';
import { SecurityScreen } from '../screens/client/account/SecurityScreen';
import { HelpSupportScreen } from '../screens/client/account/HelpSupportScreen';
import { PrivacyPolicyScreen } from '../screens/client/account/PrivacyPolicyScreen';
import { TermsConditionsScreen } from '../screens/client/account/TermsConditionsScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

/** Screens opened from Profile — registered on role root stacks and AccountStack */
export const PROFILE_SCREEN_NAMES = [
  'EditProfile',
  'SavedVenues',
  'AddAddress',
  'AddressDetails',
  'NotificationSettings',
  'Security',
  'HelpSupport',
  'PrivacyPolicy',
  'TermsConditions',
  'ForgotPassword',
] as const;

export type ProfileScreenName = (typeof PROFILE_SCREEN_NAMES)[number];

export const profileScreenComponents: Record<
  ProfileScreenName,
  React.ComponentType<any>
> = {
  EditProfile: EditProfileScreen,
  SavedVenues: SavedVenuesScreen,
  AddAddress: AddAddressScreen,
  AddressDetails: AddressDetailsScreen,
  NotificationSettings: NotificationSettingsScreen,
  Security: SecurityScreen,
  HelpSupport: HelpSupportScreen,
  PrivacyPolicy: PrivacyPolicyScreen,
  TermsConditions: TermsConditionsScreen,
  ForgotPassword: ForgotPasswordScreen,
};
