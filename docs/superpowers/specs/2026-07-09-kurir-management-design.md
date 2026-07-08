# Kurir Management Feature Design

**Date:** 2026-07-09
**Status:** Approved
**Scope:** Owner can add/manage couriers, real-time location tracking, nearest-courier assignment

---

## 1. Overview

Add courier management feature to Dombi app. Owner can invite couriers via WhatsApp, monitor their status and activity, and assign them to orders. Couriers are not restricted to specific outlets - any courier can be assigned to any outlet, sorted by nearest location.

### Key Requirements
- Owner can add couriers via WhatsApp invitation
- All couriers can be assigned to any outlet (no outlet restriction)
- At outlet, couriers sorted by nearest location when assigning
- Courier app must always have active real-time location (last 5 minutes only)
- Maximum 3 active orders per courier
- Owner dashboard shows courier status and activity

---

## 2. Database Schema

### 2.1 Extend users table

New columns:
- `latitude` DECIMAL(10,7) nullable - Current GPS latitude
- `longitude` DECIMAL(10,7) nullable - Current GPS longitude
- `location_updated_at` TIMESTAMP nullable - Last GPS update time
- `vehicle_type` ENUM('motorcycle', 'bicycle', 'car') nullable
- `vehicle_plate` VARCHAR(20) nullable - License plate number
- `photo` VARCHAR(255) nullable - Photo URL

### 2.2 courier_profiles table (new)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT PK | |
| user_id | FK users | Courier user |
| invitation_status | ENUM('pending', 'accepted', 'rejected') | |
| invited_at | TIMESTAMP | When invitation was sent |
| accepted_at | TIMESTAMP | When courier accepted |
| total_deliveries | INT DEFAULT 0 | Lifetime delivery count |
| rating | DECIMAL(3,2) nullable | Average rating |
| notes | TEXT nullable | Admin notes |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 2.3 courier_invitations table (new)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT PK | |
| invited_by | FK users | Owner who invited |
| courier_user_id | FK users nullable | Created courier user |
| phone | VARCHAR(20) | WhatsApp number |
| name | VARCHAR(255) | Courier name |
| token | VARCHAR(64) UNIQUE | Invitation token |
| status | ENUM('pending', 'accepted', 'expired') | |
| sent_at | TIMESTAMP | When WhatsApp was sent |
| accepted_at | TIMESTAMP | When invitation accepted |
| expires_at | TIMESTAMP | Token expiration |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 3. Owner - Tambah Kurir Flow

### 3.1 Create Courier
1. Owner opens `/owner/couriers/create`
2. Input: Name, Phone, Photo (optional), Vehicle type (optional), Vehicle plate (optional)
3. System creates User with role=courier, temporary password
4. System creates CourierProfile with invitation_status=pending
5. System creates CourierInvitation with unique token
6. System sends WhatsApp via GowaService with download link + login token (expires in 7 days)
7. Courier opens link -> downloads app -> logs in with token -> sets new password
8. Invitation status changes to 'accepted'

### 3.2 Owner Pages
- `/owner/couriers` - List all couriers with status, statistics
- `/owner/couriers/create` - Add courier form
- `/owner/couriers/{id}` - Courier detail (status, activity, delivery history)

---

## 4. Location Tracking

### 4.1 Courier App GPS Update
- Courier app sends GPS location every 30 seconds
- Endpoint: `POST /courier/location` { latitude, longitude }
- Server updates: `users.latitude`, `users.longitude`, `users.location_updated_at`
- Location is "active" if `location_updated_at` is within last 5 minutes

### 4.2 Location Validation
- Only couriers with active location (updated within 5 minutes) appear in assignment list
- If location expires, courier is marked as "location inactive" in monitoring

---

## 5. Courier Assignment Flow

### 5.1 At Outlet
1. Outlet opens order that needs assignment
2. Clicks "Assign Kurir"
3. System shows list of available couriers:
   - Status online (`is_online = true`)
   - Location active (updated within 5 minutes)
   - Active deliveries < 3
4. List sorted by nearest distance (Haversine formula)
5. Outlet selects courier -> courier receives push notification

