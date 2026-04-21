// All components mapping with path for internal routes

import { lazy } from 'react'

// Employee Pages
const Dashboard = lazy(() => import('../pages/protected/Dashboard'))
const EmployeeDashboard = lazy(() => import('../pages/protected/EmployeeDashboard'))
const EmployeeAttendance = lazy(() => import('../pages/protected/EmployeeAttendance'))
const EmployeeLeave = lazy(() => import('../pages/protected/EmployeeLeave'))
const EmployeePayroll = lazy(() => import('../pages/protected/EmployeePayroll'))
const EmployeeReimbursement = lazy(() => import('../pages/protected/EmployeeReimbursement'))
const EmployeeSalaryAppeal = lazy(() => import('../pages/protected/EmployeeSalaryAppeal'))
const ProfileSettings = lazy(() => import('../pages/protected/ProfileSettings'))
const Page404 = lazy(() => import('../pages/protected/404'))

// Admin Pages
const AdminUsers = lazy(() => import('../pages/protected/AdminUsers'))
const AdminEmployees = lazy(() => import('../pages/protected/AdminEmployees'))
const AdminActivityLogs = lazy(() => import('../pages/protected/AdminActivityLogs'))
const AdminReimbursements = lazy(() => import('../pages/protected/AdminReimbursements'))
const AdminAttendance = lazy(() => import('../pages/protected/AdminAttendance'))
const AdminPayrollManagerAdjustments = lazy(() => import('../pages/protected/AdminPayrollManagerAdjustments'))
const AdminHRWarningLetters = lazy(() => import('../pages/protected/AdminHRWarningLetters'))

// HR Pages
const HRDashboard = lazy(() => import('../pages/protected/HRDashboard'))
const HREmployees = lazy(() => import('../pages/protected/HREmployees'))
const HRAttendance = lazy(() => import('../pages/protected/HRAttendance'))
const HRLeaveRequests = lazy(() => import('../pages/protected/HRLeaveRequests'))
const HRReimbursements = lazy(() => import('../pages/protected/HRReimbursements'))
const HRSalaryAppeals = lazy(() => import('../pages/protected/HRSalaryAppeals'))
const HRPayrollDirectorAdjustments = lazy(() => import('../pages/protected/HRPayrollDirectorAdjustments'))
const HRWarningLetters = lazy(() => import('../pages/protected/HRWarningLetters'))
const HRJobOpenings = lazy(() => import('../pages/protected/HRJobOpenings'));
const HRRecruitmentProcess = lazy(() => import('../pages/protected/HRRecruitmentProcess'));
const HRCandidate = lazy(() => import('../pages/protected/HRDetailRecruitment'));
const HRInterview = lazy(() => import('../pages/protected/HRInterview'));
const JobDetail = lazy(() => import('../pages/protected/HRDetailInterview'));
const HRHiredCandidate = lazy(() => import('../pages/protected/HRHiredCandidate'));
const HRHiredCandidateDetail = lazy(() => import('../pages/protected/HRHiredCandidateDetail'));
const HRHiredCandidateDetailModal = lazy(() => import('../pages/protected/HRHiredCandidateDetailModal'));

// Atasan Pages
const AtasanDashboard = lazy(() => import('../pages/protected/AtasanDashboard'))
const AtasanLeaveRequests = lazy(() => import('../pages/protected/AtasanLeaveRequests'))
const AtasanReimbursements = lazy(() => import('../pages/protected/AtasanReimbursements'))
const AtasanAttendance = lazy(() => import('../pages/protected/AtasanAttendance'))

// Finance Pages
const FinanceDashboard = lazy(() => import('../pages/protected/FinanceDashboard'))
const FinancePayroll = lazy(() => import('../pages/protected/FinancePayroll'))
const FinancePayrollRevision = lazy(() => import('../pages/protected/FinancePayrollRevision'))
const FinancePayrollTransfers = lazy(() => import('../pages/protected/FinancePayrollTransfers'))
const FinancePayrollManagerAdjustments = lazy(() => import('../pages/protected/FinancePayrollManagerAdjustments'))
const FinanceReimbursements = lazy(() => import('../pages/protected/FinanceReimbursements'))
const FinanceSalaryAppeals = lazy(() => import('../pages/protected/FinanceSalaryAppeals'))
const FinanceReports = lazy(() => import('../pages/protected/FinanceReports'))

