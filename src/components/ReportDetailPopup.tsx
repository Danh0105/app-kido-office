import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, ClipboardList, MapPin } from "lucide-react";
import { dailyReportApi } from "@/service/report";
import { getSocket } from "@/utils/socket";
import { getEmployeeId, getEmployeeName } from "@/utils/auth";

type Task = {
  id: number;
  title: string;
  content?: string;
  location?: string;
};

type Report = {
  id: number;
  date: string;
  employee?: { id: number; name: string };
  tasks: Task[];
};

type Message = {
  id: number;
  message: string;
  senderRole: "MANAGER" | "EMPLOYEE";
  createdAt: string;
  sender?: { id: number; name: string };
};

type Props = {
  reportId: number;
  onClose: () => void;
};

export default function ReportDetailPopup({ reportId, onClose }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState("");
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserId = getEmployeeId();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportData, messagesData] = await Promise.all([
          dailyReportApi.getById(reportId),
          dailyReportApi.getMessages(reportId),
        ]);
        setReport(reportData);
        setMessages(messagesData);
      } catch (err) {
        console.error("Failed to load report:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reportId]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (data: any) => {
      if (data.reportId === reportId) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.messageId)) return prev;
          return [
            ...prev,
            {
              id: data.messageId,
              message: data.message,
              senderRole:
                data.senderId === currentUserId ? "MANAGER" : "EMPLOYEE",
              createdAt: data.createdAt,
              sender: { id: data.senderId, name: data.senderName || "" },
            },
          ];
        });
      }
    };

    socket.on("report:message:new", handleNewMessage);
    return () => {
      socket.off("report:message:new", handleNewMessage);
    };
  }, [reportId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const saved = await dailyReportApi.sendMessage({
        reportId,
        message: text,
      });
      setMessages((prev) => {
        if (prev.find((m) => m.id === saved.id)) return prev;
        return [
          ...prev,
          {
            id: saved.id,
            message: saved.message,
            senderRole: saved.senderRole || "MANAGER",
            createdAt: saved.createdAt,
            sender: { id: currentUserId, name: getEmployeeName() || "" },
          },
        ];
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const tagColors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-teal-100 text-teal-700",
    "bg-yellow-100 text-yellow-700",
  ];

  const extractTags = (text: string) => {
    const tags = text.match(/#[^\s#]+/g) || [];
    const cleaned = text.replace(/#[^\s#]+/g, "").trim();
    return { tags, cleaned };
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-[9999] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:w-[440px] md:max-h-[85vh] h-[90dvh] md:h-auto rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-orange-50">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-sm">Báo cáo công việc</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* REPORT INFO */}
            {report && (
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    {report.employee?.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(report.date)}
                  </span>
                </div>
              </div>
            )}

            {/* TASKS */}
            <div className="px-4 py-3 border-b space-y-2 max-h-[200px] overflow-y-auto">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Danh sách công việc ({report?.tasks?.length || 0})
              </div>
              {report?.tasks?.map((task, idx) => {
                const { tags: titleTags, cleaned: cleanedTitle } = extractTags(task.title);
                const { tags: contentTags, cleaned: cleanedContent } = task.content
                  ? extractTags(task.content)
                  : { tags: [], cleaned: "" };
                const allTags = [...titleTags, ...contentTags];

                return (
                  <div
                    key={task.id}
                    className="bg-orange-50 border border-orange-200 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{cleanedTitle}</div>
                        {allTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {allTags.map((tag, i) => (
                              <span
                                key={i}
                                className={`px-2 py-[1px] text-[10px] font-medium rounded-full ${tagColors[i % tagColors.length]}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {cleanedContent && (
                          <div className="text-xs text-gray-600 mt-1">
                            {cleanedContent}
                          </div>
                        )}
                        {task.location && (
                          <a
                            href={`https://maps.google.com/?q=${task.location}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 mt-1"
                          >
                            <MapPin className="w-3 h-3" />
                            {task.location}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!report?.tasks || report.tasks.length === 0) && (
                <div className="text-sm text-gray-400 text-center py-2">
                  Không có công việc
                </div>
              )}
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[150px]">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Hội thoại
              </div>

              {messages.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4">
                  Chưa có tin nhắn
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.sender?.id === currentUserId;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        isMe
                          ? "bg-orange-500 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-800 rounded-bl-md"
                      }`}
                    >
                      {!isMe && msg.sender?.name && (
                        <div className="text-[10px] font-semibold text-orange-600 mb-0.5">
                          {msg.sender.name}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.message}
                      </div>
                      <div
                        className={`text-[10px] mt-1 ${
                          isMe ? "text-orange-100" : "text-gray-400"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div className="relative border-t px-3 py-2 bg-white">
              {showSuggestions && (() => {
                const tasks = report?.tasks || [];
                const filtered = tasks.filter((t) =>
                  t.title.toLowerCase().includes(suggestionFilter.toLowerCase()),
                );
                if (filtered.length === 0) return null;

                return (
                  <div className="absolute bottom-full left-3 right-3 bg-white border rounded-xl shadow-lg max-h-[180px] overflow-y-auto z-10">
                    {filtered.map((task, i) => (
                      <button
                        key={task.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition ${
                          i === selectedSuggestionIdx ? "bg-orange-50" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const cursor = inputRef.current?.selectionStart || 0;
                          const before = newMessage.slice(0, cursor);
                          const after = newMessage.slice(cursor);
                          const hashStart = before.lastIndexOf("#");
                          const inserted = `#${task.title.replace(/\s+/g, "_")} `;
                          setNewMessage(
                            before.slice(0, hashStart) + inserted + after,
                          );
                          setShowSuggestions(false);
                          setSuggestionFilter("");
                          setSelectedSuggestionIdx(0);
                          inputRef.current?.focus();
                        }}
                      >
                        <span className="text-orange-500 font-medium">#</span>
                        {task.title}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewMessage(val);

                    const cursor = e.target.selectionStart || 0;
                    const textBefore = val.slice(0, cursor);
                    const hashIdx = textBefore.lastIndexOf("#");

                    if (hashIdx !== -1) {
                      const charBeforeHash = textBefore[hashIdx - 1];
                      if (hashIdx === 0 || charBeforeHash === " ") {
                        const query = textBefore.slice(hashIdx + 1);
                        if (!query.includes(" ")) {
                          setShowSuggestions(true);
                          setSuggestionFilter(query);
                          setSelectedSuggestionIdx(0);
                          return;
                        }
                      }
                    }
                    setShowSuggestions(false);
                  }}
                  onKeyDown={(e) => {
                    if (showSuggestions) {
                      const tasks = report?.tasks || [];
                      const filtered = tasks.filter((t) =>
                        t.title.toLowerCase().includes(suggestionFilter.toLowerCase()),
                      );

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedSuggestionIdx((prev) =>
                          prev < filtered.length - 1 ? prev + 1 : 0,
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedSuggestionIdx((prev) =>
                          prev > 0 ? prev - 1 : filtered.length - 1,
                        );
                        return;
                      }
                      if (e.key === "Enter" && filtered.length > 0) {
                        e.preventDefault();
                        const task = filtered[selectedSuggestionIdx];
                        const cursor = inputRef.current?.selectionStart || 0;
                        const before = newMessage.slice(0, cursor);
                        const after = newMessage.slice(cursor);
                        const hashStart = before.lastIndexOf("#");
                        const inserted = `#${task.title.replace(/\s+/g, "_")} `;
                        setNewMessage(
                          before.slice(0, hashStart) + inserted + after,
                        );
                        setShowSuggestions(false);
                        setSuggestionFilter("");
                        setSelectedSuggestionIdx(0);
                        return;
                      }
                      if (e.key === "Escape") {
                        setShowSuggestions(false);
                        return;
                      }
                    }

                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  placeholder="Nhập tin nhắn... (# để gắn tag)"
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center disabled:opacity-40 transition active:scale-95"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
