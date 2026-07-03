import { HashRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import { ExportProvider } from "../hook/ExportProvider";
import { useCheckUpdate } from "../utils/useUpdate";
import UpdateModal from "../pages/UpdateModal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/pages/Employee/Sales/Statistics/hooks/queryClient";
import ScrollToTop from "@/components/ScrollToTop";


export default function Index() {
  const updateData = useCheckUpdate();


  return (
    <HashRouter>
      <ScrollToTop />
      <QueryClientProvider client={queryClient}>
        <ExportProvider>
          <AppRoutes />
        </ExportProvider>
      </QueryClientProvider>

      {updateData && <UpdateModal data={updateData} />}

    </HashRouter>
  );
}
