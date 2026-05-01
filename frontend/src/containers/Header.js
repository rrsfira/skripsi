import { themeChange } from "theme-change";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";
import MoonIcon from "@heroicons/react/24/outline/MoonIcon";
import SunIcon from "@heroicons/react/24/outline/SunIcon";

import { Link } from "react-router-dom";

const DEFAULT_AVATAR = "https://placeimg.com/80/80/people";

const ROLE_LABELS = {
  admin: "Admin",
  hr: "HR",
  atasan: "Atasan",
  finance: "Keuangan",
  pegawai: "Pegawai",
  kandidat: "Kandidat",
};

const getResolvedPhotoUrl = (photoPath) => {
  if (!photoPath) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(photoPath) || /^data:/i.test(photoPath))
    return photoPath;

  const configuredBaseUrl = process.env.REACT_APP_BASE_URL;
  const fallbackBaseUrl = "http://localhost:5000";
  const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, "");
  const normalizedPath = String(photoPath).replace(/^\/+/, "");
  return `${baseUrl}/${normalizedPath}`;
};

const getStoredUserAvatar = () => {
  try {
    const rawUser = localStorage.getItem("user");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    return getResolvedPhotoUrl(parsedUser?.photo);
  } catch (error) {
    return DEFAULT_AVATAR;
  }
};

function Header() {
  const { pageTitle } = useSelector((state) => state.header);
  const [currentTheme, setCurrentTheme] = useState(
    localStorage.getItem("theme"),
  );
  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState(
    localStorage.getItem("activeRole") || "",
  );
  const [avatarSrc, setAvatarSrc] = useState(getStoredUserAvatar());
  const [avatarTrigger, setAvatarTrigger] = useState(0);

  useEffect(() => {
    themeChange(false);
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === null) {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        setCurrentTheme("dark");
      } else {
        setCurrentTheme("light");
      }
    } else {
      setCurrentTheme(savedTheme);
    }
    // 👆 false parameter is required for react project
    const savedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
    if (Array.isArray(savedRoles)) {
      setRoles(savedRoles);
      const currentActiveRole = localStorage.getItem("activeRole");
      if (!currentActiveRole && savedRoles.length > 0) {
        localStorage.setItem("activeRole", savedRoles[0]);
        setActiveRole(savedRoles[0]);
      } else {
        setActiveRole(currentActiveRole || "");
      }
    }

    const handleStorageChange = () => {
      setAvatarSrc(getStoredUserAvatar());
      setAvatarTrigger((t) => t + 1); // paksa re-render
    };

    setAvatarSrc(getStoredUserAvatar());
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("user-profile-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("user-profile-updated", handleStorageChange);
    };
  }, []);

  const changeRole = (role) => {
    localStorage.setItem("activeRole", role);
    setActiveRole(role);
    window.location.reload();
  };

  function logoutUser() {
    localStorage.clear();
    window.location.href = "/";
  }

  return (
    // navbar fixed  flex-none justify-between bg-base-300  z-10 shadow-md

    <>
      <div className="navbar sticky top-0 bg-base-100 z-10 shadow-md px-2 sm:px-3">
        {/* Menu toogle for mobile view or small screen */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="left-sidebar-drawer"
            className="btn btn-primary btn-sm sm:btn-md drawer-button lg:hidden"
          >
            <Bars3Icon className="h-5 inline-block w-5" />
          </label>
          <h1 className="text-base sm:text-xl lg:text-2xl font-semibold ml-2 truncate">
            {pageTitle}
          </h1>
        </div>

        <div className="flex-none flex items-center gap-2 sm:gap-3">
          {activeRole !== "kandidat" && (
            <div className="dropdown dropdown-end">
              <label
                tabIndex={0}
                className="btn btn-outline btn-xs sm:btn-sm normal-case"
              >
                {ROLE_LABELS[activeRole] || activeRole || "-"}
              </label>
              <ul
                tabIndex={0}
                className="menu menu-compact dropdown-content mt-2 p-2 shadow bg-base-100 rounded-box w-44"
              >
                {(roles || []).map((role) => (
                  <li key={role}>
                    <button
                      className={activeRole === role ? "active" : ""}
                      onClick={() => changeRole(role)}
                    >
                      {ROLE_LABELS[role] || role}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Multiple theme selection, uncomment this if you want to enable multiple themes selection, 
                also includes corporate and retro themes in tailwind.config file */}

          {/* <select className="select select-sm mr-4" data-choose-theme>
                    <option disabled selected>Theme</option>
                    <option value="light">Default</option>
                    <option value="dark">Dark</option>
                    <option value="corporate">Corporate</option>
                    <option value="retro">Retro</option>
                </select> */}

          {/* Light and dark theme selection toogle **/}
          <label className="swap">
            <input type="checkbox" />
            <SunIcon
              data-set-theme="light"
              data-act-class="ACTIVECLASS"
              className={
                "fill-current w-5 h-5 sm:w-6 sm:h-6 " +
                (currentTheme === "dark" ? "swap-on" : "swap-off")
              }
            />
            <MoonIcon
              data-set-theme="dark"
              data-act-class="ACTIVECLASS"
              className={
                "fill-current w-5 h-5 sm:w-6 sm:h-6 " +
                (currentTheme === "light" ? "swap-on" : "swap-off")
              }
            />
          </label>

          {/* Profile icon, opening menu on click */}
          <div className="dropdown dropdown-end ml-1 sm:ml-2">
            <label
              tabIndex={0}
              className="btn btn-ghost btn-circle avatar btn-sm sm:btn-md"
            >
              <div className="w-8 sm:w-10 rounded-full">
                <img
                  src={avatarSrc}
                  alt="profile"
                  onError={() => setAvatarSrc(DEFAULT_AVATAR)}
                />
              </div>
            </label>
            <ul
              tabIndex={0}
              className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52"
            >
              {activeRole !== "kandidat" && (
                <>
                  <li>
                    <Link to={"/app/settings-profile"}>Edit Profil</Link>
                  </li>
                  <div className="divider mt-0 mb-0"></div>
                </>
              )}
              
              {activeRole === "kandidat" && (
                <>
                  <li>
                    <Link to={"/candidate/edit-profile"}>Edit Profil</Link>
                  </li>
                  <div className="divider mt-0 mb-0"></div>
                </>
              )}

              <li>
                <button onClick={logoutUser}>Logout</button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default Header;
