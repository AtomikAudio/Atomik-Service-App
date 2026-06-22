import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { COLORS } from '../../constants/colors';

const SERVICE_TYPES = [
  { id: 'general', icon: 'calendar-outline', label: 'General\nService' },
  { id: 'inspection', icon: 'search-circle-outline', label: 'Inspection' },
  { id: 'installation', icon: 'construct-outline', label: 'Installation' },
  { id: 'emergency', icon: 'notifications-outline', label: 'Emergency\nVisit' },
];

interface Props {
  navigation: any;
  route: any;
}

export const BookServiceScreen: React.FC<Props> = ({ navigation, route }) => {
  const preselected = route?.params?.type;
  const [selected, setSelected] = useState<string>(preselected || '');

  const step = 1;
  const totalSteps = 4;

  return (
    <View style={styles.container}>
      <Header showBack showLogo />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Book a Service</Text>
        <Text style={styles.stepLabel}>Step {step} of {totalSteps}</Text>

        {/* Step Progress */}
        <View style={styles.progressBar}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={styles.progressSegmentWrapper}>
              <View
                style={[
                  styles.progressSegment,
                  i < step && styles.progressSegmentActive,
                  i === step - 1 && styles.progressSegmentCurrent,
                ]}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select Service Type</Text>
        <Text style={styles.sectionDesc}>Choose the type of service you need</Text>

        <View style={styles.servicesGrid}>
          {SERVICE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.serviceCard,
                selected === type.id && styles.serviceCardSelected,
              ]}
              onPress={() => setSelected(type.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={type.icon as any}
                size={28}
                color={selected === type.id ? COLORS.red : COLORS.white}
              />
              <Text
                style={[
                  styles.serviceLabel,
                  selected === type.id && styles.serviceLabelSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chargeNote}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={COLORS.gray}
          />
          <Text style={styles.chargeNoteText}>
            Extra parts and materials used during service are chargeable separately
            and will be added to your invoice after the visit.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="CONTINUE"
          onPress={() =>
            navigation.navigate('SelectVenue', {
              serviceType: selected,
            })
          }
          disabled={!selected}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 120,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 4,
  },
  stepLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 36,
  },
  progressSegmentWrapper: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: COLORS.red,
  },
  progressSegmentCurrent: {
    backgroundColor: COLORS.red,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 17,
    color: COLORS.white,
    marginBottom: 6,
  },
  sectionDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 24,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  serviceCard: {
    width: '47%',
    aspectRatio: 1.1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: 18,
  },
  serviceCardSelected: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(142, 48, 47, 0.08)',
  },
  serviceLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    marginTop: 12,
    lineHeight: 18,
  },
  serviceLabelSelected: {
    color: COLORS.white,
  },
  chargeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chargeNoteText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    lineHeight: 17,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
});
