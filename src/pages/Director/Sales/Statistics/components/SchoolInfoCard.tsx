export default function SchoolInfoCard({ p }: any) {
    if (!p) return null;

    return (
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden border">

            {/* HEADER */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-white">
                <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-lg">
                    🏫
                </div>

                <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">
                        {p.schoolName}
                    </p>
                    <p className="text-xs text-gray-400">
                        Mã trường:   {p.schoolId}
                    </p>
                </div>
            </div>

            {/* INFO */}
            <div className="px-4 pb-3 text-sm text-gray-600 space-y-1">
                <p className="truncate">📍 {p.address}</p>
                <p>👤 {p.representative}</p>
                <p>📞 {p.phone}</p>
                <p>🏷️ MST: {p.taxCode}</p>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-2 text-center border-t">
                <div className="py-2">
                    <p className="text-xs text-gray-400">Học sinh</p>
                    <p className="font-semibold text-blue-600">
                        {p.scale}
                    </p>
                </div>
                <div className="py-2 border-l">
                    <p className="text-xs text-gray-400">Lớp</p>
                    <p className="font-semibold text-blue-600">
                        {p.classCount}
                    </p>
                </div>
            </div>
        </div>
    );
}