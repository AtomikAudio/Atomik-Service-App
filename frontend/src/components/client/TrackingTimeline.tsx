import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { formatDateTimeIST } from '../../utils/schedule';
import { TrackingTimelineEvent } from '../../utils/trackingTimeline';

const DOT_SIZE = 12;
const DOT_ACTIVE = 16;
const LINE_WIDTH = 2;
const RAIL_WIDTH = 28;

interface Props {
  events: TrackingTimelineEvent[];
  emptyMessage?: string;
}

export const TrackingTimeline: React.FC<Props> = ({
  events,
  emptyMessage = 'No updates yet.',
}) => {
  if (events.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.timeline}>
      {events.map((event, index) => {
        const isFirst = index === 0;
        const isLast = index === events.length - 1;
        const isActive = !!event.isLatest;
        const segmentDone = !isActive;

        return (
          <View key={event.id} style={styles.step}>
            <View style={styles.rail}>
              {!isFirst ? (
                <View
                  style={[
                    styles.lineSegment,
                    styles.lineTop,
                    segmentDone || isActive ? styles.lineDone : styles.linePending,
                  ]}
                />
              ) : (
                <View style={styles.lineTopSpacer} />
              )}

              <View
                style={[
                  styles.dotWrap,
                  isActive && styles.dotWrapActive,
                ]}
              >
                {isActive ? <View style={styles.dotGlow} /> : null}
                <View
                  style={[
                    styles.dot,
                    isActive ? styles.dotActive : styles.dotDone,
                  ]}
                />
              </View>

              {!isLast ? (
                <View
                  style={[
                    styles.lineSegment,
                    styles.lineBottom,
                    segmentDone ? styles.lineDone : styles.linePending,
                  ]}
                />
              ) : (
                <View style={styles.lineBottomSpacer} />
              )}
            </View>

            <View style={[styles.content, !isLast && styles.contentSpaced]}>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive,
                ]}
              >
                {event.label}
              </Text>
              <Text style={styles.stepTime}>
                {formatDateTimeIST(event.timestamp)} IST
              </Text>
              {event.notes ? (
                <Text style={styles.stepNotes}>{event.notes}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  timeline: {
    paddingLeft: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  lineTopSpacer: {
    height: 4,
  },
  lineBottomSpacer: {
    flex: 1,
    minHeight: 4,
  },
  lineSegment: {
    width: LINE_WIDTH,
    flex: 1,
    minHeight: 16,
  },
  lineTop: {
    marginBottom: 0,
  },
  lineBottom: {
    marginTop: 0,
  },
  lineDone: {
    backgroundColor: COLORS.timelineActive,
  },
  linePending: {
    backgroundColor: COLORS.timelineInactive,
  },
  dotWrap: {
    width: DOT_ACTIVE + 8,
    height: DOT_ACTIVE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrapActive: {
    width: DOT_ACTIVE + 14,
    height: DOT_ACTIVE + 14,
  },
  dotGlow: {
    position: 'absolute',
    width: DOT_ACTIVE + 12,
    height: DOT_ACTIVE + 12,
    borderRadius: (DOT_ACTIVE + 12) / 2,
    backgroundColor: 'rgba(142, 48, 47, 0.25)',
  },
  dot: {
    borderRadius: 99,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  dotDone: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    backgroundColor: COLORS.timelineActive,
  },
  dotActive: {
    width: DOT_ACTIVE,
    height: DOT_ACTIVE,
    backgroundColor: COLORS.timelineActive,
    borderColor: 'rgba(142, 48, 47, 0.5)',
    shadowColor: COLORS.timelineActive,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 6,
  },
  content: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 4,
  },
  contentSpaced: {
    paddingBottom: 20,
  },
  stepLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.gray,
  },
  stepLabelActive: {
    color: COLORS.white,
    fontSize: 14,
  },
  stepTime: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 4,
  },
  stepNotes: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    lineHeight: 17,
  },
  empty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
});
