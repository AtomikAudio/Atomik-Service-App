import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PendingPaymentsScreen } from './PendingPaymentsScreen';
import { PastPaymentsScreen } from './PastPaymentsScreen';
import { Header } from '../../components/common/Header';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

export const PaymentsHubScreen: React.FC<Props> = ({ navigation }) => {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');

  return (
    <View style={styles.container}>
      <Header showLogo title="Payments" />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            Past Payments
          </Text>
        </TouchableOpacity>
      </View>
      {tab === 'pending' ? (
        <PendingPaymentsScreen navigation={navigation} />
      ) : (
        <PastPaymentsScreen navigation={navigation} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: COLORS.surfaceElevated },
  tabText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
  tabTextActive: { color: COLORS.white },
});
