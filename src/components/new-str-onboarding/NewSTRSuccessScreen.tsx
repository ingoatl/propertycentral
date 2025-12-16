import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Clock, FileCheck, Phone } from "lucide-react";
import { Link } from "react-router-dom";

export const NewSTRSuccessScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-scale-in">
              <CheckCircle className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center animate-bounce">
              <span className="text-primary-foreground text-lg">🎉</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to PeachHaus!
          </h1>
          <p className="text-muted-foreground text-lg">
            Your new property onboarding form has been submitted successfully.
          </p>
        </div>

        {/* What's Next */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-lg mb-4">What Happens Next?</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Review Your Submission</h3>
                  <p className="text-sm text-muted-foreground">
                    Our team will review your property information within 24-48 hours.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Onboarding Call</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll schedule a call to discuss your property, answer questions, and plan next steps.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Setup & Launch</h3>
                  <p className="text-sm text-muted-foreground">
                    Based on your setup status, we'll create a customized launch timeline for your property.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Questions? Reach out to us at{' '}
              <a href="mailto:info@peachhausgroup.com" className="text-primary hover:underline">
                info@peachhausgroup.com
              </a>
              {' '}or call{' '}
              <a href="tel:+17709065022" className="text-primary hover:underline">
                (770) 906-5022
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link to="/">
            <Button variant="outline" className="gap-2">
              Return to Homepage
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
