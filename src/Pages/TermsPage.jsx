import React from 'react';
import Card from '../components/ui/Card';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-2xl w-full p-8 text-left shadow-2xl rounded-3xl">
        <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
        <p className="mb-4">These Terms of Service are based on Googles official policy, adapted for our insurance chatbot platform. By using our services, you agree to the following terms:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>We provide a range of services to simplify your insurance lifecycle.</li>
          <li>You must comply with applicable laws and respect the rights of others.</li>
          <li>Do not abuse, harm, or disrupt our services or systems.</li>
          <li>Your content remains yours, but you grant us permission to use it for operating and improving the service.</li>
          <li>We may update these terms as needed; you will be notified of material changes.</li>
          <li>For more details, see our full policy or contact support.</li>
        </ul>
        <p className="mb-2">For the full official Google Terms, visit <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Google Terms of Service</a>.</p>
      </Card>
    </div>
  );
}
