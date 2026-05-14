import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CandidateAssessment from "./pages/CandidateAssessment";
import AssessmentPortalRouter from "./components/assessment-portal/AssessmentPortalRouter";
import CareersPage from "./pages/CareersPage";
import CandidateBGVUpload from "./pages/CandidateBGVUpload";
import ReferenceVerification from "./pages/ReferenceVerification";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/assessment/*" element={<AssessmentPortalRouter />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/bgv-upload/:token" element={<CandidateBGVUpload />} />
          <Route path="/bgv-verify/:token" element={<ReferenceVerification />} />
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
