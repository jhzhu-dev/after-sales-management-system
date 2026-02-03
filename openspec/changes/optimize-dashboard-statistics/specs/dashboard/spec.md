# Dashboard Capability Specification

## Overview
The dashboard provides a comprehensive overview of the device management system, including statistics, visualizations, and quick access to key metrics.

## ADDED Requirements

### Requirement: Device Type Distribution Statistics
The system SHALL provide visual statistics showing the distribution of devices across all device types.

#### Scenario: View device type distribution
- **GIVEN** the dashboard is loaded
- **WHEN** device type statistics are requested
- **THEN** the system SHALL display a pie chart showing device count per type
- **AND** each type SHALL show the count and percentage
- **AND** device types SHALL include: 机械, 电气, 上位机, 服务器, 视觉
- **AND** uncategorized devices SHALL be grouped as "未分类"

#### Scenario: Handle empty device type data
- **GIVEN** no devices exist in the system
- **WHEN** device type statistics are requested
- **THEN** the system SHALL display an empty state message
- **AND** the chart SHALL show "暂无数据"

### Requirement: Location-Based Device Statistics
The system SHALL provide statistics showing device distribution and status breakdown by location.

#### Scenario: View location statistics with status breakdown
- **GIVEN** devices exist in multiple locations
- **WHEN** location statistics are requested
- **THEN** the system SHALL display device counts grouped by location
- **AND** each location SHALL show total device count
- **AND** each location SHALL show status breakdown (正常/异常/维护中)
- **AND** locations SHALL be ordered by total device count descending
- **AND** only the top 10 locations SHALL be displayed

#### Scenario: Handle devices without location
- **GIVEN** some devices have null or empty location
- **WHEN** location statistics are requested
- **THEN** devices without location SHALL be grouped as "未指定"
- **AND** the "未指定" group SHALL appear in the statistics

### Requirement: Dashboard API Performance
The system SHALL provide dashboard statistics efficiently with acceptable performance.

#### Scenario: Fast API response
- **GIVEN** the dashboard stats API is called
- **WHEN** processing the request
- **THEN** the response time SHALL be less than 500ms
- **AND** the response SHALL include all statistics in a single call
- **AND** the response SHALL be cacheable for 60 seconds

#### Scenario: Handle large datasets
- **GIVEN** the system contains more than 1000 devices
- **WHEN** statistics are requested
- **THEN** the system SHALL use database aggregation
- **AND** queries SHALL use appropriate indexes
- **AND** response time SHALL remain under 1 second

### Requirement: Responsive Dashboard Layout
The dashboard SHALL display statistics in a responsive layout suitable for various screen sizes.

#### Scenario: Display on desktop
- **GIVEN** the dashboard is viewed on desktop (>1024px)
- **WHEN** the page loads
- **THEN** statistics cards SHALL display in a 3-column grid
- **AND** charts SHALL display side by side

#### Scenario: Display on mobile
- **GIVEN** the dashboard is viewed on mobile (<768px)
- **WHEN** the page loads
- **THEN** statistics cards SHALL stack vertically
- **AND** charts SHALL display full width
- **AND** all content SHALL remain readable

### Requirement: Dashboard Data Accuracy
The dashboard SHALL display accurate, consistent statistics based on current data.

#### Scenario: Consistent data across views
- **GIVEN** dashboard statistics are displayed
- **WHEN** data is shown in multiple charts
- **THEN** device counts SHALL be consistent across all views
- **AND** totals SHALL match the sum of categories
- **AND** percentages SHALL sum to 100%

#### Scenario: Real-time data freshness
- **GIVEN** the dashboard is loaded
- **WHEN** devices are added, updated, or deleted
- **THEN** statistics SHALL reflect changes on next page refresh
- **AND** cached data SHALL expire after 60 seconds
- **AND** users MAY manually refresh to see latest data

## Data Model

### DashboardStats Type Extension
```typescript
interface DashboardStats {
  basicStats: {
    total_devices: number;
    open_issues: number;
    resolved_this_month: number;
    version_types: number;
  };
  deviceStatusDistribution: Array<{
    status: string;
    count: number;
  }>;
  deviceTypeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  locationStats: Array<{
    location: string;
    total: number;
    normal: number;
    abnormal: number;
    maintenance: number;
  }>;
  issueStatusDistribution: Array<{
    status: string;
    count: number;
  }>;
  issueSeverityDistribution: Array<{
    severity: string;
    count: number;
  }>;
  recentActivities: Array<{
    type: string;
    id: string;
    name: string;
    timestamp: string;
    action: string;
  }>;
}
```

## API Specification

### GET /api/dashboard/stats

**Description:** Retrieves comprehensive dashboard statistics including device type and location distributions.

**Authentication:** Required (implied by system design)

**Request:**
```http
GET /api/dashboard/stats HTTP/1.1
Host: localhost:5000
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "basicStats": {
      "total_devices": 150,
      "open_issues": 12,
      "resolved_this_month": 25,
      "version_types": 5
    },
    "deviceTypeDistribution": [
      { "type": "机械", "count": 45, "percentage": 30.0 },
      { "type": "电气", "count": 38, "percentage": 25.3 },
      { "type": "上位机", "count": 32, "percentage": 21.3 },
      { "type": "服务器", "count": 20, "percentage": 13.3 },
      { "type": "视觉", "count": 15, "percentage": 10.0 }
    ],
    "locationStats": [
      {
        "location": "车间A",
        "total": 45,
        "normal": 40,
        "abnormal": 3,
        "maintenance": 2
      },
      {
        "location": "车间B",
        "total": 38,
        "normal": 35,
        "abnormal": 2,
        "maintenance": 1
      }
    ],
    "deviceStatusDistribution": [...],
    "issueStatusDistribution": [...],
    "issueSeverityDistribution": [...],
    "recentActivities": [...]
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Failed to fetch dashboard statistics"
}
```

**Performance SLA:**
- Response time: <500ms (typical)
- Response time: <1000ms (with 1000+ devices)
- Cache duration: 60 seconds
- Response size: <10KB (uncompressed)

## UI/UX Requirements

### Visual Design
- Use consistent color palette across all charts
- Provide tooltips with detailed information on hover
- Use clear labels and legends
- Maintain visual hierarchy with appropriate spacing

### Loading States
- Show skeleton loaders while fetching data
- Display loading indicators for async operations
- Prevent layout shift during loading

### Error States
- Display user-friendly error messages
- Provide retry option for failed requests
- Show empty state when no data exists

### Accessibility
- Charts SHALL have appropriate ARIA labels
- Color SHALL not be the only means of conveying information
- Text SHALL maintain minimum contrast ratios
- Interactive elements SHALL be keyboard accessible
