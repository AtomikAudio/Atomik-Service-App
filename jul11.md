# Jul 11 — Change Summary (from Reschedule onward)

This document summarizes the feature work shipped after the Job Reschedule plan, starting with `rescheduleService`, and including follow-on product fixes (booking UX, cancel, View More, coupons). It describes **what** changed and the **exact algorithms** used.

---

## 1. Job Reschedule (Technician ↔ Client)

### Goal

Technician proposes a new date/time when they cannot make the booked slot. Client accepts or counter-proposes. Schedule updates **only on accept**. Original `scheduledDate` / `scheduledTime` stay until then.

### Data model (`Booking.reschedule`)

```ts
reschedule?: {
  status: 'pending_client' | 'pending_technician';
  proposedDate: Date;
  proposedTime: string;
  proposedBy: 'technician' | 'client';
  note?: string;
  updatedAt: Date;
  history: {
    proposedDate: Date;
    proposedTime: string;
    proposedBy: 'technician' | 'client';
    note?: string;
    at: Date;
  }[];
};
```

No new top-level booking `status` (avoids breaking payment / filters). Each propose/accept also appends a `statusHistory` audit note.

### Core service: `backend/src/services/rescheduleService.ts`

#### Eligibility algorithm

```
assertRescheduleEligible(booking):
  if status ∈ {completed, cancelled} → 400

assertTechnicianRescheduleAccess(booking, userId, role):
  assigned = resolveTechnicianId(booking)
  masterOk = (role == master_technician AND assignedByMasterId == userId)
  if NOT (assigned == userId OR masterOk) → 400
  if no assigned technician → 400 ("Assign this job first")
```

#### Slot validation algorithm (`slotHoldService`)

```
isSlotBooked(date, time, excludeBookingId?):
  find non-cancelled bookings on that date+time
  if excludeBookingId set → exclude that booking from conflict check

assertRescheduleSlotAvailable(date, time, excludeBookingId):
  normalize date/time against BOOKING_TIME_SLOTS
  if isSlotBooked(..., excludeBookingId) → 400 "slot already booked"
  (no client slot-hold required — reschedule is post-booking)
```

`GET /bookings/slots/availability` also accepts `excludeBookingId` and is authorized for `client | technician | master_technician`.

#### Propose algorithm (`proposeRescheduleForBooking`)

```
INPUT: bookingId, technicianUserId, role, { scheduledDate, scheduledTime, note? }

1. load booking
2. assertRescheduleEligible
3. assertTechnicianRescheduleAccess
4. if reschedule.status == pending_technician
     → 400 (must Accept or Counter, not Propose)
5. assertRescheduleSlotAvailable(date, time, bookingId)
6. set booking.reschedule = {
     status: pending_client,
     proposedDate/Time, proposedBy: technician, note,
     history: [...oldHistory, newEntry]
   }
7. push statusHistory note: "Reschedule proposed: {label}"
8. save
9. notifyClientBooking("New service time proposed", data: { reschedule: true })
10. return booking
```

#### Respond algorithm (`respondToRescheduleForBooking`)

```
INPUT: bookingId, actor {id, role}, { action: accept|counter, scheduledDate?, scheduledTime?, note? }

1. load booking; assertRescheduleEligible
2. if no booking.reschedule → 400

--- ACCEPT ---
3a. Client: only if status == pending_client AND client owns booking
3b. Technician/master: only if status == pending_technician AND has tech access
3c. Re-check slot still free for proposedDate/Time (exclude this booking)
3d. Apply:
      scheduledDate = proposedDate
      scheduledTime = proposedTime
      clear reschedule
      statusHistory: "Reschedule confirmed: {label}"
3e. Notify client + technician (success)
3f. return booking

--- COUNTER ---
4a. require scheduledDate + scheduledTime
4b. assertRescheduleSlotAvailable
4c. Client + pending_client:
      set status = pending_technician, proposedBy = client
      notify technician
4d. Technician + pending_technician:
      set status = pending_client, proposedBy = technician
      notify client
4e. append history + statusHistory; save; return
```

### API surface

| Method | Path | Who |
|--------|------|-----|
| `POST` | `/bookings/:id/reschedule/propose` | technician, master_technician |
| `POST` | `/bookings/:id/reschedule/respond` | client, technician, master_technician |

