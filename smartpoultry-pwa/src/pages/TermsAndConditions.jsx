import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Leaf } from 'lucide-react';

export default function TermsAndConditions() {
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

      <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2.5rem', marginBottom: '10px', color: '#0d1f0e' }}>Terms & Conditions</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>

      <div style={{ lineHeight: '1.8', fontSize: '1.05rem', color: '#444' }}>
        <p style={{ marginBottom: '20px' }}>Please read these Terms and Conditions carefully before using the Smart Poultry platform.</p>
        
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: '20px' }}>By accessing or using our platform, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.</p>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>2. Account Responsibilities</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Account Security:</strong> Users are responsible for maintaining the confidentiality of their account credentials, including Two-Factor Authentication (2FA) where applicable.</li>
          <li style={{ marginBottom: '10px' }}><strong>Account Sharing:</strong> Accounts are strictly strictly for individual use. Sharing account access with unauthorized individuals is prohibited and may result in account termination.</li>
          <li style={{ marginBottom: '10px' }}><strong>Accurate Information:</strong> You agree to provide true, accurate, current, and complete information during registration.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>3. Purchases & Refunds</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Orders:</strong> All orders for poultry products are subject to availability and confirmation of the order price.</li>
          <li style={{ marginBottom: '10px' }}><strong>Cancellations:</strong> Orders may only be cancelled within a specified timeframe before dispatch. Once dispatched, cancellations are not permitted.</li>
          <li style={{ marginBottom: '10px' }}><strong>Refunds and Disputes:</strong> In the event of damaged goods or delivery discrepancies, disputes must be logged within 24 hours of delivery. Refunds are issued at the sole discretion of Smart Poultry management after an investigation.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>4. Delivery Staff Conduct</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Vehicle Verification:</strong> Delivery personnel must ensure their registered vehicle details remain accurate and up-to-date.</li>
          <li style={{ marginBottom: '10px' }}><strong>Conduct During Transit:</strong> Delivery staff are expected to handle products with care, adhere to assigned routes, and maintain professional conduct with customers.</li>
          <li style={{ marginBottom: '10px' }}><strong>Liability:</strong> Delivery personnel hold responsibility for the secure and timely transit of goods assigned to them.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>5. AI Analytics Consent</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Data Contribution:</strong> By interacting with the platform, conducting transactions, and utilizing our services, users and staff acknowledge that their data contributes to our business intelligence ecosystems.</li>
          <li style={{ marginBottom: '10px' }}><strong>Forecasting Engines:</strong> Your interactions help train our AI-driven forecasting engines and predictive models to optimize supply chain, inventory, and delivery routes.</li>
          <li style={{ marginBottom: '10px' }}><strong>Consent:</strong> You explicitly consent to the use of your anonymized data for these analytical and machine-learning purposes.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>6. Intellectual Property</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Ownership:</strong> The Smart Poultry platform, including its original content, features, software, branding, and proprietary AI algorithms and insights, are and will remain the exclusive property of Smart Poultry and its licensors.</li>
          <li style={{ marginBottom: '10px' }}><strong>Restrictions:</strong> Users may not reverse-engineer, copy, or distribute any part of the platform's code or proprietary models.</li>
        </ul>

        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px', color: '#0d1f0e' }}>7. Limitation of Liability</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '40px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Service Interruptions:</strong> Smart Poultry shall not be liable for any unforeseen delivery delays, platform downtime, or temporary inability to access the service.</li>
          <li style={{ marginBottom: '10px' }}><strong>AI-Generated Inaccuracies:</strong> The platform utilizes AI to provide recommendations and forecasts. Smart Poultry holds no liability to customers or stakeholders for business losses resulting from AI-generated inaccuracies (e.g., if an AI recommendation results in a stock shortage or routing delay). Recommendations are provided for guidance purposes only.</li>
        </ul>
      </div>
    </div>
  );
}
