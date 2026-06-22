import LegalLayout from './LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-lg font-bold mb-3" style={{ color: '#1B3A6E' }}>{title}</h2>
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function RefundPolicy() {
  return (
    <LegalLayout
      title="Return and Refund Policy"
      subtitle="We want you to be satisfied with HumanVerse360. Here's how our refund process works."
    >
      <p className="text-xs text-gray-400 mb-10">Last updated: June 2025 &nbsp;|&nbsp; Effective date: June 2025</p>

      <Section title="1. Overview">
        <p>
          HumanVerse360 is a Software-as-a-Service (SaaS) platform provided by{' '}
          <strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong>, registered in the
          Kingdom of Bahrain. Because our product is a digital service with no physical goods
          involved, this policy governs subscription cancellations, billing disputes, and eligibility
          for refunds.
        </p>
        <p>
          We encourage all new customers to start with our <strong>Free Plan</strong> — which is
          permanently free for up to 10 employees — before subscribing to a paid plan. This allows
          you to evaluate the platform at no cost or risk.
        </p>
      </Section>

      <Section title="2. No Physical Returns">
        <p>
          HumanVerse360 is a digital software service delivered entirely online. There are no physical
          products to return. All subscriptions provide immediate access to the platform upon payment.
        </p>
      </Section>

      <Section title="3. Subscription Cancellation">
        <p>
          You may cancel your paid subscription at any time through your account settings or by
          contacting us at <strong>support@humanverse360.com</strong>.
        </p>
        <p>
          Upon cancellation:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your paid plan access will continue until the end of the current billing cycle.</li>
          <li>No further charges will be made after cancellation.</li>
          <li>Your account will automatically downgrade to the Free Plan at the end of the paid period.</li>
          <li>Your data will be retained for 90 days after full account termination, after which it
            will be permanently deleted.</li>
        </ul>
      </Section>

      <Section title="4. Refund Eligibility">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-3">
          <p className="font-semibold text-blue-900 mb-2">General Rule</p>
          <p className="text-blue-800">
            Subscription fees are <strong>non-refundable</strong> once a billing cycle has commenced,
            except in the specific circumstances outlined below.
          </p>
        </div>
        <p>
          We will issue a full or partial refund in the following situations:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Duplicate Payment:</strong> If you were charged more than once for the same
            subscription period due to a technical error.
          </li>
          <li>
            <strong>Unauthorized Transaction:</strong> If a charge was made without your authorization
            (subject to investigation and verification).
          </li>
          <li>
            <strong>Service Failure:</strong> If HumanVerse360 experienced a verified outage or
            critical failure that rendered the platform substantially unusable for more than 72
            consecutive hours during your billing period, you may be eligible for a pro-rata credit
            or refund.
          </li>
          <li>
            <strong>Accidental Upgrade:</strong> If you accidentally upgraded your plan and contact
            us within <strong>48 hours</strong> of the charge, we will evaluate a refund on a
            case-by-case basis.
          </li>
        </ul>
      </Section>

      <Section title="5. Non-Refundable Circumstances">
        <p>Refunds will <strong>not</strong> be issued for:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Cancellations made after the billing cycle has commenced (you retain access until period end)</li>
          <li>Failure to use the platform or features included in your plan</li>
          <li>Dissatisfaction with features that were accurately described at the time of subscription</li>
          <li>Accounts suspended due to violation of our Terms and Conditions</li>
          <li>Partial months — billing is charged for the full monthly cycle</li>
        </ul>
      </Section>

      <Section title="6. How to Request a Refund">
        <p>To submit a refund request, please contact us within <strong>7 days</strong> of the disputed charge:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Email:</strong> <a href="mailto:support@humanverse360.com" className="text-blue-600 hover:underline">support@humanverse360.com</a></li>
          <li><strong>Subject line:</strong> Refund Request — [Your Company Name]</li>
          <li><strong>Include:</strong> Your registered email, the transaction date, the amount charged,
            and the reason for the refund request.</li>
        </ul>
        <p>
          We aim to review all refund requests within <strong>5 business days</strong>. Approved refunds
          will be processed back to the original payment method (PayPal) within 7–10 business days,
          depending on your payment provider.
        </p>
      </Section>

      <Section title="7. Disputes and Chargebacks">
        <p>
          We encourage you to contact us directly before initiating a chargeback with your bank or
          payment provider. Filing a chargeback without first attempting to resolve the issue with
          us may result in account suspension pending investigation.
        </p>
        <p>
          If a chargeback is found to be fraudulent or in violation of this policy, we reserve the
          right to pursue recovery of the disputed amount.
        </p>
      </Section>

      <Section title="8. Free Plan">
        <p>
          Our <strong>Free Plan</strong> is permanently free and does not require a credit card.
          There is nothing to refund for Free Plan usage. Upgrading from Free to a paid plan is
          subject to the terms outlined in this policy.
        </p>
      </Section>

      <Section title="9. Price Changes">
        <p>
          If we increase subscription prices, existing subscribers will be notified at least
          <strong> 30 days in advance</strong>. You may cancel before the new pricing takes effect
          without any additional charge.
        </p>
      </Section>

      <Section title="10. Contact Us">
        <p>
          For any billing questions, refund requests, or subscription management, please contact:
        </p>
        <div className="bg-gray-50 rounded-xl p-5 mt-3 space-y-1">
          <p><strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong></p>
          <p>Manama, Kingdom of Bahrain</p>
          <p>Email: <a href="mailto:support@humanverse360.com" className="text-blue-600 hover:underline">support@humanverse360.com</a></p>
          <p>Email: <a href="mailto:info@innovegicit.com" className="text-blue-600 hover:underline">info@innovegicit.com</a></p>
          <p>Phone: <a href="tel:+97338991983" className="text-blue-600 hover:underline">+973 38991983</a></p>
          <p className="text-gray-400 text-xs pt-1">Business hours: Sunday – Thursday, 9 AM – 6 PM (AST, UTC+3)</p>
        </div>
      </Section>
    </LegalLayout>
  );
}
