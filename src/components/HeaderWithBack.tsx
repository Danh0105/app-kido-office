import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { hasRole } from "@/utils/auth";
type Props = {
    title?: string;
};

export default function HeaderWithBack({ title = "Danh sách trường" }: Props) {
    const navigate = useNavigate();

    const isAccountant = hasRole("accountant");
    const isEmployeeType = hasRole(
        "employee",
        "probation",
        "employee_la",
        "sales",
    );
    const isDirectorType = hasRole(
        "director",
        "director_la",
        "saleadmin",
        "salesadmin_la",
        "ketoan_congno",
        "thuquy",
        "ketoan_truong",
        "troly_gd",
    );

    const homePath = isAccountant
        ? "/director/expense-management"
        : isDirectorType
        ? "/director"
        : isEmployeeType
        ? "/employee/home"
        : "/";

    const goHome = () => {
        navigate(homePath);
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            CapacitorApp.exitApp();
        }
    };

    // 👉 Handle back button (Android hardware)
    useEffect(() => {
        let handler: any;

        const setup = async () => {
            handler = await CapacitorApp.addListener("backButton", goBack);
        };

        setup();

        return () => {
            handler?.remove();
        };
    }, [navigate]);

    return (
        <div className="fixed top-0 left-0 w-full h-14 bg-blue-500 flex items-center px-4 z-50 shadow">

            {/* Back */}
            <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-white">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>

                <h1 className="text-white font-semibold text-base">
                    {decodeURIComponent(title)}
                </h1>
            </div>
            {/* Title */}


            {/* Home */}
            <button
                onClick={goHome}
                className="ml-auto flex items-center gap-1.5 text-blue-600 bg-white px-3 py-1.5 rounded-xl font-medium text-sm active:scale-95 transition shadow-sm"
            >
                <HomeIcon className="w-4 h-4" />
                Trang chủ
            </button>
        </div>
    );
}
