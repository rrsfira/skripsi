import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import LandingIntro from "./LandingIntro";
import ErrorText from "../../components/Typography/ErrorText";
import InputText from "../../components/Input/InputText";
import CheckCircleIcon from "@heroicons/react/24/solid/CheckCircleIcon";

function ResetPassword() {
  const INITIAL_FORM_OBJ = {
    password: "",
    passwordConfirm: "",
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(false);
  const [formObj, setFormObj] = useState(INITIAL_FORM_OBJ);
  const [validInput, setValidInput] = useState(true);

  const email = searchParams.get("email");
  const otp = searchParams.get("otp");

  useEffect(() => {
    if (!email || !otp) {
      setErrorMessage("Email atau OTP tidak ditemukan");
      setValidInput(false);
    }
  }, [email, otp]);

  const submitForm = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (formObj.password.trim() === "")
      return setErrorMessage("Password adalah wajib diisi");
    if (formObj.passwordConfirm.trim() === "")
      return setErrorMessage("Konfirmasi password adalah wajib diisi");
    if (formObj.password !== formObj.passwordConfirm)
      return setErrorMessage("Password tidak cocok");
    if (formObj.password.length < 6)
      return setErrorMessage("Password minimal 6 karakter");

    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            otp: otp,
            password: formObj.password.trim(),
            passwordConfirm: formObj.passwordConfirm.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return setErrorMessage(data.message || "Gagal mereset password");
      }

      setSuccessMessage(true);
      setFormObj(INITIAL_FORM_OBJ);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setErrorMessage(error.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const updateFormValue = ({ updateType, value }) => {
    setErrorMessage("");
    setFormObj({ ...formObj, [updateType]: value });
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
              Reset Password
            </h2>

            {successMessage && (
              <>
                <div className="text-center mt-8">
                  <CheckCircleIcon className="inline-block w-32 text-success" />
                </div>
                <p className="my-4 text-xl font-bold text-center">
                  Password Berhasil Diubah
                </p>
                <p className="mt-4 mb-8 font-semibold text-center">
                  Silahkan login dengan password baru Anda
                </p>
                <div className="text-center mt-4">
                  <Link to="/login">
                    <button className="btn btn-block btn-primary ">
                      Login
                    </button>
                  </Link>
                </div>
              </>
            )}

            {!successMessage && validInput && (
              <>
                <p className="my-8 font-semibold text-center">
                  Masukkan password baru Anda
                </p>
                <form onSubmit={(e) => submitForm(e)}>
                  <div className="mb-4">
                    <InputText
                      type="password"
                      defaultValue={formObj.password}
                      updateType="password"
                      containerStyle="mt-4"
                      labelTitle="Password Baru"
                      updateFormValue={updateFormValue}
                    />
                  </div>

                  <div className="mb-4">
                    <InputText
                      type="password"
                      defaultValue={formObj.passwordConfirm}
                      updateType="passwordConfirm"
                      containerStyle="mt-4"
                      labelTitle="Konfirmasi Password"
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
                    Reset Password
                  </button>

                  <div className="text-center mt-4">
                    <Link to="/login">
                      <button className="  inline-block  hover:text-primary hover:underline hover:cursor-pointer transition duration-200">
                        Kembali ke Login
                      </button>
                    </Link>
                  </div>
                </form>
              </>
            )}

            {!validInput && (
              <>
                <div className="text-center mt-8 text-error">
                  <p className="my-4 text-xl font-bold">Link Tidak Valid</p>
                  <p className="mt-4 mb-8 font-semibold">
                    Link reset password tidak valid atau sudah kadaluarsa
                  </p>
                </div>
                <div className="text-center mt-4">
                  <Link to="/forgot-password">
                    <button className="btn btn-block btn-primary ">
                      Minta Link Baru
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
