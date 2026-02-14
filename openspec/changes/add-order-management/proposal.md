## Why
The current system tracks devices and their modules but lacks the upstream context of how these devices are ordered, produced, and sold. There is no definition of "Products" or "Product Lines," and no way to track customer orders or the production lifecycle (SOP) before a device is deployed.

## What Changes
- **Basic Data Module**: Use `product_lines`, `products` to standardize device models. Use `customers` to manage client info.
- **Order Management**: Introduce `orders` to track sales.
- **Production Workflow**: Use `order_progress` and SOP checklists to govern the lifecycle from production to logistics.

## Impact
- **Database**:
  - New tables: `product_lines`, `products`, `customers`, `orders`, `order_payments`, `order_devices`, `order_progress`.
- **API**:
  - New routes: `/api/product-lines`, `/api/products`, `/api/customers`, `/api/orders`, `/api/order-progress`.
- **Frontend**:
  - New pages: `ProductLines.tsx`, `ProductDetail.tsx`, `Customers.tsx`, `Orders.tsx`, `OrderDetail.tsx`.
