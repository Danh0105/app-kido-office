import api from "./api";

export type PolicyYearChecklist = {
  giftFlowersCompleted: boolean;
  openingCeremonyCompleted: boolean;
  teachersDayCompleted: boolean;
};

export type UpdatePolicyYearChecklistInput = Partial<PolicyYearChecklist> & {
  schoolId: number;
  schoolYear: string;
};

export const policyYearApi = {
  getBySchoolYear: async (
    schoolId: number,
    schoolYear: string
  ): Promise<PolicyYearChecklist | null> => {
    const res = await api.get("/policy-years/checklist", {
      params: { schoolId, schoolYear },
    });
    return res.data || null;
  },

  updateChecklist: async (
    input: UpdatePolicyYearChecklistInput
  ): Promise<PolicyYearChecklist> => {
    const res = await api.patch("/policy-years/checklist", input);
    return res.data;
  },
};
