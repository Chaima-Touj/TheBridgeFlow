import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { initGA, trackPageView, trackPageVisit } from "./utils/analytics.js";
import { useAuth } from "./context/AuthContext.jsx";
import CustomCursor from "./components/common/CustomCursor.jsx";
import ScrollToTop from "./components/common/ScrollToTop.jsx";
import Loader from "./components/common/Loader.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import Login    from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import StudentDashboard from "./pages/dashboard/StudentDashboard.jsx";
import OffersList  from "./pages/offers/OffersList.jsx";
import OfferDetail from "./pages/offers/OfferDetail.jsx";
import ApplyOffer  from "./pages/offers/ApplyOffer.jsx";
import MyApplications from "./pages/applications/MyApplications.jsx";
import Interviews from "./pages/interviews/Interviews.jsx";
import Profile from "./pages/dashboard/Profile.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import AIAssistant        from "./pages/ai/AIAssistant.jsx";
import Settings           from "./pages/settings/Settings.jsx";
import NotificationsPage  from "./pages/notifications/NotificationsPage.jsx";
import MessagingPage      from "./pages/messages/MessagingPage.jsx";
import FormationsPage           from "./pages/FormationsPage";
import FormationDetail          from "./pages/FormationDetail";
import OffersPage               from "./pages/OffersPage";
import PublicOfferDetail        from "./pages/PublicOfferDetail";
import BlogPage                 from "./pages/BlogPage.jsx";
import PricingPage              from "./pages/PricingPage.jsx";
import PrivacyPolicy            from "./pages/legal/PrivacyPolicy.jsx";
import TermsOfUse               from "./pages/legal/TermsOfUse.jsx";
import LegalNotice              from "./pages/legal/LegalNotice.jsx";
import GuidesPage                from "./pages/legal/GuidesPage.jsx";
import HelpPage                 from "./pages/legal/HelpPage.jsx";
import NotFound                 from "./pages/NotFound.jsx";
import CeremonyPage             from "./pages/CeremonyPage.jsx";
import CeremonyProjectDetail    from "./pages/CeremonyProjectDetail.jsx";
import CeremonyArchives         from "./pages/CeremonyArchives.jsx";
import CeremonyArchiveDetail    from "./pages/CeremonyArchiveDetail.jsx";
import MyCeremonyProjects       from "./pages/dashboard/MyCeremonyProjects.jsx";
import DashboardFormations      from "./pages/dashboard/DashboardFormations.jsx";
import DashboardFormationDetail from "./pages/dashboard/DashboardFormationDetail.jsx";
import MesDemandes              from "./pages/dashboard/MesDemandes.jsx";
import AdminDashboard           from "./pages/dashboard/AdminDashboard.jsx";
import AdminFormations          from "./pages/dashboard/AdminFormations.jsx";
import AdminOffers              from "./pages/dashboard/AdminOffers.jsx";
import AdminNews                from "./pages/dashboard/AdminNews.jsx";
import AdminCeremony            from "./pages/dashboard/AdminCeremony.jsx";
import AdminFeedbacks           from "./pages/dashboard/AdminFeedbacks.jsx";
import AdminUsers               from "./pages/dashboard/AdminUsers.jsx";
import AdminApplications        from "./pages/dashboard/AdminApplications.jsx";
import AdminEnrollmentRequests  from "./pages/dashboard/AdminEnrollmentRequests.jsx";
import AdminEnrollments         from "./pages/dashboard/AdminEnrollments.jsx";
import AdminStatistics          from "./pages/dashboard/AdminStatistics.jsx";
import AdminProfile             from "./pages/dashboard/AdminProfile.jsx";
import AdminSettings            from "./pages/dashboard/AdminSettings.jsx";



