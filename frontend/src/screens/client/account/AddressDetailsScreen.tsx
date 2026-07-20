import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { navigateProfileScreen } from '../../../navigation/profileNavigation';
import { venueService, Venue } from '../../../services/venues';
import { COLORS } from '../../../constants/colors';

interface Props {
  navigation: any;
  route: { params?: { venue?: Venue; venueId?: string } };
}

export const AddressDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const venue = route.params?.venue;
  const [deleting, setDeleting] = useState(false);

  const lines = useMemo(() => {
    if (!venue) return [] as { label: string; value: string }[];
    return [
      { label: 'Saved as', value: venue.name },
      { label: 'Address', value: venue.address ?? '' },
      { label: 'Area / Locality', value: venue.area },
      { label: 'City', value: venue.city },
      { label: 'State', value: venue.state ?? '' },
      { label: 'PIN code', value: venue.pincode ?? '' },
    ].filter((row) => row.value);
  }, [venue]);

  const remove = () => {
    if (!venue?._id) return;
    Alert.alert(
      'Delete address',
      `Remove “${venue.name}” from your saved venues?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await venueService.deleteVenue(venue._id);
              navigation.goBack();
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : 'Could not delete address';
              Alert.alert('Delete failed', message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!venue) {
    return (
      <AccountScreenLayout title="Address details">
        <Text style={styles.empty}>Address not found.</Text>
      </AccountScreenLayout>
    );
  }

  return (
    <AccountScreenLayout title="Address details">
      <Card padding={16} style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="location-outline" size={22} color={COLORS.red} />
          <Text style={styles.name}>{venue.name}</Text>
        </View>
        {lines.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label.toUpperCase()}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </Card>

      <Button
        label="EDIT ADDRESS"
        onPress={() =>
          navigateProfileScreen(navigation, 'AddAddress', { venue })
        }
        style={styles.editBtn}
      />
      <Button
        label="DELETE ADDRESS"
        variant="outline"
        loading={deleting}
        onPress={remove}
      />
    </AccountScreenLayout>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  name: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 18,
    color: COLORS.white,
  },
  row: {
    marginBottom: 14,
  },
  label: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  value: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 20,
  },
  editBtn: { marginBottom: 12 },
  empty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 24,
  },
});
