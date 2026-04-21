import Header from "./Header"
import { Outlet } from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux'
import RightSidebar from './RightSidebar'
import { useEffect, useState } from "react"
import { removeNotificationMessage } from "../features/common/headerSlice"
import { NotificationContainer, NotificationManager } from 'react-notifications';
import 'react-notifications/lib/notifications.css';
import ModalLayout from "./ModalLayout"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { Link, useLocation, NavLink } from "react-router-dom"
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon"

const kandidatMenu = [
  { label: 'Dashboard', path: '/candidate/dashboard' },
  { label: 'Lowongan Pekerjaan', path: '/candidate/opening' },
  { label: 'Ajukan Lamaran', path: '/candidate/apply' },
  { label: 'Wawancara', path: '/candidate/interview' },
  { label: 'Permohonan Saya', path: '/candidate/requests' },
  { label: 'Data Diri', path: '/candidate/profile' },
];

const isProfilBelumLengkap = (payload) => {
  const candidate = payload?.candidate || {}

  if (!candidate || Object.keys(candidate).length === 0) {
    return true
  }

  const excludedCandidateFields = new Set([
    'id',
    'user_id',
    'created_at',
    'updated_at',
  ])

  const isEmptyValue = (value) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    return false
  }

  const fieldsToValidate = Object.keys(candidate).filter(
    (field) => !excludedCandidateFields.has(field)
  )

  return fieldsToValidate.some((field) => isEmptyValue(candidate[field]))
}

function LeftSidebarKandidat() {
  const location = useLocation();

  const close = (e) => {
    const drawer = document.getElementById("left-sidebar-drawer");
    if (drawer) drawer.checked = false;
  };

  return (
    <div className="drawer-side z-30">
      <label htmlFor="left-sidebar-drawer" className="drawer-overlay"></label>
      <ul className="menu pt-2 w-72 sm:w-80 bg-base-100 min-h-full text-base-content overflow-y-auto">
        <li className="mb-6">
          <div className="flex w-full justify-center">
            <Link to={"/candidate/dashboard"}>
              <img
                src="/logo1.svg"
                alt="Kandidat"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>
        </li>
        <button
          className="btn btn-ghost bg-base-300 btn-circle z-50 top-0 right-0 mt-4 mr-2 absolute lg:hidden"
          onClick={() => close()}
        >
          <XMarkIcon className="h-5 inline-block w-5" />
        </button>
        {kandidatMenu.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              onClick={() => close()}
              className={({ isActive }) =>
                `${isActive ? "font-semibold bg-base-200" : "font-normal"}`
              }
            >
              {item.label}
              {location.pathname === item.path ? (
                <span
                  className="absolute inset-y-0 left-0 w-1 rounded-tr-md rounded-br-md bg-primary"
                  aria-hidden="true"
                ></span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageContentKandidat() {
  const { pageTitle } = useSelector(state => state.header)

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [pageTitle])

  return (
    <div className="drawer-content flex flex-col min-w-0">
      <Header />
      <main className="flex-1 overflow-y-auto pt-3 sm:pt-4 px-3 sm:px-4 lg:px-6 bg-base-200">
        <Outlet />
        <div className="h-16"></div>
      </main>
    </div>
  );
}

export default function LayoutKandidat() {
  const dispatch = useDispatch()
  const { newNotificationMessage, newNotificationStatus } = useSelector(state => state.header)
  const [showProfilePrompt, setShowProfilePrompt] = useState(false)
  const [isAccountLocked, setIsAccountLocked] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (newNotificationMessage !== "") {
      if (newNotificationStatus === 1) NotificationManager.success(newNotificationMessage, 'Success')
      if (newNotificationStatus === 0) NotificationManager.error(newNotificationMessage, 'Error')
      dispatch(removeNotificationMessage())
    }
  }, [dispatch, newNotificationMessage, newNotificationStatus])

  useEffect(() => {
    const dismissed = localStorage.getItem('profilePromptDismissed') === '1'
    if (dismissed) return

    const checkProfile = async () => {
      try {
        // Fetch user profile for status check
        const profileResponse = await axios.get('/api/profile')
        const latestStatus = String(profileResponse?.data?.user?.status || '').toLowerCase()

        if (latestStatus === 'inactive') {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...currentUser,
              status: 'inactive',
            })
          )
          setIsAccountLocked(true)
          return
        }

        // Fetch candidate profile for completeness check
        const candidateResponse = await axios.get('/api/candidates/profile')
        if (isProfilBelumLengkap(candidateResponse.data)) {
          setShowProfilePrompt(true)
        }
      } catch (error) {
        // Silent error handling for profile check
      }
    }

    checkProfile()
  }, [])

  const closeProfilePrompt = () => {
    localStorage.setItem('profilePromptDismissed', '1')
    setShowProfilePrompt(false)
  }

  const goToProfileSettings = () => {
    closeProfilePrompt()
    navigate('/candidate/profile')
  }

  return (
    <>
      {/* Left drawer - containing page content and side bar (always open) */}
      <div className="drawer lg:drawer-open">
        <input id="left-sidebar-drawer" type="checkbox" className="drawer-toggle" />
        <PageContentKandidat />
        <LeftSidebarKandidat />
      </div>

      {/* Right drawer - containing secondary content like notifications list etc.. */}
      <RightSidebar />

      {/* Notification layout container */}
      <NotificationContainer />

      {/* Modal layout container */}
      <ModalLayout />

      {showProfilePrompt ? (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Lengkapi Profil Anda</h3>
            <p className="py-4">
              Beberapa data masih belum lengkap! Silakan lengkapi profil!
            </p>
            <div className="modal-action">
              <button className="btn" onClick={closeProfilePrompt}>Nanti Saja</button>
              <button className="btn btn-primary" onClick={goToProfileSettings}>Lengkapi Sekarang</button>
            </div>
          </div>
        </div>
      ) : null}

      {isAccountLocked ? (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Akun Dinonaktifkan</h3>
            <p className="py-4">
              Akun Anda sedang tidak aktif.
              Semua akses sistem dikunci. Silakan hubungi HR/Admin untuk tindak lanjut.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-error"
                onClick={() => {
                  localStorage.clear()
                  window.location.href = '/login'
                }}
              >
                Kembali ke Login
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
