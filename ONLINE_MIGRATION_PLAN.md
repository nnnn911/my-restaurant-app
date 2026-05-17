# Kế hoạch nâng cấp online

## Stack chọn

Frontend:
- Vite + Vanilla JS.
- Giữ HTML/CSS/UI hiện tại.
- Không thêm framework UI nặng.

Backend/database:
- Supabase Auth + Postgres + Row Level Security.

Hosting:
- Cloudflare Pages hoặc Vercel.
- Khuyến nghị Cloudflare Pages cho static hosting miễn phí lâu dài.
- Vercel cũng phù hợp nếu bạn quen GitHub import và preview deploy.

## Lý do chọn Supabase

App hiện có dữ liệu quan hệ rõ:
- users/profiles
- menu
- vouchers
- carts/cart_items
- orders/order_items
- reservations
- staff/owner/shipper roles

Postgres + RLS phù hợp hơn Firebase cho báo cáo, lọc đơn, thống kê doanh thu và phân quyền theo vai trò.

## Giới hạn free tier quan trọng

Theo trang chính thức Supabase pricing hiện tại:
- Free: 500 MB database, 50,000 monthly active users, 1 GB file storage, 5 GB egress.
- Free project có thể pause sau 1 tuần không hoạt động.
- Không có automatic backups ở Free.

Theo Vercel Hobby docs/pricing:
- Hobby là free cho personal/small projects.
- Có usage caps; nếu vượt thì thường phải chờ chu kỳ mới hoặc nâng cấp.

Theo Netlify pricing:
- Free có 300 usage credits/tháng và deploy/CDN miễn phí.

Cloudflare Pages cũng có free plan cho static hosting; nếu chỉ dùng static frontend thì chi phí vận hành là 0.

## Database schema

Schema SQL nằm ở:

- `supabase/schema.sql`

Bảng chính:
- `profiles`: user/customer/staff/owner/shipper profile, role, phone, points.
- `menu_items`: menu online.
- `vouchers`: voucher.
- `user_vouchers`: voucher thuộc user.
- `carts`, `cart_items`: giỏ hàng theo user.
- `orders`, `order_items`: đơn hàng và chi tiết món.
- `reservations`: đơn đặt trước.
- `app_sequences`: sequence sinh mã `ORD`, `POS`, `RES`, customer code.

RLS:
- Customer chỉ đọc/sửa profile, cart, order, reservation của mình.
- Staff/owner đọc và cập nhật vận hành.
- Owner quản lý menu/voucher/customer.
- Shipper chỉ thấy đơn shipping/delivered/cancelled phục vụ giao hàng.
- Không dùng service role key trong frontend.

## Migration data

Script tạo seed SQL:

```bash
npm run seed:sql
```

Output:

```text
supabase/seed.generated.sql
```

Seed script hiện import:
- menu
- voucher
- sequence

Không import plaintext password từ `db.json`. Tài khoản thật phải tạo bằng Supabase Auth rồi thêm profile role tương ứng.

## Kế hoạch refactor code

Pha 1:
- Thêm Vite và env config.
- Thêm Supabase schema/RLS.
- Thêm remote service foundation.
- Viết setup/deploy docs.

Pha 2:
- Chuyển customer auth sang Supabase Auth.
- Hydrate current profile từ `profiles`.
- Chuyển menu/voucher đọc từ Supabase, fallback local khi chưa cấu hình.

Pha 3:
- Chuyển cart/order/reservation CRUD sang Supabase.
- Giữ localStorage cho checkout draft, POS draft và cache tạm.

Pha 4:
- Chuyển admin/owner/shipper auth sang Supabase Auth + role trong `profiles`.
- Bỏ plaintext staff/owner/shipper localStorage.

Pha 5:
- Tối ưu realtime, loading state, offline/error state.
- Viết test checklist và deploy production.

