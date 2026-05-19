// ── Legal Pages ─────────────────────────────────────

export function renderTermsPage() {
  const el = document.getElementById('page-terms');
  if (!el) return;
  const s = 'font-size:0.88rem;color:var(--text-muted);line-height:1.6;';
  const h = 'margin:20px 0 8px;';
  el.innerHTML = `
    <div class="settings-section">
      <h2 style="margin-bottom:16px;">Terms of Service</h2>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:4px;">Last updated: April 2026</p>
      <p style="color:var(--warning);font-size:0.8rem;margin-bottom:16px;font-style:italic;">This is a template and does not constitute legal advice. Please have these terms reviewed by a qualified attorney before launch.</p>

      <h4 style="${h}">1. Acceptance of Terms</h4>
      <p style="${s}">By accessing or using ClearCost Inventory ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you may not access or use the Service. We may update these Terms from time to time, and your continued use of the Service constitutes acceptance of any changes.</p>

      <h4 style="${h}">2. Description of Service</h4>
      <p style="${s}">ClearCost Inventory is a cloud-based software-as-a-service (SaaS) platform for inventory management, cost analysis, production tracking, and business operations. The Service includes web-based tools for managing products, raw materials, recipes, suppliers, sales channels, financial integrations, and reporting. Features and functionality may vary depending on your subscription tier.</p>

      <h4 style="${h}">3. Account Terms</h4>
      <p style="${s}">You must be at least 18 years of age to use the Service. By creating an account, you represent that you are at least 18 years old and that the information you provide is accurate and complete.</p>
      <p style="${s}margin-top:8px;">You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized access or use. We reserve the right to suspend or terminate accounts that violate these Terms.</p>

      <h4 style="${h}">4. Subscription and Billing</h4>
      <p style="${s}">Paid subscription plans are billed in advance on a recurring monthly or annual basis through our payment processor, Stripe. By subscribing to a paid plan, you authorize us to charge the applicable fees to your payment method on a recurring basis.</p>
      <p style="${s}margin-top:8px;">You may cancel your subscription at any time through your account settings. Upon cancellation, you will retain access to paid features until the end of your current billing period. No prorated refunds are provided for partial billing periods. Refunds for other circumstances are handled on a case-by-case basis at our discretion.</p>
      <p style="${s}margin-top:8px;">We reserve the right to change our pricing with 30 days written notice. Price changes will take effect at the start of your next billing cycle following the notice period.</p>

      <h4 style="${h}">5. Acceptable Use</h4>
      <p style="${s}">You agree not to:</p>
      <ul style="${s}margin-top:6px;padding-left:20px;">
        <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations</li>
        <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
        <li>Use automated tools to scrape, crawl, or extract data from the Service</li>
        <li>Interfere with or disrupt the Service or servers connected to the Service</li>
        <li>Upload malicious code, viruses, or harmful data to the Service</li>
        <li>Resell, sublicense, or redistribute access to the Service without authorization</li>
        <li>Use the Service to store or transmit content that infringes on intellectual property rights</li>
      </ul>

      <h4 style="${h}">6. Data Ownership</h4>
      <p style="${s}">You retain all rights, title, and interest in the data you enter into the Service ("Your Data"). We do not claim ownership of Your Data. You grant us a limited license to host, store, and process Your Data solely for the purpose of providing the Service to you.</p>
      <p style="${s}margin-top:8px;">You may export Your Data at any time through the Data Management section in Settings. Upon account termination, we will make Your Data available for export for a period of 30 days, after which it may be permanently deleted.</p>

      <h4 style="${h}">7. Intellectual Property</h4>
      <p style="${s}">The Service, including its design, features, code, and documentation, is owned by us and protected by intellectual property laws. These Terms do not grant you any rights to our trademarks, service marks, or branding.</p>

      <h4 style="${h}">8. Limitation of Liability</h4>
      <p style="${s}">The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
      <p style="${s}margin-top:8px;">To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities arising from your use of the Service, even if we have been advised of the possibility of such damages.</p>
      <p style="${s}margin-top:8px;">Our total aggregate liability arising from or relating to these Terms or the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim.</p>

      <h4 style="${h}">9. Termination</h4>
      <p style="${s}">You may cancel your account at any time. We may suspend or terminate your access to the Service at any time for violation of these Terms, with or without notice. Upon termination, your right to use the Service ceases immediately, though sections of these Terms that by their nature should survive termination will remain in effect.</p>

      <h4 style="${h}">10. Indemnification</h4>
      <p style="${s}">You agree to indemnify and hold us harmless from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.</p>

      <h4 style="${h}">11. Governing Law</h4>
      <p style="${s}">These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which our company is incorporated, without regard to conflict of law provisions.</p>

      <h4 style="${h}">12. Changes to Terms</h4>
      <p style="${s}">We reserve the right to modify these Terms at any time. We will provide notice of material changes by email or through the Service at least 30 days before changes take effect. Your continued use of the Service after the effective date of revised Terms constitutes your acceptance of those changes.</p>

      <h4 style="${h}">13. Contact</h4>
      <p style="${s}">If you have questions about these Terms, please contact us at:</p>
      <p style="${s}margin-top:8px;">Email: support@clearcostinventory.com<br>Or through the support channel in your account dashboard.</p>
    </div>
  `;
}

