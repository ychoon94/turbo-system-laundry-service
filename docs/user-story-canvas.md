# Coverage Validation

## 1. Customer Journey

Covered:

- account creation
- order placement
- drop-off or pickup scheduling
- delivery scheduling
- payment
- status tracking
- notifications

No missing steps.

---

## 2. Laundry Processing Workflow

Covered:

- order intake
- washing
- drying
- folding
- issue reporting
- order completion

No missing operational step.

---

## 3. Delivery Workflow

Covered:

- pickup tasks
- delivery tasks
- lobby/security drop-off
- navigation
- incident reporting
- proof of delivery

Constraint respected:

```
Doorstep delivery NOT allowed
```

---

## 4. Business Operations

Covered:

- order management
- worker assignment
- delivery assignment
- pricing configuration
- machine capacity management
- analytics dashboard

---

## 5. Payment Flow

Covered:

- digital payment on order placement
- payment tracking
- transaction history

---

## 6. Security Constraints

Covered:

- building delivery instructions
- lobby/security drop-off enforcement

---

## 7. Operational Constraints

Covered:

- washing machine capacity
- time slot control
- worker assignments

---

# Final Engineering-Ready User Story Canvas

---

# Persona: Customer

## Epic: Account Management

**US-C1**

As a customer
I want to create an account using my phone or email
So that I can place and manage laundry orders.

**US-C2**

As a customer
I want to update my profile and contact details
So that the service provider can contact me regarding my orders.

**US-C3**

As a customer
I want to save my building address and delivery instructions
So that delivery workers know where to deliver my laundry.

---

## Epic: Order Creation

**US-C4**

As a customer
I want to create a laundry order
So that I can request laundry service.

**US-C5**

As a customer
I want to specify the number of washing machine loads
So that the system can calculate pricing correctly.

**US-C6**

As a customer
I want to add special instructions to my order
So that my garments are handled according to my preferences.

---

## Epic: Pickup / Drop-off Scheduling

**US-C7**

As a customer
I want to choose between self drop-off or pickup service
So that I can select the most convenient option.

**US-C8**

As a customer
I want to select an available pickup or drop-off time slot
So that the shop can prepare to receive my laundry.

**US-C9**

As a customer
I want to reschedule my pickup or drop-off before a cutoff time
So that I can adjust my schedule.

---

## Epic: Delivery Scheduling

**US-C10**

As a customer
I want to select a delivery time slot
So that I will be available when my laundry arrives.

**US-C11**

As a customer
I want my laundry to be delivered to the building lobby or security desk
So that the delivery complies with building policies.

---

## Epic: Payment

**US-C12**

As a customer
I want to pay digitally when placing the order
So that my order can be confirmed immediately.

**US-C13**

As a customer
I want to see the total price before confirming the order
So that I understand the service cost.

**US-C14**

As a customer
I want to view my payment history
So that I can track previous transactions.

---

## Epic: Order Tracking

**US-C15**

As a customer
I want to view the status of my order
So that I know the progress of my laundry.

**US-C16**

As a customer
I want to know when washing, drying, and folding are completed
So that I can anticipate delivery.

**US-C17**

As a customer
I want to know when my order is out for delivery
So that I can prepare to receive it.

---

## Epic: Notifications

**US-C18**

As a customer
I want to receive notifications when my order status changes
So that I stay informed.

**US-C19**

As a customer
I want to receive reminders before pickup and delivery
So that I do not miss scheduled times.

---

# Persona: Business Owner / Administrator

---

## Epic: Order Management

**US-B1**

As a business owner
I want to view all orders in a dashboard
So that I can monitor operations.

**US-B2**

As a business owner
I want to filter orders by date, status, or customer
So that I can quickly locate specific orders.

**US-B3**

As a business owner
I want to update order statuses manually
So that operational errors can be corrected.

---

## Epic: Worker Management

**US-B4**

As a business owner
I want to create accounts for laundry workers and delivery workers
So that staff can access the system.

**US-B5**

As a business owner
I want to assign orders to laundry workers
So that work is distributed efficiently.

---

## Epic: Delivery Management

**US-B6**

As a business owner
I want to assign delivery tasks to delivery workers
So that orders are delivered on time.

**US-B7**

As a business owner
I want to view delivery schedules for each driver
So that I can balance workload.

---

## Epic: Capacity Scheduling

**US-B8**

As a business owner
I want to define the number of orders allowed per time slot
So that machine capacity is not exceeded.

**US-B9**

As a business owner
I want to modify time slot capacity
So that schedules reflect machine or staffing changes.

---

## Epic: Pricing Management

**US-B10**

As a business owner
I want to configure pricing based on washing machine loads
So that customers are charged correctly.

**US-B11**

As a business owner
I want to update pricing when business costs change
So that pricing remains accurate.

---

## Epic: Analytics

**US-B12**

As a business owner
I want to view sales reports
So that I understand business performance.

**US-B13**

As a business owner
I want to view order volume trends
So that I can plan staffing and machine usage.

**US-B14**

As a business owner
I want to see payment summaries
So that I can reconcile revenue.

---

# Persona: Laundry Worker

---

## Epic: Task Queue

**US-W1**

As a laundry worker
I want to see orders assigned to me
So that I know what tasks to perform.

**US-W2**

As a laundry worker
I want to view order details and special instructions
So that I handle garments correctly.

---

## Epic: Order Processing

**US-W3**

As a laundry worker
I want to mark when washing begins and ends
So that the system reflects order progress.

**US-W4**

As a laundry worker
I want to mark when drying and folding are completed
So that delivery can be scheduled.

---

## Epic: Issue Handling

**US-W5**

As a laundry worker
I want to report issues with garments or machines
So that supervisors can address them.

---

# Persona: Delivery Worker

---

## Epic: Pickup Tasks

**US-D1**

As a delivery worker
I want to see assigned pickup tasks
So that I know where to collect laundry.

**US-D2**

As a delivery worker
I want to view pickup addresses and time slots
So that I can plan my route.

---

## Epic: Delivery Tasks

**US-D3**

As a delivery worker
I want to see assigned delivery tasks
So that I know where to deliver orders.

**US-D4**

As a delivery worker
I want to view building delivery instructions
So that I follow security rules.

---

## Epic: Navigation

**US-D5**

As a delivery worker
I want to open navigation directions to locations
So that I reach them efficiently.

---

## Epic: Delivery Confirmation

**US-D6**

As a delivery worker
I want to confirm pickup of laundry
So that the system records that the order has been collected.

**US-D7**

As a delivery worker
I want to confirm delivery at the lobby or security desk
So that the order can be completed.

---

## Epic: Incident Reporting

**US-D8**

As a delivery worker
I want to report delivery issues such as building access problems
So that the business owner can resolve them.

---

# Final System Coverage

Total Personas: **4**

Total Epics: **18**

Total User Stories: **47**

System flows fully covered:

```
Customer journey
Laundry processing workflow
Pickup & delivery logistics
Building security restrictions
Operational management
Worker coordination
Payment workflow
Analytics
```
