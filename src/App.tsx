import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
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
import MidTermBookings from "./pages/MidTermBookings";
import Bookings from "./pages/Bookings";
import LeaveReview from "./pages/LeaveReview";
import PublicReview from "./pages/PublicReview";
import Documents from "./pages/Documents";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/leave-review" element={<LeaveReview />} />
            <Route path="/review" element={<PublicReview />} />
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/properties" element={<Layout><Properties /></Layout>} />
            <Route path="/visits" element={<Layout><Visits /></Layout>} />
            <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
            <Route path="/admin" element={<Layout><Admin /></Layout>} />
            <Route path="/owners" element={<Layout><PropertyOwners /></Layout>} />
            <Route path="/charges" element={<Layout><MonthlyCharges /></Layout>} />
            <Route path="/mid-term-bookings" element={<Layout><MidTermBookings /></Layout>} />
            <Route path="/bookings" element={<Layout><Bookings /></Layout>} />
            <Route path="/documents" element={<Layout><Documents /></Layout>} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
