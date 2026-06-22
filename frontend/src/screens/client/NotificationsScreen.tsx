import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { useIsTabbedRoute } from '../../hooks/useIsTabbedRoute';
import { LoadingView } from '../../components/common/LoadingView';
import { notificationService, AppNotification } from '../../services/notifications';
import { navigateToBookingFromNotification } from '../../navigation/navigateFromNotification';
import { formatDateTimeIST } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

const iconMap = {
  info: { name: 'information-circle' as const, color: '#4a9edd' },
  warning: { name: 'alert-circle' as const, color: COLORS.red },
  success: { name: 'checkmark-circle' as const, color: COLORS.ashGray },
  error: { name: 'close-circle' as const, color: COLORS.red },
};

interface Props {
  navigation: any;
}

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const role = useSelector((state: any) => state.auth.user?.role);
  const { scrollBottomPadding, scrollBottomPaddingFullScreen } = useLayoutInsets();
  const isTabbed = useIsTabbedRoute();
  const listBottomPad = isTabbed ? scrollBottomPadding : scrollBottomPaddingFullScreen;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await notificationService.getNotifications());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const openNotification = async (item: AppNotification) => {
    await notificationService.markRead(item._id);
    const bookingId = item.data?.bookingId;
    if (bookingId) {
      navigateToBookingFromNotification(navigation, role, String(bookingId));
    }
    load();
  };

  const markAll = async () => {
    await notificationService.markAllRead();
    load();
  };

  if (loading) return <LoadingView />;

  const unread = items.filter((i) => !i.isRead).length;

  return (
    <Screen>
      <Header showBack={navigation.canGoBack()} title="Notifications" />
      {items.length > 0 && unread > 0 && (
        <TouchableOpacity style={styles.markAll} onPress={markAll}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.list, { paddingBottom: listBottomPad }]}
        renderItem={({ item }) => {
          const icon = iconMap[item.type] || iconMap.info;
          return (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.unread]}
              onPress={() => openNotification(item)}
            >
              <Ionicons name={icon.name} size={22} color={icon.color} />
              <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>
                  {formatDateTimeIST(item.createdAt)} IST
                </Text>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet</Text>
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  markAll: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  markAllText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
  },
  list: { padding: 20, paddingTop: 0, gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    backgroundColor: 'rgba(142, 48, 47, 0.06)',
  },
  content: { flex: 1 },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    lineHeight: 17,
  },
  time: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.red,
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 40,
    fontFamily: 'Montserrat_400Regular',
  },
});
