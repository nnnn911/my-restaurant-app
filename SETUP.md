# Setup local, database và deploy miễn phí

## 1. Chạy local

Cài dependencies:

```bash
pnpm install
```

Tạo file env:

```bash
cp .env.example .env
```

Chạy dev server:

```bash
pnpm run dev
```

Mở URL Vite in ra, thường là:

```text
http://localhost:5173
```

## 2. Tạo Supabase project

1. Vào [Supabase](https://supabase.com).
2. Bấm `Start your project` hoặc `New project`.
3. Chọn organization.
4. Nhập project name, ví dụ `dong-que-restaurant`.
5. Tạo database password và lưu lại ở nơi an toàn.
6. Chọn region gần Việt Nam nhất nếu có.
7. Bấm `Create new project`.

## 3. Lấy public config

Trong Supabase dashboard:

1. Vào `Project Settings`.
2. Vào `API`.
3. Copy `Project URL`.
4. Copy `anon public` key.
5. Dán vào `.env`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Không copy `service_role` key vào frontend.

## 4. Tạo database schema

Trong Supabase dashboard:

1. Vào `SQL Editor`.
2. Bấm `New query`.
3. Mở file `supabase/schema.sql`.
4. Copy toàn bộ nội dung.
5. Paste vào SQL Editor.
6. Bấm `Run`.

## 5. Seed menu/voucher

Tạo SQL seed từ `db.json`:

```bash
pnpm run seed:sql
```

Sau đó:

1. Mở `supabase/seed.generated.sql`.
2. Copy toàn bộ nội dung.
3. Vào Supabase `SQL Editor`.
4. Paste và bấm `Run`.

## 5.1. Reset toàn bộ database và user để test lại

Chỉ dùng bước này với project Supabase test/dev. Không chạy trên dữ liệu thật.

Trong Supabase dashboard:

1. Vào `SQL Editor`.
2. Bấm `New query`.
3. Mở file `supabase/reset-test-data.sql`.
4. Copy toàn bộ nội dung.
5. Paste vào SQL Editor.
6. Bấm `Run`.

Sau khi reset xong, chạy lại theo thứ tự:

1. Mở `supabase/schema.sql`, copy toàn bộ, paste vào SQL Editor và bấm `Run`.
2. Chạy local command:

```bash
pnpm run seed:sql
```

3. Mở `supabase/seed.generated.sql`, copy toàn bộ, paste vào SQL Editor và bấm `Run`.
4. Tạo lại owner/staff/shipper nếu cần theo mục bên dưới.

Nếu dòng `delete from auth.users;` bị Supabase chặn:

1. Vào `Authentication` → `Users`.
2. Tick chọn toàn bộ user test.
3. Bấm `Delete users`.
4. Quay lại SQL Editor và chạy lại phần reset public data nếu cần.

## 6. Tạo tài khoản thật

Để customer đăng ký bằng số điện thoại nhưng vẫn dùng Supabase email/password Auth ở phía dưới, app tạo email kỹ thuật dạng `0901234567@phone.dongque.app`.

Trong Supabase dashboard:

1. Vào `Authentication`.
2. Vào `Providers`.
3. Mở `Email`.
4. Tắt `Confirm email` cho giai đoạn free/simple setup.
5. Lưu thay đổi.

Nếu gặp lỗi `email rate limit exceeded` khi customer đăng ký:

1. Kiểm tra lại `Authentication` → `Providers` → `Email`.
2. Đảm bảo `Confirm email` đang tắt.
3. Vào `Authentication` → `Users`, xóa user test vừa tạo lỗi nếu có.
4. Chờ vài phút rồi đăng ký lại bằng số điện thoại.

Lý do: app dùng email kỹ thuật dạng `0901234567@phone.dongque.app` để giữ UI đăng nhập bằng số điện thoại. Nếu `Confirm email` còn bật, Supabase sẽ cố gửi email xác nhận tới địa chỉ kỹ thuật này và có thể chạm giới hạn gửi email của free tier. Theo tài liệu Supabase, email auth mặc định có rate limit, đặc biệt với các luồng signup confirmation/password reset.

Vào Supabase dashboard:

1. Vào `Authentication`.
2. Vào `Users`.
3. Bấm `Add user`.
4. Nhập email kỹ thuật theo số điện thoại và password.

Ví dụ:

```text
0903333444@phone.dongque.app
```

App dùng số điện thoại để tạo email kỹ thuật ở phía dưới, nên nếu bạn muốn owner/staff/shipper đăng nhập bằng số điện thoại trên UI hiện tại, email trong Supabase Auth cũng nên theo dạng trên.

Sau khi user được tạo:

1. Copy `User UID`.
2. Vào `SQL Editor`.
3. Chạy SQL sau, thay UID/phone/name/role:

```sql
insert into public.profiles (id, public_code, role, name, phone)
values (
  'PASTE_USER_UID_HERE',
  'A00000',
  'owner',
  'Chủ cửa hàng',
  '0903333444'
)
on conflict (id) do update set
  public_code = excluded.public_code,
  role = excluded.role,
  name = excluded.name,
  phone = excluded.phone;
```

Role hợp lệ:

- `customer`
- `staff`
- `owner`
- `shipper`

Ví dụ nhân viên:

```sql
insert into public.profiles (id, public_code, role, name, phone)
values (
  'PASTE_USER_UID_HERE',
  'E00000',
  'staff',
  'Nhân viên',
  '0902222333'
)
on conflict (id) do update set
  public_code = excluded.public_code,
  role = excluded.role,
  name = excluded.name,
  phone = excluded.phone;
```

Ví dụ shipper:

```sql
insert into public.profiles (id, public_code, role, name, phone)
values (
  'PASTE_USER_UID_HERE',
  'D00000',
  'shipper',
  'Shipper',
  '0904444555'
)
on conflict (id) do update set
  public_code = excluded.public_code,
  role = excluded.role,
  name = excluded.name,
  phone = excluded.phone;
```

## 7. Build kiểm tra

```bash
pnpm run build
```

Preview production build:

```bash
pnpm run preview
```

## 8. Deploy miễn phí bằng Cloudflare Pages

1. Push project lên GitHub.
2. Vào [Cloudflare Dashboard](https://dash.cloudflare.com).
3. Vào `Workers & Pages`.
4. Chọn `Create application`.
5. Chọn `Pages`.
6. Chọn `Connect to Git`.
7. Chọn repo.
8. Framework preset: `Vite`.
9. Build command:

```bash
pnpm run build
```

10. Output directory:

```text
dist
```

11. Thêm environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

12. Bấm `Save and Deploy`.

## 9. Deploy miễn phí bằng Vercel

1. Vào [Vercel](https://vercel.com).
2. Bấm `Add New Project`.
3. Import GitHub repo.
4. Framework preset: `Vite`.
5. Build command:

```bash
pnpm run build
```

6. Output directory:

```text
dist
```

7. Thêm environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

8. Bấm `Deploy`.

## 10. Test checklist

- Mở trang chủ, menu render đủ món.
- Search/filter menu hoạt động.
- Đăng ký/đăng nhập customer.
- Thêm món vào cart.
- Checkout tạo order.
- History chỉ hiện order của đúng user.
- Rewards/voucher hoạt động.
- Staff đăng nhập, xem và cập nhật order.
- Owner quản lý menu/voucher/customer.
- Shipper chỉ thấy đơn đang giao.
- Tắt mạng hoặc sai Supabase env: app hiển thị lỗi/fallback rõ ràng.
- Build production không lỗi.
