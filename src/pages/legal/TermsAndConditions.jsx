import LegalLayout from './LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-lg font-bold mb-3" style={{ color: '#1B3A6E' }}>{title}</h2>
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function TermsAndConditions() {
  return (
    <LegalLayout
      title="Terms and Conditions"
      subtitle="Please read these terms carefully before using the HumanVerse360 platform."
    >
      <p className="text-xs text-gray-400 mb-10">Last updated: June 2025 &nbsp;|&nbsp; Effective date: June 2025</p>

      <Section title="1. Agreement to Terms">
        <p>
          These Terms and Conditions ("Terms") constitute a legally binding agreement between you (the
          "Customer" or "User") and <strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong>,
          a company registered in the Kingdom of Bahrain ("<strong>Innovegic</strong>", "<strong>we</strong>",
          or "<strong>us</strong>"), governing your access to and use of the <strong>HumanVerse360</strong>
          platform at <strong>humanverse360.com</strong>.
        </p>
        <p>
          By registering an account, accessing, or using the platform, you confirm that you have read,
          understood, and agree to be bound by these Terms. If you do not agree, you must not use the platform.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          HumanVerse360 is a cloud-based Human Resources and Payroll management Software-as-a-Service (SaaS)
          platform designed for businesses operating in the GCC region. The platform provides features
          including, but not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Employee profile and records management</li>
          <li>Payroll processing and salary slip generation</li>
          <li>Leave management and balance tracking</li>
          <li>Document expiry alerts (visa, passport, national ID, work permit)</li>
          <li>End-of-service indemnity calculations</li>
          <li>Employee Self-Service (ESS) portal</li>
          <li>Role-based access control and user management</li>
        </ul>
        <p>
          We reserve the right to modify, suspend, or discontinue any feature or the platform as a whole
          at any time, with reasonable prior notice where practicable.
        </p>
      </Section>

      <Section title="3. Account Registration and Eligibility">
        <p>
          To use HumanVerse360, you must register a company account by providing accurate and complete
          information. You represent and warrant that:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You are at least 18 years of age</li>
          <li>You have the legal authority to enter into this agreement on behalf of your company</li>
          <li>All information provided during registration is true, accurate, and current</li>
          <li>You will keep your login credentials confidential and are responsible for all activity
            under your account</li>
        </ul>
        <p>
          You must notify us immediately at <strong>support@humanverse360.com</strong> if you suspect
          unauthorized access to your account.
        </p>
      </Section>

      <Section title="4. Subscription Plans and Payment">
        <p>HumanVerse360 offers the following subscription plans (prices in Bahraini Dinar, BHD):</p>
        <div className="overflow-x-auto mt-3 mb-3">
          <table className="w-full text-xs border-collapse rounded-lg overflow-hidden">
            <thead>
              <tr style={{ background: '#1B3A6E', color: 'white' }}>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-left px-4 py-3 font-semibold">Price</th>
                <th className="text-left px-4 py-3 font-semibold">Employees</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Free', 'BHD 0 / month', 'Up to 10'],
                ['Small Enterprise', 'BHD 20 / month', 'Up to 25'],
                ['Medium Enterprise', 'BHD 50 / month', 'Up to 100'],
                ['Large Enterprise', 'BHD 250 / month', 'Unlimited'],
              ].map(([plan, price, emp], i) => (
                <tr key={plan} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium text-gray-800">{plan}</td>
                  <td className="px-4 py-3 text-gray-700">{price}</td>
                  <td className="px-4 py-3 text-gray-700">{emp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Subscriptions are billed monthly in advance. Payment is processed through PayPal.
          Subscription fees are non-refundable except as outlined in our Refund Policy. We reserve the
          right to modify pricing with 30 days' advance notice to registered users.
        </p>
        <p>
          Failure to pay subscription fees may result in service suspension. Access will be restored
          upon payment of outstanding amounts.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree to use HumanVerse360 only for lawful business purposes. You must not:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Use the platform to store, process, or transmit unlawful, harmful, or fraudulent data</li>
          <li>Attempt to gain unauthorized access to any part of the platform or other user accounts</li>
          <li>Reverse engineer, decompile, or create derivative works from the platform</li>
          <li>Use automated bots, scrapers, or other tools to extract data from the platform</li>
          <li>Resell, sublicense, or transfer access to the platform to third parties without written consent</li>
          <li>Violate any applicable laws, including data protection and employment laws of Bahrain or
            your operating jurisdiction</li>
        </ul>
        <p>
          Violation of these acceptable use provisions may result in immediate account suspension or
          termination without refund.
        </p>
      </Section>

      <Section title="6. Data Ownership and Responsibility">
        <p>
          You retain full ownership of all employee data and company data you input into the platform.
          By using HumanVerse360, you grant us a limited license to process and store your data solely
          to provide the contracted services.
        </p>
        <p>
          You are solely responsible for ensuring that the employee data you upload complies with all
          applicable data protection and employment laws in your jurisdiction, including obtaining
          appropriate consents from your employees.
        </p>
      </Section>

      <Section title="7. Intellectual Property">
        <p>
          The HumanVerse360 platform, including its design, code, features, and content, is the exclusive
          intellectual property of Innovegic Consultancy &amp; IT Services Co W.L.L. All rights are reserved.
          Nothing in these Terms grants you any ownership rights in the platform.
        </p>
        <p>
          The HumanVerse360 name, logo, and related marks are trademarks of Innovegic and may not be
          used without prior written permission.
        </p>
      </Section>

      <Section title="8. Service Availability and Uptime">
        <p>
          We strive to maintain platform availability of 99% uptime on a monthly basis, excluding
          scheduled maintenance windows. Scheduled maintenance will be communicated in advance where possible.
          We are not liable for downtime caused by third-party service providers, force majeure events,
          or circumstances beyond our reasonable control.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by applicable law, Innovegic shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including loss of profits,
          data, or business, arising from your use of or inability to use the platform.
        </p>
        <p>
          Our total aggregate liability to you for any claims arising under these Terms shall not exceed
          the total fees paid by you to Innovegic in the three (3) months immediately preceding the
          event giving rise to the claim.
        </p>
      </Section>

      <Section title="10. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless Innovegic and its officers, directors,
          employees, and agents from any claims, damages, liabilities, costs, or expenses (including
          reasonable legal fees) arising from: (a) your use of the platform; (b) your violation of
          these Terms; (c) your violation of any applicable law or third-party rights; or (d) your
          employee data or company data.
        </p>
      </Section>

      <Section title="11. Termination">
        <p>
          Either party may terminate this agreement at any time. You may cancel your subscription
          through the platform settings or by contacting support. We may suspend or terminate your
          account immediately for material breach of these Terms.
        </p>
        <p>
          Upon termination, your access to the platform will cease. We will retain your data for
          90 days post-termination to allow data export, after which it will be permanently deleted.
        </p>
      </Section>

      <Section title="12. Governing Law and Disputes">
        <p>
          These Terms are governed by the laws of the <strong>Kingdom of Bahrain</strong>. Any disputes
          arising from these Terms or your use of the platform shall be subject to the exclusive
          jurisdiction of the courts of Bahrain.
        </p>
        <p>
          We encourage you to contact us first to resolve any disputes informally before initiating
          formal legal proceedings.
        </p>
      </Section>

      <Section title="13. Changes to These Terms">
        <p>
          We reserve the right to modify these Terms at any time. Changes will be posted on this page
          with an updated effective date. We will notify active subscribers by email at least 14 days
          before material changes take effect. Continued use of the platform after the effective date
          constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="14. Contact Us">
        <p>For questions about these Terms, please contact:</p>
        <div className="bg-gray-50 rounded-xl p-5 mt-3 space-y-1">
          <p><strong>Innovegic Consultancy &amp; IT Services Co W.L.L</strong></p>
          <p>Manama, Kingdom of Bahrain</p>
          <p>Email: <a href="mailto:support@humanverse360.com" className="text-blue-600 hover:underline">support@humanverse360.com</a></p>
          <p>Email: <a href="mailto:info@innovegicit.com" className="text-blue-600 hover:underline">info@innovegicit.com</a></p>
          <p>Phone: <a href="tel:+97338991983" className="text-blue-600 hover:underline">+973 38991983</a></p>
        </div>
      </Section>
    </LegalLayout>
  );
}
