import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getClientHold,
  getSlotAvailability,
  holdSlot,
  releaseClientHold,
} from '../services/slotHoldService';

export const getSlotsAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const date = String(req.query.date ?? '').trim();
    if (!date) {
      res.status(400).json({ success: false, message: 'date query parameter is required' });
      return;
    }

    const excludeBookingId = String(req.query.excludeBookingId ?? '').trim() || undefined;
    const result = await getSlotAvailability(date, req.user!.id, excludeBookingId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getMySlotHold = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const hold = await getClientHold(req.user!.id);
    if (!hold || hold.expiresAt <= new Date()) {
      res.status(200).json({ success: true, hold: null });
      return;
    }

    const displayTime = hold.scheduledTime.replace(/\s*IST\s*$/i, '').trim();
    const secondsRemaining = Math.max(
      0,
      Math.ceil((hold.expiresAt.getTime() - Date.now()) / 1000)
    );

    res.status(200).json({
      success: true,
      hold: {
        scheduledDate: hold.scheduledDate,
        scheduledTime: hold.scheduledTime,
        displayTime,
        expiresAt: hold.expiresAt.toISOString(),
        secondsRemaining,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createSlotHold = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { scheduledDate, scheduledTime } = req.body;
    const hold = await holdSlot(req.user!.id, String(scheduledDate), String(scheduledTime));
    res.status(200).json({
      success: true,
      message: 'Slot reserved for 5 minutes',
      hold,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteSlotHold = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await releaseClientHold(req.user!.id);
    res.status(200).json({ success: true, message: 'Slot reservation released' });
  } catch (err) {
    next(err);
  }
};
