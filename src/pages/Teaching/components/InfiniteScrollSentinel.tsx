import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  /** Gọi khi mốc này lọt vào (hoặc sắp lọt vào) màn hình. */
  onVisible: () => void;
  /** Đang tải / vừa lỗi thì thôi theo dõi. */
  disabled?: boolean;
  children?: ReactNode;
};

/**
 * Mốc đặt ở cuối danh sách: cuộn tới gần là tự gọi `onVisible` để tải thêm.
 *
 * Observer được dựng lại mỗi lần `disabled` tắt (tức là vừa tải xong): lúc
 * bắt đầu theo dõi, IntersectionObserver luôn báo trạng thái hiện tại, nên
 * nếu nội dung mới vẫn chưa lấp đầy màn hình thì tự tải tiếp — không phải
 * chờ người dùng cuộn thêm một nhịp.
 */
export default function InfiniteScrollSentinel({
  onVisible,
  disabled = false,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current();
      },
      // Tải trước khi chạm đáy hẳn để cuộn không bị khựng.
      { rootMargin: "0px 0px 300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);

  return <div ref={ref}>{children}</div>;
}
