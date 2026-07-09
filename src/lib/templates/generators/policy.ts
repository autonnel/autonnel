import type { Data } from '@puckeditor/core';

export const policyTemplate = (): Data => {
  // RichTextBlock renders `content` as HTML (dangerouslySetInnerHTML), so this must be markup, not markdown.
  const defaultPolicyContent = `<h2>Introduction</h2>
<p>Welcome to our Privacy Policy. Your privacy is critically important to us.</p>
<p>We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us.</p>
<h2>Information We Collect</h2>
<p>We collect personal information that you voluntarily provide to us when you:</p>
<ul>
<li>Register on our website</li>
<li>Express an interest in obtaining information about us or our products</li>
<li>Participate in activities on our website</li>
<li>Contact us</li>
</ul>
<h3>Personal Information Provided by You</h3>
<p>The personal information we collect depends on the context of your interactions with us and the website, the choices you make, and the products and features you use. The personal information we collect may include:</p>
<ul>
<li><strong>Name and Contact Data</strong> — We collect your first and last name, email address, postal address, phone number, and other similar contact data.</li>
<li><strong>Payment Data</strong> — We collect data necessary to process your payment if you make purchases, such as your payment instrument number and the security code associated with your payment instrument.</li>
</ul>
<h2>How We Use Your Information</h2>
<p>We use personal information collected via our website for a variety of business purposes:</p>
<ol>
<li>To facilitate account creation and logon process</li>
<li>To send you marketing and promotional communications</li>
<li>To respond to your inquiries and solve problems</li>
<li>To send administrative information to you</li>
<li>To protect our services</li>
</ol>
<h2>Your Privacy Rights</h2>
<p>Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information.</p>
<h3>Right to Access</h3>
<p>You have the right to request access to your personal information.</p>
<h3>Right to Rectification</h3>
<p>You have the right to request that we correct any information you believe is inaccurate.</p>
<h3>Right to Erasure</h3>
<p>You have the right to request that we erase your personal data, under certain conditions.</p>
<h2>Contact Us</h2>
<p>If you have questions or comments about this policy, you may email us at <strong>support@example.com</strong>.</p>
<hr />
<p><em>Thank you for trusting us with your information.</em></p>`;

  return {
    root: { props: { maxWidth: '960' }  as any },
    content: [
      {
        type: 'RichTextBlock',
        props: {
          id: 'policy-content-1',
          title: 'Privacy Policy',
          titleAlignment: 'center',
          lastUpdated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          content: defaultPolicyContent,
          maxWidth: '800px',
          backgroundColor: '#ffffff',
          textColor: '#374151',
          padding: '48px 24px',
        },
      },
      {
        type: 'PageFooter',
        props: {
          id: 'footer-1',
          theme: 'compact',
          brandName: { text: 'Your Brand', color: '#ffffff', fontSize: 18 },
          backgroundColor: '#1e293b',
          showNav: true,
          showAbout: false,
          showLogo: false,
          showCopyright: true,
          showSocial: false,
          links: [
            { label: { text: 'Home', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/' } },
            { label: { text: 'Privacy', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/privacy' } },
            { label: { text: 'Terms', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/terms' } },
          ],
          copyright: { text: '© 2026 Your Brand. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
          padding: 32,
          fullWidth: true,
        },
      },
    ],
    zones: {},
  };
};
