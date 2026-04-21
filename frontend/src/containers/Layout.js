import PageContent from "./PageContent"
import LeftSidebar from "./LeftSidebar"
import { useSelector, useDispatch } from 'react-redux'
import RightSidebar from './RightSidebar'
import { useEffect, useState } from "react"
import  {  removeNotificationMessage } from "../features/common/headerSlice"
import {NotificationContainer, NotificationManager} from 'react-notifications';
import 'react-notifications/lib/notifications.css';
import ModalLayout from "./ModalLayout"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const isProfilBelumLengkap = (payload) => {
  const employee = payload?.employee || {}

  if (!employee || Object.keys(employee).length === 0) {
    return true
  }

  const excludedEmployeeFields = new Set([
    'employment_contract_document',
    'position_id',
    'join_date',
    'basic_salary',
    'employment_status',
    'working_hours_id',
    'annual_leave_quota',
    'remaining_leave_quota',
    'quota_reset_date',
    'created_at',
    'updated_at',
    // Bukan kolom asli tabel employees (hasil join)
    'position_name',
    'level',
    'department_name',
  ])

  const isEmptyValue = (value) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    return false
  }

  const fieldsToValidate = Object.keys(employee).filter(
    (field) => !excludedEmployeeFields.has(field)
  )

  return fieldsToValidate.some((field) => isEmptyValue(employee[field]))
}

function Layout(){
  const dispatch = useDispatch()
  const {newNotificationMessage, newNotificationStatus} = useSelector(state => state.header)
  const [showProfilePrompt, setShowProfilePrompt] = useState(false)
  const [isAccountLocked, setIsAccountLocked] = useState(false)
  const navigate = useNavigate()


  useEffect(() => {
      if(newNotificationMessage !== ""){
          if(newNotificationStatus === 1)NotificationManager.success(newNotificationMessage, 'Success')
          if(newNotificationStatus === 0)NotificationManager.error( newNotificationMessage, 'Error')
          dispatch(removeNotificationMessage())
      }
  }, [dispatch, newNotificationMessage, newNotificationStatus])

  useEffect(() => {
    const dismissed = localStorage.getItem('profilePromptDismissed') === '1'
    if (dismissed) return

    const checkProfile = async () => {
      try {
        const response = await axios.get('/api/profile')
        const latestStatus = String(response?.data?.user?.status || '').toLowerCase()

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

        if (isProfilBelumLengkap(response.data)) {
          setShowProfilePrompt(true)
        }
      } catch (error) {
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
    navigate('/app/settings-profile')
  }

    return(
      <>
        { /* Left drawer - containing page content and side bar (always open) */ }
        <div className="drawer  lg:drawer-open">
            <input id="left-sidebar-drawer" type="checkbox" className="drawer-toggle" />
            <PageContent/>
            <LeftSidebar />
        </div>

        { /* Right drawer - containing secondary content like notifications list etc.. */ }
        <RightSidebar />


        {/** Notification layout container */}
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
    )
}

export default Layout