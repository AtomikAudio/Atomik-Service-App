import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { LoadingView } from '../../components/common/LoadingView';
import { PressableScale } from '../../components/common/PressableScale';
import { adminService } from '../../services/admin';
import { COLORS } from '../../constants/colors';
import { TechRatingBadge } from '../../components/common/TechRatingBadge';
import { formatServiceTypeLabel } from '../../utils/bookingDisplay';

type UserRole = 'client' | 'technician' | 'admin';

interface UserRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  rating?: number;
  ratingCount?: number;
}

type TechReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  clientName: string;
  clientPhone: string | null;
  venueName: string;
  bookingCode: string | null;
  serviceType: string | null;
  bookingId: string;
};

const CATEGORIES: {
  role: UserRole;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}[] = [
  {
    role: 'client',
    title: 'Users',
    subtitle: 'Clients & service accounts',
    icon: 'people-outline',
    accent: COLORS.red,
  },
  {
    role: 'technician',
    title: 'Technicians',
    subtitle: 'Field engineers & assignees',
    icon: 'hardware-chip-outline',
    accent: '#4a9eff',
  },
  {
    role: 'admin',
    title: 'Admins',
    subtitle: 'Operations & dashboard access',
    icon: 'shield-outline',
    accent: '#c9a227',
  },
];

const categoryMeta = (role: UserRole) =>
  CATEGORIES.find((c) => c.role === role)!;

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={14}
          color={n <= rating ? COLORS.ashGray : COLORS.grayDark}
        />
      ))}
      <Text style={styles.starsValue}>{rating}/5</Text>
    </View>
  );
}

