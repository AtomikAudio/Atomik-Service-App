import api from './api';
import { getToken } from './tokenStore';
import { getApiBaseUrl } from '../config/apiConfig';
import type { SlotAvailabilityItem, SlotHoldInfo } from '../constants/timeSlots';

const API_BASE = getApiBaseUrl();

export interface BookingInvoice {
  _id: string;
  invoiceNumber: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  serviceCharges: number;
  technicianCharges: number;
  spareParts: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  /** Cash actually charged after discount (not the quote marker). */
  amountReceived?: number;
  paidAt?: string;
  razorpayPaymentId?: string;
  paymentHistory?: {
    amount: number;
    type: string;
    paidAt: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  }[];
}

export interface BookingReschedule {
  status: 'pending_client' | 'pending_technician';
  proposedDate: string;
  proposedTime: string;
  proposedBy: 'technician' | 'client';
  note?: string;
  updatedAt?: string;
  history?: {
    proposedDate: string;
    proposedTime: string;
    proposedBy: 'technician' | 'client';
    note?: string;
    at: string;
  }[];
}

export interface Booking {
  _id: string;
  bookingId: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  notes?: string;
  statusHistory?: {
    status: string;
    timestamp: string;
    notes?: string;
  }[];
  venueId?: {
    name: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  technicianId?: { _id?: string; name: string; phone?: string };
  assignedByMasterId?: { _id?: string; name: string; phone?: string };
  clientId?: { name: string; phone?: string };
  invoiceId?: string;
  invoice?: BookingInvoice;
  paymentStatus?: 'paid' | 'unpaid';
  technicianNotes?: string;
  spareParts?: { name: string; quantity: number; unitCost: number }[];
  /** Client reference photos (Cloudinary HTTPS URLs). */
  serviceImages?: string[];
  rejectedBy?: (string | { _id: string })[];
  reschedule?: BookingReschedule;
}

export const bookingService = {
  async getSlotAvailability(
    date: string,
    excludeBookingId?: string
  ): Promise<{
    date: string;
    slots: SlotAvailabilityItem[];
    myHold: SlotHoldInfo | null;
  }> {
    const res = (await api.get('/bookings/slots/availability', {
      params: {
        date,
        ...(excludeBookingId ? { excludeBookingId } : {}),
      },
    })) as {
      date: string;
      slots: SlotAvailabilityItem[];
      myHold: SlotHoldInfo | null;
    };
    return {
      date: res.date,
      slots: res.slots ?? [],
      myHold: res.myHold ?? null,
    };
  },

  async holdSlot(scheduledDate: string, scheduledTime: string): Promise<SlotHoldInfo> {
    const res = (await api.post('/bookings/slots/hold', {
      scheduledDate,
      scheduledTime,
    })) as { hold: SlotHoldInfo };
    return res.hold;
  },

  async releaseSlotHold(): Promise<void> {
    await api.delete('/bookings/slots/hold');
  },

  async getMySlotHold(): Promise<SlotHoldInfo | null> {
    const res = (await api.get('/bookings/slots/hold')) as { hold: SlotHoldInfo | null };
    return res.hold ?? null;
  },

  async createBooking(payload: {
    serviceType: string;
    venueId: string;
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
  }) {
    return api.post('/bookings', payload) as Promise<{
      booking: Booking;
      invoice: { _id: string; totalAmount: number; invoiceNumber: string };
    }>;
  },

  async uploadServiceImages(
    bookingId: string,
    imageUris: string[]
  ): Promise<Booking> {
    const token = await getToken();
    if (!token || token.startsWith('demo-token-')) {
      throw new Error('Sign in to upload reference photos.');
    }
    if (!imageUris.length) {
      throw new Error('No photos to upload');
    }

    const formData = new FormData();
    imageUris.slice(0, 6).forEach((uri, index) => {
      const filename = uri.split('/').pop() || `photo-${index + 1}.jpg`;
      const ext = filename.split('.').pop()?.toLowerCase();
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
      formData.append('images', {
        uri,
        name: filename,
        type: mime,
      } as unknown as Blob);
    });

    const response = await fetch(`${API_BASE}/bookings/${bookingId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      booking?: Booking;
    };

    if (!response.ok || !data?.booking) {
      throw new Error(data?.message || 'Could not upload photos');
    }
    return data.booking;
  },

  async getMyBookings(params?: { status?: string; page?: number; limit?: number }) {
    const res = (await api.get('/bookings/my', { params })) as {
      bookings: Booking[];
    };
    return res.bookings ?? [];
  },

  async getBookingById(id: string) {
    const res = (await api.get(`/bookings/${id}`)) as { booking: Booking };
    return res.booking;
  },

  async cancelBooking(id: string, reason?: string) {
    return api.patch(`/bookings/${id}/cancel`, { reason });
  },

  async getAllBookings(params?: { status?: string; page?: number; limit?: number }) {
    const res = (await api.get('/bookings', { params })) as {
      bookings: Booking[];
    };
    return res.bookings ?? [];
  },

  async assignTechnician(bookingId: string, technicianId: string) {
    return api.patch(`/bookings/${bookingId}/assign`, { technicianId });
  },

  async assignJobByMaster(bookingId: string, technicianId: string) {
    const res = (await api.patch(`/bookings/${bookingId}/assign-by-master`, {
      technicianId,
    })) as { booking: Booking; message?: string };
    return res.booking;
  },

  async acceptJob(bookingId: string) {
    const res = (await api.patch(`/bookings/${bookingId}/accept`)) as {
      booking: Booking;
    };
    return res.booking;
  },

  async rejectJob(bookingId: string) {
    const res = (await api.patch(`/bookings/${bookingId}/reject`)) as {
      booking: Booking;
    };
    return res.booking;
  },

  async dropJob(bookingId: string) {
    const res = (await api.patch(`/bookings/${bookingId}/drop`)) as {
      booking: Booking;
    };
    return res.booking;
  },

  async updateStatus(
    bookingId: string,
    status: string,
    notes?: string,
    extra?: { technicianNotes?: string; spareParts?: { name: string; quantity: number; unitCost: number }[] }
  ) {
    return api.patch(`/bookings/${bookingId}/status`, {
      status,
      notes,
      ...extra,
    });
  },

  async proposeReschedule(
    bookingId: string,
    payload: { scheduledDate: string; scheduledTime: string; note?: string }
  ) {
    const res = (await api.post(`/bookings/${bookingId}/reschedule/propose`, payload)) as {
      booking: Booking;
      message?: string;
    };
    return res.booking;
  },

  async respondToReschedule(
    bookingId: string,
    payload: {
      action: 'accept' | 'counter';
      scheduledDate?: string;
      scheduledTime?: string;
      note?: string;
    }
  ) {
    const res = (await api.post(`/bookings/${bookingId}/reschedule/respond`, payload)) as {
      booking: Booking;
      message?: string;
    };
    return res.booking;
  },
};
