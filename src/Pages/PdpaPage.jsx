import React from 'react';
import Card from '../components/ui/Card';

export default function PdpaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-2xl w-full p-8 text-left shadow-2xl rounded-3xl">
        <h1 className="text-2xl font-bold mb-4">PDPA Data Privacy Policy</h1>
        <p className="mb-4">This PDPA Data Privacy Policy is adapted from Googles Privacy Policy for our insurance chatbot platform. We are committed to protecting your personal information and privacy.</p>
        <ul className="list-disc pl-6 mb-4">
          <li>We collect information to provide and improve our services.</li>
          <li>Your information is protected and only shared with your consent or as required by law.</li>
          <li>You have control over your data, including options to review, update, export, or delete your information.</li>
          <li>We use strong security measures to protect your data.</li>
          <li>For more details, see our full policy or contact support.</li>
        </ul>
        <p className="mb-2">For the full official Google Privacy Policy, visit <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Google Privacy Policy</a>.</p>
      </Card>
    </div>
  );
}
