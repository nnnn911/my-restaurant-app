# Tiến độ nâng cấp online product

Ngày cập nhật: 2026-05-18

File này tóm tắt những gì đã hoàn thành trong kế hoạch nâng cấp app HTML/CSS/JS localStorage thành online product, và các việc cần làm tiếp theo.

## Tài liệu liên quan

- Audit chi tiết dự án: [AUDIT.md](./AUDIT.md)
- Kế hoạch kiến trúc và migration: [ONLINE_MIGRATION_PLAN.md](./ONLINE_MIGRATION_PLAN.md)
- Hướng dẫn setup local, Supabase và deploy: [SETUP.md](./SETUP.md)
- Supabase schema/RLS: [supabase/schema.sql](./supabase/schema.sql)
- Script tạo seed SQL: [scripts/generate-seed-sql.mjs](./scripts/generate-seed-sql.mjs)

## Những việc đã hoàn thành

### 1. Audit dự án

Đã đọc và phân tích toàn bộ cấu trúc app hiện tại:

- Các page HTML shell.
- Toàn bộ CSS/UI chính.
- Data layer localStorage trong `js/data/store.js`.
- Seed data trong `db.json`.
- Customer flow: auth, menu, cart, checkout, history, rewards, preorder.
- Admin/staff flow: POS, order management, preorder management.
- Owner flow: dashboard, reports, menu, vouchers, customers.
- Shipper flow: delivery list, order detail, delivery status.

Kết quả audit được ghi tại [AUDIT.md](./AUDIT.md).

### 2. Chọn kiến trúc online

Đã chọn hướng triển khai:

- Frontend: Vite + Vanilla JS.
- Backend/database/auth: Supabase Auth + Postgres + Row Level Security.
- Hosting miễn phí: ưu tiên Cloudflare Pages hoặc Vercel.
- UI: giữ nguyên HTML/CSS/JS hiện tại, không redesign.

Lý do chính:

- App hiện có UI vanilla đủ tốt, không cần thêm framework nặng.
- Dữ liệu có quan hệ rõ ràng, phù hợp Postgres hơn NoSQL.
- Supabase RLS phù hợp phân quyền customer/staff/owner/shipper.
- Deploy static qua Vite đơn giản và miễn phí.

Chi tiết nằm trong [ONLINE_MIGRATION_PLAN.md](./ONLINE_MIGRATION_PLAN.md).

### 3. Thêm Vite build/deploy foundation

Đã thêm:

- `package.json`
- `vite.config.js`
- `.env.example`
- `.gitignore`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

