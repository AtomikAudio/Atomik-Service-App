import api from './api';

export const adminService = {
  async getStats() {
    return api.get('/admin/stats') as Promise<{
      stats: {
        totalUsers: number;
        totalBookings: number;
        pendingBookings: number;
        totalRevenue: number;
        activeTechnicians: number;
      };
    }>;
  },

  async getAnalytics() {
    return api.get('/admin/analytics');
  },

  async getUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const res = (await api.get('/admin/users', { params })) as {
      users: {
        _id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        isActive: boolean;
        rating?: number;
        ratingCount?: number;
      }[];
    };
    return res.users ?? [];
  },

  async toggleUser(id: string) {
    return api.patch(`/admin/users/${id}/toggle`);
  },

  async getTechnicianReviews(technicianId: string): Promise<{
    technician: {
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
    };
    rating: number;
    ratingCount: number;
    reviews: {
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
    }[];
  }> {
    const res = (await api.get(`/reviews/technician/${technicianId}`)) as {
      technician?: {
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
      };
      rating?: number;
      ratingCount?: number;
      reviews?: {
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
      }[];
      message?: string;
    };
    if (!res.technician) {
      throw new Error(res.message || 'Could not load technician ratings');
    }
    return {
      technician: res.technician,
      rating: Number(res.rating ?? 0),
      ratingCount: Number(res.ratingCount ?? 0),
      reviews: res.reviews ?? [],
    };
  },
};
