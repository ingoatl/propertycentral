import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
// Auto-upload headshot to storage on app load
import "@/lib/uploadHeadshotToSupabase";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryErrorResetBoundary } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
const OwnerPaymentSetup = lazy(() => import("./pages/OwnerPaymentSetup"));
const OwnerPaymentSuccess = lazy(() => import("./pages/OwnerPaymentSuccess"));
const AuditPortal = lazy(() => import("./pages/AuditPortal"));
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const OwnerW9Upload = lazy(() => import("./pages/owner/OwnerW9Upload"));
const OwnerPortalManagement = lazy(() => import("./pages/OwnerPortalManagement"));
const SignDocument = lazy(() => import("./pages/SignDocument"));
const BookInspection = lazy(() => import("./pages/BookInspection"));
const LeadPaymentSetup = lazy(() => import("./pages/LeadPaymentSetup"));
const LeadPaymentSuccess = lazy(() => import("./pages/LeadPaymentSuccess"));
const OnboardingPresentation = lazy(() => import("./pages/OnboardingPresentation"));
const DesignerPresentation = lazy(() => import("./pages/DesignerPresentation"));
const RescheduleCall = lazy(() => import("./pages/RescheduleCall"));
const VoicemailPlayer = lazy(() => import("./pages/VoicemailPlayer"));
const RecapPlayer = lazy(() => import("./pages/RecapPlayer"));
const VendorJobPortal = lazy(() => import("./pages/VendorJobPortal"));
const VendorW9Upload = lazy(() => import("./pages/VendorW9Upload"));
const TeamHub = lazy(() => import("./pages/TeamHub"));
const TeamHubInvite = lazy(() => import("./pages/TeamHubInvite"));
const Tax1099 = lazy(() => import("./pages/Tax1099"));
const BookOwnerCall = lazy(() => import("./pages/BookOwnerCall"));
const VendorQuote = lazy(() => import("./pages/VendorQuote"));
const OwnerPortalPresentation = lazy(() => import("./pages/OwnerPortalPresentation"));

// QueryClient configured with aggressive caching for speed
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes - data stays fresh longer
      gcTime: 1000 * 60 * 60, // 1 hour cache retention
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      networkMode: 'offlineFirst', // Use cache first, then network
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Minimal loading skeleton for faster perceived load
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

// Branded loading for signing pages
const SigningLoader = () => (
  <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
    <div className="text-center">
      <img 
        src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
        alt="PeachHaus" 
        className="h-16 mx-auto mb-4"
      />
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#fae052] border-t-transparent mx-auto mb-3"></div>
      <p className="text-white/80 text-sm">Loading your document...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onError={() => reset()}>
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
                    <Route path="/book-owner-call" element={<BookOwnerCall />} />
                    <Route path="/book-inspection" element={<BookInspection />} />
                    <Route path="/payment-setup" element={<PaymentSetup />} />
                    <Route path="/payment-success" element={<PaymentSetup />} />
                    <Route path="/owner-payment-setup" element={<OwnerPaymentSetup />} />
                    <Route path="/owner-payment-success" element={<OwnerPaymentSuccess />} />
                    <Route path="/audit/:token" element={<AuditPortal />} />
                    <Route path="/owner" element={<OwnerDashboard />} />
                    <Route path="/owner/w9-upload" element={<OwnerW9Upload />} />
                    <Route path="/lead-payment-setup" element={<LeadPaymentSetup />} />
                    <Route path="/lead-payment-success" element={<LeadPaymentSuccess />} />
                    <Route path="/sign/:token" element={<Suspense fallback={<SigningLoader />}><SignDocument /></Suspense>} />
                    <Route path="/onboarding-presentation" element={<OnboardingPresentation />} />
                    <Route path="/p/onboarding" element={<OnboardingPresentation />} />
                    <Route path="/designer-presentation" element={<DesignerPresentation />} />
                    <Route path="/p/designer" element={<DesignerPresentation />} />
                    <Route path="/reschedule/:callId" element={<RescheduleCall />} />
                    <Route path="/vm/:token" element={<VoicemailPlayer />} />
                    <Route path="/recap/:token" element={<RecapPlayer />} />
                    <Route path="/recap" element={<RecapPlayer />} />
                    <Route path="/vendor-job/:token" element={<VendorJobPortal />} />
                    <Route path="/vendor-quote/:requestId" element={<VendorQuote />} />
                    <Route path="/vendor/w9-upload" element={<VendorW9Upload />} />
                    <Route path="/owner-portal-presentation" element={<OwnerPortalPresentation />} />
                    <Route path="/p/owner-portal" element={<OwnerPortalPresentation />} />
                    <Route path="*" element={
                      <ErrorBoundary>
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
                              <Route path="/owner-portal-management" element={<OwnerPortalManagement />} />
                              <Route path="/vendors" element={<Vendors />} />
                              <Route path="/maintenance" element={<Maintenance />} />
                              <Route path="/leads" element={<Leads />} />
                              <Route path="/communications" element={<Communications />} />
                              <Route path="/team-hub" element={<TeamHub />} />
                              <Route path="/team-hub/invite/:token" element={<TeamHubInvite />} />
                              <Route path="/tax-1099" element={<Tax1099 />} />
                              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </Layout>
                      </ErrorBoundary>
                    } />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