### 5.2 Distance Calculation
Use Haversine formula to calculate distance between outlet (latitude/longitude) and each courier (latitude/longitude). Sort ascending.

---

## 6. Owner Monitoring Dashboard

### 6.1 Summary Stats
- Total couriers (active/inactive)
- Couriers online now
- Total deliveries today
- Couriers with active location

### 6.2 Courier List
Each row shows:
- Name, photo, vehicle info
- Online/offline status badge
- Location status (active/inactive)
- Active deliveries count (e.g., "2/3")
- Today's delivery count
- Last location update time

---

## 7. Technical Implementation

### 7.1 Backend (Laravel)

**Controllers:**
- `App\Http\Controllers\Owner\CourierController` - CRUD kurir
- `App\Http\Controllers\Courier\LocationController` - GPS update
- `App\Http\Controllers\Owner\CourierMonitoringController` - Dashboard data

**Services:**
- `App\Services\CourierService` - Business logic (create, update, stats)
- `App\Services\CourierInvitationService` - WhatsApp invitation flow
- `App\Services\CourierLocationService` - Location tracking, nearest calculation

**Models:**
- `App\Models\CourierProfile` - courier_profiles table
- `App\Models\CourierInvitation` - courier_invitations table
- Update `App\Models\User` - Add location fields, vehicle fields

### 7.2 Frontend (React/Inertia)

**Pages:**
- `resources/js/pages/owner/couriers/index.tsx` - List + monitoring
- `resources/js/pages/owner/couriers/create.tsx` - Add form
- `resources/js/pages/owner/couriers/show.tsx` - Detail
- Update `resources/js/pages/outlet/orders/show.tsx` - Add assign kurir flow

**Components:**
- `resources/js/components/owner/courier-list.tsx` - Courier list component
- `resources/js/components/owner/courier-form.tsx` - Add/edit form
- `resources/js/components/owner/courier-stats.tsx` - Summary cards
- `resources/js/components/outlet/assign-courier-sheet.tsx` - Assign kurir bottom sheet

### 7.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/owner/couriers` | List all couriers |
| POST | `/owner/couriers` | Create new courier |
| GET | `/owner/couriers/{id}` | Get courier detail |
| PUT | `/owner/couriers/{id}` | Update courier |
| DELETE | `/owner/couriers/{id}` | Deactivate courier |
| POST | `/courier/location` | Update GPS location (courier app) |
| GET | `/api/outlets/{id}/nearest-couriers` | Get nearest available couriers |
| POST | `/api/orders/{id}/assign-courier` | Assign courier to order |

### 7.4 Real-time Updates
- Outlet assign page polls `/api/outlets/{id}/nearest-couriers` every 10 seconds
- Push notification to courier when assigned
- Owner dashboard polls every 30 seconds for status updates

---

## 8. Courier App Changes

### 8.1 New Features
- Background GPS tracking (every 30 seconds)
- Location permission request on first login
- Status indicator showing location is active

### 8.2 GPS Tracking Implementation
- Use browser Geolocation API or React Native location
- Send to `POST /courier/location` every 30 seconds
- Handle permission denied gracefully
- Show warning if location is disabled

---

## 9. Testing Strategy

### 9.1 Unit Tests
- CourierService: create, update, stats calculation
- CourierLocationService: nearest calculation, location validation
- Haversine distance calculation accuracy

### 9.2 Feature Tests
- Owner can create courier via invitation
- Courier can accept invitation and set password
- Location updates are saved correctly
- Nearest couriers are sorted correctly
- Assignment respects capacity limit (max 3)

### 9.3 Manual Testing
- WhatsApp invitation delivery
- GPS tracking on real device
- Distance sorting accuracy
- Push notification delivery

---

## 10. Implementation Order

1. Database migrations (users extend, courier_profiles, courier_invitations)
2. Models and relationships
3. CourierService and CourierInvitationService
4. Owner courier CRUD (controller + pages)
5. Location tracking (controller + courier app update)
6. Assignment flow (outlet page update)
7. Monitoring dashboard
8. Testing and QA

---

## 11. Future Considerations

- Rating system for couriers
- Earnings tracking per courier
- Performance analytics
- Auto-assign algorithm
- Courier shift scheduling
