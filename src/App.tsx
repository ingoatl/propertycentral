import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
