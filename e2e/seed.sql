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

TRUNCATE app_users, companies, job_postings, crawl_runs, maintenance_runs RESTART IDENTITY CASCADE;

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
    ('SS Mai Linh E2E',       'msg-ss@e2e.test',       'ss_team'),
    ('E2E PwChange Student',  'pwchange@e2e.test',     'user'),
    ('E2E Revoke Student',    'revoke@e2e.test',       'user'),
    ('E2E Expiry Student',    'expiry@e2e.test',       'user'),
    ('E2E Locked Student',    'locked@e2e.test',       'user'),
    ('E2E Data Staff',        'data-staff@e2e.test',   'ss_team'),
    ('E2E Data Student',      'data-student@e2e.test', 'user'),
    ('E2E Import Staff',      'import-staff@e2e.test', 'ss_team'),
    ('E2E Crawl Staff',       'crawl-staff@e2e.test',  'ss_team'),
    ('E2E Crawl Admin',       'crawl-admin@e2e.test',  'admin'),
    ('E2E Crawl Student',     'crawl-student@e2e.test','user')
) AS v(full_name, email, role);

-- ---------------------------------------------------------------------------------------------------------
-- Lịch sử vận hành cho spec crawl.spec.ts (/crawl, Nhóm 6 phần 3/3). Dữ liệu CHỈ-ĐỌC với spec: không spec nào
-- được bấm chạy crawl/bảo trì thật (sẽ gọi TopCV/Tavily/Gemini ra ngoài).
--
-- 25 lượt crawl (2 trang x 20): 23 'topcv' hoàn tất (lọc nguồn cũng ra 2 trang), 1 'vietnamworks' lỗi,
-- 1 'careerviet' ĐANG CHẠY (để widget "Đang chạy" có dữ liệu). Hàng mới nhất trước (i = số phút trước).
-- 23 lượt bảo trì (2 trang): 21 'backfill_company_profiles' hoàn tất, 1 'check_expired_jobs' lỗi, 1 đang chạy.
-- Mọi lượt đang chạy bắt đầu lúc nạp seed nên không bị watchdog coi là treo (ngưỡng 120/180 phút).
-- LƯU Ý cho phần 3c/3d: nguồn 'careerviet' và job 'check_expired_jobs' đang có lượt chạy dở trong seed, nên
-- bấm chạy đúng chúng sẽ nhận 409 — dùng nguồn/job khác khi viết e2e kích hoạt.
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO crawl_runs (source, category, pages, max_jobs, status, stats, error, triggered_by, started_at, finished_at)
SELECT r.source, r.category, 2, NULL, r.status::crawl_status_enum, r.stats::jsonb, r.error,
       (SELECT ss_user_id FROM app_users WHERE email = 'crawl-admin@e2e.test'),
       now() - make_interval(mins => r.i),
       CASE WHEN r.status = 'running' THEN NULL ELSE now() - make_interval(mins => r.i) + interval '90 seconds' END
FROM (
    SELECT 0 AS i, 'careerviet' AS source, 'running-cat' AS category, 'running' AS status,
           NULL::text AS stats, NULL::text AS error
    UNION ALL
    SELECT 1, 'vietnamworks', 'err-cat', 'error',
           '{"fetched": 0, "inserted": 0, "errors": 1, "blocked": true}', 'E2E: bị chặn bởi anti-bot'
    UNION ALL
    SELECT g, 'topcv', 'cat-' || lpad(g::text, 2, '0'), 'done',
           '{"fetched": 40, "inserted": 12, "skipped_duplicate": 5, "errors": 1}', NULL
    FROM generate_series(2, 24) AS g
) AS r;

INSERT INTO maintenance_runs (job_type, params, status, stats, error, triggered_by, started_at, finished_at)
SELECT r.job_type::maintenance_job_type_enum, r.params::jsonb, r.status::crawl_status_enum, r.stats::jsonb, r.error,
       (SELECT ss_user_id FROM app_users WHERE email = 'crawl-admin@e2e.test'),
       now() - make_interval(mins => r.j),
       CASE WHEN r.status = 'running' THEN NULL ELSE now() - make_interval(mins => r.j) + interval '45 seconds' END
