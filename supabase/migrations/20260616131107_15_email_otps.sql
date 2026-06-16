CREATE TABLE IF NOT EXISTS email_otps (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        NOT NULL,
  otp         text        NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otps_lookup_idx ON email_otps (email, expires_at);

ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;
-- Access is exclusively via service-role edge functions; no direct client access needed.
