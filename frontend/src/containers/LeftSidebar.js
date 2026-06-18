import { getSidebarByRole } from "../routes/sidebar";
import { NavLink, Link, useLocation } from "react-router-dom";
import SidebarSubmenu from "./SidebarSubmenu";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

function LeftSidebar() {
  const location = useLocation();
  const activeRole = localStorage.getItem("activeRole") || "";
  const routes = getSidebarByRole(activeRole);
  const isRouteActive = (route) => {
    const isActiveAlias = (route.activePaths || []).some(
      (path) =>
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`),
    );

    if (isActiveAlias) return true;
    if (route.exact) return location.pathname === route.path;

    return (
      location.pathname === route.path ||
      location.pathname.startsWith(`${route.path}/`)
    );
  };
  const close = (e) => {
    const drawer = document.getElementById("left-sidebar-drawer");
    if (drawer) drawer.checked = false;
  };

  return (
    <div className="drawer-side z-30">
      <label htmlFor="left-sidebar-drawer" className="drawer-overlay"></label>
      <ul className="menu relative min-h-full w-72 overflow-y-auto border-r border-base-300/70 bg-base-100/95 pt-2 text-base-content shadow-[16px_0_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:w-80">
        {/* Logo di awal sidebar */}
        <li className="mb-6 px-3 pt-4">
          <div className="flex w-full justify-center rounded-3xl border border-base-300/60 bg-base-200/70 px-4 py-4 shadow-sm">
            <Link to={"/app/dashboard"}>
              <img
                src={process.env.PUBLIC_URL + '/logo1.svg'}
                alt="PT OTAK KANAN"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>
        </li>
        <button
          className="btn btn-ghost btn-circle absolute right-3 top-3 z-50 mt-4 bg-base-200 text-base-content shadow-sm hover:bg-primary hover:text-primary-content lg:hidden"
          onClick={() => close()}
        >
          <XMarkIcon className="h-5 inline-block w-5" />
        </button>
        {routes.map((route, k) => (
          <div key={k}>
            {route.submenu ? (
              <SidebarSubmenu {...route} />
            ) : (
              <li>
                <NavLink
                  end
                  to={route.path}
                  onClick={() => close()}
                  className={() =>
                    `relative mb-1 rounded-2xl px-4 py-3 font-medium transition-all duration-200 ${
                      isRouteActive(route)
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                        : "text-base-content/80 hover:bg-base-200/80 hover:text-base-content"
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{route.icon}</span>
                    <span>{route.name}</span>
                  </span>

                  {isRouteActive(route) ? (
                    <span
                      className="absolute inset-y-2 left-2 w-1 rounded-full bg-primary shadow-[0_0_0_4px_rgba(234,107,47,0.12)]"
                      aria-hidden="true"
                    ></span>
                  ) : null}
                </NavLink>
              </li>
            )}
          </div>
        ))}
      </ul>
    </div>
  );
}

export default LeftSidebar;
