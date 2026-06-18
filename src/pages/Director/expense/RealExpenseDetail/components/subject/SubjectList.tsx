import SubjectCard from "./SubjectCard";
import EmptyState from "../EmptyState";

type Props = {
  subjects: any[];
};

export default function SubjectList({ subjects }: Props) {
  if (!subjects.length) {
    return <EmptyState text="Không có môn học" />;
  }

  return (
    <div className="space-y-4">
      {subjects.map((subject: any) => (
        <SubjectCard key={subject.id} subject={subject} />
      ))}
    </div>
  );
}
