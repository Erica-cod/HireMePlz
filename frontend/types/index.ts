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
  tags: string[];
  content: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  source?: string | null;
  updatedAt: string;
};

export type Job = {
  id: string;
  source: string;
  sourceSite?: string | null;
  company: string;
  companyUrl?: string | null;
  title: string;
  location?: string | null;
  isRemote?: boolean | null;
  applyUrl: string;
  description?: string | null;
  skills: string[];
  jobType?: string | null;
  jobLevel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryInterval?: string | null;
  postedAt?: string | null;
};

export type JobMatch = {
  id: string;
  score: number;
  reasons: string[];
  job: Job;
};

export type JobSubscription = {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
  locations: string[];
  isRemote?: boolean | null;
  jobTypes: string[];
  sites: string[];
  countryIndeed?: string | null;
  hoursOld?: number | null;
  resultsWanted: number;
  runEveryMinutes: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  runs?: JobIngestionRun[];
};

export type JobIngestionRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  matchedCount: number;
  errorMessage?: string | null;
};

