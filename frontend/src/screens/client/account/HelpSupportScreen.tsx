import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../constants/colors';

const PHONE_DISPLAY = '+91 80886 75627';
const PHONE_TEL = 'tel:+918088675627';

function ContactBlock({
  heading,
  email,
}: {
  heading: string;
  email: string;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockHeading}>{heading}</Text>
      <TouchableOpacity
        style={styles.row}
        onPress={() => Linking.openURL(`mailto:${email}`)}
        activeOpacity={0.75}
      >
        <Ionicons name="mail-outline" size={16} color={COLORS.red} />
        <Text style={styles.link}>{email}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.row}
        onPress={() => Linking.openURL(PHONE_TEL)}
        activeOpacity={0.75}
      >
        <Ionicons name="call-outline" size={16} color={COLORS.red} />
        <Text style={styles.link}>{PHONE_DISPLAY}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const HelpSupportScreen: React.FC = () => (
  <AccountScreenLayout title="Help & Support">
    <Card padding={16}>
      <Text style={styles.title}>Contact ATOMIK Support</Text>
      <Text style={styles.body}>
        For booking issues, technician delays, or billing questions, reach our
        support team.
      </Text>

      <ContactBlock
        heading="General Enquiries"
        email="contact@atomikaudio.com"
      />
      <View style={styles.divider} />
      <ContactBlock
        heading="Product Support"
        email="support@atomikaudio.com"
      />
    </Card>

    <Card padding={16} style={styles.card}>
      <Text style={styles.title}>FAQ</Text>
      <Text style={styles.faqQ}>How do I track my technician?</Text>
      <Text style={styles.body}>
        Open Home → Track Service or tap a notification to see live status and
        contact details.
      </Text>
      <Text style={styles.faqQ}>When is payment due?</Text>
      <Text style={styles.body}>
        Pay from the Payments tab after booking. Service proceeds once payment
        is confirmed.
      </Text>
    </Card>
  </AccountScreenLayout>
);

const styles = StyleSheet.create({
  card: { marginTop: 12 },
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
    marginBottom: 8,
  },
  block: {
    marginTop: 12,
  },
  blockHeading: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.ashGray,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  link: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.red,
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
    marginBottom: 4,
  },
  faqQ: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    marginTop: 12,
    marginBottom: 4,
  },
});