Các script hiện có:

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run seed:sql
```

Build production đã chạy thành công bằng:

```bash
pnpm run build
```

### 4. Thiết kế database schema

Đã tạo schema Supabase tại [supabase/schema.sql](./supabase/schema.sql).

Các bảng chính:

- `profiles`
- `menu_items`
- `vouchers`
- `user_vouchers`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `reservations`
- `app_sequences`

Đã thêm:

- Enum role/category/status/payment.
- Trigger cập nhật `updated_at`.
- Function sinh mã public như `ORD`, `POS`, `RES`, customer/staff/owner/shipper code.
- Trigger tự tạo `profiles` khi tạo Supabase Auth user.
- Index cho các query quan trọng.
- Row Level Security policies cho customer/staff/owner/shipper.

### 5. Chuẩn bị migration seed data

Đã tạo script [scripts/generate-seed-sql.mjs](./scripts/generate-seed-sql.mjs).

Script đọc `db.json` và tạo SQL seed cho:

- `menu_items`
- `vouchers`
- `app_sequences`

Đã cố ý không import plaintext password từ `db.json`. Tài khoản thật cần tạo qua Supabase Auth.

Đã chạy thành công:

```bash
pnpm run seed:sql
```

Output được tạo tại:

```text
supabase/seed.generated.sql
```

File generated này đang được ignore khỏi git vì có thể tái tạo bất cứ lúc nào.

### 6. Thêm Supabase client và remote data foundation

Đã thêm:

- [js/services/supabaseClient.js](./js/services/supabaseClient.js)
- [js/services/remoteDataService.js](./js/services/remoteDataService.js)

Hiện remote service hỗ trợ:

- Kiểm tra Supabase đã cấu hình chưa.
- Tạo Supabase client bằng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- Customer sign up bằng phone/password qua email kỹ thuật.
- Customer sign in bằng phone/password.
- Staff/owner/shipper sign in bằng phone/password qua cùng email kỹ thuật.
- Sign out.
- Lấy current profile.
- Đọc/ghi customer profiles cho owner/staff.
- Đọc/ghi menu từ Supabase.
- Đọc/ghi vouchers từ Supabase.
- Đọc/ghi cart từ Supabase.
- Đọc/ghi orders và order items từ Supabase.
- Đọc/ghi reservations từ Supabase.

### 7. Nối customer auth sang Supabase có fallback

Đã cập nhật [js/features/customer/auth.js](./js/features/customer/auth.js).

Hành vi hiện tại:

- Nếu `.env` đã cấu hình Supabase, customer login/register dùng Supabase Auth.
- Nếu chưa cấu hình Supabase, app vẫn fallback về localStorage như trước.
- UI auth modal được giữ nguyên.
- Không hardcode private key.
- Chỉ dùng public anon key qua env.

Lưu ý: để đăng ký bằng số điện thoại hoạt động mượt, Supabase Email confirmation nên tắt trong giai đoạn setup ban đầu. Việc này đã được hướng dẫn trong [SETUP.md](./SETUP.md).

### 8. Nối staff/owner/shipper auth sang Supabase có fallback

Đã cập nhật:

- [js/features/admin/auth.js](./js/features/admin/auth.js)
- [js/features/owner/auth.js](./js/features/owner/auth.js)
- [js/features/shipper/auth.js](./js/features/shipper/auth.js)

Hành vi hiện tại:

- Nếu `.env` đã cấu hình Supabase, login dùng Supabase Auth.
- Sau login, app đọc `profiles.role`.
- Staff chỉ được vào flow nhân viên.
- Owner chỉ được vào flow chủ cửa hàng.
- Shipper chỉ được vào flow shipper.
- Nếu chưa cấu hình Supabase, login local cũ vẫn hoạt động.

### 9. Thêm remote hydrate + write-through cho data layer

Đã cập nhật [js/data/store.js](./js/data/store.js).

Hành vi hiện tại:

- `hydrateOnlineData()` kéo dữ liệu Supabase về local cache trước khi render page.
- Các entry page customer/admin/owner/shipper đã gọi hydrate trước render.
- Khi Supabase chưa cấu hình, app bỏ qua hydrate và chạy local như trước.
- `saveMenu()` ghi local và đẩy Supabase.
- `saveVouchers()` ghi local và đẩy Supabase.
- `saveCart()` ghi local và đẩy Supabase.
- `createOrder()` ghi local và đẩy order/order_items lên Supabase.
- `saveOrders()` ghi local và đẩy trạng thái/order fields lên Supabase.
- `createReservation()` ghi local và đẩy reservation lên Supabase.
- `saveReservations()` ghi local và đẩy reservation status/fields lên Supabase.
- `saveUsers()` ghi local và đẩy profile updates/points lên Supabase khi user có `authId`.

Đây là cầu nối để giữ UI sync hiện tại, tránh rewrite toàn app sang async trong một lần.

### 10. Thêm function migrate local data lên online

Đã thêm export:

```js
migrateLocalDataToOnline()
```

Function này có thể dùng sau khi user đăng nhập Supabase để đẩy dữ liệu local hiện có lên online:

- Cart hiện tại.
- Orders của current user.
- Reservations của current user.
- Menu/vouchers nếu current Supabase profile là `owner` hoặc `staff`.

### 11. Thêm RPC transaction cho nghiệp vụ quan trọng

Đã cập nhật [supabase/schema.sql](./supabase/schema.sql) với các function:

- `calculate_order_points(total_amount)`
- `create_order(payload)`
- `update_order_status(order_id, next_status)`
- `create_reservation(payload)`

Các lợi ích chính:

- Tạo order online có transaction trong database.
- Sinh mã `ORD-xxxx` và `POS-xxxx` bằng sequence trong DB.
- Insert `orders` và `order_items` trong cùng transaction.
- Tăng `menu_items.sold` khi tạo order.
- Cập nhật trạng thái delivered và cộng điểm trong DB, giảm rủi ro cộng điểm trùng.
- Tạo reservation online bằng mã `RES-xxxx` từ DB.

Đã nối các flow sau sang RPC khi Supabase được cấu hình:

- Checkout customer tạo order.
- POS staff tạo order tại quán.
- Admin cập nhật trạng thái order.
- Shipper cập nhật giao hàng thành công/thất bại.
- Customer tạo preorder/reservation.

Nếu Supabase chưa cấu hình, các flow vẫn fallback local như trước.

### 12. Thêm realtime refresh foundation

Đã thêm realtime subscription trong [js/services/remoteDataService.js](./js/services/remoteDataService.js) và wrapper trong [js/data/store.js](./js/data/store.js):

```js
startOnlineRealtime(onChange)
stopOnlineRealtime()
```

Các trang đã gắn realtime refresh:

- Admin order.
- Admin preorder.
- Owner pages.
- Shipper app.

Khi bảng `orders`, `order_items`, `reservations`, `menu_items`, `vouchers` thay đổi, app hydrate lại dữ liệu online rồi render lại trang liên quan.

### 13. Hoàn thiện migration UX

Đã thêm [js/features/customer/migration.js](./js/features/customer/migration.js).

Sau khi customer login/register, app sẽ:

- Kiểm tra dữ liệu local chưa đồng bộ.
- Hiển thị confirm nhẹ nếu có cart/order/reservation/menu/voucher local.
- Gọi `migrateLocalDataToOnline()` nếu người dùng đồng ý.
- Ghi marker `migratedLocalDataToOnlineAt` để tránh nhắc lại.

### 14. Hardening XSS cơ bản

Đã cập nhật render dữ liệu động ở:

- [js/features/customer/menu.js](./js/features/customer/menu.js)
- [js/features/customer/profile.js](./js/features/customer/profile.js)

Các field từ menu/profile như `name`, `desc`, `img`, `phone`, `note`, `aria-label` đã được escape bằng `escapeHtml`/`escapeAttr` ở những vị trí quan trọng.

### 15. Viết hướng dẫn setup/deploy

Đã viết [SETUP.md](./SETUP.md), gồm:

- Cài dependency.
- Chạy local.
- Tạo Supabase project.
- Lấy public URL/anon key.
- Chạy schema SQL.
- Seed menu/voucher.
- Tạo tài khoản thật cho owner/staff/shipper.
- Build kiểm tra.
- Deploy miễn phí bằng Cloudflare Pages.
- Deploy miễn phí bằng Vercel.
- Checklist test cơ bản.

### 16. Kiểm thử đã thực hiện

Đã chạy:

```bash
pnpm install
pnpm run seed:sql
pnpm run build
```

Kết quả:

- Dependencies cài được.
- Seed SQL tạo được.
- Production build pass.
- Sau khi thêm RPC/realtime, `pnpm run build` vẫn pass.
- Sau khi thêm migration UX và XSS hardening, `pnpm run build` vẫn pass.

Đã mở app qua dev server và sanity-check các page sau khi nối remote hydrate/write-through:

- Home render navbar, hero và 40 món.
- Checkout render empty cart state.
- Preorder render form.
- Rewards render page.
- Admin render login staff.
- Owner render login owner.
- Shipper render login shipper.
- Home vẫn render 40 menu cards sau hardening.

## Những việc chưa hoàn thành

Các phần dưới đây vẫn cần làm để app thật sự chuyển hoàn toàn từ localStorage sang database online.

### 1. Test với Supabase project thật

Cần làm:

- Tạo Supabase project thật.
- Chạy lại toàn bộ [supabase/schema.sql](./supabase/schema.sql).
- Chạy seed SQL.
- Tạo tài khoản customer/staff/owner/shipper thật.
- Test RLS bằng từng role thật.
- Test RPC `create_order`, `update_order_status`, `create_reservation` trên dữ liệu thật.

### 2. Xóa dần auth giả/local plaintext

Cần làm:

- Sau khi Supabase setup xong, xóa hoặc vô hiệu hóa `staffUsers`, `ownerUsers`, `shipperUsers` plaintext trong `db.json`.
- Giữ fallback local chỉ cho demo/dev nếu cần.
- Tách seed demo khỏi production seed.

### 3. Security hardening

Cần làm:

- Review RLS bằng user thật cho từng role.
- Tiếp tục rà soát các render còn dùng raw dynamic values ở admin/owner/shipper.
- Không expose service role key.
- Không lưu password plaintext ở frontend.
- Xác định rõ policy cho public preorder guest.

### 4. UX online states

Cần làm:

- Loading state khi đọc menu/order/cart từ Supabase.
- Error state khi mất mạng hoặc Supabase lỗi.
- Empty state vẫn giữ phong cách hiện tại.
- Toast lỗi dễ hiểu cho user.
- Optional: realtime update cho admin/shipper nếu muốn.

### 5. Deployment thật

Cần làm:

- Tạo Supabase project thật.
- Chạy `schema.sql`.
- Chạy `seed.generated.sql`.
- Tạo owner/staff/shipper Auth users thật.
- Cấu hình `.env`.
- Deploy Cloudflare Pages hoặc Vercel.
- Test production URL.

## Rủi ro còn lại

- Supabase Free project có thể pause nếu không hoạt động trong một thời gian.
- Free tier không có automatic backups; cần export dữ liệu định kỳ nếu dùng thật.
- Chuyển CRUD sang async Supabase sẽ cần sửa khá nhiều call site vì code hiện tại đang sync.
- Sequence/order creation cần làm bằng database transaction để tránh race condition.
- Dữ liệu mẫu trong `db.json` khá lớn; không nên coi toàn bộ là production data thật.

## Mốc tiếp theo đề xuất

Thứ tự triển khai tiếp nên là:

1. Tạo Supabase project thật và chạy schema/seed theo [SETUP.md](./SETUP.md).
2. Test login customer/staff/owner/shipper bằng tài khoản thật.
3. Test CRUD menu/voucher/cart/order/reservation trên Supabase thật.
4. Security review + deploy production.
