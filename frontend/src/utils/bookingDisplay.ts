import { Booking } from '../services/bookings';

export const formatBookingStatus = (status: string): string =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Human-readable API service type label. */
export const formatServiceTypeLabel = (serviceType?: string): string => {
  const labels: Record<string, string> = {
    general: 'General Service',
    inspection: 'General Visit',
    installation: 'Installation',
    emergency: 'Emergency Visit',
  };
  if (!serviceType) return 'Service';
  return labels[serviceType] ?? serviceType.replace(/_/g, ' ');
};

/** Specific services listed in booking notes (e.g. "Services: Tuning, DSP"). */
export const parseBookedServices = (notes?: string): string[] => {
  if (!notes) return [];
  const match = notes.match(/Services:\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
};

/** Client free-text notes, excluding structured lines. */
export const parseBookingClientNotes = (notes?: string): string => {
  if (!notes) return '';
  return notes
    .split('\n')
    .filter(
      (line) =>
        !/^Services:/i.test(line) &&
        !/^Venue type:/i.test(line) &&
        !/^Environment:/i.test(line)
    )
    .join('\n')
    .trim();
};

/** Display list of what was booked — from notes or inferred from service type. */
export const getBookedServiceSummary = (booking: Booking): string[] => {
  const fromNotes = parseBookedServices(booking.notes);
  if (fromNotes.length > 0) return fromNotes;
  return [formatServiceTypeLabel(booking.serviceType)];
};

export const getTechnicianFromBooking = (
  booking: Booking
): { name: string; phone?: string } | null => {
  const tech = booking.technicianId;
  if (!tech || typeof tech === 'string') return null;
  if (!tech.name) return null;
  return { name: tech.name, phone: tech.phone };
};

export const hasAssignedTechnician = (booking: Booking): boolean =>
  getTechnicianFromBooking(booking) !== null;
