import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const LOADING_STEPS = [
  "Authenticating session",
  "Loading property data",
  "Fetching performance metrics",
  "Loading bookings & guests",
  "Preparing your dashboard",
];

export function PremiumLoadingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          setCompletedSteps((c) => [...c, prev]);
          return prev + 1;
        }
        return prev;
      });
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 text-center p-8 max-w-sm"
      >
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="relative"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-2xl">
            <img 
              src="/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="w-16 h-auto object-contain filter brightness-0 invert"
            />
          </div>
          
          {/* Animated ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-[28px] border-2 border-primary/20 border-t-primary"
          />
        </motion.div>
        
        <div className="space-y-2">
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold"
          >
            Owner Portal
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground"
          >
            Preparing your personalized dashboard
          </motion.p>
        </div>
        
        {/* Progress Steps */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full space-y-3"
        >
          {LOADING_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = currentStep === index;
            
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className={`flex items-center gap-3 text-sm ${
                  isCompleted 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : isCurrent 
                      ? "text-primary font-medium" 
                      : "text-muted-foreground/50"
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    >
                      <Check className="h-4 w-4" />
                    </motion.div>
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span>{step}</span>
              </motion.div>
            );
          })}
        </motion.div>
        
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
