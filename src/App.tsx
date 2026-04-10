import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { MarketingLayout } from "@/components/MarketingLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import MenuBuilder from "@/pages/MenuBuilder";
import AIStudioRedirect from "@/pages/AIStudioRedirect";
import GuestPreview from "@/pages/GuestPreview";
import QRCodes from "@/pages/QRCodes";
import Billing from "@/pages/Billing";
import Settings from "@/pages/Settings";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/NotFound";
import InviteOnly from "@/pages/InviteOnly";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Marketing pages — public, no auth required */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/preise" element={<Pricing />} />
          </Route>

          {/* Standalone public pages */}
          <Route path="/setup" element={<Onboarding />} />
          <Route path="/invite-only" element={<InviteOnly />} />
          <Route path="/guest" element={<GuestPreview standalone />} />

          {/* App pages — require authentication */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/menu" element={<MenuBuilder />} />
            <Route path="/ai-studio" element={<AIStudioRedirect />} />
            <Route path="/preview" element={<GuestPreview />} />
            <Route path="/qr-codes" element={<QRCodes />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
