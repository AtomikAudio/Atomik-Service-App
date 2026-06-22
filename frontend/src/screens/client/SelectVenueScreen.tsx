import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { LoadingView } from '../../components/common/LoadingView';
import { venueService, Venue } from '../../services/venues';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
  route: any;
}

export const SelectVenueScreen: React.FC<Props> = ({ navigation, route }) => {
  const { serviceType } = route.params || {};
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    venueService
      .getMyVenues()
      .then(setVenues)
      .catch(() => Alert.alert('Error', 'Could not load venues'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = venues.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.area.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header showBack showLogo />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header showBack showLogo />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.stepLabel}>Step 2 of 4</Text>
        <View style={styles.progressBar}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.progressSegment, i < 2 && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <Text style={styles.title}>Choose Venue</Text>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={16} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search venue or area"
            placeholderTextColor={COLORS.grayDark}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.venueList}>
          {filtered.map((venue) => (
            <TouchableOpacity
              key={venue._id}
              style={[
                styles.venueItem,
                selected === venue._id && styles.venueItemSelected,
              ]}
              onPress={() => setSelected(venue._id)}
            >
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueArea}>
                  {venue.area}, {venue.city}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>No venues. Add one below.</Text>
          )}
          <TouchableOpacity
            style={styles.addVenue}
            onPress={async () => {
              const name = search.trim() || 'My Venue';
              try {
                const v = await venueService.createVenue({
                  name,
                  area: 'Bengaluru',
                  city: 'Bengaluru',
                });
                setVenues((prev) => [...prev, v]);
                setSelected(v._id);
              } catch (e: any) {
                Alert.alert('Error', e.message);
              }
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.gray} />
            <Text style={styles.addVenueText}>Add New Venue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label="CONTINUE"
          onPress={() =>
            navigation.navigate('DateTime', { serviceType, venueId: selected })
          }
          disabled={!selected}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 },
  stepLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.surface },
  progressSegmentActive: { backgroundColor: COLORS.red },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: COLORS.white,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  venueList: { gap: 10 },
  venueItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  venueItemSelected: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(142, 48, 47, 0.06)',
  },
  venueInfo: { flex: 1 },
  venueName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  venueArea: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 3,
  },
  empty: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  addVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  addVenueText: { color: COLORS.gray, fontFamily: 'Montserrat_500Medium' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: COLORS.background,
  },
});
