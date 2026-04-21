import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import LandingIntro from "./LandingIntro";
import ErrorText from "../../components/Typography/ErrorText";
import InputText from "../../components/Input/InputText";
import api from "../../lib/api";
import { useLocation } from "react-router-dom";

function Register() {
  const INITIAL_REGISTER_OBJ = {
    name: "",
    email: "",
    username: "",
    password: "",
    phone: "",
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registerObj, setRegisterObj] = useState(INITIAL_REGISTER_OBJ);
  const location = useLocation();

  const submitForm = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (registerObj.name.trim() === "")
      return setErrorMessage("Nama wajib diisi");
    if (registerObj.email.trim() === "")
      return setErrorMessage("Email wajib diisi");
    if (registerObj.username.trim() === "")
      return setErrorMessage("Username wajib diisi");
    if (registerObj.password.trim() === "")
      return setErrorMessage("Password wajib diisi");

    setLoading(true);
    const formData = new FormData();
    formData.append("name", registerObj.name);
    formData.append("email", registerObj.email);
    formData.append("username", registerObj.username);
    formData.append("password", registerObj.password);
    formData.append("phone", registerObj.phone);

    api
      .post("/auth/register/candidate", formData)
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        setLoading(false);
        window.location.href = "/app/welcome";
      })
      .catch((err) => {
        let msg = "Registrasi gagal";
        if (err?.response?.data?.message) {
          msg = err.response.data.message;
        } else if (err?.message) {
          msg = err.message;
        }
        setErrorMessage(msg);
        setLoading(false);
      });
  };

  const updateFormValue = ({ updateType, value }) => {
    setErrorMessage("");
    setRegisterObj({ ...registerObj, [updateType]: value });
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
  <div className="w-full max-w-3xl bg-base-100 rounded-2xl shadow-xl p-6 sm:p-8">

    {/* Title */}
    <div className="text-center mb-6">
      <h2 className="text-2xl font-semibold">Registrasi Kandidat</h2>
      <p className="text-sm text-base-content/60">
        Buat akun untuk melamar pekerjaan
      </p>
    </div>

    <form onSubmit={submitForm} className="space-y-5">

      {/* GRID 2 KOLOM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <InputText
          defaultValue={registerObj.name}
          updateType="name"
          labelTitle="Nama Lengkap"
          placeholder="Masukkan nama lengkap"
          containerStyle="w-full"
          updateFormValue={updateFormValue}
        />

        <InputText
          defaultValue={registerObj.email}
          updateType="email"
          labelTitle="Email"
          placeholder="nama@email.com"
          containerStyle="w-full"
          updateFormValue={updateFormValue}
        />

        <InputText
          defaultValue={registerObj.username}
          updateType="username"
          labelTitle="Username"
          placeholder="Masukkan username"
          containerStyle="w-full"
          updateFormValue={updateFormValue}
        />

        <InputText
          defaultValue={registerObj.phone}
          updateType="phone"
          labelTitle="Nomor HP"
          placeholder="08xxxxxxxxxx"
          containerStyle="w-full"
          updateFormValue={updateFormValue}
        />

        {/* Password full width */}
        <div className="md:col-span-2">
          <InputText
            defaultValue={registerObj.password}
            type="password"
            updateType="password"
            labelTitle="Password"
            placeholder="Masukkan kata sandi"
            containerStyle="w-full"
            updateFormValue={updateFormValue}
          />
        </div>

      </div>

      {/* Error */}
      <ErrorText>{errorMessage}</ErrorText>

      {/* Button */}
      <button
        type="submit"
        className={
          "btn w-full btn-primary rounded-lg h-11 " +
          (loading ? " loading" : "")
        }
      >
        {loading ? "Sedang mendaftar..." : "Daftar"}
      </button>

      {/* Login */}
      <p className="text-center text-sm text-base-content/70">
        Sudah punya akun?{" "}
        <Link to="/login?role=kandidat">
          <span className="text-primary font-medium hover:underline cursor-pointer">
            Masuk
          </span>
        </Link>
      </p>

    </form>
  </div>
</div>
  );
}

export default Register;
