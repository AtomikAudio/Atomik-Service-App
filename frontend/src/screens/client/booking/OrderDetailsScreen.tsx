import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { Button } from '../../../components/common/Button';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { COLORS } from '../../../constants/colors';

interface Props {
  navigation: any;
}

export const OrderDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { draft, setDraft } = useBookingDraft();
  const [text, setText] = useState(draft.details ?? '');

  const save = () => {
    setDraft((d) => ({ ...d, details: text.trim() }));
    navigation.navigate('PlaceOrder');
  };

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title="Details"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>TECHNICAL NOTES</Text>
        <Text style={styles.hint}>
          Describe system issues, rig layout, DSP chain, or event requirements.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Add details…"
          placeholderTextColor={COLORS.grayDark}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.saveRow}>
          <Button
            label="SAVE"
            onPress={save}
            disabled={!text.trim()}
            fullWidth={false}
            style={styles.saveBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20 },
  label: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    minHeight: 200,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 22,
  },
  saveRow: {
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtn: {
    minWidth: 200,
    paddingHorizontal: 32,
  },
});
