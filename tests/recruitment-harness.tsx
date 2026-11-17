import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import RecruitmentPage from "../src/pages/Recruitment/RecruitmentPage";
import "../src/css/tailwind.scss";

createRoot(document.getElementById("root")!).render(<><RecruitmentPage /><Toaster /></>);
