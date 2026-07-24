import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  assignTechnician,
  assignJobByMaster,
  getAllBookings,
  cancelBooking,
  acceptJob,
  rejectJob,
  dropJob,
  proposeReschedule,
  respondToReschedule,
  uploadServiceImages,
  acknowledgeCompletion,
  dismissRatingPrompt,
} from '../controllers/bookingController';
import {
  createSlotHold,
  deleteSlotHold,
  getMySlotHold,
  getSlotsAvailability,
} from '../controllers/slotHoldController';
import { authenticate, authorize } from '../middleware/auth';
import { bookingImagesUpload } from '../middleware/uploadBookingImages';
import {
  assignTechnicianRules,
  cancelBookingRules,
  createBookingRules,
  holdSlotRules,
  masterAssignRules,
  mongoIdParamRules,
  rescheduleProposeRules,
  rescheduleRespondRules,
  slotAvailabilityQueryRules,
  updateBookingStatusRules,
  validate,
} from '../middleware/validators';

const router = Router();

router.use(authenticate);

router.get(
  '/slots/availability',
  authorize('client', 'technician', 'master_technician'),
  validate,
  getSlotsAvailability
);
router.get('/slots/hold', authorize('client'), getMySlotHold);
router.post(
  '/slots/hold',
  authorize('client'),
  holdSlotRules,
  validate,
  createSlotHold
);
router.delete('/slots/hold', authorize('client'), deleteSlotHold);

router.post('/', authorize('client'), createBookingRules, validate, createBooking);
router.get('/my', getMyBookings);
router.get('/', authorize('admin'), getAllBookings);
router.get('/:id', ...mongoIdParamRules('id'), validate, getBookingById);
router.post(
  '/:id/images',
  ...mongoIdParamRules('id'),
  validate,
  authorize('client'),
  (req, res, next) => {
    bookingImagesUpload(req, res, (err) => {
      if (err) {
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'Upload failed',
        });
        return;
      }
      next();
    });
  },
  uploadServiceImages
);
router.patch(
  '/:id/accept',
  ...mongoIdParamRules('id'),
  validate,
  authorize('technician', 'master_technician'),
  acceptJob
);
router.patch(
  '/:id/reject',
  ...mongoIdParamRules('id'),
  validate,
  authorize('technician'),
  rejectJob
);
router.patch(
  '/:id/drop',
  ...mongoIdParamRules('id'),
  validate,
  authorize('technician', 'master_technician'),
  dropJob
);
router.patch(
  '/:id/status',
  ...mongoIdParamRules('id'),
  authorize('technician', 'master_technician', 'admin'),
  updateBookingStatusRules,
  validate,
  updateBookingStatus
);
router.patch(
  '/:id/ack-completion',
  ...mongoIdParamRules('id'),
  validate,
  authorize('client'),
  acknowledgeCompletion
);
router.patch(
  '/:id/dismiss-rating',
  ...mongoIdParamRules('id'),
  validate,
  authorize('client'),
  dismissRatingPrompt
);
router.patch(
  '/:id/assign',
  ...mongoIdParamRules('id'),
  authorize('admin'),
  assignTechnicianRules,
  validate,
  assignTechnician
);
router.patch(
  '/:id/assign-by-master',
  ...mongoIdParamRules('id'),
  authorize('master_technician'),
  masterAssignRules,
  validate,
  assignJobByMaster
);
router.patch(
  '/:id/cancel',
  ...mongoIdParamRules('id'),
  cancelBookingRules,
  validate,
  cancelBooking
);
router.post(
  '/:id/reschedule/propose',
  ...rescheduleProposeRules,
  validate,
  authorize('technician', 'master_technician'),
  proposeReschedule
);
router.post(
  '/:id/reschedule/respond',
  ...rescheduleRespondRules,
  validate,
  authorize('client', 'technician', 'master_technician'),
  respondToReschedule
);

export default router;
