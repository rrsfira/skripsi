import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutKandidat from '../containers/LayoutKandidat';
import CandidateDashboardHome from './CandidateDashboardHome';
import CandidateJobsPage from './CandidateJobsPage';
import CandidateApplyPage from './CandidateApplyPage';
import CandidateInterviewPage from './CandidateInterviewPage';
import CandidateRequestsPage from './CandidateRequestsPage';
import CandidateProfilePage from './CandidateProfilePage';
import CandidateEditProfilePage from './CandidateEditProfilePage';
import CandidateOpeningPage from './CandidateOpeningPage';

export default function CandidateRoutes() {
  return (
    <Routes>
      <Route path="" element={<LayoutKandidat />}>
        <Route index element={<CandidateDashboardHome />} />
        <Route path="dashboard" element={<CandidateDashboardHome />} />
        <Route path="jobs" element={<CandidateJobsPage />} />
        <Route path="opening" element={<CandidateOpeningPage />} />
        <Route path="apply" element={<CandidateApplyPage />} />
        <Route path="interview" element={<CandidateInterviewPage />} />
        <Route path="requests" element={<CandidateRequestsPage />} />
        <Route path="profile" element={<CandidateProfilePage />} />
        <Route path="edit-profile" element={<CandidateEditProfilePage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