function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}><Loader size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  // Initialisation GA4 — une seule fois au montage
  useEffect(() => {
    initGA();
  }, []);

  // Tracking de page à chaque changement de route
  useEffect(() => {
    trackPageView(location.pathname);
    trackPageVisit(location.pathname);
  }, [location.pathname]);

  return (
    <>
    <ScrollToTop />
    <CustomCursor />
    <Routes>
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/dashboard/student" element={
        <ProtectedRoute><StudentDashboard/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/offers" element={
        <ProtectedRoute><OffersList/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/offers/:id" element={
        <ProtectedRoute><OfferDetail/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/offers/:id/apply" element={
        <ProtectedRoute><ApplyOffer/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/applications" element={
        <ProtectedRoute><MyApplications/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/interviews" element={
        <ProtectedRoute><Interviews/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/profile" element={
        <ProtectedRoute><Profile/></ProtectedRoute>
      }/>
      <Route path="/verify-email" element={<VerifyEmail/>}/>
<Route path="/verify-email/:email" element={<VerifyEmail/>}/>
      <Route path="/dashboard/student/ai-assistant" element={
        <ProtectedRoute><AIAssistant/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/notifications" element={
        <ProtectedRoute><NotificationsPage/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/messages" element={
        <ProtectedRoute><MessagingPage/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/settings" element={
        <ProtectedRoute><Settings/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/formations" element={
        <ProtectedRoute><DashboardFormations/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/formations/:slug" element={
        <ProtectedRoute><DashboardFormationDetail/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/demandes" element={
        <ProtectedRoute><MesDemandes/></ProtectedRoute>
      }/>
      <Route path="/dashboard/student/ceremonie" element={
        <ProtectedRoute><MyCeremonyProjects/></ProtectedRoute>
      }/>

      <Route path="/dashboard/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/users" element={
        <ProtectedRoute role="admin"><AdminUsers/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/formations" element={
        <ProtectedRoute role="admin"><AdminFormations/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/offers" element={
        <ProtectedRoute role="admin"><AdminOffers/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/news" element={
        <ProtectedRoute role="admin"><AdminNews/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/ceremonie" element={
        <ProtectedRoute role="admin"><AdminCeremony/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/feedbacks" element={
        <ProtectedRoute role="admin"><AdminFeedbacks/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/messages" element={
        <ProtectedRoute role="admin"><MessagingPage/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/notifications" element={
        <ProtectedRoute role="admin"><NotificationsPage/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/candidatures" element={
        <ProtectedRoute role="admin"><AdminApplications/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/demandes" element={
        <ProtectedRoute role="admin"><AdminEnrollmentRequests/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/inscriptions" element={
        <ProtectedRoute role="admin"><AdminEnrollments/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/stats" element={
        <ProtectedRoute role="admin"><AdminStatistics/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/settings" element={
        <ProtectedRoute role="admin"><AdminSettings/></ProtectedRoute>
      }/>
      <Route path="/dashboard/admin/profile" element={
        <ProtectedRoute role="admin"><AdminProfile/></ProtectedRoute>
      }/>

      <Route path="/formations"        element={<FormationsPage />} />
      <Route path="/formations/:slug"  element={<FormationDetail />} />
      <Route path="/offers"            element={<OffersPage />} />
      <Route path="/offers/:id"        element={<PublicOfferDetail />} />

      <Route path="/ceremonie"                    element={<CeremonyPage />} />
      <Route path="/ceremonie/archives"           element={<CeremonyArchives />} />
      <Route path="/ceremonie/archives/:edition"  element={<CeremonyArchiveDetail />} />
      <Route path="/ceremonie/:id"     element={<CeremonyProjectDetail />} />

      <Route path="/blog"                 element={<BlogPage />} />
      <Route path="/tarifs"               element={<PricingPage />} />
      <Route path="/guides"               element={<GuidesPage />} />
      <Route path="/aide"                 element={<HelpPage />} />
      <Route path="/mentions-legales"     element={<LegalNotice />} />
      <Route path="/confidentialite"      element={<PrivacyPolicy />} />
      {/* CGU et Conditions pointent vers la même page pour éviter le doublon */}
      <Route path="/cgu"                  element={<TermsOfUse />} />
      <Route path="/conditions"           element={<TermsOfUse />} />

      {/* FAQ retirée des routes internes : le lien footer pointe désormais
          directement vers le post Instagram dédié (voir LandingPage.jsx) */}
      <Route path="/faq" element={<Navigate to="/" replace />} />

      {/* Route non définie */}
      <Route path="*" element={<NotFound />} />

    </Routes>
    </>
  );
}
