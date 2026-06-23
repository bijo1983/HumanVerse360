CREATE TABLE IF NOT EXISTS payment_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES subscription_plans(id),
  charge_id       text NOT NULL,
  amount          numeric(10,3) NOT NULL,
  currency        text NOT NULL DEFAULT 'BHD',
  status          text NOT NULL DEFAULT 'INITIATED',
  tap_response    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_transactions" ON payment_transactions FOR SELECT
  TO authenticated USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "insert_own_transactions" ON payment_transactions FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "update_own_transactions" ON payment_transactions FOR UPDATE
  TO authenticated USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  ) WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "delete_own_transactions" ON payment_transactions FOR DELETE
  TO authenticated USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX idx_payment_transactions_company ON payment_transactions(company_id);
CREATE INDEX idx_payment_transactions_charge ON payment_transactions(charge_id);