Validators reuse booking date/time slot rules (`rescheduleProposeRules`, `rescheduleRespondRules`).

### Frontend wiring

| Area | Change |
|------|--------|
| `bookings.ts` | Types `BookingReschedule*`; `proposeReschedule()`, `respondToReschedule()`; `getSlotAvailability(date, excludeBookingId?)` |
| `RescheduleSlotPicker` | Shared calendar + slot grid (availability with exclude) |
| `RescheduleProposalCard` | Client: accept / counter when `pending_client` |
| `JobDetailScreen` | Reschedule section on **Details** (below DROP JOB) and **Update** |
| `HomeScreen` / `TrackingScreen` | Mount proposal card when pending client |
| `trackingTimeline.ts` | Append propose/confirm events from `reschedule.history` + statusHistory |

### Negotiation state machine

```
(no reschedule)
    │ tech propose
    ▼
pending_client ──accept──► schedule updated, reschedule cleared
    │ client counter
    ▼
pending_technician ──accept──► schedule updated, cleared
    │ tech counter
    ▼
pending_client  (loop)
```

---

## 2. Booking category exclusivity (General Visit vs General Service)

### Problem

Selecting General Service then General Visit (or vice versa) could club categories together. Visit also showed a **+** add button.

### Algorithm (`BookingDraftContext.addCategory`)

```
addCategory(id):
  if id == "general-visit":
    categoryIds := ["general-visit"]   // replace everything
    return

  // adding anything else:
  categoryIds := categoryIds.filter(c ≠ "general-visit")
  if id not in categoryIds: append id
```

### UI rules (`PlaceOrderScreen`)

```
isGeneralVisit = categoryIds includes "general-visit"
if isGeneralVisit:
  hide "+" add category button
  hide per-chip remove (X)
  show "CLEAR · START OVER" → resetDraft + navigate ServiceCategories{reset:true}
else:
  keep General Service + add flow unchanged
```

---

## 3. Navigation bug: Home tab restored Notifications

### Problem

Notifications lived on the Home stack. Leaving Home then returning restored Notifications instead of the dashboard.

### Fix algorithm (`ClientNavigator` / `TechNavigator`)

```
on Home tabPress:
  navigate('Home', { screen: 'HomeMain' })

on Jobs tabPress (technician):
  navigate('Jobs', { screen: 'TechDashboard' })
```

Same pattern as Services tab resetting to `ServiceCategories`.

---

## 4. Client Cancel Booking

### Surfaces

1. **Home** upcoming cards — `CANCEL` beside `PAY NOW`
2. **Service Details** — beside Pay Now (or standalone Cancel Booking)
3. **Pending Payments** — `CANCEL` beside Pay Now
4. **Payment screen** (after confirm order) — `CANCEL BOOKING` under Pay Now

### Algorithm

```
cancelBooking(bookingId):
  confirm Alert
  PATCH /bookings/:id/cancel { reason: "Cancelled by client" }
  backend:
    owner check (clientId == user OR admin)
    if status ∈ {completed, cancelled} → 400
    set status=cancelled, cancelledAt, cancellationReason
  UI: refresh list / goBack / navigate ServiceCategories
```

On Payment screen: cancel only for base booking payment (not extra-parts-only), then navigate to Service Categories with `reset: true`.

---

## 5. TRACK → VIEW MORE + service details

### Changes

- Home card button label: **TRACK** → **VIEW MORE**
- Tracking screen header: **Service details**
- Added helpers in `bookingDisplay.ts`:
  - `formatServiceTypeLabel` (general → General Service, inspection → General Visit, …)
  - `parseBookedServices` / `parseBookingClientNotes`
  - `getBookedServiceSummary`

### Display algorithm on TrackingScreen

```
serviceTypeLabel = formatServiceTypeLabel(booking.serviceType)
bookedServices =
  parse "Services: ..." from notes if present
  else [serviceTypeLabel]

Show cards:
  SERVICE TYPE + bookingId + status badge
  WHAT YOU BOOKED (chips)
  Schedule, Venue, Address, Your notes
  then existing: reschedule, technician, payment, live timeline
```

---

## 6. Apply Coupon (`Sid123` → 30% flat)

