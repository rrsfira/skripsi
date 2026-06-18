import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import LandingIntro from "./LandingIntro";
import ErrorText from "../../components/Typography/ErrorText";
import InputText from "../../components/Input/InputText";
import { useLocation } from "react-router-dom";

function Login() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isKandidat = params.get("role") === "kandidat";

  const INITIAL_LOGIN_OBJ = {
    password: "",
    email: "",
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginObj, setLoginObj] = useState(INITIAL_LOGIN_OBJ);

  useEffect(() => {
    const hasInactiveNotice =
      localStorage.getItem("accountInactiveNotice") === "1";
    const hasSessionExpiredNotice =
      localStorage.getItem("sessionExpiredNotice") === "1";
    if (hasInactiveNotice) {
      setErrorMessage("Akun Anda sedang tidak aktif. Hubungi HR/Admin.");
      localStorage.removeItem("accountInactiveNotice");
      return;
    }

    if (hasSessionExpiredNotice) {
      setErrorMessage("Sesi Anda telah berakhir. Silakan login ulang.");
      localStorage.removeItem("sessionExpiredNotice");
    }
  }, []);

  const submitForm = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (loginObj.email.trim() === "")
      return setErrorMessage("Email wajib diisi");
    if (loginObj.password.trim() === "")
      return setErrorMessage("Password wajib diisi");

    setLoading(true);
    axios
      .post("/api/auth/login", {
        email: loginObj.email,
        password: loginObj.password,
      })
      .then((response) => {
        const { token, roles = [], ...userPayload } = response.data || {};

        if (!token) {
          throw new Error("Token tidak ditemukan");
        }

        if (!Array.isArray(roles) || roles.length === 0) {
          throw new Error("Akun ini tidak memiliki role yang valid");
        }

        const activeRole = roles[0];

        localStorage.setItem("token", token);
        localStorage.setItem("roles", JSON.stringify(roles));
        localStorage.setItem("activeRole", activeRole);
        localStorage.setItem("user", JSON.stringify(userPayload));
        localStorage.removeItem("profilePromptDismissed");

        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        // Redirect sesuai role
        if (activeRole === "kandidat") {
          window.location.href = (process.env.PUBLIC_URL || '') + '/candidate/dashboard';
        } else {
          window.location.href = (process.env.PUBLIC_URL || '') + '/app/dashboard';
        }
      })
      .catch((error) => {
        const apiMessage = error?.response?.data?.message;
        const apiCode = error?.response?.data?.code;
        if (apiCode === "ACCOUNT_INACTIVE") {
          localStorage.setItem("accountInactiveNotice", "1");
        }
        setErrorMessage(apiMessage || error.message || "Login gagal");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const updateFormValue = ({ updateType, value }) => {
    setErrorMessage("");
    setLoginObj({ ...loginObj, [updateType]: value });
  };

  return (
  <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
    <div className="card w-full max-w-5xl shadow-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 bg-base-100 rounded-xl overflow-hidden">
        
        {/* Logo / Intro */}
        <div className="hidden md:block">
          <LandingIntro />
        </div>

        {/* Form Login */}
        <div className="py-16 px-8 sm:px-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold">Login</h2>
            <p className="mt-2 text-sm text-base-content/60">
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          <form onSubmit={submitForm} className="space-y-5">
            <InputText
              type="email"
              defaultValue={loginObj.email}
              updateType="email"
              labelTitle="Email"
              placeholder="Silahkan input email anda"
              containerStyle="w-full"
              updateFormValue={updateFormValue}
            />

            <InputText
              type="password"
              defaultValue={loginObj.password}
              updateType="password"
              labelTitle="Password"
              placeholder="Silahkan input password anda"
              containerStyle="w-full"
              updateFormValue={updateFormValue}
            />

            <div className="flex justify-end">
              <Link to="/forgot-password">
                <span className="text-sm text-primary hover:underline cursor-pointer">
                  Lupa kata sandi?
                </span>
              </Link>
            </div>

            <ErrorText>{errorMessage}</ErrorText>

            <button
              type="submit"
              className={
                "btn w-full btn-primary rounded-lg text-base font-medium h-11 " +
                (loading ? " loading" : "")
              }
            >
              {loading ? "Sedang masuk..." : "Masuk"}
            </button>

            {isKandidat && (
              <>
                <div className="divider text-xs text-base-content/50">atau</div>
                <p className="text-center text-sm text-base-content/70">
                  Belum punya akun?{" "}
                  <Link to="/register?role=kandidat">
                    <span className="text-primary font-medium hover:underline cursor-pointer">
                      Daftar sekarang
                    </span>
                  </Link>
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  </div>
);
}

export default Login;
