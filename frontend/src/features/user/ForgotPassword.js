import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LandingIntro from "./LandingIntro";
import ErrorText from "../../components/Typography/ErrorText";
import InputText from "../../components/Input/InputText";

function ForgotPassword() {
  const INITIAL_USER_OBJ = {
    emailId: "",
  };

  const INITIAL_OTP_OBJ = {
    otp: "",
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stage, setStage] = useState("email");
  const [userObj, setUserObj] = useState(INITIAL_USER_OBJ);
  const [otpObj, setOtpObj] = useState(INITIAL_OTP_OBJ);
  const navigate = useNavigate();

  const submitEmail = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (userObj.emailId.trim() === "")
      return setErrorMessage("Email adalah wajib diisi");
    else {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/auth/forgot-password`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: userObj.emailId.trim(),
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          return setErrorMessage(data.message || "Gagal mengirim kode OTP");
        }

        if (data.devOTP) {
          console.log("Development OTP:", data.devOTP);
          setErrorMessage(`[DEV] OTP: ${data.devOTP}`);
        }

        setStage("otp");
      } catch (error) {
        setErrorMessage(error.message || "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    }
  };

  const submitOTP = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (otpObj.otp.trim() === "")
      return setErrorMessage("Kode OTP adalah wajib diisi");
    else {
      try {
        setLoading(true);
        navigate(
          `/reset-password?email=${encodeURIComponent(userObj.emailId.trim())}&otp=${otpObj.otp.trim()}`,
        );
      } catch (error) {
        setErrorMessage(error.message || "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    }
  };

  const updateFormValue = ({ updateType, value }) => {
    setErrorMessage("");
    setUserObj({ ...userObj, [updateType]: value });
  };

  const updateOTPValue = ({ updateType, value }) => {
    setErrorMessage("");
    setOtpObj({ ...otpObj, [updateType]: value });
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center">
      <div className="card mx-auto w-full max-w-5xl  shadow-xl">
        <div className="grid  md:grid-cols-2 grid-cols-1  bg-base-100 rounded-xl">
          <div className="">
            <LandingIntro />
          </div>
          <div className="py-24 px-10">
            <h2 className="text-2xl font-semibold mb-2 text-center">
              Lupa Password
            </h2>

            {stage === "email" && (
              <>
                <p className="my-8 font-semibold text-center">
                  Masukkan email Anda untuk menerima kode OTP
                </p>
                <form onSubmit={(e) => submitEmail(e)}>
                  <div className="mb-4">
                    <InputText
                      type="emailId"
                      defaultValue={userObj.emailId}
                      updateType="emailId"
                      containerStyle="mt-4"
                      labelTitle="Email"
                      updateFormValue={updateFormValue}
                    />
                  </div>

                  <ErrorText styleClass="mt-12">{errorMessage}</ErrorText>
                  <button
                    type="submit"
                    className={
                      "btn mt-2 w-full btn-primary" +
                      (loading ? " loading" : "")
                    }
                  >
                    Kirim Kode OTP
                  </button>

                  <div className="text-center mt-4">
                    Belum punya akun?{" "}
                    <Link to="/register">
                      <button className="  inline-block  hover:text-primary hover:underline hover:cursor-pointer transition duration-200">
                        Daftar
                      </button>
                    </Link>
                  </div>
                </form>
              </>
            )}

            {stage === "otp" && (
              <>
                <p className="my-8 font-semibold text-center">
                  Masukkan kode OTP yang telah dikirim ke email Anda
                </p>
                <form onSubmit={(e) => submitOTP(e)}>
                  <div className="mb-4">
                    <InputText
                      type="text"
                      defaultValue={otpObj.otp}
                      updateType="otp"
                      containerStyle="mt-4"
                      labelTitle="Kode OTP"
                      updateFormValue={updateOTPValue}
                      placeholder="Masukkan 6 digit kode OTP"
                    />
                  </div>

                  <ErrorText styleClass="mt-12">{errorMessage}</ErrorText>
                  <button
                    type="submit"
                    className={
                      "btn mt-2 w-full btn-primary" +
                      (loading ? " loading" : "")
                    }
                  >
                    Verifikasi OTP
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setStage("email");
                        setOtpObj(INITIAL_OTP_OBJ);
                        setErrorMessage("");
                      }}
                      className="inline-block hover:text-primary hover:underline hover:cursor-pointer transition duration-200"
                    >
                      Ubah Email
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
