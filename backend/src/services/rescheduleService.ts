import mongoose from 'mongoose';
import { Booking, IBooking, IRescheduleHistoryEntry } from '../models/Booking';
import { resolveTechnicianId } from '../utils/bookingAssignment';
import {
  assertRescheduleSlotAvailable,
  normalizeSlotDate,
  normalizeSlotTime,
} from './slotHoldService';
import {
  formatDateIST,
  normalizeScheduledTime,
  parseScheduledDate,
  toISODateStringIST,
} from '../utils/schedule';
import { notifyClientBooking } from '../utils/notifyClient';
import { notifyUsers } from '../utils/notifyUsers';
import { BadRequestError, toObjectId } from '../utils/mongoQuery';

function formatProposalLabel(date: Date, time: string): string {
  const displayTime = time.replace(/\s*IST\s*$/i, '').trim();
  return `${formatDateIST(date)} · ${displayTime}`;
}

function assertRescheduleEligible(booking: IBooking): void {
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    throw new BadRequestError('Cannot reschedule a completed or cancelled booking');
  }
}

function resolveMasterAssignerId(booking: IBooking): string | null {
  const ref = booking.assignedByMasterId;
  if (!ref) return null;
  if (typeof ref === 'object' && '_id' in ref && ref._id) {
    return ref._id.toString();
  }
  return ref.toString();
}

function canActAsTechnicianOnReschedule(
  booking: IBooking,
  userId: string,
  role: string
): boolean {
  const assigned = resolveTechnicianId(booking);
  if (assigned && assigned === userId) return true;
  if (role === 'master_technician' && resolveMasterAssignerId(booking) === userId) {
    return true;
  }
  return false;
}

function assertTechnicianRescheduleAccess(
  booking: IBooking,
  userId: string,
  role: string
): void {
  if (!canActAsTechnicianOnReschedule(booking, userId, role)) {
    throw new BadRequestError(
      'Only the assigned technician can manage reschedule for this job'
    );
  }
  if (!resolveTechnicianId(booking)) {
    throw new BadRequestError('Assign this job before proposing a reschedule');
  }
}

function historyEntry(
  proposedDate: Date,
  proposedTime: string,
  proposedBy: 'technician' | 'client',
  note?: string
): IRescheduleHistoryEntry {
  return {
    proposedDate,
    proposedTime,
    proposedBy,
    note: note?.trim() || undefined,
    at: new Date(),
  };
}

async function loadBooking(bookingId: string): Promise<IBooking> {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new BadRequestError('Booking not found');
  }
  return booking;
}

async function notifyTechnicianReschedule(
  booking: IBooking,
  title: string,
  body: string,
  type: 'info' | 'warning' | 'success' = 'info'
): Promise<void> {
  const techId = resolveTechnicianId(booking);
  if (!techId) return;
  await notifyUsers([new mongoose.Types.ObjectId(techId)], {
    title,
    body,
    type,
    category: 'booking',
    data: { bookingId: booking._id, reschedule: true },
  });
}

async function applyAcceptedReschedule(
  booking: IBooking,
  proposedDate: Date,
  proposedTime: string,
  updatedBy: mongoose.Types.ObjectId
): Promise<void> {
  const label = formatProposalLabel(proposedDate, proposedTime);
  booking.scheduledDate = proposedDate;
  booking.scheduledTime = proposedTime;
  booking.reschedule = undefined;
  booking.statusHistory.push({
    status: booking.status,
    timestamp: new Date(),
    notes: `Reschedule confirmed: ${label}`,
    updatedBy,
  });
  await booking.save();
}

export async function proposeRescheduleForBooking(
  bookingId: string,
  technicianUserId: string,
  role: string,
  payload: { scheduledDate: string; scheduledTime: string; note?: string }
): Promise<IBooking> {
  const booking = await loadBooking(bookingId);
  assertRescheduleEligible(booking);
  assertTechnicianRescheduleAccess(booking, technicianUserId, role);

  if (booking.reschedule?.status === 'pending_technician') {
    throw new BadRequestError(
      'Client counter-proposal awaits your response. Accept or counter instead.'
    );
  }

  const slotDate = normalizeSlotDate(payload.scheduledDate);
  const slotTime = normalizeSlotTime(payload.scheduledTime);
  await assertRescheduleSlotAvailable(slotDate, slotTime, bookingId);

  const proposedDate = parseScheduledDate(slotDate);
  const normalizedTime = normalizeScheduledTime(slotTime);
  const now = new Date();
  const entry = historyEntry(proposedDate, normalizedTime, 'technician', payload.note);
  const label = formatProposalLabel(proposedDate, normalizedTime);

  booking.reschedule = {
    status: 'pending_client',
    proposedDate,
    proposedTime: normalizedTime,
    proposedBy: 'technician',
    note: payload.note?.trim() || undefined,
    updatedAt: now,
    history: [...(booking.reschedule?.history ?? []), entry],
  };
  booking.statusHistory.push({
    status: booking.status,
    timestamp: now,
    notes: `Reschedule proposed: ${label}`,
    updatedBy: new mongoose.Types.ObjectId(technicianUserId),
  });

  await booking.save();

  await notifyClientBooking(booking, {
    title: 'New service time proposed',
    body: `Your technician proposed ${label} for booking ${booking.bookingId}. Accept or suggest another time in the app.`,
    type: 'warning',
  });

  return booking;
}

