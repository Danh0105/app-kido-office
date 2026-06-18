import { Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import logo from "../static/Logo.png";
import NotificationDropdown from "@/components/PortalDropdown";

type Props = {
  unreadCount?: number;
  notifications?: any[];
  loadMore: any;
  tab: "unread" | "read";
  setTab: (tab: "unread" | "read") => void;
  onClickNotification: (notification: any) => void;
  hasMore: {
    POLICY: { unread: boolean; read: boolean };
    SUGGEST: { unread: boolean; read: boolean };
    REPORT: { unread: boolean; read: boolean };
    WEEKLY_PLAN: { unread: boolean; read: boolean };
  };
  notificationStats: Record<
    "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN",
    {
      unread: number;
      read: number;
    }
  >;
};

export default function AppHeader({
  unreadCount = 0,
  notifications = [],
  loadMore,
  tab,
  setTab,
  onClickNotification,
  hasMore,
  notificationStats,
}: Props) {
  console.log(notificationStats);
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const totalUnread =
    (notificationStats?.POLICY?.unread || 0) +
    (notificationStats?.SUGGEST?.unread || 0) +
    (notificationStats?.REPORT?.unread || 0) +
    (notificationStats?.WEEKLY_PLAN?.unread || 0);
  return (
    <div className="sticky top-0 z-50 bg-gray-100 py-0 md:py-2">
      <header
        className="
            w-full md:max-w-6xl md:mx-auto

            bg-orange-500 text-white

            md:rounded-xl md:shadow

            px-4 md:px-6 lg:px-8

            h-16

            flex items-center justify-between
        "
      >
        {/* LEFT */}
        <div className="flex items-center">
          <img
            src={logo}
            className="
                            h-12 w-auto
                            object-contain
                        "
          />
        </div>

        {/* RIGHT */}
        <div className="flex items-center">
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setOpen(!open)}
              className="
                    relative 
                    p-2 rounded-full 
                    hover:bg-white/20 
                    transition
                    flex items-center justify-center
                "
            >
              <Bell size={20} />

              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </button>

            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-[320px] md:w-[380px] z-50">
              <NotificationDropdown
                open={open}
                dropdownRef={dropdownRef}
                notifications={notifications}
                loadMore={loadMore}
                tab={tab}
                setTab={setTab}
                hasMore={hasMore}
                notificationStats={notificationStats}
                onClickNotification={onClickNotification}
              />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
