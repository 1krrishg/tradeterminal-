import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import BiltyPage from "./pages/BiltyPage";
import ReportPage from "./pages/ReportPage";
import NotFound from "./pages/NotFound";
import AuthPage from "@/pages/AuthPage";
import ChatPage from "@/pages/ChatPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/bilty" element={<BiltyPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