export async function respondToRescheduleForBooking(
  bookingId: string,
  actor: { id: string; role: string },
  payload: {
    action: 'accept' | 'counter';
    scheduledDate?: string;
    scheduledTime?: string;
    note?: string;
  }
): Promise<IBooking> {
  const booking = await loadBooking(bookingId);
  assertRescheduleEligible(booking);

  const reschedule = booking.reschedule;
  if (!reschedule) {
    throw new BadRequestError('No active reschedule proposal on this booking');
  }

  const isClient = actor.role === 'client';
  const isTechnician =
    actor.role === 'technician' || actor.role === 'master_technician';

  if (payload.action === 'accept') {
    if (isClient && reschedule.status !== 'pending_client') {
      throw new BadRequestError('No technician proposal awaiting your response');
    }
    if (isTechnician) {
      assertTechnicianRescheduleAccess(booking, actor.id, actor.role);
      if (reschedule.status !== 'pending_technician') {
        throw new BadRequestError('No client counter-proposal awaiting your response');
      }
    }
    if (!isClient && !isTechnician) {
      throw new BadRequestError('Access denied');
    }

    if (isClient) {
      const clientOid = toObjectId(actor.id, 'clientId');
      if (booking.clientId.toString() !== clientOid.toString()) {
        throw new BadRequestError('Access denied');
      }
    }

    await assertRescheduleSlotAvailable(
      toISODateStringIST(reschedule.proposedDate),
      reschedule.proposedTime,
      bookingId
    );

    const updatedBy = new mongoose.Types.ObjectId(actor.id);
    const label = formatProposalLabel(reschedule.proposedDate, reschedule.proposedTime);

    await applyAcceptedReschedule(
      booking,
      reschedule.proposedDate,
      reschedule.proposedTime,
      updatedBy
    );

    await notifyClientBooking(booking, {
      title: 'Service rescheduled',
      body: `Your booking ${booking.bookingId} is now scheduled for ${label}.`,
      type: 'success',
    });
    await notifyTechnicianReschedule(
      booking,
      'Reschedule confirmed',
      `Booking ${booking.bookingId} is confirmed for ${label}.`,
      'success'
    );

    return booking;
  }

  if (payload.action !== 'counter') {
    throw new BadRequestError('Invalid action');
  }

  if (!payload.scheduledDate?.trim() || !payload.scheduledTime?.trim()) {
    throw new BadRequestError('scheduledDate and scheduledTime are required to counter-propose');
  }

  const slotDate = normalizeSlotDate(payload.scheduledDate);
  const slotTime = normalizeSlotTime(payload.scheduledTime);
  await assertRescheduleSlotAvailable(slotDate, slotTime, bookingId);

  const proposedDate = parseScheduledDate(slotDate);
  const normalizedTime = normalizeScheduledTime(slotTime);
  const now = new Date();
  const label = formatProposalLabel(proposedDate, normalizedTime);

  if (isClient) {
    if (reschedule.status !== 'pending_client') {
      throw new BadRequestError('No technician proposal awaiting your response');
    }
    const clientOid = toObjectId(actor.id, 'clientId');
    if (booking.clientId.toString() !== clientOid.toString()) {
      throw new BadRequestError('Access denied');
    }

    const entry = historyEntry(proposedDate, normalizedTime, 'client', payload.note);
    booking.reschedule = {
      status: 'pending_technician',
      proposedDate,
      proposedTime: normalizedTime,
      proposedBy: 'client',
      note: payload.note?.trim() || undefined,
      updatedAt: now,
      history: [...(booking.reschedule?.history ?? []), entry],
    };
    booking.statusHistory.push({
      status: booking.status,
      timestamp: now,
      notes: `Client counter-proposed: ${label}`,
      updatedBy: clientOid,
    });
    await booking.save();

    await notifyTechnicianReschedule(
      booking,
      'Client proposed a new time',
      `Client suggested ${label} for booking ${booking.bookingId}. Accept or propose another time.`,
      'warning'
    );
    return booking;
  }

  if (isTechnician) {
    assertTechnicianRescheduleAccess(booking, actor.id, actor.role);
    if (reschedule.status !== 'pending_technician') {
      throw new BadRequestError('No client counter-proposal awaiting your response');
    }

    const entry = historyEntry(proposedDate, normalizedTime, 'technician', payload.note);
    booking.reschedule = {
      status: 'pending_client',
      proposedDate,
      proposedTime: normalizedTime,
      proposedBy: 'technician',
      note: payload.note?.trim() || undefined,
      updatedAt: now,
      history: [...(booking.reschedule?.history ?? []), entry],
    };
    booking.statusHistory.push({
      status: booking.status,
      timestamp: now,
      notes: `Technician counter-proposed: ${label}`,
      updatedBy: new mongoose.Types.ObjectId(actor.id),
    });
    await booking.save();

    await notifyClientBooking(booking, {
      title: 'New service time proposed',
      body: `Your technician proposed ${label} for booking ${booking.bookingId}. Accept or suggest another time.`,
      type: 'warning',
    });
    return booking;
  }

  throw new BadRequestError('Access denied');
}
