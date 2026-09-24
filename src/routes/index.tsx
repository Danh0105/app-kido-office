import { HashRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import AppRoutes from "./AppRoutes";
import { ExportProvider } from "../hook/ExportProvider";
import { useCheckUpdate } from "../utils/useUpdate";
import UpdateModal from "../pages/UpdateModal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/pages/Employee/Sales/Statistics/hooks/queryClient";
import ScrollToTop from "@/components/ScrollToTop";
import CheckinAlertWatcher from "@/components/CheckinAlertWatcher";


export default function Index() {
  const updateData = useCheckUpdate();


  return (
    <HashRouter>
      <ScrollToTop />
      {/* Nghe báo động chưa check-in ở mọi màn, cần Router nên đặt trong đây. */}
      <CheckinAlertWatcher />
      <QueryClientProvider client={queryClient}>
        <ExportProvider>
          <AppRoutes />
        </ExportProvider>
      </QueryClientProvider>

      {updateData && <UpdateModal data={updateData} />}

      {/* react-hot-toast đã dùng khắp app nhưng chưa có nơi render — mount 1 lần ở đây. */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { fontSize: "14px", maxWidth: "90vw" },
        }}
      />
    </HashRouter>
  );
}