const adminRoutes = [
  {
    path: '/dashboard',
    component: Dashboard,
  },
  {
    path: '/users',
    component: AdminUsers,
  },
  {
    path: '/employees',
    component: AdminEmployees,
  },
  {
    path: '/leave-requests',
    component: AtasanLeaveRequests,
  },
  {
    path: '/attendance',
    component: AdminAttendance,
  },
  {
    path: '/reimbursements',
    component: AdminReimbursements,
  },
  {
    path: '/salary-appeals',
    component: HRSalaryAppeals,
  },
  {
    path: '/activity-logs',
    component: AdminActivityLogs,
  },
  {
    path: '/payroll/manager-adjustments',
    component: AdminPayrollManagerAdjustments,
  },
  {
    path: '/warning-letters',
    component: AdminHRWarningLetters,
  },
  {
    path: '/settings-profile',
    component: ProfileSettings,
  },
  {
    path: '/404',
    component: Page404,
  },
]

const pegawaiRoutes = [
  {
    path: '/dashboard',
    component: EmployeeDashboard,
  },
  {
    path: '/attendance',
    component: EmployeeAttendance,
  },
  {
    path: '/leave-requests',
    component: EmployeeLeave,
  },
  {
    path: '/payroll',
    component: EmployeePayroll,
  },
  {
    path: '/salary-appeals',
    component: EmployeeSalaryAppeal,
  },
  {
    path: '/reimbursements',
    component: EmployeeReimbursement,
  },
  {
    path: '/settings-profile',
    component: ProfileSettings,
  },
  {
    path: '/404',
    component: Page404,
  },
]
const hrRoutes = [
  {
    path: '/dashboard',
    component: HRDashboard,
  },
  {
    path: '/job-openings',
    component: HRJobOpenings,
  },
  {
    path: '/recruitment-process',
    component: HRRecruitmentProcess,
  },
  {
    path: '/Interview-process',
    component: HRInterview,
  },
  {
    path: '/DetailInterview-process',
    component: JobDetail,
  },
  {
    path: '/employees',
    component: HREmployees,
  },
  {
    path: '/attendance',
    component: HRAttendance,
  },
  {
    path: '/leave-requests',
    component: HRLeaveRequests,
  },
  {
    path: '/reimbursements',
    component: HRReimbursements,
  },
  {
    path: '/salary-appeals',
    component: HRSalaryAppeals,
  },
  {
    path: '/payroll/hr-adjustments',
    component: HRPayrollDirectorAdjustments,
  },
  {
    path: '/warning-letters',
    component: HRWarningLetters,
  },
  {
    path: '/candidate/:jobId',
    component: HRCandidate,
  },
  {
    path: '/settings-profile',
    component: ProfileSettings,
  },
  {
    path: '/Hire-candidates',
    component: HRHiredCandidate,
  },
  {
    path:'/Hire-candidates/:id',
    component:HRHiredCandidateDetail,
  },
  {
    path: '/Hire-candidates-detailmodal/:id',
    component: HRHiredCandidateDetailModal,
  },
  {
    path: '/404',
    component: Page404,
  },
]

const atasanRoutes = [
  {
    path: '/dashboard',
    component: AtasanDashboard,
  },
  {
    path: '/leave-requests',
    component: AtasanLeaveRequests,
  },
  {
    path: '/reimbursements',
    component: AtasanReimbursements,
  },
  {
    path: '/team-attendance',
    component: AtasanAttendance,
  },
  {
    path: '/settings-profile',
    component: ProfileSettings,
  },
  {
    path: '/404',
    component: Page404,
  },
]

const financeRoutes = [
  {
    path: '/dashboard',
    component: FinanceDashboard,
  },
  {
    path: '/payroll',
    component: FinancePayroll,
  },
  {
    path: '/payroll/revision',
    component: FinancePayrollRevision,
  },
  {
    path: '/payroll/transfers',
    component: FinancePayrollTransfers,
  },
  {
    path: '/payroll/manager-adjustments',
    component: FinancePayrollManagerAdjustments,
  },
  {
    path: '/reimbursements',
    component: FinanceReimbursements,
  },
  {
    path: '/salary-appeals',
    component: FinanceSalaryAppeals,
  },
  {
    path: '/reports',
    component: FinanceReports,
  },
  {
    path: '/settings-profile',
    component: ProfileSettings,
  },
  {
    path: '/404',
    component: Page404,
  },
]

export const getRoutesByRole = (activeRole) => {
  if (activeRole === 'admin') {
    return adminRoutes
  }

  if (activeRole === 'hr') {
    return hrRoutes
  }

  if (activeRole === 'atasan') {
    return atasanRoutes
  }

  if (activeRole === 'finance') {
    return financeRoutes
  }

  return pegawaiRoutes
}

export default getRoutesByRole
