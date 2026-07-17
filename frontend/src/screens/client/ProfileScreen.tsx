import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { Header } from '../../components/common/Header';
import { Screen } from '../../components/common/Screen';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { Card } from '../../components/common/Card';
import { COLORS } from '../../constants/colors';
import { logout } from '../../store/authSlice';
import { authService } from '../../services/auth';
import { bookingService } from '../../services/bookings';
import { venueService } from '../../services/venues';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import { navigateProfileScreen } from '../../navigation/profileNavigation';
import type { ProfileScreenName } from '../../navigation/profileScreens';

const MenuItem = ({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? COLORS.red : COLORS.gray} />
    </View>
    <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
    {!danger && (
      <Ionicons name="chevron-forward" size={16} color={COLORS.grayDark} />
    )}
  </TouchableOpacity>
);

interface Props {
  navigation: any;
}

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.auth.user);
  const [stats, setStats] = React.useState({
    services: 0,
    venues: 0,
    past: 0,
    upcoming: 0,
  });

  const roleLabel = (user?.role ?? 'client').toUpperCase();
  const isAdmin = user?.role === 'admin';
  const isTechnician =
    user?.role === 'technician' || user?.role === 'master_technician';

  useFocusEffect(
    React.useCallback(() => {
      if (user?.role === 'admin') return;
      if (isTechnician) {
        bookingService
          .getMyBookings({ limit: 50 })
          .then((bookings) => {
            const myId = String(user?.id ?? '');
            const mine = bookings.filter(
              (b) => resolveAssignedTechnicianId(b) === myId
            );
            const past = mine.filter((b) => b.status === 'completed').length;
            const upcoming = mine.filter(
              (b) => !['completed', 'cancelled'].includes(b.status)
            ).length;
            setStats({ services: past, venues: 0, past, upcoming });
          })
          .catch(() => {});
        return;
      }
      Promise.all([bookingService.getMyBookings(), venueService.getMyVenues()])
        .then(([b, v]) =>
          setStats({
            services: b.length,
            venues: v.length,
            past: 0,
            upcoming: 0,
          })
        )
        .catch(() => {});
    }, [user?.role, user?.id, isTechnician])
  );

  const goTo = (screen: ProfileScreenName) => navigateProfileScreen(navigation, screen);

  const openSavedVenues = () => {
    if (isAdmin) {
      const tabNav = navigation.getParent();
      tabNav?.navigate('Dashboard', { screen: 'AdminVenues' });
      return;
    }
    goTo('SavedVenues');
  };

  const openPastServices = () => {
    let parent = navigation.getParent?.();
    while (parent) {
      const names = parent.getState?.()?.routeNames ?? [];
      if (names.includes('TechPastServices')) {
        parent.navigate('TechPastServices');
        return;
      }
      parent = parent.getParent?.();
    }
    navigation.navigate('TechPastServices');
  };

  const openUpcomingJobs = () => {
    let parent = navigation.getParent?.();
    while (parent) {
      const names = parent.getState?.()?.routeNames ?? [];
      if (names.includes('TechTabs')) {
        parent.navigate('TechTabs', {
          screen: 'Jobs',
          params: { screen: 'TechDashboard' },
        });
        return;
      }
      parent = parent.getParent?.();
    }
    navigation.navigate('Jobs', { screen: 'TechDashboard' });
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await authService.logout();
            } catch {
              /* still clear local session */
            }
            dispatch(logout());
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Profile" />

      <SafeScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => goTo('EditProfile')}
            activeOpacity={0.85}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color={COLORS.gray} />
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <Text style={styles.userRole}>{roleLabel}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {isTechnician ? (
            <>
              <TouchableOpacity
                style={styles.statItem}
                onPress={openPastServices}
                activeOpacity={0.7}
              >
                <Text style={styles.statNum}>{stats.past}</Text>
                <Text
                  style={styles.statLabelWide}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  Past Services
                </Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity
                style={styles.statItem}
                onPress={openUpcomingJobs}
                activeOpacity={0.7}
              >
                <Text style={styles.statNum}>{stats.upcoming}</Text>
                <Text
                  style={styles.statLabelWide}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  Upcoming Services
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.services}</Text>
                <Text style={styles.statLabel}>Services</Text>
              </View>
              {!isAdmin && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>{stats.venues}</Text>
                    <Text style={styles.statLabel}>Venues</Text>
                  </View>
                </>
              )}
              {isAdmin && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>{roleLabel}</Text>
                    <Text style={styles.statLabel}>Access</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Menu */}
        <Card style={styles.menuCard} padding={0}>
          <MenuItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => goTo('EditProfile')}
          />
          <View style={styles.menuDivider} />
          {isTechnician ? (
            <MenuItem
              icon="time-outline"
              label="Past Services"
              onPress={openPastServices}
            />
          ) : (
            <MenuItem
              icon="location-outline"
              label={isAdmin ? 'Manage Venues' : 'Saved Venues'}
              onPress={openSavedVenues}
            />
          )}
          <View style={styles.menuDivider} />
          <MenuItem
            icon="notifications-outline"
            label="Notification Settings"
            onPress={() => goTo('NotificationSettings')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Security"
            onPress={() => goTo('Security')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => goTo('HelpSupport')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => goTo('PrivacyPolicy')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="reader-outline"
            label="Terms & Conditions"
            onPress={() => goTo('TermsConditions')}
          />
        </Card>

        <Card style={[styles.menuCard, { marginTop: 12 }]} padding={0}>
          <MenuItem
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            danger
          />
        </Card>

        <Text style={styles.version}>ATOMIK v1.0.0 • Precision Audio Service</Text>
      </SafeScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  userName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: COLORS.white,
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  userRole: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.red,
    letterSpacing: 2,
    backgroundColor: 'rgba(142,48,47,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(142,48,47,0.25)',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
    paddingVertical: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statNum: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
  },
  statLabelWide: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  menuCard: {
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconDanger: {
    backgroundColor: 'rgba(142,48,47,0.1)',
  },
  menuLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: COLORS.white,
    flex: 1,
  },
  menuLabelDanger: {
    color: COLORS.red,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 68,
  },
  version: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    textAlign: 'center',
    marginTop: 28,
    letterSpacing: 1,
  },
});
