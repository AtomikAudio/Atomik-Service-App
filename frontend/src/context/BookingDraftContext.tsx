import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { ApiServiceType, resolvePrimaryServiceType } from '../constants/audioServices';
import { bookingService } from '../services/bookings';

export const GENERAL_VISIT_CATEGORY_ID = 'general-visit';

export interface BookingDraft {
  categoryIds: string[];
  venueId?: string;
  addressLabel?: string;
  venueType?: string;
  indoorOutdoor?: 'indoor' | 'outdoor';
  details?: string;
  photos: string[];
  scheduledDate?: string;
  scheduledTime?: string;
  slotHoldExpiresAt?: string;
  lat?: number;
  lng?: number;
  /** Set after place-order succeeds; used so Payment → back keeps the draft. */
  pendingBookingId?: string;
  pendingInvoiceId?: string;
}

const emptyDraft: BookingDraft = {
  categoryIds: [],
  photos: [],
};

type LeaveOptions = {
  /** Show the leave confirm even if the draft looks empty (e.g. Place Order back). */
  force?: boolean;
};

interface BookingDraftContextValue {
  draft: BookingDraft;
  setDraft: React.Dispatch<React.SetStateAction<BookingDraft>>;
  resetDraft: () => void;
  addCategory: (id: string) => void;
  removeCategory: (id: string) => void;
  primaryServiceType: () => ApiServiceType;
  canConfirm: boolean;
  /** True when the user has started a booking that would be lost on leave. */
  isBookingInProgress: boolean;
  leaveConfirmOpen: boolean;
  leaveConfirmLoading: boolean;
  /**
   * Ask before abandoning the booking. Returns true if the leave was blocked
   * (confirm modal shown). Returns false if leave proceeded immediately.
   */
  requestLeaveBooking: (
    afterLeave?: () => void,
    options?: LeaveOptions
  ) => boolean;
  confirmLeaveBooking: () => Promise<void>;
  cancelLeaveBooking: () => void;
}

const BookingDraftContext = createContext<BookingDraftContextValue | null>(null);

function draftHasProgress(draft: BookingDraft): boolean {
  return Boolean(
    draft.pendingBookingId ||
      draft.pendingInvoiceId ||
      draft.categoryIds.length > 0 ||
      draft.venueId ||
      draft.addressLabel ||
      draft.scheduledDate ||
      draft.scheduledTime ||
      draft.slotHoldExpiresAt ||
      (draft.details && draft.details.trim()) ||
      draft.photos.length > 0
  );
}

export const BookingDraftProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveConfirmLoading, setLeaveConfirmLoading] = useState(false);
  const afterLeaveRef = useRef<(() => void) | undefined>(undefined);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const resetDraft = useCallback(() => setDraft(emptyDraft), []);

  const isBookingInProgress = useMemo(() => draftHasProgress(draft), [draft]);

  const addCategory = useCallback((id: string) => {
    setDraft((d) => {
      // General Visit is standalone — never combine with General Service (or anything else).
      if (id === GENERAL_VISIT_CATEGORY_ID) {
        if (
          d.categoryIds.length === 1 &&
          d.categoryIds[0] === GENERAL_VISIT_CATEGORY_ID
        ) {
          return d;
        }
        return { ...d, categoryIds: [GENERAL_VISIT_CATEGORY_ID] };
      }

      const withoutVisit = d.categoryIds.filter(
        (c) => c !== GENERAL_VISIT_CATEGORY_ID
      );
      if (withoutVisit.includes(id)) {
        return withoutVisit.length === d.categoryIds.length
          ? d
          : { ...d, categoryIds: withoutVisit };
      }
      return { ...d, categoryIds: [...withoutVisit, id] };
    });
  }, []);

  const removeCategory = useCallback((id: string) => {
    setDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.filter((c) => c !== id),
    }));
  }, []);

  const primaryServiceType = useCallback(
    () => resolvePrimaryServiceType(draft.categoryIds),
    [draft.categoryIds]
  );

  const canConfirm = Boolean(
    draft.categoryIds.length > 0 &&
      draft.venueId &&
      draft.addressLabel &&
      draft.scheduledDate &&
      draft.scheduledTime
  );

  const requestLeaveBooking = useCallback(
    (afterLeave?: () => void, options?: LeaveOptions) => {
      const shouldGuard = options?.force || draftHasProgress(draftRef.current);
      if (!shouldGuard) {
        afterLeave?.();
        return false;
      }
      afterLeaveRef.current = afterLeave;
      setLeaveConfirmOpen(true);
      return true;
    },
    []
  );

  const cancelLeaveBooking = useCallback(() => {
    if (leaveConfirmLoading) return;
    afterLeaveRef.current = undefined;
    setLeaveConfirmOpen(false);
  }, [leaveConfirmLoading]);

  const confirmLeaveBooking = useCallback(async () => {
    setLeaveConfirmLoading(true);
    const current = draftRef.current;
    try {
      if (current.pendingBookingId) {
        try {
          await bookingService.cancelBooking(
            current.pendingBookingId,
            'Left booking flow before payment'
          );
        } catch {
          // Draft still clears so the user can start fresh.
        }
      } else {
        try {
          await bookingService.releaseSlotHold();
        } catch {
          // Hold may already be gone.
        }
      }
    } finally {
      resetDraft();
      setLeaveConfirmLoading(false);
      setLeaveConfirmOpen(false);
      const after = afterLeaveRef.current;
      afterLeaveRef.current = undefined;
      after?.();
    }
  }, [resetDraft]);

  return (
    <BookingDraftContext.Provider
      value={{
        draft,
        setDraft,
        resetDraft,
        addCategory,
        removeCategory,
        primaryServiceType,
        canConfirm,
        isBookingInProgress,
        leaveConfirmOpen,
        leaveConfirmLoading,
        requestLeaveBooking,
        confirmLeaveBooking,
        cancelLeaveBooking,
      }}
    >
      {children}
    </BookingDraftContext.Provider>
  );
};

export const useBookingDraft = () => {
  const ctx = useContext(BookingDraftContext);
  if (!ctx) throw new Error('useBookingDraft must be inside BookingDraftProvider');
  return ctx;
};
