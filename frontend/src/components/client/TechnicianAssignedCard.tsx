import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { COLORS } from '../../constants/colors';

interface Props {
  name: string;
  phone?: string;
  /** When true, show a primary CALL button instead of only the phone row. */
  showCallButton?: boolean;
}

export const TechnicianAssignedCard: React.FC<Props> = ({
  name,
  phone,
  showCallButton = false,
}) => {
  const callTech = () => {
    if (!phone) return;
    const tel = phone.replace(/\s/g, '');
    Linking.openURL(`tel:${tel}`);
  };

  return (
    <Card padding={16} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="construct-outline" size={20} color={COLORS.red} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your technician</Text>
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      {phone ? (
        showCallButton ? (
          <Button
            label="CALL"
            onPress={callTech}
            style={styles.callBtn}
          />
        ) : (
          <TouchableOpacity style={styles.phoneRow} onPress={callTech}>
            <Ionicons name="call-outline" size={16} color={COLORS.red} />
            <Text style={styles.phone}>{phone}</Text>
          </TouchableOpacity>
        )
      ) : (
        <Text style={styles.muted}>Contact details not available</Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(142,48,47,0.2)',
    backgroundColor: 'rgba(142,48,47,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(142,48,47,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  name: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phone: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: COLORS.red,
  },
  callBtn: {
    marginTop: 4,
  },
  muted: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
  },
});
