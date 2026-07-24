import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { AddressAutofillSearch } from '../../../components/common/AddressAutofillSearch';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { venueService, Venue } from '../../../services/venues';
import { COLORS } from '../../../constants/colors';
import type { ParsedAddress } from '../../../services/placesAutocomplete';

const ADDRESS_LABELS = ['Home', 'Office', 'Venue', 'Other'];

interface Props {
  navigation: any;
  route?: { params?: { venue?: Venue } };
}

export const AddAddressScreen: React.FC<Props> = ({ navigation, route }) => {
  const editing = route?.params?.venue;
  const [saving, setSaving] = useState(false);
  const [saveAs, setSaveAs] = useState(() => {
    const name = editing?.name?.trim();
    if (name && ADDRESS_LABELS.includes(name)) return name;
    return name || 'Home';
  });
  const [line1, setLine1] = useState(editing?.address ?? '');
  const [line2, setLine2] = useState('');
  const [locality, setLocality] = useState(editing?.area ?? '');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState(editing?.city ?? 'Bengaluru');
  const [state, setState] = useState(editing?.state ?? 'Karnataka');
  const [pincode, setPincode] = useState(editing?.pincode ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!line1.trim()) e.line1 = 'Required';
    if (!locality.trim()) e.locality = 'Required';
    if (!city.trim()) e.city = 'Required';
    if (!state.trim()) e.state = 'Required';
    if (!/^\d{6}$/.test(pincode.trim())) e.pincode = 'Enter valid 6-digit PIN';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveAddress = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const addressParts = [line1.trim(), line2.trim(), landmark.trim()].filter(
        Boolean
      );
      const payload = {
        name: saveAs,
        address: addressParts.join(', '),
        area: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      };
      if (editing?._id) {
        await venueService.updateVenue(editing._id, payload);
        Alert.alert('Saved', 'Address updated.', [
          { text: 'OK', onPress: () => navigation.pop(2) },
        ]);
      } else {
        await venueService.createVenue(payload);
        Alert.alert('Saved', 'Address added to your saved venues.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not save address';
      Alert.alert('Could not save address', message);
    } finally {
      setSaving(false);
    }
  };

  const applyAutofill = (address: ParsedAddress) => {
    setLine1(address.line1);
    setLine2(address.line2);
    setLocality(address.locality);
    setCity(address.city || 'Bengaluru');
    setState(address.state || 'Karnataka');
    if (address.pincode) setPincode(address.pincode);
    setErrors({});
  };

  return (
    <AccountScreenLayout title={editing ? 'Edit address' : 'Add address'} keyboard>
      <Text style={styles.sectionLabel}>SAVE AS</Text>
      <View style={styles.chipRow}>
        {ADDRESS_LABELS.map((label) => (
          <TouchableOpacity
            key={label}
            style={[styles.chip, saveAs === label && styles.chipActive]}
            onPress={() => setSaveAs(label)}
          >
            <Text
              style={[
                styles.chipText,
                saveAs === label && styles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>ADDRESS</Text>

      <AddressAutofillSearch onSelect={applyAutofill} />

      <Input
        label="Address line 1"
        placeholder="Flat / House no., Building name"
        value={line1}
        onChangeText={setLine1}
        autoCapitalize="words"
        autoComplete="address-line1"
        textContentType="streetAddressLine1"
        error={errors.line1}
      />
      <Input
        label="Address line 2"
        placeholder="Street, sector, colony (optional)"
        value={line2}
        onChangeText={setLine2}
        autoCapitalize="words"
        autoComplete="address-line2"
        textContentType="streetAddressLine2"
      />
      <Input
        label="Area / Locality"
        placeholder="e.g. Koramangala, HSR Layout"
        value={locality}
        onChangeText={setLocality}
        autoCapitalize="words"
        textContentType="sublocality"
        error={errors.locality}
      />
      <Input
        label="Landmark (optional)"
        placeholder="Near metro, mall, etc."
        value={landmark}
        onChangeText={setLandmark}
        autoCapitalize="words"
      />
      <Input
        label="City"
        placeholder="City"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
        autoComplete="postal-address"
        textContentType="addressCity"
        error={errors.city}
      />
      <Input
        label="State"
        placeholder="State"
        value={state}
        onChangeText={setState}
        autoCapitalize="words"
        textContentType="addressState"
        error={errors.state}
      />
      <Input
        label="PIN code"
        placeholder="6-digit PIN"
        value={pincode}
        onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="numeric"
        autoComplete="postal-code"
        textContentType="postalCode"
        error={errors.pincode}
      />

      <Button
        label={editing ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}
        onPress={saveAddress}
        loading={saving}
        style={styles.saveBtn}
        textStyle={styles.saveBtnText}
      />
    </AccountScreenLayout>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.redMuted,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.gray,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  saveBtn: { marginTop: 8, marginBottom: 24, borderRadius: 6 },
  saveBtnText: {
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 2,
  },
});
