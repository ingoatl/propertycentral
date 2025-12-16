import { Check, Clock, Phone } from 'lucide-react';

export function OnboardingSuccessScreen() {
  return (
    <div className="min-h-screen bg-[hsl(25,100%,98%)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Animated Checkmark */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <Check className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Thank you — your onboarding is complete.
        </h1>
        
        <p className="text-gray-600 mb-8">
          Our team will review and confirm setup. If anything's missing, we'll reach out within one business day.
        </p>

        {/* Status Indicators */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-green-700 font-medium">Form Submitted</span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-amber-700 font-medium">Under Review</span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-blue-700 font-medium">Contact if Needed</span>
          </div>
        </div>

        <a
          href="https://peachhausgroup.com"
          className="inline-block w-full px-6 py-3 bg-[hsl(25,95%,65%)] text-white rounded-xl font-medium hover:bg-[hsl(25,95%,55%)] transition-all"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}
