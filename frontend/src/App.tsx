import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { VetLayout } from "./layouts/VetLayout";
import { OwnerLayout } from "./layouts/OwnerLayout";
import { VetDashboard } from "./pages/vet/VetDashboard";
import { VetPets } from "./pages/vet/VetPets";
import { VetAppointments } from "./pages/vet/VetAppointments";
import { VetCases } from "./pages/vet/VetCases";
import { VetCaseDetail } from "./pages/vet/VetCaseDetail";
import { VetReports } from "./pages/vet/VetReports";
import { VetRisk } from "./pages/vet/VetRisk";
import { OwnerDashboard } from "./pages/owner/OwnerDashboard";
import { OwnerPets } from "./pages/owner/OwnerPets";
import { OwnerAppointments } from "./pages/owner/OwnerAppointments";
import { OwnerCheck } from "./pages/owner/OwnerCheck";
import { OwnerHistory } from "./pages/owner/OwnerHistory";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Vet paneli: sadece vet rolü */}
        <Route
          path="/vet"
          element={
            <ProtectedRoute requiredRole="vet">
              <VetLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/vet/dashboard" replace />} />
          <Route path="dashboard" element={<VetDashboard />} />
          <Route path="pets" element={<VetPets />} />
          <Route path="appointments" element={<VetAppointments />} />
          <Route path="cases" element={<VetCases />} />
          <Route path="cases/:id" element={<VetCaseDetail />} />
          <Route path="reports" element={<VetReports />} />
          <Route path="risk" element={<VetRisk />} />
        </Route>

        {/* Owner paneli: sadece pet_owner rolü */}
        <Route
          path="/owner"
          element={
            <ProtectedRoute requiredRole="pet_owner">
              <OwnerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<OwnerDashboard />} />
          <Route path="pets" element={<OwnerPets />} />
          <Route path="appointments" element={<OwnerAppointments />} />
          <Route path="check" element={<OwnerCheck />} />
          <Route path="history" element={<OwnerHistory />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};