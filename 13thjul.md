# Jul 13 — Client UX Changes

This document lists the Jul 13 client UX work done in this session: Categories hub, Home compact/clickable cards, service detail Call / View Bill, DELETE rename, and spacing polish.

---

## 1. Categories — two sections

**File:** `frontend/src/screens/client/booking/ServiceCategoriesScreen.tsx`

### Layout

```
[ Header: Categories ]
[ Book a service ]          ← renamed from “Select a service type for your booking.”
  - General Service
  - General Visit
[ Upcoming service ]        ← collapsible accordion
  - latest upcoming booking only (or empty state)
  - tap row → TrackService { id }
```

### Algorithm

```
on focus:
  bookings = getMyBookings({ limit: 20 })
  upcoming = filter status ∉ {completed, cancelled}
  latest = sort by scheduledDate ascending → first item

accordion:
  default collapsed
  chevron toggles open/closed
```

**View All** on Home still routes to Services / Categories (unchanged).

---

## 2. Home — compact clickable upcoming cards

**File:** `frontend/src/screens/client/HomeScreen.tsx`

### Changes

- Shorter upcoming cards: less verbose preview (no spare-parts / extra-due blocks on the card face).
- Removed status badge (“En Route”, etc.).
- Removed **VIEW MORE** / **TRACK** button.
- Entire card is pressable → opens `TrackService` (service detail).
- **PAY NOW** / action buttons stay nested so they remain clickable without opening detail.
- Goal: Quick Actions more reachable in the first viewport.

### Later polish (same session)

- Renamed action button **CANCEL** → **DELETE** on upcoming cards.
- Confirm / success alerts use “Delete” wording (API still `cancelBooking`).
- Made layout more spacious (padding, gaps, wider cards ~268px).
- Stacked **PAY NOW** and **DELETE** vertically (full width) so DELETE no longer overflows the card.
- Slightly taller compact action buttons (`height: 44`, smaller label text).

---

## 3. Service detail — Call + View Bill

**Files:**

- `frontend/src/screens/client/TrackingScreen.tsx`
- `frontend/src/components/client/TechnicianAssignedCard.tsx`
- `frontend/src/screens/client/ServiceDetailsScreen.tsx` (stopped passing `statusLabel`)

### Removed

- Status badge on detail header
- Technician status line (“En Route”, “Technician assigned”, etc.)
- **Live updates** / `TrackingTimeline` block

### Added

- **CALL** primary button when technician phone exists (`Linking.openURL('tel:…')`)
- **VIEW BILL** toggle showing:
  - Full spare parts list
  - Invoice breakdown via `PaymentBreakdownCard`
  - Pay CTA when balance is due

### Kept

- Service type, what booked, schedule, venue, address, notes, reschedule card
- Waiting-for-technician empty state (without status chrome)

---

## 4. Documentation

- Wrote this file: `13thjul.md`

---

## Flow

```
Home --View All--> Categories
Home --tap upcoming card--> Detail (TrackService)
Categories --Book a service (GS/GV)--> Booking flow
Categories --Upcoming service row--> Detail
Detail --CALL--> tel:technician
Detail --VIEW BILL--> Invoice + spare parts (+ pay if due)
Home card --DELETE--> cancelBooking API (UI labeled Delete)
```

---

## Files touched (Jul 13 UX)

| File | What changed |
|------|----------------|
| `13thjul.md` | This change list |
| `ServiceCategoriesScreen.tsx` | Book a service + Upcoming service accordion |
| `HomeScreen.tsx` | Compact clickable cards, DELETE, spacing / no overflow |
| `TrackingScreen.tsx` | Call + View Bill; remove status / timeline |
| `TechnicianAssignedCard.tsx` | Drop status label; optional CALL CTA |
| `ServiceDetailsScreen.tsx` | Drop `statusLabel` prop usage |

No backend changes for this UX pass.

---

## Out of scope (as planned)

- Separate “all services” list screen beyond View All → Categories
- Technician-side job status UI changes
- Push notifications

---

*Document for Jul 13, 2026 — ATOMIK Service.*
