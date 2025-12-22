import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Visits from "./pages/Visits";
import Expenses from "./pages/Expenses";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PropertyOwners from "./pages/PropertyOwners";
import MonthlyCharges from "./pages/MonthlyCharges";
import { Navigate } from "react-router-dom";
import Bookings from "./pages/Bookings";
import LeaveReview from "./pages/LeaveReview";
import PublicReview from "./pages/PublicReview";
import Documents from "./pages/Documents";
import Utilities from "./pages/Utilities";
import OwnerOnboarding from "./pages/OwnerOnboarding";
import NewSTROnboarding from "./pages/NewSTROnboarding";
import Inspect from "./pages/Inspect";
import InspectProperty from "./pages/InspectProperty";
import InspectionsList from "./pages/InspectionsList";
import InspectIssues from "./pages/InspectIssues";
import InspectSettings from "./pages/InspectSettings";
import JobApplication from "./pages/JobApplication";
import OwnerConversations from "./pages/OwnerConversations";
import Vendors from "./pages/Vendors";
import Maintenance from "./pages/Maintenance";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="*" element={
            <Layout>
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
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
