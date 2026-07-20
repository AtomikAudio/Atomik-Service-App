import React from 'react';
import { ThemedConfirmModal } from '../common/ThemedConfirmModal';
import { useBookingDraft } from '../../context/BookingDraftContext';

/** Global leave-booking confirm — shown for header back and tab-bar exits. */
export const BookingLeaveConfirmModal: React.FC = () => {
  const {
    leaveConfirmOpen,
    leaveConfirmLoading,
    confirmLeaveBooking,
    cancelLeaveBooking,
  } = useBookingDraft();

  return (
    <ThemedConfirmModal
      visible={leaveConfirmOpen}
      title="Leave booking?"
      message="Are you sure you want to go back? Your booking details will be cleared."
      confirmLabel="YES, GO BACK"
      cancelLabel="STAY"
      confirmDestructive
      loading={leaveConfirmLoading}
      icon="arrow-back-outline"
      onConfirm={() => {
        void confirmLeaveBooking();
      }}
      onCancel={cancelLeaveBooking}
    />
  );
};
