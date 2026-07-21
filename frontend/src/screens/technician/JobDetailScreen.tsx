import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { LoadingView } from '../../components/common/LoadingView';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
import { bookingService, Booking } from '../../services/bookings';
import { authService, AuthUser } from '../../services/auth';
import { MasterJobAssignPanel } from '../../components/technician/MasterJobAssignPanel';
import { RescheduleSlotPicker } from '../../components/client/RescheduleSlotPicker';
import { COLORS } from '../../constants/colors';
import { isDeclinedByTechnician } from '../../utils/technicianBooking';
import {
  formatBookingDate,
  formatBookingSchedule,
  formatBookingTime,
} from '../../utils/schedule';
import { paymentBadgeVariant, paymentLabel, formatINR } from '../../utils/payment';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';

const STATUS_OPTIONS = [
  { id: 'en_route', label: 'En Route' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

type TabKey = 'details' | 'update';

interface Props {
  navigation: any;
  route: { params: { jobId: string } };
}

const getAssignedTech = (booking: Booking) => {
  const raw =
    booking.technicianId ??
    (booking as Booking & { assignedTechnicianId?: typeof booking.technicianId })
      .assignedTechnicianId;

  if (raw == null) {
    return { id: null as string | null, name: null as string | null };
  }
  if (typeof raw === 'string') {
    return { id: raw, name: null };
  }
  const id = raw._id != null ? String(raw._id) : null;
  return { id, name: raw.name ?? null };
};

const parseServices = (notes?: string): string[] => {
  if (!notes) return [];
  const match = notes.match(/Services:\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
};

const parseClientNotes = (notes?: string): string => {
  if (!notes) return '';
  return notes
    .split('\n')
    .filter((line) => !/^Services:/i.test(line))
    .join('\n')
    .trim();
};

const formatAddress = (venue: Booking['venueId']) => {
  if (!venue) return '—';
  const parts = [
    venue.address,
    venue.area,
    venue.city,
    venue.state,
    venue.pincode,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : venue.name ?? '—';
};

export const JobDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const user = useSelector((state: any) => state.auth.user);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [currentStatus, setCurrentStatus] = useState('en_route');
  const [notes, setNotes] = useState('');
  const [partName, setPartName] = useState('');
  const [partCost, setPartCost] = useState('');
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [spareParts, setSpareParts] = useState<
    { name: string; quantity: number; unitCost: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [technicians, setTechnicians] = useState<AuthUser[]>([]);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  const [resultAlert, setResultAlert] = useState<{
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
  } | null>(null);

  const isMaster = user?.role === 'master_technician';

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const b = await bookingService.getBookingById(jobId);
      setBooking(b);
      const workable = ['en_route', 'arrived', 'in_progress', 'completed'];
      setCurrentStatus(
        workable.includes(b.status) ? b.status : 'en_route'
      );
      setNotes(b.technicianNotes ?? '');
      setSpareParts(b.spareParts ?? []);
      if (isMaster) {
        try {
          setTechnicians(await authService.listTechnicians());
        } catch {
          setTechnicians([]);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [jobId, isMaster]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const acceptJob = async () => {
    setActing(true);
    try {
      const updated = await bookingService.acceptJob(jobId);
      setBooking(updated);
      setActiveTab('details');
      setResultAlert({
        title: 'Job assigned',
        message: 'This job is now assigned to you.',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      setResultAlert({
        title: 'Unable to accept',
        message: e.message || 'Could not accept this job. Please try again.',
        icon: 'alert-circle-outline',
      });
      load();
    } finally {
      setActing(false);
    }
  };

  const rejectJob = () => {
    Alert.alert('Decline job?', 'You can accept this job later if you change your mind.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            const updated = await bookingService.rejectJob(jobId);
            setBooking(updated);
            Alert.alert('Declined', 'Job marked as declined. You can accept later.');
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  const dropJob = () => setDropConfirmOpen(true);

  const confirmDropJob = async () => {
    setActing(true);
    try {
      const updated = await bookingService.dropJob(jobId);
      setBooking(updated);
      setActiveTab('details');
      setDropConfirmOpen(false);
      setResultAlert({
        title: 'Job dropped',
        message: 'This job is back in the open pool for other technicians.',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      setDropConfirmOpen(false);
      setResultAlert({
        title: 'Could not drop job',
        message: e.message || 'Something went wrong. Please try again.',
        icon: 'alert-circle-outline',
      });
    } finally {
      setActing(false);
    }
  };

  const updateStatus = async () => {
    setActing(true);
    try {
      await bookingService.updateStatus(jobId, currentStatus, notes, {
        technicianNotes: notes || undefined,
        // Always send the current list (even when empty) so edits and deletions
        // of previously-added extra parts persist and the invoice is updated.
        spareParts,
      });
      Alert.alert('Saved', `Status updated to ${currentStatus.replace(/_/g, ' ')}.`);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setActing(false);
    }
  };

  const proposeReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      Alert.alert('Select date and time', 'Pick a new date and slot before proposing.');
      return;
    }
    setActing(true);
    try {
      const updated = await bookingService.proposeReschedule(jobId, {
        scheduledDate: rescheduleDate,
        scheduledTime: rescheduleTime,
        note: rescheduleNote.trim() || undefined,
      });
      setBooking(updated);
      setShowReschedulePicker(false);
      setRescheduleDate(null);
      setRescheduleTime('');
      setRescheduleNote('');
      Alert.alert('Sent', 'Client will be notified of the proposed time.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setActing(false);
    }
  };

  const acceptReschedule = async () => {
    setActing(true);
    try {
      const updated = await bookingService.respondToReschedule(jobId, {
        action: 'accept',
      });
      setBooking(updated);
      Alert.alert('Confirmed', 'Service schedule updated.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setActing(false);
    }
  };

  const counterReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      Alert.alert('Select date and time', 'Pick a new date and slot before proposing.');
      return;
    }
    setActing(true);
    try {
      const updated = await bookingService.respondToReschedule(jobId, {
        action: 'counter',
        scheduledDate: rescheduleDate,
        scheduledTime: rescheduleTime,
        note: rescheduleNote.trim() || undefined,
      });
      setBooking(updated);
      setShowReschedulePicker(false);
      setRescheduleDate(null);
      setRescheduleTime('');
      setRescheduleNote('');
      Alert.alert('Sent', 'Client will be notified of the new proposed time.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingView />;
  if (!booking) return null;

  const { id: assignedTechId, name: assignedTechName } = getAssignedTech(booking);
  const masterAssigner = booking.assignedByMasterId;
  const masterAssignerName =
    masterAssigner && typeof masterAssigner === 'object'
      ? masterAssigner.name
      : undefined;
  const isMasterAssigned = Boolean(masterAssigner);
  const isUnassigned = !assignedTechId;
  const isAssignedToMe = assignedTechId === String(user?.id ?? '');
  const isAssignedToOther = !!assignedTechId && !isAssignedToMe;
  const canDrop =
    isAssignedToMe &&
    !isMasterAssigned &&
    !['completed', 'cancelled'].includes(booking.status);
  const masterAssignerId =
    masterAssigner && typeof masterAssigner === 'object'
      ? masterAssigner._id != null
        ? String(masterAssigner._id)
        : null
      : masterAssigner != null
        ? String(masterAssigner)
        : null;
  const canManageReschedule =
    !['completed', 'cancelled'].includes(booking.status) &&
    Boolean(assignedTechId) &&
    (isAssignedToMe || (isMaster && masterAssignerId === String(user?.id ?? '')));
  const pendingClientReschedule =
    booking.reschedule?.status === 'pending_client';
  const pendingTechnicianReschedule =
    booking.reschedule?.status === 'pending_technician';
  const isDeclinedByMe =
    isUnassigned && isDeclinedByTechnician(booking, user?.id);
  const services = parseServices(booking.notes);
  const clientNotes = parseClientNotes(booking.notes);

  const renderSummaryCard = () => (
    <Card padding={18} style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Text style={styles.jobType}>{booking.serviceType}</Text>
        <View style={styles.summaryBadges}>
          {booking.paymentStatus ? (
            <Badge
              label={paymentLabel(booking.paymentStatus)}
              variant={paymentBadgeVariant(booking.paymentStatus)}
            />
          ) : null}
          <Badge
            label={
              isDeclinedByMe
                ? 'declined'
                : isUnassigned
                  ? 'open'
                  : isAssignedToOther
                    ? 'assigned'
                    : booking.status.replace(/_/g, ' ')
            }
            variant="ongoing"
          />
        </View>
      </View>
      <Text style={styles.info}>{booking.venueId?.name}</Text>
      <Text style={styles.info}>
        Client: {(booking.clientId as { name?: string })?.name ?? '—'}
      </Text>
      <Text style={styles.meta}>
        #{booking.bookingId} · {formatBookingSchedule(booking.scheduledDate, booking.scheduledTime)}
      </Text>
    </Card>
  );

  const renderDetailsTab = () => (
    <View style={styles.tabPanel}>
      <Text style={styles.blockLabel}>Client</Text>
      <Card padding={16}>
        <DetailRow label="Name" value={(booking.clientId as any)?.name} />
        <DetailRow label="Phone" value={(booking.clientId as any)?.phone} />
      </Card>

      <Text style={styles.blockLabel}>Service address</Text>
      <Card padding={16}>
        <DetailRow label="Venue" value={booking.venueId?.name} />
        <DetailRow label="Address" value={formatAddress(booking.venueId)} />
      </Card>

      <Text style={styles.blockLabel}>Schedule</Text>
      <Card padding={16}>
        <DetailRow
          label="Date"
          value={formatBookingDate(booking.scheduledDate, {
            weekday: 'short',
          })}
        />
        <DetailRow label="Time" value={formatBookingTime(booking.scheduledTime)} />
        <DetailRow label="Type" value={booking.serviceType} />
      </Card>

      <Text style={styles.blockLabel}>Payment</Text>
      <Card padding={16}>
        <DetailRow
          label="Status"
          value={paymentLabel(booking.paymentStatus ?? 'unpaid')}
        />
      </Card>

      <Text style={styles.blockLabel}>Services requested</Text>
      <Card padding={16}>
        {services.length === 0 ? (
          <Text style={styles.muted}>No specific services listed.</Text>
        ) : (
          services.map((service) => (
            <View key={service} style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>{service}</Text>
            </View>
          ))
        )}
      </Card>

      {clientNotes ? (
        <>
          <Text style={styles.blockLabel}>Client notes</Text>
          <Card padding={16}>
            <Text style={styles.notesBody}>{clientNotes}</Text>
          </Card>
        </>
      ) : null}

      {spareParts.length > 0 ? (
        <>
          <Text style={styles.blockLabel}>Extra parts added</Text>
          <Card padding={16}>
            {spareParts.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.partRow}>
                <Text style={styles.partName}>{p.name}</Text>
                <Text style={styles.partCost}>
                  {formatINR((p.quantity ?? 1) * (p.unitCost ?? 0))}
                </Text>
              </View>
            ))}
            <View style={[styles.partRow, styles.partTotalRow]}>
              <Text style={styles.partTotalLabel}>Total extra</Text>
              <Text style={styles.partTotalValue}>
                {formatINR(sumSparePartsTotal(spareParts))}
              </Text>
            </View>
          </Card>
        </>
      ) : null}

      {isMasterAssigned && isAssignedToMe ? (
        <Card padding={16} style={styles.masterNotice}>
          <Text style={styles.masterNoticeTitle}>Master assignment</Text>
          <Text style={styles.masterNoticeBody}>
            This job was assigned by Master Technician {masterAssignerName ?? '—'}.
            Contact them to drop this job.
            {masterAssigner &&
            typeof masterAssigner === 'object' &&
            masterAssigner.phone
              ? ` (${masterAssigner.phone})`
              : ''}
          </Text>
        </Card>
      ) : null}

      {canDrop && (
        <Button
          label="DROP JOB"
          variant="outline"
          onPress={dropJob}
          loading={acting}
          style={styles.dropBtn}
        />
      )}
    </View>
  );

  const renderRescheduleSection = () => {
    if (!canManageReschedule) return null;
    return (
      <>
        <Text style={styles.blockLabel}>Reschedule job</Text>
        <Card padding={16}>
          <DetailRow
            label="Current schedule"
            value={formatBookingSchedule(
              booking.scheduledDate,
              booking.scheduledTime
            )}
          />
          {booking.reschedule ? (
            <DetailRow
              label={
                pendingTechnicianReschedule ? 'Client proposed' : 'Your proposal'
              }
              value={formatBookingSchedule(
                booking.reschedule.proposedDate,
                booking.reschedule.proposedTime
              )}
            />
          ) : null}

          {pendingTechnicianReschedule ? (
            <>
              <Text style={styles.rescheduleHint}>
                Client suggested a new time. Accept it or propose a different slot.
              </Text>
              {booking.reschedule?.note ? (
                <Text style={styles.rescheduleNote}>
                  "{booking.reschedule.note}"
                </Text>
              ) : null}
              {!showReschedulePicker ? (
                <View style={styles.rescheduleActions}>
                  <Button
                    label="ACCEPT CLIENT TIME"
                    onPress={acceptReschedule}
                    loading={acting}
                  />
                  <Button
                    label="PROPOSE DIFFERENT TIME"
                    variant="outline"
                    onPress={() => setShowReschedulePicker(true)}
                    disabled={acting}
                    style={styles.rescheduleSecondaryBtn}
                  />
                </View>
              ) : null}
            </>
          ) : pendingClientReschedule ? (
            <Text style={styles.rescheduleHint}>
              Waiting for client to accept your proposed time of{' '}
              {formatBookingSchedule(
                booking.reschedule!.proposedDate,
                booking.reschedule!.proposedTime
              )}
              .
            </Text>
          ) : !showReschedulePicker ? (
            <Button
              label="RESCHEDULE JOB"
              variant="outline"
              onPress={() => setShowReschedulePicker(true)}
              disabled={acting}
            />
          ) : null}

          {showReschedulePicker ? (
            <View style={styles.reschedulePicker}>
              <RescheduleSlotPicker
                bookingId={booking._id}
                serviceType={booking.serviceType}
                selectedDate={rescheduleDate}
                selectedTime={rescheduleTime}
                onSelectDate={setRescheduleDate}
                onSelectTime={setRescheduleTime}
              />
              <Input
                label="Note (optional)"
                value={rescheduleNote}
                onChangeText={setRescheduleNote}
                placeholder="Reason for reschedule..."
                multiline
              />
              <Button
                label={
                  pendingTechnicianReschedule
                    ? 'SEND COUNTER-PROPOSAL'
                    : 'SEND PROPOSAL'
                }
                onPress={
                  pendingTechnicianReschedule
                    ? counterReschedule
                    : proposeReschedule
                }
                loading={acting}
              />
              <Button
                label="CANCEL"
                variant="ghost"
                onPress={() => {
                  setShowReschedulePicker(false);
                  setRescheduleDate(null);
                  setRescheduleTime('');
                  setRescheduleNote('');
                }}
                disabled={acting}
              />
            </View>
          ) : null}
        </Card>
      </>
    );
  };

  const renderUpdateTab = () => (
    <View style={styles.tabPanel}>
      {renderRescheduleSection()}

      <Text style={styles.blockLabel}>Job status</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.statusBtn,
              currentStatus === s.id && styles.statusBtnActive,
            ]}
            onPress={() => setCurrentStatus(s.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusBtnText,
                currentStatus === s.id && styles.statusBtnTextActive,
              ]}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label="Technician notes"
        placeholder="Add notes about the visit..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.blockLabel}>Spare parts</Text>
      <Card padding={16} style={styles.partsCard}>
        <Input
          label="Part name"
          value={partName}
          onChangeText={setPartName}
          placeholder="e.g. XLR cable"
        />
        <Input
          label="Unit cost (₹)"
          value={partCost}
          onChangeText={setPartCost}
          keyboardType="numeric"
          placeholder="500"
        />
        <Button
          label={editingPartIndex === null ? 'ADD PART' : 'UPDATE PART'}
          variant="outline"
          onPress={() => {
            if (!partName.trim() || !partCost.trim()) return;
            const nextPart = {
              name: partName.trim(),
              quantity:
                editingPartIndex !== null
                  ? spareParts[editingPartIndex]?.quantity ?? 1
                  : 1,
              unitCost: Number(partCost) || 0,
            };
            setSpareParts((prev) => {
              if (editingPartIndex === null) return [...prev, nextPart];
              return prev.map((p, idx) =>
                idx === editingPartIndex ? nextPart : p
              );
            });
            setEditingPartIndex(null);
            setPartName('');
            setPartCost('');
          }}
          style={styles.addPartBtn}
        />
        {editingPartIndex !== null ? (
          <Button
            label="CANCEL EDIT"
            variant="ghost"
            onPress={() => {
              setEditingPartIndex(null);
              setPartName('');
              setPartCost('');
            }}
            style={styles.addPartBtn}
          />
        ) : null}
        {spareParts.map((p, i) => (
          <View key={`${p.name}-${i}`} style={styles.partRow}>
            <Text style={styles.partName}>{p.name}</Text>
            <Text style={styles.partCost}>₹{p.unitCost}</Text>
            <View style={styles.partActions}>
              <TouchableOpacity
                onPress={() => {
                  setEditingPartIndex(i);
                  setPartName(p.name);
                  setPartCost(String(p.unitCost ?? ''));
                }}
                hitSlop={8}
                style={styles.partActionBtn}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.gray} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSpareParts((prev) => prev.filter((_, idx) => idx !== i));
                  if (editingPartIndex === i) {
                    setEditingPartIndex(null);
                    setPartName('');
                    setPartCost('');
                  }
                }}
                hitSlop={8}
                style={styles.partActionBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>

      <Button
        label="SAVE STATUS"
        onPress={updateStatus}
        loading={acting}
        style={styles.saveBtn}
      />
      {isMasterAssigned && isAssignedToMe ? (
        <Card padding={16} style={styles.masterNotice}>
          <Text style={styles.masterNoticeTitle}>Master assignment</Text>
          <Text style={styles.masterNoticeBody}>
            This job was assigned by Master Technician {masterAssignerName ?? '—'}.
            Contact them to drop this job.
            {masterAssigner &&
            typeof masterAssigner === 'object' &&
            masterAssigner.phone
              ? ` (${masterAssigner.phone})`
              : ''}
          </Text>
        </Card>
      ) : null}

      {canDrop && (
        <Button
          label="DROP JOB"
          variant="ghost"
          onPress={dropJob}
          disabled={acting}
          style={styles.dropBtnGhost}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header showBack title={`Job #${booking.bookingId}`} />
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderSummaryCard()}

        {isUnassigned && isMaster && booking && (
          <View style={styles.poolSection}>
            <MasterJobAssignPanel
              job={booking}
              technicians={technicians}
              onUpdated={() => load({ silent: true })}
            />
          </View>
        )}

        {isUnassigned && !isMaster && !isDeclinedByMe && (
          <View style={styles.poolSection}>
            <Text style={styles.poolHint}>
              This job is open. Accept to take ownership or decline if unavailable.
            </Text>
            <View style={styles.actionRow}>
              <Button
                label="ACCEPT"
                onPress={acceptJob}
                loading={acting}
                fullWidth={false}
                style={styles.actionBtn}
              />
              <Button
                label="REJECT"
                variant="outline"
                onPress={rejectJob}
                disabled={acting}
                fullWidth={false}
                style={styles.actionBtn}
              />
            </View>
          </View>
        )}

        {isDeclinedByMe && !isMaster && (
          <View style={styles.poolSection}>
            <Card padding={16} style={styles.declinedCard}>
              <Text style={styles.declinedTitle}>You declined this job</Text>
              <Text style={styles.declinedSub}>
                The card stays visible. Tap Accept below if you are available now.
              </Text>
            </Card>
            <Button
              label="ACCEPT JOB"
              onPress={acceptJob}
              loading={acting}
              style={{ marginTop: 12 }}
            />
          </View>
        )}

        {isAssignedToOther && (
          <Card padding={16} style={styles.assignedBanner}>
            <Text style={styles.assignedTitle}>
              {isMasterAssigned && masterAssignerName
                ? `Assigned to ${assignedTechName ?? 'technician'}`
                : `Taken by ${assignedTechName ?? 'another technician'}`}
            </Text>
            <Text style={styles.assignedSub}>
              {isMasterAssigned
                ? `You assigned this job to ${assignedTechName ?? 'the technician'}.`
                : `${assignedTechName ?? 'Another technician'} accepted this job.`}
            </Text>
          </Card>
        )}

        {isAssignedToMe && (
          <>
            <View style={styles.tabBar}>
              {(['details', 'update'] as TabKey[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab === 'details' ? 'Details' : 'Update'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeTab === 'details' ? renderDetailsTab() : renderUpdateTab()}
          </>
        )}

        {isAssignedToOther && renderDetailsTab()}
      </ScrollView>

      <ThemedConfirmModal
        visible={dropConfirmOpen}
        title="Drop this job?"
        message="The job returns to the open pool for other technicians to accept."
        confirmLabel="DROP JOB"
        cancelLabel="KEEP"
        confirmDestructive
        loading={acting}
        icon="alert-circle-outline"
        onConfirm={confirmDropJob}
        onCancel={() => {
          if (!acting) setDropConfirmOpen(false);
        }}
      />

      <ThemedAlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message ?? ''}
        icon={resultAlert?.icon}
        onClose={() => setResultAlert(null)}
      />
    </View>
  );
};

const DetailRow: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  bodyScroll: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 40 },
  tabPanel: { paddingBottom: 16 },
  summaryCard: { marginTop: 8 },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryBadges: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  jobType: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 17,
    color: COLORS.white,
    textTransform: 'capitalize',
    flex: 1,
    marginRight: 8,
  },
  info: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  meta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 10,
  },
  poolSection: { marginTop: 20 },
  declinedCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  declinedTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  declinedSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    lineHeight: 18,
  },
  poolHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    height: 52,
  },
  assignedBanner: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  assignedTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  assignedSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.red,
  },
  tabText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.gray,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  blockLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    marginBottom: 10,
    marginTop: 4,
  },
  detailRow: { marginBottom: 12 },
  detailLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: COLORS.grayDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  detailValue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 20,
  },
  muted: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
  serviceChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(142,48,47,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(142,48,47,0.25)',
  },
  serviceChipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.white,
  },
  notesBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: COLORS.surface,
  },
  statusBtnActive: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(142,48,47,0.12)',
  },
  statusBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.gray,
  },
  statusBtnTextActive: {
    color: COLORS.white,
  },
  partsCard: { marginBottom: 8 },
  addPartBtn: { marginTop: 4 },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  partName: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
    flex: 1,
    flexShrink: 1,
  },
  partActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  partActionBtn: {
    padding: 6,
  },
  partCost: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    flexShrink: 0,
    textAlign: 'right',
  },
  partTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    paddingTop: 10,
  },
  partTotalLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
  },
  partTotalValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: COLORS.red,
  },
  saveBtn: { marginTop: 8, marginBottom: 8 },
  dropBtn: { marginTop: 24, marginBottom: 24 },
  masterNotice: {
    marginTop: 16,
    marginBottom: 8,
    borderColor: 'rgba(184, 134, 11, 0.35)',
    borderWidth: 1,
    backgroundColor: COLORS.statusPendingBg,
  },
  masterNoticeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.statusPending,
    marginBottom: 6,
  },
  masterNoticeBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.grayLight,
    lineHeight: 20,
  },
  dropBtnGhost: { marginBottom: 24 },
  rescheduleHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
    marginBottom: 12,
  },
  rescheduleNote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayLight,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  rescheduleActions: { gap: 10 },
  rescheduleSecondaryBtn: { marginTop: 4 },
  reschedulePicker: { marginTop: 8, gap: 10 },
});
