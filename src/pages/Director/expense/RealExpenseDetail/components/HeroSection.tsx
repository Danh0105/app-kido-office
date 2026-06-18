import { School2 } from "lucide-react";

export default function HeroSection({ school }: any) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 p-5 shadow-xl">
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-blue-100 text-sm">Quản lý thực chi</p>

          <h1 className="text-white text-2xl font-bold mt-2">{school?.name}</h1>

          <p className="text-blue-100 text-sm mt-2">{school?.period?.name}</p>
        </div>

        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
          <School2 className="text-white" size={30} />
        </div>
      </div>
    </div>
  );
}