FROM (
    SELECT 0 AS j, 'check_expired_jobs' AS job_type, '{"dry_run": true}' AS params, 'running' AS status,
           NULL::text AS stats, NULL::text AS error
    UNION ALL
    SELECT 1, 'check_expired_jobs', '{}', 'error', NULL, 'E2E: kết nối cơ sở dữ liệu thất bại'
    UNION ALL
    SELECT g, 'backfill_company_profiles', '{"limit": 50}', 'done',
           '{"checked": 10, "updated": 4, "unchanged": 5, "unknown_domain": 1, "errors": 0}', NULL
    FROM generate_series(2, 22) AS g
) AS r;

-- ---------------------------------------------------------------------------------------------------------
-- Tab Crawl (phần 3c): lượt 'careerviet' ĐANG CHẠY ở trên được gắn vào một batch 3 category để e2e kiểm checklist
-- ("Đang chạy" + 2 category "Đang chờ" chưa có record) và khung Log live (3 dòng log, 1 dòng cảnh báo, 1 dòng lỗi).
-- Lượt này là lượt MỚI NHẤT (i = 0) nên GET /crawl/latest-log-run trả nó và tab Crawl tự theo dõi batch này.
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO crawl_batches (batch_id, source, categories, pages, status, triggered_by, created_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'careerviet',
        '["running-cat", "data-engineer", "data-scientist"]'::jsonb, 2, 'running',
        (SELECT ss_user_id FROM app_users WHERE email = 'crawl-admin@e2e.test'), now());

UPDATE crawl_runs
SET batch_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', batch_position = 1,
    progress = jsonb_build_object('fetched', 12, 'inserted', 3, 'last_update', now())
WHERE source = 'careerviet' AND status = 'running';

INSERT INTO crawl_run_logs (run_id, level, message, created_at)
SELECT run_id, l.level, l.message, now() - make_interval(secs => l.ago)
FROM crawl_runs,
     (VALUES ('INFO', '[careerviet] Bắt đầu crawl category running-cat', 30),
             ('WARNING', '[careerviet] Trang 2 phản hồi chậm, thử lại', 20),
             ('ERROR', '[careerviet] Không tải được chi tiết tin E2E-123', 10)) AS l(level, message, ago)
WHERE source = 'careerviet' AND status = 'running';

-- ---------------------------------------------------------------------------------------------------------
-- Tab Bảo trì (phần 3d): log cho hai thẻ để e2e kiểm khung Log live và gộp log (logs-batch). KHÔNG thêm lượt bảo trì
-- nào (spec Lịch sử đếm đúng 23 lượt): chỉ thêm dòng log vào lượt đã có.
--   - check_expired_jobs ĐANG CHẠY (lượt mới nhất của job này): 3 dòng log (INFO, WARNING, ERROR).
--   - backfill_company_profiles lượt mới nhất (đã xong, 5 số liệu): 2 dòng log -> sau lần hỏi đầu trả hết, run này
--     "settled" và rời khỏi các lời gọi logs-batch sau đó.
-- Ba job còn lại (enrich_profile_from_website, enrich_web_info, get_fb_linkedin) cố ý KHÔNG có lượt nào: thẻ hiện
-- "chưa từng chạy" (latest-log-runs trả null cho job đó, hợp lệ). Vì check_expired_jobs đang chạy nên nút chạy của thẻ
-- này bị tắt; ca 409 thật đi qua route POST (e2e/crawl.spec.ts), không qua nút.
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO maintenance_run_logs (run_id, level, message, created_at)
SELECT m.run_id, l.level, l.message, now() - make_interval(secs => l.ago)
FROM (SELECT run_id FROM maintenance_runs WHERE job_type = 'check_expired_jobs' AND status = 'running') AS m,
     (VALUES ('INFO', '[check_expired_jobs] Bắt đầu kiểm tra job còn hạn', 30),
             ('WARNING', '[check_expired_jobs] Nguồn E2E-SRC phản hồi chậm, thử lại', 20),
             ('ERROR', '[check_expired_jobs] Không kiểm được job E2E-456', 10)) AS l(level, message, ago);

INSERT INTO maintenance_run_logs (run_id, level, message, created_at)
SELECT m.run_id, l.level, l.message, now() - make_interval(secs => l.ago)
FROM (SELECT run_id FROM maintenance_runs WHERE job_type = 'backfill_company_profiles'
      ORDER BY started_at DESC LIMIT 1) AS m,
     (VALUES ('INFO', '[backfill_company_profiles] Bắt đầu vá hồ sơ công ty', 200),
             ('INFO', '[backfill_company_profiles] Xong: kiểm tra 10, cập nhật 4', 160)) AS l(level, message, ago);
