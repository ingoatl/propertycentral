import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
const Visits = lazy(() => import("./pages/Visits"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Admin = lazy(() => import("./pages/Admin"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PropertyOwners = lazy(() => import("./pages/PropertyOwners"));
const MonthlyCharges = lazy(() => import("./pages/MonthlyCharges"));
const Bookings = lazy(() => import("./pages/Bookings"));
const LeaveReview = lazy(() => import("./pages/LeaveReview"));
const PublicReview = lazy(() => import("./pages/PublicReview"));
const Documents = lazy(() => import("./pages/Documents"));
const Utilities = lazy(() => import("./pages/Utilities"));
const OwnerOnboarding = lazy(() => import("./pages/OwnerOnboarding"));
const NewSTROnboarding = lazy(() => import("./pages/NewSTROnboarding"));
const Inspect = lazy(() => import("./pages/Inspect"));
const InspectProperty = lazy(() => import("./pages/InspectProperty"));
const InspectionsList = lazy(() => import("./pages/InspectionsList"));
const InspectIssues = lazy(() => import("./pages/InspectIssues"));
const InspectSettings = lazy(() => import("./pages/InspectSettings"));
const JobApplication = lazy(() => import("./pages/JobApplication"));
const OwnerConversations = lazy(() => import("./pages/OwnerConversations"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Leads = lazy(() => import("./pages/Leads"));
const Communications = lazy(() => import("./pages/Communications"));
const BookDiscoveryCall = lazy(() => import("./pages/BookDiscoveryCall"));
const PaymentSetup = lazy(() => import("./pages/PaymentSetup"));

// Optimized QueryClient with caching and stale time
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/leave-review" element={<LeaveReview />} />
            <Route path="/review" element={<PublicReview />} />
            <Route path="/onboard/existing-str" element={<OwnerOnboarding />} />
            <Route path="/onboard/new-str" element={<NewSTROnboarding />} />
            {/* Mobile-first inspection app routes - outside Layout for full-screen mobile experience */}
            <Route path="/inspect" element={<Inspect />} />
            <Route path="/inspect/property/:inspectionId" element={<InspectProperty />} />
            <Route path="/inspect/list" element={<InspectionsList />} />
            <Route path="/inspect/issues" element={<InspectIssues />} />
            <Route path="/inspect/settings" element={<InspectSettings />} />
            {/* Public job application page */}
            <Route path="/careers/property-inspector" element={<JobApplication />} />
            <Route path="/book-discovery-call" element={<BookDiscoveryCall />} />
            <Route path="/payment-setup" element={<PaymentSetup />} />
            <Route path="/payment-success" element={<PaymentSetup />} />
            <Route path="*" element={
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/visits" element={<Visits />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/owners" element={<PropertyOwners />} />
                    <Route path="/charges" element={<MonthlyCharges />} />
                    <Route path="/mid-term-bookings" element={<Navigate to="/bookings" replace />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/utilities" element={<Utilities />} />
                    <Route path="/owner-conversations" element={<OwnerConversations />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/maintenance" element={<Maintenance />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/communications" element={<Communications />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
