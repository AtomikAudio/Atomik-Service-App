import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthUser, authService } from '../../services/auth';
import { COLORS } from '../../constants/colors';
import { TechAvailabilityBadge } from '../common/TechAvailabilityBadge';
import { subscribeBookingChanged } from '../../services/liveUpdates';

interface Props {
  technicians: AuthUser[];
  value: string;
  onChange: (technicianId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  excludeBookingId?: string;
}

export const TechnicianSelect: React.FC<Props> = ({
  technicians,
  value,
  onChange,
  placeholder = 'Select technician',
  disabled = false,
  scheduledDate,
  scheduledTime,
  excludeBookingId,
}) => {
  const [open, setOpen] = useState(false);
  const [freeById, setFreeById] = useState<Record<string, boolean>>({});
  const selected = technicians.find((t) => t.id === value);

  const loadAvailability = useCallback(async () => {
    try {
      const rows = await authService.listTechnicianAvailability({
        scheduledDate,
        scheduledTime,
        excludeBookingId,
      });
      const next: Record<string, boolean> = {};
      for (const row of rows) next[row.id] = row.free;
      setFreeById(next);
    } catch {
      // Keep last known map; badge simply omits if missing.
    }
  }, [scheduledDate, scheduledTime, excludeBookingId]);

  useEffect(() => {
    if (!open) return undefined;
    void loadAvailability();
    const interval = setInterval(() => {
      void loadAvailability();
    }, 15000);
    const unsubscribe = subscribeBookingChanged(() => {
      void loadAvailability();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [open, loadAvailability]);

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.85}
        disabled={disabled}
      >
        <Text
          style={[styles.triggerText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.gray} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Available technicians</Text>
            {technicians.length === 0 ? (
              <Text style={styles.empty}>No technician accounts found.</Text>
            ) : (
              <FlatList
                data={technicians}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }) => {
                  const active = item.id === value;
                  const free =
                    item.id in freeById ? freeById[item.id] : null;
                  return (
                    <TouchableOpacity
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                    >
                      <View style={styles.optionRow}>
                        <View style={styles.optionMain}>
                          <Text
                            style={[
                              styles.optionText,
                              active && styles.optionTextActive,
                            ]}
                          >
                            {item.name}
                          </Text>
                          {item.phone ? (
                            <Text style={styles.optionSub}>{item.phone}</Text>
                          ) : null}
                        </View>
                        <TechAvailabilityBadge free={free} />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: COLORS.surfaceElevated,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: COLORS.white,
  },
  placeholder: { color: COLORS.gray },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 12,
  },
  list: { maxHeight: 320 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionActive: { backgroundColor: COLORS.redMuted },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionMain: { flex: 1, minWidth: 0 },
  optionText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  optionTextActive: { color: COLORS.white },
  optionSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  empty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    paddingVertical: 8,
  },
});
