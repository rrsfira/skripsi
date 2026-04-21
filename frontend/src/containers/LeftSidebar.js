import { getSidebarByRole } from "../routes/sidebar";
import { NavLink, Link, useLocation } from "react-router-dom";
import SidebarSubmenu from "./SidebarSubmenu";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

function LeftSidebar() {
  const location = useLocation();
  const activeRole = localStorage.getItem("activeRole") || "";
  const routes = getSidebarByRole(activeRole);

  const close = (e) => {
    const drawer = document.getElementById("left-sidebar-drawer");
    if (drawer) drawer.checked = false;
  };

  return (
    <div className="drawer-side  z-30  ">
      <label htmlFor="left-sidebar-drawer" className="drawer-overlay"></label>
      <ul className="menu pt-2 w-72 sm:w-80 bg-base-100 min-h-full text-base-content overflow-y-auto">
        {/* Logo di awal sidebar */}
        <li className="mb-6">
          <div className="flex w-full justify-center">
            <Link to={"/app/dashboard"}>
              <img
                src="/logo1.svg"
                alt="PT OTAK KANAN"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>
        </li>
        <button
          className="btn btn-ghost bg-base-300  btn-circle z-50 top-0 right-0 mt-4 mr-2 absolute lg:hidden"
          onClick={() => close()}
        >
          <XMarkIcon className="h-5 inline-block w-5" />
        </button>
        {routes.map((route, k) => {
          return (
            <li className="" key={k}>
              {route.submenu ? (
                <SidebarSubmenu {...route} />
              ) : (
                <NavLink
                  end
                  to={route.path}
                  onClick={() => close()}
                  className={({ isActive }) =>
                    `${isActive ? "font-semibold  bg-base-200 " : "font-normal"}`
                  }
                >
                  {route.icon} {route.name}
                  {location.pathname === route.path ? (
                    <span
                      className="absolute inset-y-0 left-0 w-1 rounded-tr-md rounded-br-md bg-primary "
                      aria-hidden="true"
                    ></span>
                  ) : null}
                </NavLink>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LeftSidebar;
