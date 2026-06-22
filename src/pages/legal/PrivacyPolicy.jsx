import LegalLayout from './LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-lg font-bold mb-3" style={{ color: '#1B3A6E' }}>{title}</h2>
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Your privacy matters to us. This policy explains how we collect, use, and protect your data."
    >
      <p className="text-xs text-gray-400 mb-10">Last updated: June 2025 &nbsp;|&nbsp; Effective date: June 2025</p>

      <Section title="1. Introduction">
        <p>
          HumanVerse360 ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is a cloud-based HR and
          Payroll management platform operated by <strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong>,
          a company registered in the Kingdom of Bahrain, located in Manama, Bahrain.
        </p>
        <p>
          This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you
          visit our website <strong>humanverse360.com</strong> or use our platform. Please read this policy
          carefully. By using our services, you agree to the practices described herein.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong>Account &amp; Registration Data:</strong> When you register a company account, we collect your
          name, company name, business email address, phone number, country, and billing information.</p>
        <p><strong>Employee Data:</strong> As an HR platform, we store employee records that you input, including
          names, national IDs, passport details, visa information, employment history, salary details, and
          leave records. This data is provided by you (the company administrator) and is processed on your behalf.</p>
        <p><strong>Usage Data:</strong> We collect technical information about how you interact with our platform,
          including IP addresses, browser type, pages visited, and session duration, for security and
          performance purposes.</p>
        <p><strong>Payment Data:</strong> Billing transactions are processed through secure third-party payment
          processors (PayPal). We do not store full payment card details on our servers.</p>
        <p><strong>Communications:</strong> If you contact us via email or through the platform, we retain those
          communications to respond to your queries and improve our services.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide, operate, and maintain the HumanVerse360 platform</li>
          <li>Process subscription payments and manage your account</li>
          <li>Send transactional emails (account confirmations, password resets, document expiry alerts)</li>
          <li>Respond to customer support requests</li>
          <li>Monitor and analyze platform usage to improve features and security</li>
          <li>Comply with legal obligations and enforce our Terms and Conditions</li>
          <li>Detect and prevent fraudulent or unauthorized activity</li>
        </ul>
        <p>We do not sell, rent, or trade your personal data to third parties for marketing purposes.</p>
      </Section>

      <Section title="4. Data Storage and Security">
        <p>
          All data is stored on secure cloud infrastructure provided by Supabase, with servers hosted in
          regions compliant with applicable data protection laws. We implement industry-standard security
          measures including:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>TLS/SSL encryption for all data in transit</li>
          <li>AES-256 encryption for data at rest</li>
          <li>Role-based access controls (RBAC) limiting data access to authorized personnel</li>
          <li>Regular security audits and vulnerability assessments</li>
          <li>Multi-factor authentication support for administrator accounts</li>
        </ul>
        <p>
          While we take every reasonable precaution, no system is 100% secure. In the event of a data breach,
          we will notify affected users in accordance with applicable laws.
        </p>
      </Section>

      <Section title="5. Data Sharing and Disclosure">
        <p>We may share your information with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Service Providers:</strong> Third-party vendors who assist us in operating the platform
            (e.g., cloud hosting, email delivery, payment processing), bound by confidentiality agreements.</li>
          <li><strong>Legal Requirements:</strong> When required by law, regulation, court order, or governmental
            authority in Bahrain or other applicable jurisdictions.</li>
          <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets,
            your data may be transferred to the acquiring entity subject to equivalent privacy protections.</li>
        </ul>
        <p>We do not share employee data with any third parties except as strictly necessary to provide
          the services you have contracted for.</p>
      </Section>

      <Section title="6. Cookies">
        <p>
          We use essential cookies to maintain your session and remember your login state. We may also use
          analytics cookies to understand how users interact with our platform. You can disable cookies
          through your browser settings, but this may affect platform functionality.
        </p>
      </Section>

      <Section title="7. Data Retention">
        <p>
          We retain your account and company data for the duration of your subscription plus 90 days after
          termination, to allow account reinstatement. After that period, data is permanently deleted.
          You may request earlier deletion by contacting us.
        </p>
        <p>
          We may retain anonymized, aggregated data for analytical purposes indefinitely.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
          <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention obligations)</li>
          <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
          <li><strong>Objection:</strong> Object to certain types of processing</li>
        </ul>
        <p>To exercise any of these rights, please contact us at <strong>info@innovegicit.com</strong>.</p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          HumanVerse360 is a business platform not intended for use by individuals under the age of 18.
          We do not knowingly collect personal information from minors.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. We will notify registered users by email and
          post the updated policy on this page with the revised effective date. Continued use of the
          platform after changes constitutes acceptance of the updated policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
        <div className="bg-gray-50 rounded-xl p-5 mt-3 space-y-1">
          <p><strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong></p>
          <p>Manama, Kingdom of Bahrain</p>
          <p>Email: <a href="mailto:info@innovegicit.com" className="text-blue-600 hover:underline">info@innovegicit.com</a></p>
          <p>Email: <a href="mailto:info@innovegicit.com" className="text-blue-600 hover:underline">info@innovegicit.com</a></p>
          <p>Phone: <a href="tel:+97338991983" className="text-blue-600 hover:underline">+973 38991983</a></p>
        </div>
      </Section>
    </LegalLayout>
  );
}
