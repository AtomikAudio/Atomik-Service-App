import api from './api';

export interface BookingReview {
  rating: number;
  comment?: string;
  createdAt?: string;
  technicianName?: string;
}

export const reviewService = {
  async getForBooking(bookingId: string): Promise<{
    reviewed: boolean;
    review: BookingReview | null;
  }> {
    const res = (await api.get(`/reviews/booking/${bookingId}`)) as {
      reviewed?: boolean;
      review?: BookingReview | null;
    };
    return {
      reviewed: Boolean(res.reviewed),
      review: res.review ?? null,
    };
  },

  async submit(
    bookingId: string,
    rating: number,
    comment?: string
  ): Promise<{ rating: number; technicianName?: string }> {
    const res = (await api.post(`/reviews/booking/${bookingId}`, {
      rating,
      comment,
    })) as {
      review?: { rating: number; technicianName?: string };
      message?: string;
    };
    if (!res.review) {
      throw new Error(res.message || 'Could not submit rating');
    }
    return res.review;
  },
};
