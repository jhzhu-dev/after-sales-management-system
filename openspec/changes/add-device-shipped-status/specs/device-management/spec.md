## ADDED Requirements

### Requirement: Device Shipped Status
The system SHALL support a "已发货" (shipped) status for devices. Shipping SHALL be an explicit user action only (the ship button / `POST /api/devices/:id/ship`), which requires "生产中" status and complete factory documentation (factory_docs_complete = true). Marking factory documentation complete SHALL NOT change the device status. The ship action opens a confirmation dialog showing module version completeness and optional Feishu recipients to remind them to register version numbers. A shipped device SHALL be changeable to "使用中(正常)" / "使用中(异常)" / "已停用" via the standard edit form, and SHALL be revertible to "生产中" (cancel shipment).

#### Scenario: Marking factory docs complete does not ship
- **WHEN** a device is in "生产中" status and factory_docs_complete is set to true
- **THEN** the device remains in "生产中" status and a prompt indicates the ship button is now available

#### Scenario: Manual ship action for docs-complete production devices
- **WHEN** a device is in "生产中" status, factory_docs_complete is true, and the user confirms shipping in the ship dialog (optionally with Feishu recipients)
- **THEN** the device status becomes "已发货", shipped_at is set to the current time, and (if recipients were selected) a Feishu version-number reminder is sent asynchronously

#### Scenario: Shipping is rejected when factory docs are incomplete
- **WHEN** a device is in "生产中" status but factory_docs_complete is false and the user attempts to ship
- **THEN** the API returns an error and the device status remains unchanged

#### Scenario: Shipping is rejected for non-production statuses
- **WHEN** a device is not in "生产中" status and the user attempts to ship
- **THEN** the API returns an error and the device status remains unchanged

#### Scenario: Reverting a shipped device to production
- **WHEN** a shipped device is edited and its status is set to "生产中"
- **THEN** the device status becomes "生产中" and the shipped_at timestamp is cleared or ignored by the status display

### Requirement: Bundle Shipped Status
The system SHALL derive a multi-device bundle's status including "已发货". When all member devices of a bundle are shipped, the bundle SHALL display "已发货". A bundle with complete factory documentation (factory_docs_complete = true) SHALL be shippable via a ship action that marks all member devices as "已发货" in a single transaction.

#### Scenario: Shipping a bundle with complete factory docs
- **WHEN** a bundle's factory_docs_complete is true, all member devices are in "生产中" status, and the user clicks the bundle ship button
- **THEN** all member devices become "已发货" with shipped_at recorded, and the bundle status displays "已发货"

#### Scenario: Shipping a bundle with incomplete factory docs
- **WHEN** a bundle's factory_docs_complete is false and the user attempts to ship
- **THEN** the API returns an error and no member device status is changed

#### Scenario: Auto-shipping members when bundle factory docs are marked complete
- **WHEN** a bundle's factory_docs_complete is set to true
- **THEN** all member devices in "生产中" status become "已发货" with shipped_at recorded, and devices in other statuses remain unchanged

### Requirement: Shipped Status Filtering and Display
The system SHALL include "已发货" in all device and bundle status filters, status selects in forms, status badges, and the shipped_at display on device and bundle member tables.

#### Scenario: Filtering devices by shipped status
- **WHEN** a user selects "已发货" in the device list status filter
- **THEN** only devices with status "已发货" are shown
