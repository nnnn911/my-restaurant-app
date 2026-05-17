# Audit dự án Quán Ăn Đồng Quê

Ngày audit: 2026-05-18

## 1. Tổng quan

Project hiện là ứng dụng HTML/CSS/JavaScript thuần, chạy local, lưu dữ liệu bằng `localStorage` và seed dữ liệu từ `db.json`.

UI hiện tại được render chủ yếu bằng JavaScript module vào `#page-content`. Các file HTML chỉ là shell mỏng nạp CSS và entry script.

## 2. Cấu trúc file liên quan

- `*.html`: các entry page cho customer, admin, owner, shipper.
- `css/`: design tokens, base, layout, component, navbar, page-specific styles.
- `js/data/store.js`: data layer chính, merge `db.json` với `localStorage`.
- `js/data/db.js`: đọc `db.json` bằng synchronous XHR.
- `js/core/storage.js`: wrapper đọc/ghi JSON vào `localStorage`.
- `js/features/customer/`: auth, menu, cart, checkout, history, rewards, profile.
- `js/features/admin/`: POS, quản lý order, preorder, auth/layout.
- `js/features/owner/`: dashboard, reports, menu, vouchers, customers, auth/layout.
- `js/features/shipper/`: shipper login, danh sách đơn, cập nhật giao hàng.
- `db.json`: seed data gồm users, staff, owner, shipper, menu, vouchers, orders, reservations.

## 3. Chức năng hiện có

Customer:
- Xem menu, lọc/tìm kiếm món.
- Đăng ký/đăng nhập bằng số điện thoại.
- Giỏ hàng, ghi chú món, checkout.
- Voucher, đổi điểm, lịch sử đơn hàng.
- Đặt trước gà/vịt nguyên con.

Admin/staff:
- Đăng nhập nhân viên.
- POS tạo đơn tại quán.
- Quản lý trạng thái order.
- Quản lý trạng thái preorder.

Owner:
- Đăng nhập chủ cửa hàng.
- Quản lý menu, voucher, khách hàng.
- Dashboard và báo cáo doanh thu/món/đơn hàng.

Shipper:
- Đăng nhập shipper.
- Xem đơn đang giao và lịch sử.
- Cập nhật giao thành công/thất bại.

## 4. UI hiện tại

Phong cách UI:
- Font Montserrat local.
- Tông xanh lá đậm, beige/cream, accent vàng.
- Customer UI dùng navbar sticky, hero ảnh nền, menu cards, cart sidebar, modal.
- Staff/owner UI dạng dashboard/table/panel.
- Shipper UI thiên mobile, rõ thao tác giao hàng.

Kết luận: UI đủ tốt để giữ lại. Migration online nên chạm vào data/auth layer trước, không redesign.

## 5. LocalStorage schema hiện tại

Key chính:
- `dq_db`: database runtime hiện tại.
- `dq_staff_users`, `dq_staff_current`.
- `dq_owner_users`, `dq_owner_current`.
- `dq_shipper_users`, `dq_shipper_current`.
- `dq_pos_cart`, `dq_pos_draft`.

Legacy keys được migrate một lần:
- `dq_users`
- `dq_current_user`
- `dq_orders`
- `dq_cart`
- `dq_vouchers`
- `dq_menu`
- `dq_reservations`

`dq_db` schema:

```js
{
  schemaVersion,
  createdAt,
  updatedAt,
  users,
  currentUserId,
  carts,
  orders,
  vouchers,
  menu,
  reservations,
  meta: {
    orderSeq,
    posOrderSeq,
    reservationSeq,
    checkoutDraft
  }
}
```

## 6. Vấn đề chính

Security:
- Password đang lưu plaintext trong `db.json` và `localStorage`.
- Tài khoản staff/owner/shipper mặc định bị expose ở frontend.
- Không có phân quyền thật; DevTools có thể sửa dữ liệu.
- Một số đoạn render dữ liệu động chưa escape đồng nhất.

Data/architecture:
- `dq_db` là single JSON document, khó đồng bộ nhiều thiết bị.
- Sequence ID sinh ở client, có rủi ro trùng khi online.
- `loadStaticDb()` dùng synchronous XHR.
- Dữ liệu seed và dữ liệu production giả lập đang trộn trong `db.json`.

Deploy:
- Static deploy dễ, nhưng nếu không có DB online thì dữ liệu vẫn chỉ ở từng máy.
- Một số image path trong seed bắt đầu bằng `/assets/...`, nên cần chuẩn hóa khi deploy dưới subpath.

