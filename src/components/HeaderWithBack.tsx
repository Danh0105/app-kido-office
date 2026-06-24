import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getEmployeeRole } from "@/utils/auth";
type Props = {
    title?: string;
};

export default function HeaderWithBack({ title = "Danh sách trường" }: Props) {
    const navigate = useNavigate();

    const goHome = () => {
        const role = getEmployeeRole();

        if (role === "accountant") {
            navigate("/director/expense-management");
            return;
        }

        if (role === "director" || role === "saleadmin" || role === "salesadmin_la" || role === "director_la") {
            navigate("/director");
        } else {
            navigate("/employee");
        }
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
                className="ml-auto flex items-center gap-2 text-white bg-blue-500 px-3 py-2 rounded-xl shadow-sm active:scale-95 transition"
            >
                <HomeIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Trang chủ</span>
            </button>
        </div>
    );
}
