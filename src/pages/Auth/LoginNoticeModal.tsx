export type LoginNotice = {
  id: string;
  title: string;
  message: string;
  theme?: "womens-day-20-10";
};

type Props = {
  notice: LoginNotice;
  onClose: () => void;
};

const PETALS = [
  { left: "3%", delay: "-7s", duration: "12s", size: 13, opacity: 0.72 },
  { left: "9%", delay: "-2s", duration: "10s", size: 17, opacity: 0.9 },
  { left: "15%", delay: "-9s", duration: "14s", size: 11, opacity: 0.68 },
  { left: "21%", delay: "-4s", duration: "11s", size: 15, opacity: 0.82 },
  { left: "28%", delay: "-11s", duration: "15s", size: 19, opacity: 0.76 },
  { left: "34%", delay: "-6s", duration: "13s", size: 12, opacity: 0.86 },
  { left: "40%", delay: "-1s", duration: "10s", size: 16, opacity: 0.7 },
  { left: "47%", delay: "-8s", duration: "14s", size: 14, opacity: 0.92 },
  { left: "53%", delay: "-3s", duration: "11s", size: 18, opacity: 0.78 },
  { left: "59%", delay: "-10s", duration: "15s", size: 12, opacity: 0.84 },
  { left: "66%", delay: "-5s", duration: "12s", size: 16, opacity: 0.74 },
  { left: "72%", delay: "-12s", duration: "16s", size: 20, opacity: 0.88 },
  { left: "78%", delay: "-7s", duration: "13s", size: 13, opacity: 0.69 },
  { left: "84%", delay: "-2s", duration: "10s", size: 17, opacity: 0.85 },
  { left: "90%", delay: "-9s", duration: "14s", size: 11, opacity: 0.76 },
  { left: "96%", delay: "-4s", duration: "12s", size: 15, opacity: 0.9 },
] as const;

/** Lớp nền tối và cánh hoa chỉ là trang trí, luôn nằm sau nội dung popup. */
export default function LoginNoticeModal({ notice, onClose }: Props) {
  const hasPetals = notice.theme === "womens-day-20-10";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/80 px-5 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-notice-title"
    >
      {hasPetals && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {PETALS.map((petal, index) => (
            <span
              key={`${petal.left}-${petal.delay}`}
              className={`login-notice-petal absolute -top-8 block bg-gradient-to-br from-pink-200 via-pink-400 to-rose-500 shadow-[0_0_10px_rgba(244,114,182,0.35)] ${
                index % 2 === 0
                  ? "login-notice-petal-left"
                  : "login-notice-petal-right"
              }`}
              style={{
                left: petal.left,
                width: petal.size,
                height: Math.round(petal.size * 1.45),
                opacity: petal.opacity,
                animationDelay: petal.delay,
                animationDuration: petal.duration,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 px-6 pb-6 pt-8 text-center shadow-[0_24px_80px_rgba(244,63,94,0.42)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -left-12 -top-14 h-36 w-36 rounded-full bg-pink-300/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-rose-200/60 blur-2xl" />

        <div className="relative">
          <div className="mb-3 text-5xl" aria-hidden="true">
            💐
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">
            Dành riêng cho bạn
          </p>
          <h2
            id="login-notice-title"
            className="text-2xl font-bold leading-tight text-rose-700"
          >
            {notice.title}
          </h2>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-slate-700">
            {notice.message}
          </p>

          <div
            className="my-5 flex items-center justify-center gap-3 text-xl text-pink-400"
            aria-hidden="true"
          >
            <span>🌷</span>
            <span className="h-px w-16 bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
            <span>🌸</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-3 font-semibold text-white shadow-lg shadow-pink-200 transition active:scale-[0.98]"
          >
            Nhận lời chúc 💝
          </button>
        </div>
      </div>

      <style>{`
        .login-notice-petal {
          border-radius: 100% 0 100% 100%;
          will-change: transform, opacity;
        }

        .login-notice-petal-left {
          animation-name: login-notice-petal-fall-left;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .login-notice-petal-right {
          animation-name: login-notice-petal-fall-right;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes login-notice-petal-fall-left {
          0% { transform: translate3d(0, -12vh, 0) rotate(0deg); }
          45% { transform: translate3d(-42px, 48vh, 0) rotate(250deg); }
          100% { transform: translate3d(70px, 112vh, 0) rotate(560deg); }
        }

        @keyframes login-notice-petal-fall-right {
          0% { transform: translate3d(0, -12vh, 0) rotate(30deg); }
          45% { transform: translate3d(48px, 48vh, 0) rotate(280deg); }
          100% { transform: translate3d(-64px, 112vh, 0) rotate(590deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-notice-petal {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
