// React Router DOM Imports
import Sidebar from "@/components/custom/Sidebar";
import { Outlet } from "react-router-dom";

// Components Imports
Sidebar


export default function Layout() {
  return(
    <div className="w-full relative">
      {/* <Sidebar /> */}
      <div className="border w-full z-0 flex justify-center">
        <Outlet />
      </div>
    </div>
  )
}

{/* <Navbar /> */}
{/* <Outlet /> */}
