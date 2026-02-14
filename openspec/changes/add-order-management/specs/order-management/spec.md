## ADDED Requirements

### Requirement: Order Management
The system SHALL support the full lifecycle management of customer orders and device-level production tracking.

#### Scenario: Create new order
- **WHEN** user submits new order form with customer and product quantities
- **THEN** a new order record is created and per-device items are generated with SNs

#### Scenario: Track device progress
- **WHEN** a device stage is completed and verified
- **THEN** user can advance that device to next stage (装配 -> 部署 -> 调试 -> 打包 -> 物流 -> 完成)

### Requirement: Product Definition
The system SHALL allow defining standard products and product lines.

#### Scenario: Define product line
- **WHEN** admin creates a new product line (e.g., "Gantry System")
- **THEN** it appears in the catalog for attaching products

### Requirement: SOP Enforcement
The system SHALL enforce Standard Operating Procedures (SOP) for each production stage.

#### Scenario: Block stage progression
- **WHEN** SOP checklist is incomplete
- **THEN** system prevents advancing to the next stage

#### Scenario: Require review
- **WHEN** SOP is complete
- **THEN** user must submit for review and receive approval before stage advances

### Requirement: Payment Records
The system SHALL support creating and updating order payment records.

#### Scenario: Create payment record
- **WHEN** user submits a payment entry for an order
- **THEN** the system records payment amount, type, date, and notes

#### Scenario: Update payment status
- **WHEN** user updates payment status or notes
- **THEN** the system persists changes and reflects them in order detail
