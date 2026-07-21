import React from 'react';
import { Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../constants/colors';

export const HelpSupportScreen: React.FC = () => (
  <AccountScreenLayout title="Help & Support">
    <Card padding={16}>
      <Text style={styles.title}>Contact ATOMIK Support</Text>
      <Text style={styles.body}>
        For booking issues, technician delays, or billing questions, reach our support team.
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:support@atomik.demo')}>
        <Text style={styles.link}>support@atomik.demo</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('tel:+918088675627')}>
        <Text style={[styles.link, styles.linkSpaced]}>+91 80886 75627</Text>
      </TouchableOpacity>
    </Card>
    <Card padding={16} style={styles.card}>
      <Text style={styles.title}>FAQ</Text>
      <Text style={styles.faqQ}>How do I track my technician?</Text>
      <Text style={styles.body}>
        Open Home → Track Service or tap a notification to see live status and contact details.
      </Text>
      <Text style={styles.faqQ}>When is payment due?</Text>
      <Text style={styles.body}>
        Pay from the Payments tab after booking. Service proceeds once payment is confirmed.
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
  link: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.red,
  },
  linkSpaced: { marginTop: 10 },
  faqQ: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    marginTop: 12,
    marginBottom: 4,
  },
});
