import React, { createContext, useContext, useState, useCallback } from 'react';
import { ApiServiceType, resolvePrimaryServiceType } from '../constants/audioServices';

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

interface BookingDraftContextValue {
  draft: BookingDraft;
  setDraft: React.Dispatch<React.SetStateAction<BookingDraft>>;
  resetDraft: () => void;
  addCategory: (id: string) => void;
  removeCategory: (id: string) => void;
  primaryServiceType: () => ApiServiceType;
  canConfirm: boolean;
}

const BookingDraftContext = createContext<BookingDraftContextValue | null>(null);

export const BookingDraftProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);

  const resetDraft = useCallback(() => setDraft(emptyDraft), []);

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