### Coupon table (backend + frontend mirror)

| Code | Key | Discount |
|------|-----|----------|
| `Sid123` | `SID123` (normalized uppercase) | 30% flat off charge amount |

Files: `backend/src/utils/coupons.ts`, `frontend/src/utils/coupons.ts`.

### Apply algorithm

```
normalizeCouponCode(raw) = trim(raw).toUpperCase()

applyCouponToAmount(amount, code):
  coupon = COUPONS[normalize(code)] or null → invalid
  original = round2(amount)
  discount = round2(original * percent / 100)
  charge   = round2(max(0, original - discount))
  return { original, discount, charge, couponCode, label }
```

### Payment create-order algorithm

```
createPaymentOrder:
  baseCharge = extra_parts ? extraPartsCharge : balanceDue
  if couponCode provided:
    if resolveCoupon fails → 400 Invalid coupon
    applied = applyCouponToAmount(baseCharge, code)
    chargeAmount = applied.chargeAmount
    persist on invoice: couponCode, discountPercent, discountAmount
  else:
    unset coupon fields on invoice
  create Razorpay/demo order for chargeAmount (paise)
  return order + coupon payload
```

### Settlement algorithm (with coupon)

```
paidNow = max(0, round2( (totalAmount - previousPaid) - discountAmount ))
amountPaid set to totalAmount (invoice considered fully settled)
history records paidNow (actual money taken)
notes/notifications mention coupon if present
webhook expected paise uses same coupon-adjusted charge
```

### Payment UI algorithm

```
baseAmountToPay = balance / extra-parts amount
user enters code → APPLY → local validate Sid123
appliedCoupon → show discount rows; amountToPay = chargeAmount
PAY NOW → createOrder(..., couponCode)
REMOVE → clear applied coupon
```

---

## 7. Misc fixes along the way

| Issue | Fix |
|-------|-----|
| `DevTestPaymentCard` ReferenceError | JSX block comment still referenced component; replaced with plain comment |
| Reschedule not visible on Details tab | Shared `renderRescheduleSection()` mounted below DROP JOB |
| Invalid COLORS.primary | Switched to brand tokens (`COLORS.red`, `statusPending`, etc.) |

---

## 8. Key files touched

### Backend

- `services/rescheduleService.ts` **(new)**
- `models/Booking.ts` — `reschedule` subdocument
- `services/slotHoldService.ts` — `excludeBookingId`, `assertRescheduleSlotAvailable`
- `controllers/bookingController.ts` — propose/respond handlers
- `routes/bookings.ts`, `middleware/validators.ts`
- `utils/notifyClient.ts` — optional `data` on notifications
- `utils/coupons.ts` **(new)**
- `models/Invoice.ts` — coupon/discount fields
- `controllers/paymentController.ts`, `services/paymentSettlement.ts`

### Frontend

- `services/bookings.ts`, `services/payments.ts`
- `components/client/RescheduleProposalCard.tsx`, `RescheduleSlotPicker.tsx` **(new)**
- `screens/technician/JobDetailScreen.tsx`
- `screens/client/HomeScreen.tsx`, `TrackingScreen.tsx`, `PaymentScreen.tsx`
- `screens/client/ServiceDetailsScreen.tsx`, `PendingPaymentsScreen.tsx`
- `screens/client/booking/PlaceOrderScreen.tsx`
- `context/BookingDraftContext.tsx`
- `navigation/ClientNavigator.tsx`, `TechNavigator.tsx`
- `utils/trackingTimeline.ts`, `utils/bookingDisplay.ts`, `utils/coupons.ts` **(new)**

---

## 9. How the work was done (process)

1. **Plan-first for reschedule** — model → slot check → API/service → notifications → tech UI → client UI → timeline.
2. **Service layer first** — business rules live in `rescheduleService` / `coupons`; controllers thin.
3. **Exclude self on slot checks** — current booking never blocks its own reschedule.
4. **Negotiate without mutating schedule** — proposal object until accept.
5. **Product polish next** — exclusive visit, cancel buttons, View More details, Home stack reset, Sid123 coupon.
6. **Keep payment truthful** — Razorpay order amount = discounted charge; settlement records actual paid vs invoice total.

---

*Document generated for Jul 11, 2026 — ATOMIK Service.*
