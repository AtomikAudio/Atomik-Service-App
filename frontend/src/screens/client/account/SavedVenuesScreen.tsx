import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../../components/common/Header';
import { Screen } from '../../../components/common/Screen';
import { SafeScrollView } from '../../../components/common/SafeScrollView';
import { Card } from '../../../components/common/Card';
import { LoadingView } from '../../../components/common/LoadingView';
import { PressableScale } from '../../../components/common/PressableScale';
import { navigateProfileScreen } from '../../../navigation/profileNavigation';
import { venueService, Venue } from '../../../services/venues';
import { COLORS } from '../../../constants/colors';

interface Props {
  navigation: any;
}

export const SavedVenuesScreen: React.FC<Props> = ({ navigation }) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      venueService
        .getMyVenues()
        .then(setVenues)
        .catch(() => setVenues([]))
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <LoadingView />
      </View>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Header showBack title="Saved Venues" />
      <View style={styles.body}>
        <SafeScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {venues.length === 0 ? (
            <Text style={styles.empty}>
              No saved venues yet. Tap Add address to save one.
            </Text>
          ) : (
            venues.map((v) => (
              <PressableScale
                key={v._id}
                onPress={() =>
                  navigateProfileScreen(navigation, 'AddressDetails', {
                    venue: v,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${v.name}`}
              >
                <Card padding={16} style={styles.card}>
                  <View style={styles.row}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={COLORS.red}
                    />
                    <View style={styles.cardBody}>
                      <Text style={styles.name}>{v.name}</Text>
                      <Text style={styles.line}>
                        {[v.address, v.area, v.city, v.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.grayDark}
                    />
                  </View>
                </Card>
              </PressableScale>
            ))
          )}
        </SafeScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigateProfileScreen(navigation, 'AddAddress')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add address"
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.red} />
            <Text style={styles.addBtnText}>ADD ADDRESS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: COLORS.redMuted,
  },
  addBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardBody: { flex: 1 },
  name: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  line: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    lineHeight: 18,
  },
  empty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 24,
  },
});
