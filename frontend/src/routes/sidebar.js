/** Icons are imported separatly to reduce build time */
import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import UsersIcon from '@heroicons/react/24/outline/UsersIcon'
import IdentificationIcon from '@heroicons/react/24/outline/IdentificationIcon'
import ClipboardDocumentListIcon from '@heroicons/react/24/outline/ClipboardDocumentListIcon'
import CalendarDaysIcon from '@heroicons/react/24/outline/CalendarDaysIcon'
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import BanknotesIcon from '@heroicons/react/24/outline/BanknotesIcon'
import WalletIcon from '@heroicons/react/24/outline/WalletIcon'
import ReceiptPercentIcon from '@heroicons/react/24/outline/ReceiptPercentIcon'
import BriefcaseIcon from '@heroicons/react/24/outline/BriefcaseIcon'
import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon'

const iconClasses = `h-6 w-6`

const adminRoutes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>, 
    name: 'Dashboard Admin',
  },
  {
    path: '/app/users',
    icon: <UsersIcon className={iconClasses}/> ,
    name: 'Kelola Pengguna',
  },
  {
    path: '/app/employees',
    icon: <IdentificationIcon className={iconClasses}/>,
    name: 'Data Pegawai',
  },
  {
    path: '/app/activity-logs',
    icon: <ClipboardDocumentListIcon className={iconClasses}/>,
    name: 'Log Aktivitas',
  },
]

const pegawaiRoutes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>,
    name: 'Dashboard Pegawai',
  },
  {
    path: '/app/attendance',
    icon: <CalendarDaysIcon className={iconClasses}/>,
    name: 'Absensi',
  },
  {
    path: '/app/leave-requests',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Cuti & Izin',
  },
  {
    path: '/app/payroll',
    icon: <BanknotesIcon className={iconClasses}/>,
    name: 'Slip Gaji',
  },
  {
    path: '/app/salary-appeals',
    icon: <ReceiptPercentIcon className={iconClasses}/>,
    name: 'Banding Gaji',
  },
  {
    path: '/app/reimbursements',
    icon: <WalletIcon className={iconClasses}/>,
    name: 'Reimbursement',
  },
]

const hrRoutes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>, 
    name: 'Dashboard HR',
  },

  {
    path: '/app/job-openings',
    icon: <BriefcaseIcon className={iconClasses}/>,
    name: 'Daftar Lowongan Kerja',
  },
  
  {
    path: '/app/recruitment-process',
    icon: <UserGroupIcon className={iconClasses}/>,
    name: 'Daftar Kandidat',
  },

  {
    path: '/app/Interview-process',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Wawancara',
  },

  {
    path: '/app/Hire-candidates',
    icon: <ClipboardDocumentListIcon className={iconClasses}/>,
    name: 'Kandidat yang lolos',
  },

  {
    path: '/app/employees',
    icon: <IdentificationIcon className={iconClasses}/>,
    name: 'Data Pegawai',
  },

  {
    path: '/app/attendance',
    icon: <CalendarDaysIcon className={iconClasses}/> ,
    name: 'Kehadiran Pegawai',
  },

  {
    path: '/app/leave-requests',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Riwayat Izin/Cuti',
  },

  {
    path: '/app/reimbursements',
    icon: <WalletIcon className={iconClasses}/>,
    name: 'Validasi Reimbursement',
  },

  {
     path: '/app/hr-allowance',
    icon: <BanknotesIcon className={iconClasses}/> ,
    name: 'Manajemen Payroll',
  },
  
  {
    path: '/app/salary-appeals',
    icon: <ReceiptPercentIcon className={iconClasses}/>,
    name: 'Review Banding Gaji',
  },
  {
    path: '/app/warning-letters',
    icon: <DocumentTextIcon className={iconClasses}/> ,
    name: 'Surat Peringatan Pegawai',
  },
]

const atasanRoutes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/> ,
    name: 'Dashboard Atasan',
  },
  {
    path: '/app/leave-requests',
    icon: <DocumentTextIcon className={iconClasses}/> ,
    name: 'Persetujuan Cuti & Izin',
  },
  {
    path: '/app/reimbursements',
    icon: <WalletIcon className={iconClasses}/> ,
    name: 'Persetujuan Reimbursement',
  },
  {
    path: '/app/team-attendance',
    icon: <CalendarDaysIcon className={iconClasses}/> ,
    name: 'Kehadiran Tim',
  },
]

const financeRoutes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>,
    name: 'Dashboard Finance',
  },
  {
    path: '/app/payroll/component',
    icon: <BanknotesIcon className={iconClasses}/> ,
    name: 'Komponen Payroll',
  },
  {
    path: '/app/reimbursements',
    icon: <WalletIcon className={iconClasses}/>,
    name: 'Data Reimbursement',
  },
  {
    path: '/app/payroll',
    icon: <BanknotesIcon className={iconClasses}/>,
    name: 'Kelola Payroll',
  },
  {
    path: '/app/salary-appeals',
    icon: <ReceiptPercentIcon className={iconClasses}/>,
    name: 'Banding Gaji',
  },
  {
    path: '/app/payroll/transfers',
    icon: <BanknotesIcon className={iconClasses}/> ,
    name: 'Riwayat Slip Gaji',
  },
  {
    path: '/app/reports',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Laporan Keuangan',
  },
]

export const getSidebarByRole = (activeRole) => {
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

export default getSidebarByRole
