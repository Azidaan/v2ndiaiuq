CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

UPDATE admin_users SET role = 'superadmin' WHERE role IS NULL;

ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'viewer';
ALTER TABLE admin_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('superadmin', 'admin', 'editor', 'viewer'));

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_email_format_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_email_format_check CHECK (
  length(email) BETWEEN 3 AND 320
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
);
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_password_hash_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_password_hash_check
  CHECK (length(password_hash) BETWEEN 20 AND 255);
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_timestamps_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_timestamps_check
  CHECK (updated_at >= created_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);

DELETE FROM admin_sessions WHERE expires_at <= now();

ALTER TABLE admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_token_hash_check;
ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_token_hash_check
  CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_expiry_check;
ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_expiry_check
  CHECK (expires_at > created_at);

CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  image_url text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_items_public_idx
  ON content_items (type, status, published_at DESC);

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_type_check;

UPDATE content_items
SET type = 'visual_block'
WHERE type = 'page' AND slug LIKE 'block:%';

UPDATE content_items
SET category = 'visual-block', updated_at = now()
WHERE type = 'visual_block' AND category <> 'visual-block';

DELETE FROM content_items
WHERE type IN ('announcement', 'page');

ALTER TABLE content_items ADD CONSTRAINT content_items_type_check CHECK (
  type IN ('news', 'publication', 'vacancy', 'document', 'visual_block', 'research', 'certificate', 'department')
);

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_required_text_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_required_text_check CHECK (
  length(btrim(title)) BETWEEN 1 AND 500
  AND length(btrim(slug)) BETWEEN 1 AND 500
  AND length(category) <= 500
);
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_payload_size_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_payload_size_check CHECK (
  length(summary) <= 100000
  AND length(body) <= 1000000
  AND length(image_url) <= 2000
  AND length(file_url) <= 2000
);
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_metadata_object_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_metadata_object_check
  CHECK (jsonb_typeof(metadata) = 'object');
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_timestamps_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_timestamps_check
  CHECK (updated_at >= created_at);
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_urls_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_urls_check CHECK (
  (image_url = '' OR image_url ~ '^(https?://|/)')
  AND (file_url = '' OR file_url ~ '^(https?://|/)')
);
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_visual_block_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_visual_block_check CHECK (
  type <> 'visual_block'
  OR (
    category = 'visual-block'
    AND slug ~ '^block:[a-z0-9-]+:[a-z0-9-]+$'
    AND metadata ? 'tag'
    AND metadata ? 'path'
  )
);

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_status_created_idx
  ON inquiries (status, created_at DESC);

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('new', 'in_progress', 'resolved'));
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_payload_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_payload_check CHECK (
  length(btrim(name)) BETWEEN 2 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email = lower(email)
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND length(subject) <= 500
  AND length(btrim(message)) BETWEEN 10 AND 10000
  AND length(admin_note) <= 10000
);
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_timestamps_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_timestamps_check
  CHECK (updated_at >= created_at);

CREATE OR REPLACE VIEW database_integrity_violations AS
  SELECT 'admin_users.email'::text AS check_name, count(*)::bigint AS violations
  FROM admin_users
  WHERE email <> lower(email)
     OR length(email) NOT BETWEEN 3 AND 320
     OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  UNION ALL
  SELECT 'admin_users.active_superadmin', CASE WHEN count(*) > 0 THEN 0 ELSE 1 END
  FROM admin_users WHERE role = 'superadmin' AND is_active = true
  UNION ALL
  SELECT 'admin_sessions.expired_or_orphaned', count(*)
  FROM admin_sessions s LEFT JOIN admin_users u ON u.id = s.admin_id
  WHERE u.id IS NULL OR s.expires_at <= now() OR NOT u.is_active
  UNION ALL
  SELECT 'content_items.required_fields', count(*)
  FROM content_items WHERE btrim(title) = '' OR btrim(slug) = ''
  UNION ALL
  SELECT 'content_items.metadata', count(*)
  FROM content_items WHERE jsonb_typeof(metadata) <> 'object'
  UNION ALL
  SELECT 'content_items.visual_blocks', count(*)
  FROM content_items
  WHERE type = 'visual_block'
    AND (category <> 'visual-block' OR slug !~ '^block:[a-z0-9-]+:[a-z0-9-]+$' OR NOT (metadata ?& ARRAY['tag', 'path']))
  UNION ALL
  SELECT 'content_items.duplicate_slugs', count(*)
  FROM (SELECT slug FROM content_items GROUP BY slug HAVING count(*) > 1) duplicates
  UNION ALL
  SELECT 'inquiries.required_fields', count(*)
  FROM inquiries
  WHERE length(btrim(name)) < 2
     OR length(btrim(message)) < 10
     OR email <> lower(email)
     OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  UNION ALL
  SELECT 'inquiries.status', count(*)
  FROM inquiries WHERE status NOT IN ('new', 'in_progress', 'resolved');