export function renderPrivacyPage() {
  const el = document.getElementById('page-privacy');
  if (!el) return;
  const s = 'font-size:0.88rem;color:var(--text-muted);line-height:1.6;';
  const h = 'margin:20px 0 8px;';
  el.innerHTML = `
    <div class="settings-section">
      <h2 style="margin-bottom:16px;">Privacy Policy</h2>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:4px;">Last updated: April 2026</p>
      <p style="color:var(--warning);font-size:0.8rem;margin-bottom:16px;font-style:italic;">This is a template and does not constitute legal advice. Please have this policy reviewed by a qualified attorney before launch.</p>

      <p style="${s}">This Privacy Policy describes how ClearCost Inventory ("we", "us", or "the Service") collects, uses, and protects your information when you use our platform.</p>

      <h4 style="${h}">1. Information We Collect</h4>
      <p style="${s}"><strong>Account Information:</strong> When you create an account, we collect your email address, business name, and optional profile details you choose to provide.</p>
      <p style="${s}margin-top:8px;"><strong>Business Data:</strong> The inventory, product, material, production, recipe, supplier, expense, and sales data you enter into the Service. This is your core business data and you retain full ownership of it.</p>
      <p style="${s}margin-top:8px;"><strong>Payment Information:</strong> If you subscribe to a paid plan, payment details are collected and processed directly by Stripe. We do not store your full credit card number on our servers.</p>
      <p style="${s}margin-top:8px;"><strong>Financial Integration Data:</strong> If you connect banking via Plaid or accounting via QuickBooks, we access the specific financial data needed to provide those features (account balances, transactions, chart of accounts). Access tokens are stored securely and encrypted.</p>
      <p style="${s}margin-top:8px;"><strong>Usage Data:</strong> We collect basic analytics data such as pages visited, features used, and general usage patterns to improve the Service. If analytics are enabled, this may be collected via Plausible Analytics (a privacy-focused, cookieless analytics platform).</p>

      <h4 style="${h}">2. How We Use Your Information</h4>
      <p style="${s}">We use the information we collect to:</p>
      <ul style="${s}margin-top:6px;padding-left:20px;">
        <li>Provide, maintain, and improve the Service</li>
        <li>Process subscription payments and manage billing</li>
        <li>Sync data with connected integrations (QuickBooks, sales channels)</li>
        <li>Send important account notifications (billing, security, service updates)</li>
        <li>Provide customer support</li>
        <li>Analyze usage patterns to improve features and user experience</li>
        <li>Detect and prevent fraud or abuse</li>
      </ul>
      <p style="${s}margin-top:8px;">We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>

      <h4 style="${h}">3. Third-Party Services</h4>
      <p style="${s}">We integrate with the following third-party services to provide functionality. Each has its own privacy policy governing how they handle data:</p>
      <ul style="${s}margin-top:6px;padding-left:20px;">
        <li><strong>Supabase</strong> — Database hosting and authentication. Your data is stored in Supabase-managed PostgreSQL databases with row-level security.</li>
        <li><strong>Stripe</strong> — Payment processing for subscriptions. Stripe handles all payment card data directly.</li>
        <li><strong>Plaid</strong> — Banking integration for linking financial accounts and retrieving transaction data.</li>
        <li><strong>Intuit QuickBooks</strong> — Accounting integration for syncing inventory and financial data.</li>
        <li><strong>Vercel</strong> — Application hosting and serverless function execution.</li>
        <li><strong>Etsy / Shopify</strong> — Sales channel integrations for syncing product and order data (when connected by you).</li>
      </ul>
      <p style="${s}margin-top:8px;">We only share the minimum data necessary for each integration to function. We do not share your data with services you have not connected.</p>

      <h4 style="${h}">4. Data Security</h4>
      <p style="${s}">We take the security of your data seriously and implement industry-standard measures to protect it:</p>
      <ul style="${s}margin-top:6px;padding-left:20px;">
        <li>All data is transmitted over HTTPS with TLS encryption</li>
        <li>Database access is protected by row-level security (RLS), ensuring each user can only access their own data</li>
        <li>Third-party access tokens (QuickBooks, Plaid, sales channels) are stored encrypted</li>
        <li>Authentication is handled through Supabase Auth with secure session management</li>
        <li>API endpoints are protected with authentication middleware</li>
      </ul>

      <h4 style="${h}">5. Data Retention</h4>
      <p style="${s}">We retain your data for as long as your account remains active. If you delete your account, we will permanently remove your data from our systems within 30 days, except where we are legally required to retain certain information.</p>
      <p style="${s}margin-top:8px;">Backups that may contain your data are retained for a limited period as part of our disaster recovery procedures and are automatically purged according to our backup retention schedule.</p>

      <h4 style="${h}">6. Your Rights</h4>
      <p style="${s}">You have the right to:</p>
      <ul style="${s}margin-top:6px;padding-left:20px;">
        <li><strong>Access</strong> your data at any time through the Service interface</li>
        <li><strong>Export</strong> all your data in JSON format through the Data Management section in Settings</li>
        <li><strong>Correct</strong> any inaccurate data through the Service</li>
        <li><strong>Delete</strong> your data or request complete account deletion by contacting support</li>
        <li><strong>Disconnect</strong> third-party integrations at any time, which revokes our access to those services</li>
      </ul>
      <p style="${s}margin-top:8px;">If you are located in the EU/EEA, you may also have additional rights under GDPR including the right to data portability and the right to lodge a complaint with a supervisory authority.</p>

      <h4 style="${h}">7. Cookies and Tracking</h4>
      <p style="${s}">We use minimal cookies, limited to essential session management for authentication. We do not use third-party advertising cookies or cross-site tracking. If Plausible Analytics is enabled, it operates without cookies and does not track individuals across sites.</p>

      <h4 style="${h}">8. Children's Privacy</h4>
      <p style="${s}">The Service is not intended for use by anyone under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it promptly.</p>

      <h4 style="${h}">9. International Data Transfers</h4>
      <p style="${s}">Your data may be processed and stored in data centers located outside your country of residence. By using the Service, you consent to the transfer of your data to these locations. We ensure that appropriate safeguards are in place for any international data transfers.</p>

      <h4 style="${h}">10. Changes to This Policy</h4>
      <p style="${s}">We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of material changes by email or through a notice in the Service at least 30 days before changes take effect. Your continued use after the effective date constitutes acceptance of the updated policy.</p>

      <h4 style="${h}">11. Contact</h4>
      <p style="${s}">If you have questions or concerns about this Privacy Policy or how your data is handled, please contact us at:</p>
      <p style="${s}margin-top:8px;">Email: privacy@clearcostinventory.com<br>Or through the support channel in your account dashboard.</p>
    </div>
  `;
}
