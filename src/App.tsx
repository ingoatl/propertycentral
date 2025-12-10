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
import MidTermBookings from "./pages/MidTermBookings";
import Bookings from "./pages/Bookings";
import LeaveReview from "./pages/LeaveReview";
import PublicReview from "./pages/PublicReview";
import Documents from "./pages/Documents";
import Utilities from "./pages/Utilities";

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
                <Route path="/mid-term-bookings" element={<MidTermBookings />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/utilities" element={<Utilities />} />
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
