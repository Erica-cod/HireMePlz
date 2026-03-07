export type UserProfile = {
  fullName?: string | null;
  phone?: string | null;
  location?: string | null;
  school?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  visaStatus?: string | null;
  preferredRoles: string[];
  preferredCities: string[];
  skills: string[];
  summary?: string | null;
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy?: string | null;
  description?: string | null;
};

export type Experience = {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  description: string;
  highlights: string[];
  skills: string[];
};

export type Story = {
  id: string;
  title: string;
  category: string;
  promptTags: string[];
  situation: string;
  task?: string | null;
  action: string;
  result: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  source?: string | null;
  updatedAt: string;
};

export type JobMatch = {
  id: string;
  score: number;
  reasons: string[];
  job: {
    id: string;
    company: string;
    title: string;
    location?: string | null;
    applyUrl: string;
  };
};

export type AnswerMemory = {
  id: string;
  questionHash: string;
  companyKey: string;
  roleKey: string;
  question: string;
  answer: string;
  hitCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
};
