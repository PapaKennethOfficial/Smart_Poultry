import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Leaf } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif', color: '#333' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
        <Link to="/" style={{ color: '#237227', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
          <ArrowLeft size={18} />
          Back
        </Link>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,170,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={16} color="#FFAA00" />
          </div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: '#0d1f0e' }}>
            Smart<span style={{ color: '#237227' }}>Poultry</span>
          </span>
        </div>
      </div>

      <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2.5rem', marginBottom: '10px', color: '#0d1f0e' }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>

      <div style={{ lineHeight: '1.8', fontSize: '1.05rem', color: '#444' }}>
        <p style={{ marginBottom: '20px' }}>Smart Poultry ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Smart Poultry platform, including our website and mobile applications.</p>
        
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>1. Data Collection</h2>
        <p style={{ marginBottom: '15px' }}>We collect several types of information from and about users of our platform:</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Contact Information:</strong> Name, email address, phone number, and physical address.</li>
          <li style={{ marginBottom: '10px' }}><strong>Vehicle Details:</strong> For delivery staff, we collect vehicle registration numbers, insurance details, and make/model information.</li>
          <li style={{ marginBottom: '10px' }}><strong>Transactional Data:</strong> Details about payments to and from you, including payment method (processed securely via third-party providers) and order history.</li>
          <li style={{ marginBottom: '10px' }}><strong>Location Data:</strong> Delivery routes, drop-off locations, and farm location data.</li>
          <li style={{ marginBottom: '10px' }}><strong>Device and Usage Data:</strong> IP addresses, browser types, interaction logs, and device identifiers.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>2. Data Usage</h2>
        <p style={{ marginBottom: '15px' }}>We use the information we collect to:</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li>Process your orders and manage farm operations.</li>
          <li>Manage deliveries and optimize logistics.</li>
          <li>Secure user accounts and verify identities (e.g., Two-Factor Authentication).</li>
          <li>Provide customer support and respond to inquiries.</li>
          <li>Enforce our Terms and Conditions.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>3. AI & Machine Learning Data Processing</h2>
        <p style={{ marginBottom: '15px' }}>Smart Poultry utilizes Artificial Intelligence (AI) and Machine Learning (ML) to enhance our platform's capabilities and provide actionable business insights.</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Data Ingestion:</strong> Platform data—including sales volumes, order amounts, frequencies, and delivery routes—will be ingested by our proprietary or third-party ML algorithms.</li>
          <li style={{ marginBottom: '10px' }}><strong>Business Intelligence:</strong> This data is used to generate predictive models (e.g., forecasting seasonal demand spikes, predicting egg yield), real-time graphical charts, and dashboards for stakeholders.</li>
          <li style={{ marginBottom: '10px' }}><strong>Anonymization:</strong> Personally Identifiable Information (PII) is strictly anonymized or aggregated where appropriate before being used for large-scale AI model training or predictive analytics.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>4. Data Sharing</h2>
        <p style={{ marginBottom: '15px' }}>We may share your data under the following circumstances:</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Third-Party Service Providers:</strong> With SMS providers (for notifications), payment gateways (for transaction processing), and cloud AI providers (for running machine learning models).</li>
          <li style={{ marginBottom: '10px' }}><strong>Legal Obligations:</strong> If required to do so by law or in response to valid requests by public authorities.</li>
          <li style={{ marginBottom: '10px' }}><strong>Business Transfers:</strong> In connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>5. Security</h2>
        <p style={{ marginBottom: '15px' }}>We implement robust security measures to protect your data:</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Role-Based Access Control (RBAC):</strong> Ensuring that only authorized personnel have access to sensitive information.</li>
          <li style={{ marginBottom: '10px' }}><strong>Audit Trails:</strong> Monitoring and logging interactions within the platform to prevent and detect unauthorized access.</li>
          <li style={{ marginBottom: '10px' }}><strong>Encryption:</strong> Utilizing industry-standard encryption protocols for data in transit and at rest.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>6. User Rights</h2>
        <p style={{ marginBottom: '15px' }}>You have the right to:</p>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong>Access Your Data:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Request correction of any inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> Request the deletion of your personal data, subject to certain legal and operational exceptions.</li>
        </ul>
        <p style={{ marginBottom: '40px' }}>To exercise these rights, please contact us via the support section in your Account Settings.</p>
      </div>
    </div>
  );
}
