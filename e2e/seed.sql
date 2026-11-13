-- e2e/seed.sql — dữ liệu nền cho Playwright (mục 2e). CHỈ chạy trên DB dùng riêng cho e2e:
SET client_min_messages = warning;
-- file này XOÁ SẠCH dữ liệu người dùng/công ty/job. scripts/e2e-db.mjs từ chối chạy nếu tên
-- database không chứa "e2e" hoặc "test".
--
-- Mọi tài khoản dùng chung một mật khẩu thử (không phải secret, chỉ có hiệu lực trên DB e2e):
--   E2e-Passw0rd!
-- Hash argon2id bên dưới sinh bằng scrapjd.api.security.hash_password (backend); argon2 tự mang
-- salt và tham số, nên cùng một chuỗi hash dùng được cho mọi tài khoản.
--
-- Backend chỉ cho MỘT phiên đăng nhập cùng lúc cho mỗi tài khoản (single-session): đăng nhập lần
-- hai làm phiên đầu chết. Vì vậy mỗi spec dùng tài khoản RIÊNG, không dùng chung giữa các spec.
-- Công ty và job được tạo bằng REST trong e2e/global-setup.ts (đi qua đúng validation của API).

TRUNCATE app_users, companies, job_postings RESTART IDENTITY CASCADE;

INSERT INTO app_users
    (full_name, email, role, password_hash, must_change_password, is_active, email_verified)
SELECT v.full_name, v.email, v.role,
       '$argon2id$v=19$m=65536,t=3,p=4$TIXqKO24vr0Jk3mo6xOYUA$TYR52LVAB5jDavhEIzD3OxH+RCk0hickfVYMqQUU6o0',
       false, true, true
FROM (VALUES
    ('E2E Seed Admin',        'seed-admin@e2e.test',   'admin'),
    ('E2E Auth Student',      'auth-student@e2e.test', 'user'),
    ('E2E Auth Staff',        'auth-staff@e2e.test',   'ss_team'),
    ('E2E Replaced Student',  'replaced@e2e.test',     'user'),
    ('E2E BadPass Student',   'badpass@e2e.test',      'user'),
    ('E2E Jobs Student',      'jobs-student@e2e.test', 'user'),
    ('Học Viên Nhắn Tin',     'msg-student@e2e.test',  'user'),
    ('SS Mai Linh E2E',       'msg-ss@e2e.test',       'ss_team')
) AS v(full_name, email, role);
