import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { venueService, Venue } from '../../../services/venues';
import { COLORS } from '../../../constants/colors';

const ADDRESS_LABELS = ['Home', 'Office', 'Venue', 'Other'];

interface Props {
  navigation: any;
}

export const SelectLocationScreen: React.FC<Props> = ({ navigation }) => {
  const { setDraft } = useBookingDraft();
  const [saved, setSaved] = useState<Venue[]>([]);
  const [saving, setSaving] = useState(false);

  const [saveAs, setSaveAs] = useState('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    venueService.getMyVenues().then(setSaved).catch(() => setSaved([]));
  }, []);

  const formatLabel = (v: Venue) => {
    const parts = [v.address, v.area, v.city, v.pincode].filter(Boolean);
    return parts.join(', ');
  };

  const selectSaved = (v: Venue) => {
    setDraft((d) => ({
      ...d,
      venueId: v._id,
      addressLabel: formatLabel(v) || `${v.name}, ${v.area}, ${v.city}`,
    }));
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('PlaceOrder');
  };

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
      const venue = await venueService.createVenue({
        name: saveAs,
        address: addressParts.join(', '),
        area: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      });
      const label = [
        line1.trim(),
        line2.trim(),
        locality.trim(),
        city.trim(),
        state.trim(),
        pincode.trim(),
      ]
        .filter(Boolean)
        .join(', ');
      setDraft((d) => ({
        ...d,
        venueId: venue._id,
        addressLabel: label,
      }));
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('PlaceOrder');
    } catch (err: any) {
      Alert.alert('Could not save address', err.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title="Add address"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {saved.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, styles.savedHeader]}>
                SAVED ADDRESSES
              </Text>
              {saved.map((v) => (
                <TouchableOpacity
                  key={v._id}
                  style={styles.savedRow}
                  onPress={() => selectSaved(v)}
                >
                  <Text style={styles.savedName}>{v.name}</Text>
                  <Text style={styles.savedAddr} numberOfLines={2}>
                    {formatLabel(v)}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

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

          <Text style={styles.sectionLabel}>DELIVERY ADDRESS</Text>

          <Input
            label="Address line 1"
            placeholder="Flat / House no., Building name"
            value={line1}
            onChangeText={setLine1}
            autoCapitalize="words"
            error={errors.line1}
          />
          <Input
            label="Address line 2"
            placeholder="Street, sector, colony (optional)"
            value={line2}
            onChangeText={setLine2}
            autoCapitalize="words"
          />
          <Input
            label="Area / Locality"
            placeholder="e.g. Koramangala, HSR Layout"
            value={locality}
            onChangeText={setLocality}
            autoCapitalize="words"
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
            error={errors.city}
          />
          <Input
            label="State"
            placeholder="State"
            value={state}
            onChangeText={setState}
            autoCapitalize="words"
            error={errors.state}
          />
          <Input
            label="PIN code"
            placeholder="6-digit PIN"
            value={pincode}
            onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="numeric"
            error={errors.pincode}
          />

          <Button
            label="SAVE ADDRESS"
            onPress={saveAddress}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
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
  saveBtn: { marginTop: 8, marginBottom: 8 },
  savedHeader: { marginBottom: 16 },
  savedRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  savedName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    marginBottom: 4,
  },
  savedAddr: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    lineHeight: 18,
  },
});
