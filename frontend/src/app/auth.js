import axios from "axios"

const checkAuth = () => {
/*  Getting token value stored in localstorage, if token is not present we will open login page 
    for all internal dashboard routes  */
    const TOKEN = localStorage.getItem("token")
    const activeRole = localStorage.getItem("activeRole")
    const savedRoles = JSON.parse(localStorage.getItem("roles") || "[]")
        const PUBLIC_ROUTES = [
            "login",
            "forgot-password",
            "register",
            "documentation",
            "candidate/jobs",
            "candidate/apply",
            "candidate/status"
        ]

    const isPublicPage = PUBLIC_ROUTES.some( r => window.location.href.includes(r))
    const isAppRoute = window.location.pathname.startsWith('/app')
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}')
    const userStatus = String(savedUser?.status || '').toLowerCase()

    if (TOKEN && isAppRoute && userStatus === 'inactive') {
        localStorage.setItem('accountInactiveNotice', '1')
        localStorage.removeItem('token')
        localStorage.removeItem('roles')
        localStorage.removeItem('activeRole')
        delete axios.defaults.headers.common['Authorization']
        window.location.href = '/login'
        return null
    }

    if(!TOKEN && !isPublicPage){
        window.location.href = '/login'
        return;
    }

    if (!TOKEN) {
        return null
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${TOKEN}`
    const currentActiveRole = localStorage.getItem('activeRole')
    if (currentActiveRole) {
        axios.defaults.headers.common['X-Active-Role'] = currentActiveRole
    }

    if (isAppRoute) {
        if (!Array.isArray(savedRoles) || savedRoles.length === 0) {
            localStorage.clear()
            window.location.href = '/login'
            return
        }

        if (!activeRole || !savedRoles.includes(activeRole)) {
            localStorage.setItem('activeRole', savedRoles[0])
        }
    }

    if (!window.__axiosInterceptorsInitialized) {
        window.__axiosInterceptorsInitialized = true

        axios.interceptors.request.use(function (config) {
            document.body.classList.add('loading-indicator');
            const runtimeActiveRole = localStorage.getItem('activeRole')
            if (runtimeActiveRole) {
                config.headers = config.headers || {}
                config.headers['X-Active-Role'] = runtimeActiveRole
            }
            return config
        }, function (error) {
            return Promise.reject(error);
        });
          
        axios.interceptors.response.use(function (response) {
            document.body.classList.remove('loading-indicator');
            return response;
        }, function (error) {
            document.body.classList.remove('loading-indicator');

            const statusCode = error?.response?.status
            const errorCode = error?.response?.data?.code
            const requestUrl = String(error?.config?.url || '')
            const hasToken = Boolean(localStorage.getItem('token'))
            if (statusCode === 403 && errorCode === 'ACCOUNT_INACTIVE') {
                localStorage.clear()
                localStorage.setItem('accountInactiveNotice', '1')
                delete axios.defaults.headers.common['Authorization']
                window.location.href = '/login'
            }

            const isAuthLoginRequest = requestUrl.includes('/api/auth/login') || requestUrl.includes('/auth/login')
            if (statusCode === 401 && hasToken && !isAuthLoginRequest) {
                localStorage.clear()
                localStorage.setItem('sessionExpiredNotice', '1')
                delete axios.defaults.headers.common['Authorization']
                window.location.href = '/login'
            }

            return Promise.reject(error);
        });
    }

    return TOKEN
}

export default checkAuth