export const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { scrollBottomPadding } = useLayoutInsets();
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTech, setSelectedTech] = useState<UserRow | null>(null);
  const [techReviews, setTechReviews] = useState<TechReviewRow[]>([]);
  const [techRating, setTechRating] = useState({ rating: 0, ratingCount: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeRole) return;
    setLoading(true);
    try {
      const q = search.trim();
      setUsers(
        await adminService.getUsers({
          role: activeRole,
          search: q || undefined,
          limit: 100,
        })
      );
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [activeRole, search]);

  useEffect(() => {
    if (!activeRole) return;
    const timer = setTimeout(load, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, activeRole, search]);

  const openCategory = (role: UserRole) => {
    setSearch('');
    setUsers([]);
    setSelectedTech(null);
    setTechReviews([]);
    setActiveRole(role);
  };

  const closeList = () => {
    setActiveRole(null);
    setSearch('');
    setUsers([]);
    setSelectedTech(null);
    setTechReviews([]);
  };

  const closeTechReviews = () => {
    setSelectedTech(null);
    setTechReviews([]);
    setTechRating({ rating: 0, ratingCount: 0 });
  };

  const openTechReviews = async (tech: UserRow) => {
    setSelectedTech(tech);
    setReviewsLoading(true);
    setTechReviews([]);
    setTechRating({
      rating: tech.rating ?? 0,
      ratingCount: tech.ratingCount ?? 0,
    });
    try {
      const data = await adminService.getTechnicianReviews(tech._id);
      setTechReviews(data.reviews);
      setTechRating({
        rating: data.rating,
        ratingCount: data.ratingCount,
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not load technician ratings';
      Alert.alert('Ratings', msg);
      setSelectedTech(null);
    } finally {
      setReviewsLoading(false);
    }
  };

  const goBackFromHub = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent();
    if (parent?.canGoBack?.()) {
      parent.goBack();
      return;
    }
    parent?.navigate('Dashboard');
  }, [navigation]);

  const toggle = async (id: string) => {
    try {
      await adminService.toggleUser(id);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  if (!activeRole) {
    return (
      <Screen>
        <Header title="Users" showBack onBackPress={goBackFromHub} />
        <SafeScrollView contentContainerStyle={styles.hub}>
          <Text style={styles.hubTitle}>Manage accounts</Text>
          <Text style={styles.hubDesc}>
            Choose a role group to browse, search, and enable or disable accounts.
          </Text>
          {CATEGORIES.map((cat) => (
            <PressableScale
              key={cat.role}
              style={[styles.categoryBtn, { borderColor: `${cat.accent}45` }]}
              onPress={() => openCategory(cat.role)}
            >
              <View
                style={[styles.categoryIcon, { backgroundColor: `${cat.accent}18` }]}
              >
                <Ionicons name={cat.icon} size={22} color={cat.accent} />
              </View>
              <View style={styles.categoryText}>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.grayDark} />
            </PressableScale>
          ))}
        </SafeScrollView>
      </Screen>
    );
  }

  if (selectedTech) {
    return (
      <Screen>
        <Header
          title={selectedTech.name}
          showBack
          onBackPress={closeTechReviews}
        />
        <View style={styles.techSummary}>
          <TechRatingBadge
            rating={techRating.rating}
            ratingCount={techRating.ratingCount}
          />
          <Text style={styles.techSummaryMeta}>
            {techRating.ratingCount > 0
              ? `${techRating.ratingCount} client rating${
                  techRating.ratingCount === 1 ? '' : 's'
                }`
              : 'No client ratings yet'}
          </Text>
        </View>
        {reviewsLoading ? (
          <LoadingView />
        ) : (
          <FlatList
            data={techReviews}
            keyExtractor={(r) => r.id}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: scrollBottomPadding },
            ]}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No ratings submitted for this technician yet.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewClient}>
                    <Text style={styles.reviewClientName} numberOfLines={1}>
                      {item.clientName}
                    </Text>
                    <Text style={styles.reviewVenue} numberOfLines={2}>
                      {item.venueName}
                    </Text>
                  </View>
                  <Stars rating={item.rating} />
                </View>
                {(item.bookingCode || item.serviceType) && (
                  <Text style={styles.reviewMeta}>
                    {[
                      item.bookingCode ? `#${item.bookingCode}` : null,
                      item.serviceType
                        ? formatServiceTypeLabel(item.serviceType)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
                {item.comment ? (
                  <Text style={styles.reviewComment}>{item.comment}</Text>
                ) : null}
              </View>
            )}
          />
        )}
      </Screen>
    );
  }

  const meta = categoryMeta(activeRole);

  return (
    <Screen>
      <Header
        title={meta.title}
        showBack
        onBackPress={closeList}
      />
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={16} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${meta.title.toLowerCase()}…`}
          placeholderTextColor={COLORS.grayDark}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      {activeRole === 'technician' ? (
        <Text style={styles.listHint}>
          Tap a technician to view client ratings (name, venue, score).
        </Text>
      ) : null}
      {loading && users.length === 0 ? (
        <LoadingView />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search.trim()
                ? `No ${meta.title.toLowerCase()} match your search.`
                : `No ${meta.title.toLowerCase()} found.`}
            </Text>
          }
          renderItem={({ item }) => {
            const isTech = activeRole === 'technician';
            const body = (
              <>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isTech ? (
                      <TechRatingBadge
                        rating={item.rating}
                        ratingCount={item.ratingCount}
                        style={styles.ratingBadge}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.email}>{item.email}</Text>
                  {item.phone ? (
                    <Text style={styles.phone}>{item.phone}</Text>
                  ) : null}
                  <View
                    style={[
                      styles.statusPill,
                      item.isActive ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.isActive
                          ? styles.statusTextActive
                          : styles.statusTextInactive,
                      ]}
                    >
                      {item.isActive ? 'ACTIVE' : 'DISABLED'}
                    </Text>
                  </View>
                  {isTech ? (
                    <Text style={styles.tapHint}>View ratings →</Text>
                  ) : null}
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={() => toggle(item._id)}
                  trackColor={{ true: COLORS.red }}
                />
              </>
            );

            if (isTech) {
              return (
                <PressableScale
                  style={styles.card}
                  onPress={() => void openTechReviews(item)}
                >
                  {body}
                </PressableScale>
              );
            }

            return <View style={styles.card}>{body}</View>;
          }}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  hub: { padding: 20, paddingTop: 8 },
  hubTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: COLORS.white,
    marginBottom: 8,
  },
  hubDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 24,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { flex: 1 },
  categoryTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
  categorySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: COLORS.white,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  listHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  info: { flex: 1, paddingRight: 12 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  name: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    flex: 1,
    flexShrink: 1,
  },
  ratingBadge: {
    flexShrink: 0,
  },
  email: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  phone: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.grayDark,
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  statusActive: { backgroundColor: COLORS.statusConfirmedBg },
  statusInactive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    letterSpacing: 1,
  },
  statusTextActive: { color: COLORS.statusConfirmed },
  statusTextInactive: { color: COLORS.grayDark },
  tapHint: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.ashGray,
    marginTop: 8,
  },
  techSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  techSummaryMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    flex: 1,
  },
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewClient: { flex: 1, minWidth: 0 },
  reviewClientName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  reviewVenue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    lineHeight: 17,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  starsValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: COLORS.ashGray,
    marginLeft: 6,
  },
  reviewMeta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 0.5,
    marginTop: 10,
  },
  reviewComment: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 8,
    lineHeight: 18,
  },
  empty: {
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
  },
});
