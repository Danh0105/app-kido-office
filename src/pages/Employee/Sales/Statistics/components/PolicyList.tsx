import { policiesApi } from "@/service/policy";
import { useEffect, useState } from "react";

export default function SubjectList({ schoolId }: any) {
    const [subjects, setSubjects] = useState<any[]>([]);

    useEffect(() => {
        // giả sử backend có API này
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        const data = await policiesApi.getBySubject(schoolId);
        setSubjects(data);
    };

    return (
        <div className="p-3 space-y-2">
            {subjects.map((s) => (
                <div key={s.id} className="border rounded p-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-gray-500">
                        {s.policies?.length || 0} policies
                    </div>
                </div>
            ))}
        </div>
    );
}