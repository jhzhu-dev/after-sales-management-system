# Design Document: Dashboard Statistics Optimization

## Context

The device management system currently provides basic statistics on the dashboard but lacks detailed insights into device distribution patterns. Users managing multiple locations and device types need better visibility into their device inventory.

**Current State:**
- Basic counters: total devices, open issues, resolved issues
- Simple status distribution chart
- No type or location breakdown
- Limited actionable insights

**Stakeholders:**
- System administrators managing device inventory
- Maintenance teams planning service routes
- Management making capacity decisions

**Constraints:**
- Must maintain fast load times (<2s)
- Must work with existing database schema
- Must be responsive for mobile access
- Should not break existing functionality

## Goals / Non-Goals

### Goals
- Provide device type distribution visualization
- Show location-based device statistics with status breakdown
- Maintain or improve current dashboard performance
- Create reusable chart components
- Support responsive design

### Non-Goals
- Real-time data streaming (polling is sufficient)
- Historical trend analysis (future enhancement)
- User-customizable dashboards (future enhancement)
- Export functionality (future enhancement)
- Drill-down to individual devices (use device list page)

## Technical Decisions

### Decision 1: Aggregation Strategy
**Choice:** Server-side aggregation using SQL GROUP BY

**Rationale:**
- More efficient than client-side aggregation for large datasets
- Reduces data transfer over network
- Leverages database indexing for performance
- Easier to cache at API layer

**Alternatives Considered:**
- Client-side aggregation: Would increase payload size and client processing
- Materialized views: Overkill for current data volume; adds complexity

### Decision 2: Chart Library
**Choice:** Continue using Recharts

**Rationale:**
- Already integrated in the project
- Lightweight and performant
- Good React integration
- Sufficient for current needs

**Alternatives Considered:**
- Chart.js: Requires more imperative code
- D3.js: Too complex for simple charts

### Decision 3: API Design
**Choice:** Extend existing `/api/dashboard/stats` endpoint

**Rationale:**
- Single API call reduces latency
- Atomic data consistency
- Simpler frontend code
- Better caching strategy

**Alternatives Considered:**
- Separate endpoints: Would require multiple API calls and state management

### Decision 4: Data Structure
**New fields added to stats response:**
```typescript
interface DashboardStats {
  // Existing fields
  basicStats: { ... }
  deviceStatusDistribution: Array<{ status: string, count: number }>
  
  // New fields
  deviceTypeDistribution: Array<{ 
    type: string, 
    count: number,
    percentage: number 
  }>
  locationStats: Array<{ 
    location: string, 
    total: number,
    normal: number,
    abnormal: number,
    maintenance: number 
  }>
}
```

## Database Schema

### Existing Tables Used
```sql
devices (
  id VARCHAR(36),
  name VARCHAR(255),
  type_id INT,
  location VARCHAR(255),
  status ENUM('正常', '异常', '维护中'),
  ...
)

device_types (
  id INT,
  name VARCHAR(100)
)
```

### Required Indexes
```sql
-- Check if these exist, create if needed
CREATE INDEX idx_devices_type_id ON devices(type_id);
CREATE INDEX idx_devices_location ON devices(location);
CREATE INDEX idx_devices_status ON devices(status);
```

## SQL Queries

### Device Type Distribution
```sql
SELECT 
  COALESCE(dt.name, '未分类') as type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM devices), 2) as percentage
FROM devices d
LEFT JOIN device_types dt ON d.type_id = dt.id
GROUP BY d.type_id, dt.name
ORDER BY count DESC;
```

### Location Statistics
```sql
SELECT 
  COALESCE(location, '未指定') as location,
  COUNT(*) as total,
  SUM(CASE WHEN status = '正常' THEN 1 ELSE 0 END) as normal,
  SUM(CASE WHEN status = '异常' THEN 1 ELSE 0 END) as abnormal,
  SUM(CASE WHEN status = '维护中' THEN 1 ELSE 0 END) as maintenance
FROM devices
GROUP BY location
ORDER BY total DESC
LIMIT 10;
```

## Frontend Component Structure

```
Dashboard
├─ StatsCard (existing)
├─ DeviceStatusChart (existing)
├─ DeviceTypeChart (new)
│  └─ PieChart with legend
└─ LocationStatsTable (new)
   └─ BarChart with stacked bars
```

## Performance Considerations

### Query Optimization
- Estimated rows scanned: ~1000 devices typical
- Query execution time: <50ms (with indexes)
- Response size: ~5KB (compressed)

### Caching Strategy
- Cache stats for 60 seconds on server
- Use ETags for client-side caching
- Invalidate on device mutations

### Frontend Performance
- Use React.memo for chart components
- Lazy load chart library (already done via code splitting)
- Debounce window resize events

## Risks / Trade-offs

### Risk 1: Query Performance with Large Datasets
**Impact:** Medium  
**Likelihood:** Low  
**Mitigation:** 
- Add database indexes
- Implement query result caching
- Set reasonable LIMIT on location stats
- Monitor query execution times

### Risk 2: Increased API Response Size
**Impact:** Low  
**Likelihood:** High  
**Mitigation:**
- Response compression (gzip)
- Limit location stats to top 10
- Use efficient JSON structure
- Monitor response sizes

### Risk 3: UI Complexity
**Impact:** Low  
**Likelihood:** Low  
**Mitigation:**
- Progressive enhancement approach
- Graceful degradation for errors
- Clear visual hierarchy
- Responsive design testing

## Migration Plan

### Phase 1: Backend (No User Impact)
1. Deploy new API endpoints with feature flag
2. Validate query performance in production
3. Monitor error rates and response times

### Phase 2: Frontend (Gradual Rollout)
1. Deploy new UI components
2. A/B test with subset of users
3. Monitor client-side performance
4. Full rollout after validation

### Rollback Strategy
- Feature flag to disable new stats
- Frontend gracefully handles missing data fields
- No database migrations required
- Can revert to previous version instantly

## Open Questions

1. **Q:** Should we limit location stats to top N locations?  
   **A:** Yes, limit to top 10 by device count. Can add "View All" link later.

2. **Q:** How to handle devices with null location?  
   **A:** Group as "未指定" (Unspecified) location.

3. **Q:** Should charts be interactive (clickable)?  
   **A:** Not in v1. Add tooltips only. Clickable navigation is future enhancement.

4. **Q:** What colors to use for device types?  
   **A:** Use existing COLORS array, maintain consistency with other charts.
