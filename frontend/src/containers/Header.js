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

const getResolvedPhotoUrl = (photoPath, cacheBuster) => {
  if (!photoPath) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(photoPath) || /^data:/i.test(photoPath))
    return photoPath;

  const configuredBaseUrl = process.env.REACT_APP_BASE_URL;
  const fallbackBaseUrl = "http://localhost:5000";
  const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, "");
  const normalizedPath = String(photoPath).replace(/^\/+/, "");
  const resolvedUrl = `${baseUrl}/${normalizedPath}`;
  return cacheBuster ? `${resolvedUrl}?v=${cacheBuster}` : resolvedUrl;
};

const getStoredUserAvatar = () => {
  try {
    const rawUser = localStorage.getItem("user");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    return getResolvedPhotoUrl(parsedUser?.photo, parsedUser?.photoVersion);
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

    const handleStorageChange = (e) => {
      try {
        let newSrc = getStoredUserAvatar();
        // Keep a short-lived refresh marker for browsers that reuse the same image URL
        if (
          newSrc &&
          newSrc !== DEFAULT_AVATAR &&
          (e?.type === "user-profile-updated" || e?.type === "storage")
        ) {
          const sep = newSrc.includes("?") ? "&" : "?";
          newSrc = `${newSrc}${sep}_=${Date.now()}`;
        }
        setAvatarSrc(newSrc);
      } catch (err) {
        setAvatarSrc(DEFAULT_AVATAR);
      }
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
    window.location.href = (process.env.PUBLIC_URL || '') + '/';
  }

  return (
    // navbar fixed  flex-none justify-between bg-base-300  z-10 shadow-md

    <>
      <div className="navbar sticky top-0 z-20 mx-3 mt-3 rounded-3xl border border-base-300/70 bg-base-100/85 px-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-4">
        {/* Menu toogle for mobile view or small screen */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="left-sidebar-drawer"
            className="btn btn-primary btn-sm sm:btn-md drawer-button lg:hidden shadow-lg shadow-primary/20"
          >
            <Bars3Icon className="h-5 inline-block w-5 text-white" />
          </label>
          <div className="ml-2 min-w-0">
            <h1 className="font-display truncate text-base font-semibold sm:text-xl lg:text-2xl">
              {pageTitle}
            </h1>
          </div>
        </div>

        <div className="flex-none flex items-center gap-2 sm:gap-3">
          {activeRole !== "kandidat" && (
            <div className="dropdown dropdown-end">
              <label
                tabIndex={0}
                className="btn btn-outline btn-xs sm:btn-sm normal-case rounded-full border-base-300 bg-base-100/90 text-base-content hover:border-primary hover:bg-primary/5"
              >
                {ROLE_LABELS[activeRole] || activeRole || "-"}
              </label>
              <ul
                tabIndex={0}
                className="menu menu-compact dropdown-content mt-3 w-44 rounded-2xl border border-base-300/70 bg-base-100/95 p-2 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl"
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
          <label className="swap rounded-full p-2 transition hover:bg-base-200/80">
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
              className="btn btn-ghost btn-circle avatar btn-sm sm:btn-md ring-1 ring-base-300/70 hover:ring-primary/30"
            >
              <div className="w-8 sm:w-10 rounded-full ring-2 ring-base-100 shadow-md">
                <img
                  src={avatarSrc}
                  alt="profile"
                  onError={() => setAvatarSrc(DEFAULT_AVATAR)}
                />
              </div>
            </label>
            <ul
              tabIndex={0}
              className="menu menu-compact dropdown-content mt-3 w-52 rounded-2xl border border-base-300/70 bg-base-100/95 p-2 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl"
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
