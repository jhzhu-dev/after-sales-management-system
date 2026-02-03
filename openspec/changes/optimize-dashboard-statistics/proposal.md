# Proposal: Optimize Dashboard Statistics

**Change ID**: `optimize-dashboard-statistics`  
**Type**: Enhancement  
**Status**: Proposed  
**Author**: AI Assistant  
**Date**: 2025-10-22

## Why

The current dashboard provides basic statistics but lacks detailed insights into device distribution by type and location. Users need more granular visibility to:
- Understand device deployment patterns across locations
- Analyze device type distribution for capacity planning
- Quickly identify location-specific issues or trends
- Make data-driven decisions about resource allocation

## What Changes

- Add device type statistics with visual charts showing distribution across all device types (机械/电气/上位机/服务器/视觉)
- Add location-based statistics showing device count and status per location
- Enhance backend API to efficiently query and aggregate device data by type and location
- Improve dashboard UI to display new statistics in an intuitive, responsive layout
- Add filtering capabilities to drill down into specific device types or locations
- Optimize database queries for better performance with aggregations

### Visual Enhancements
- Add pie chart for device type distribution
- Add bar chart for location-based device counts
- Add status breakdown per location (normal/abnormal/maintenance)
- Improve color coding and visual hierarchy

## Impact

### Affected Specs
- `dashboard` - New capability being formalized

### Affected Code
- Backend: `server/routes/dashboard.js` - Add new aggregation queries
- Frontend: `client/src/pages/Dashboard.tsx` - Add new chart components
- Frontend: `client/src/types/index.ts` - Add new type definitions
- Database: No schema changes required (uses existing columns)

### Performance Considerations
- New queries will use GROUP BY aggregations
- Add indexes on `devices.type_id` and `devices.location` if not present
- Queries are read-only and cacheable
- Expected query execution time: <100ms for typical dataset sizes

### Non-Breaking Changes
- All changes are additive
- Existing dashboard functionality remains unchanged
- Backward compatible API extensions

## Alternatives Considered

1. **Real-time updates with WebSockets**: Decided against for v1 due to complexity; current polling approach is sufficient
2. **Separate analytics page**: Kept unified dashboard for better UX and quick overview
3. **Third-party dashboard library**: Decided to use existing Recharts to maintain consistency

## Success Metrics

- Dashboard load time remains under 2 seconds
- Users can view device distribution without additional navigation
- Reduced support queries about device location/type information
- Improved decision-making speed for maintenance planning
