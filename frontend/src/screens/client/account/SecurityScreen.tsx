import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../constants/colors';
import { navigateProfileScreen } from '../../../navigation/profileNavigation';
import { authService } from '../../../services/auth';
import { logout } from '../../../store/authSlice';

interface Props {
  navigation: any;
}

export const SecurityScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile and signs you out. Open bookings will be cancelled. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your account and personal data will be deleted. You will need to create a new account to use ATOMIK again.',
              [
                { text: 'Keep account', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: () => {
                    void performDelete();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await authService.deleteAccount();
      dispatch(logout());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not delete account. Try again.';
      Alert.alert('Delete failed', message);
      setDeleting(false);
    }
  };

  return (
    <AccountScreenLayout title="Security">
      <Card padding={16}>
        <Text style={styles.title}>Password</Text>
        <Text style={styles.body}>
          Use a strong password and change it periodically. Reset via email if you forget it.
        </Text>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => navigateProfileScreen(navigation, 'ForgotPassword')}
        >
          <Text style={styles.linkText}>RESET PASSWORD</Text>
        </TouchableOpacity>
      </Card>
      <Card padding={16} style={styles.card}>
        <Text style={styles.title}>Session</Text>
        <Text style={styles.body}>
          You are signed in on this device. Log out from Profile when using a shared device.
        </Text>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() =>
            Alert.alert(
              'Tip',
              'Use Logout on the Profile screen to end your session on this device.'
            )
          }
        >
          <Text style={styles.linkText}>SESSION INFO</Text>
        </TouchableOpacity>
      </Card>
      <Card padding={16} style={styles.dangerCard}>
        <Text style={styles.title}>Delete account</Text>
        <Text style={styles.body}>
          Permanently delete your ATOMIK account and personal data. Open bookings will be
          cancelled. This cannot be undone.
        </Text>
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={confirmDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          {deleting ? (
            <ActivityIndicator color={COLORS.red} />
          ) : (
            <Text style={styles.dangerBtnText}>DELETE ACCOUNT</Text>
          )}
        </TouchableOpacity>
      </Card>
    </AccountScreenLayout>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  dangerCard: {
    marginTop: 12,
    borderColor: COLORS.redMuted,
    borderWidth: 1,
  },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  linkBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  dangerBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.redMuted,
    minWidth: 140,
    alignItems: 'center',
  },
  dangerBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
});
