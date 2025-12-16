import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Clock, FileCheck, Phone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export const NewSTRSuccessScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(25,100%,98%)] via-[hsl(30,100%,97%)] to-[hsl(20,100%,96%)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-28 h-28 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto animate-scale-in shadow-xl shadow-emerald-100">
              <CheckCircle className="w-14 h-14 text-emerald-600" />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-[hsl(25,95%,60%)] to-[hsl(20,90%,50%)] rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-orange-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[hsl(25,40%,25%)] to-[hsl(25,95%,40%)] bg-clip-text text-transparent">
            Welcome to PeachHaus!
          </h1>
          <p className="text-[hsl(25,20%,45%)] text-lg max-w-md mx-auto">
            Your new property onboarding form has been submitted successfully. We're excited to help you launch!
          </p>
        </div>

        {/* What's Next */}
        <Card className="bg-white rounded-3xl shadow-xl shadow-[hsl(25,30%,85%)]/30 border border-[hsl(25,30%,94%)] overflow-hidden">
          <CardContent className="pt-8 pb-8 px-8">
            <h2 className="font-semibold text-xl mb-6 text-[hsl(25,40%,25%)]">What Happens Next?</h2>
            <div className="space-y-6">
              <div className="flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(25,100%,95%)] to-[hsl(25,90%,90%)] flex items-center justify-center shadow-sm">
                    <FileCheck className="w-6 h-6 text-[hsl(25,95%,50%)]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-[hsl(25,40%,30%)]">Review Your Submission</h3>
                  <p className="text-sm text-[hsl(25,20%,50%)] mt-1">
                    Our team will review your property information within 24-48 hours.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(25,100%,95%)] to-[hsl(25,90%,90%)] flex items-center justify-center shadow-sm">
                    <Phone className="w-6 h-6 text-[hsl(25,95%,50%)]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-[hsl(25,40%,30%)]">Onboarding Call</h3>
                  <p className="text-sm text-[hsl(25,20%,50%)] mt-1">
                    We'll schedule a call to discuss your property, answer questions, and plan next steps.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(25,100%,95%)] to-[hsl(25,90%,90%)] flex items-center justify-center shadow-sm">
                    <Clock className="w-6 h-6 text-[hsl(25,95%,50%)]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-[hsl(25,40%,30%)]">Setup & Launch</h3>
                  <p className="text-sm text-[hsl(25,20%,50%)] mt-1">
                    Based on your setup status, we'll create a customized launch timeline for your property.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="bg-gradient-to-r from-[hsl(25,100%,97%)] to-[hsl(30,100%,96%)] rounded-2xl border border-[hsl(25,50%,90%)]">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-[hsl(25,30%,40%)]">
              Questions? Reach out to us at{' '}
              <a href="mailto:info@peachhausgroup.com" className="font-semibold text-[hsl(25,95%,45%)] hover:underline">
                info@peachhausgroup.com
              </a>
              {' '}or call{' '}
              <a href="tel:+17709065022" className="font-semibold text-[hsl(25,95%,45%)] hover:underline">
                (770) 906-5022
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link to="/">
            <Button 
              variant="outline" 
              className="gap-2 h-12 px-8 rounded-xl border-2 border-[hsl(25,50%,80%)] hover:bg-white hover:border-[hsl(25,60%,70%)] text-[hsl(25,40%,35%)] transition-all duration-200"
            >
              Return to Homepage
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
