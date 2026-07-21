import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { DashboardTopBar } from '../../components/common/DashboardTopBar';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { PressableScale } from '../../components/common/PressableScale';
import { LoadingView } from '../../components/common/LoadingView';
import { MasterJobAssignPanel } from '../../components/technician/MasterJobAssignPanel';
import { bookingService, Booking } from '../../services/bookings';
import { authService, AuthUser } from '../../services/auth';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { isDeclinedByTechnician, resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import { formatBookingSchedule } from '../../utils/schedule';
import { paymentBadgeVariant, paymentLabel } from '../../utils/payment';

interface Props {
  navigation: any;
}

const getTechId = resolveAssignedTechnicianId;

const getTechName = (job: Booking): string | null => {
  const t = job.technicianId;
  if (!t || typeof t === 'string') return null;
  return t.name ?? null;
};

const isMasterAssignedJob = (job: Booking): boolean => Boolean(job.assignedByMasterId);

export const TechDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const user = useSelector((state: any) => state.auth.user);
  const isMaster = user?.role === 'master_technician';
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [techTab, setTechTab] = useState<'available' | 'ongoing' | 'pending'>(
    'available'
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await bookingService.getMyBookings({ limit: 50 });
      setJobs(list.filter((j) => j.status !== 'cancelled'));
      if (isMaster) {
        try {
          setTechnicians(await authService.listTechnicians());
        } catch {
          if (!silent) setTechnicians([]);
        }
      }
    } catch {
      if (!silent) {
        setJobs([]);
        if (isMaster) setTechnicians([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isMaster]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLiveRefresh(() => load(true));

  const availableJobs = jobs.filter((j) => !getTechId(j));
  const openJobs = availableJobs.filter(
    (j) => !isDeclinedByTechnician(j, user?.id)
  );
  const declinedJobs = availableJobs.filter((j) =>
    isDeclinedByTechnician(j, user?.id)
  );
  const myJobs = jobs.filter((j) => getTechId(j) === String(user?.id ?? ''));
  const othersJobs = jobs.filter(
    (j) => getTechId(j) && getTechId(j) !== String(user?.id ?? '')
  );
  const activeMine = myJobs.filter(
    (j) => !['completed', 'cancelled'].includes(j.status)
  );
  const awaitingReschedule = activeMine.filter((j) =>
    Boolean(j.reschedule?.status)
  );
  const ongoingJobs = activeMine.filter((j) => !j.reschedule?.status);
  const completedJobs = myJobs.filter((j) => j.status === 'completed');

  const rescheduleHint = (job: Booking) => {
    if (job.reschedule?.status === 'pending_client') {
      return 'Waiting for client to confirm new time';
    }
    if (job.reschedule?.status === 'pending_technician') {
      return 'Client proposed a new time — review on job details';
    }
    return 'Reschedule in progress';
  };
  const renderJobHeader = (job: Booking, badgeLabel: string) => (
    <View style={styles.jobHeader}>
      <Text style={styles.jobType}>{job.serviceType}</Text>
      <View style={styles.jobBadges}>
        {job.paymentStatus ? (
          <Badge
            label={paymentLabel(job.paymentStatus)}
            variant={paymentBadgeVariant(job.paymentStatus)}
          />
        ) : null}
        <Badge label={badgeLabel} variant="ongoing" />
      </View>
    </View>
  );

  const renderOpenJobForMaster = (job: Booking) => (
    <Card key={job._id} padding={16} style={styles.masterOpenCard}>
      {renderJobHeader(job, 'open')}
      <Text style={styles.jobVenue}>{job.venueId?.name}</Text>
      <Text style={styles.jobMeta}>
        #{job.bookingId} · {formatBookingSchedule(job.scheduledDate, job.scheduledTime)}
      </Text>
      <MasterJobAssignPanel job={job} technicians={technicians} onUpdated={load} />
      <PressableScale
        style={styles.viewDetailsLink}
        onPress={() => navigation.navigate('JobDetail', { jobId: job._id })}
      >
        <Text style={styles.viewDetailsText}>View job details →</Text>
      </PressableScale>
    </Card>
  );

  const renderJob = (
    job: Booking,
    variant: 'open' | 'mine' | 'other' | 'declined'
  ) => {
    const techName = getTechName(job);
    const declined = variant === 'declined';
    const badgeLabel = declined
      ? 'declined'
      : variant === 'open'
        ? 'open'
        : variant === 'other'
          ? `→ ${techName ?? 'Assigned'}`
          : job.status.replace(/_/g, ' ');

    return (
      <PressableScale
        key={job._id}
        style={[styles.jobCard, declined && styles.jobCardDeclined]}
        onPress={() => navigation.navigate('JobDetail', { jobId: job._id })}
      >
        <View style={styles.jobContent}>
          {renderJobHeader(job, badgeLabel)}
          <Text style={styles.jobVenue}>{job.venueId?.name}</Text>
          {variant === 'other' && techName ? (
            <Text style={styles.assignedLine}>
              {isMasterAssignedJob(job)
                ? `Assigned to ${techName} by you`
                : `Accepted by ${techName}`}
            </Text>
          ) : null}
          <Text style={styles.jobMeta}>
            #{job.bookingId} · {formatBookingSchedule(job.scheduledDate, job.scheduledTime)}
          </Text>
        </View>
      </PressableScale>
    );
  };

  if (loading) return <LoadingView />;

  return (
    <Screen>
      <DashboardTopBar
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      <SafeScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hey, {user?.name || 'Technician'}</Text>
          <View style={styles.statusPill}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>ON DUTY</Text>
          </View>
        </View>
        <Text style={styles.greetingRole}>
          {isMaster ? 'Master Technician' : 'Field Technician'}
        </Text>

        {isMaster ? (
          <PressableScale onPress={() => navigation.navigate('MasterAssign')}>
            <Card padding={16} style={styles.masterCard}>
              <Text style={styles.masterCardTitle}>Assignment board</Text>
              <Text style={styles.masterCardBody}>
                {openJobs.length} open job{openJobs.length === 1 ? '' : 's'} waiting for assignment
              </Text>
              <Text style={styles.masterCardLink}>Open full board →</Text>
            </Card>
          </PressableScale>
        ) : (
          <View style={styles.techTabs}>
            {(
              [
                { key: 'available', label: 'Available', count: openJobs.length },
                { key: 'ongoing', label: 'Ongoing', count: ongoingJobs.length },
                {
                  key: 'pending',
                  label: 'Pending',
                  count: awaitingReschedule.length,
                },
              ] as const
            ).map((t) => {
              const active = techTab === t.key;
              return (
                <PressableScale
                  key={t.key}
                  style={styles.techTabWrap}
                  scaleTo={0.96}
                  onPress={() => setTechTab(t.key)}
                >
                  <Card
                    padding={14}
                    style={[styles.techTab, active && styles.techTabActive]}
                  >
                    <Text
                      style={[
                        styles.techTabNum,
                        active && styles.techTabNumActive,
                      ]}
                    >
                      {t.count}
                    </Text>
                    <Text
                      style={[
                        styles.techTabLabel,
                        active && styles.techTabLabelActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t.label}
                    </Text>
                  </Card>
                </PressableScale>
              );
            })}
          </View>
        )}

        {isMaster && openJobs.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Open Jobs</Text>
            <Text style={styles.sectionHint}>
              Pick a technician from the dropdown, assign the job, or accept it yourself.
            </Text>
            {openJobs.map((j) => renderOpenJobForMaster(j))}
          </>
        ) : null}

        {!isMaster && techTab === 'available' ? (
          <>
            {openJobs.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Available Jobs</Text>
                <Text style={styles.sectionHint}>
                  Open requests — accept or decline from the job screen.
                </Text>
                {openJobs.map((j) => renderJob(j, 'open'))}
              </>
            ) : null}

            {declinedJobs.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Declined by You</Text>
                <Text style={styles.sectionHint}>
                  Still visible — open and tap Accept if you are available.
                </Text>
                {declinedJobs.map((j) => renderJob(j, 'declined'))}
              </>
            ) : null}

            {othersJobs.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Taken by Others</Text>
                <Text style={styles.sectionHint}>
                  These jobs were accepted by another technician.
                </Text>
                {othersJobs.map((j) => renderJob(j, 'other'))}
              </>
            ) : null}

            {openJobs.length === 0 &&
            declinedJobs.length === 0 &&
            othersJobs.length === 0 ? (
              <Text style={styles.empty}>No available jobs right now.</Text>
            ) : null}
          </>
        ) : null}

        {!isMaster && techTab === 'ongoing' ? (
          <>
            <Text style={styles.sectionTitle}>Ongoing Jobs</Text>
            {ongoingJobs.length === 0 ? (
              <Text style={styles.empty}>No ongoing jobs assigned to you yet.</Text>
            ) : (
              ongoingJobs.map((j) => renderJob(j, 'mine'))
            )}

            {completedJobs.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Completed</Text>
                {completedJobs.map((j) => renderJob(j, 'mine'))}
              </>
            ) : null}
          </>
        ) : null}

        {!isMaster && techTab === 'pending' ? (
          <>
            <Text style={styles.sectionTitle}>Awaiting Reschedule</Text>
            <Text style={styles.sectionHint}>
              Jobs with a proposed time change waiting to be confirmed.
            </Text>
            {awaitingReschedule.length === 0 ? (
              <Text style={styles.empty}>Nothing pending right now.</Text>
            ) : (
              awaitingReschedule.map((j) => (
                <PressableScale
                  key={j._id}
                  style={styles.jobCard}
                  onPress={() =>
                    navigation.navigate('JobDetail', { jobId: j._id })
                  }
                >
                  <View style={styles.jobContent}>
                    {renderJobHeader(j, 'reschedule')}
                    <Text style={styles.jobVenue}>{j.venueId?.name}</Text>
                    <Text style={styles.rescheduleLine}>{rescheduleHint(j)}</Text>
                    <Text style={styles.jobMeta}>
                      #{j.bookingId} ·{' '}
                      {formatBookingSchedule(j.scheduledDate, j.scheduledTime)}
                    </Text>
                  </View>
                </PressableScale>
              ))
            )}
          </>
        ) : null}

        {isMaster ? (
          <>
            {myJobs.filter((j) => !['completed', 'cancelled'].includes(j.status))
              .length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>My Ongoing Jobs</Text>
                {myJobs
                  .filter((j) => !['completed', 'cancelled'].includes(j.status))
                  .map((j) => renderJob(j, 'mine'))}
              </>
            ) : null}
            <Text style={styles.sectionTitle}>Assigned to Team</Text>
            {othersJobs.length === 0 ? (
              <Text style={styles.empty}>No jobs assigned to technicians yet.</Text>
            ) : (
              othersJobs.map((j) => renderJob(j, 'other'))
            )}
          </>
        ) : null}
      </SafeScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.ashGrayBg,
    flexShrink: 0,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.ashGray,
  },
  statusText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.ashGray,
    letterSpacing: 0.5,
  },
  scroll: { padding: 20, paddingBottom: 100 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  greeting: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
    flexShrink: 1,
  },
  greetingRole: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 20,
  },
  masterCard: {
    marginBottom: 20,
    borderColor: 'rgba(142,48,47,0.35)',
    borderWidth: 1,
  },
  masterCardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 6,
  },
  masterCardBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  masterCardLink: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.red,
  },
  techTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  techTabWrap: {
    flex: 1,
  },
  techTab: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  techTabActive: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(142,48,47,0.16)',
  },
  techTabNum: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
  },
  techTabNumActive: {
    color: COLORS.red,
  },
  techTabLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  techTabLabelActive: {
    color: COLORS.white,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 12,
    marginTop: -8,
  },
  masterOpenCard: { marginBottom: 12 },
  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  jobCardDeclined: {
    opacity: 0.75,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  jobContent: { padding: 16 },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  jobBadges: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  jobType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    textTransform: 'capitalize',
    flex: 1,
  },
  jobVenue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
  assignedLine: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.grayDark,
    marginTop: 6,
  },
  rescheduleLine: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
    marginTop: 6,
  },
  jobMeta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 6,
  },
  viewDetailsLink: { marginTop: 10 },
  viewDetailsText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
  },
  empty: { color: COLORS.gray, fontFamily: 'Montserrat_400Regular' },
});
