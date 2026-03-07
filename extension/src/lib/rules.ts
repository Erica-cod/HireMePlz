export const FIELD_RULES: [RegExp, string][] = [
  // Name
  [/first.?name|fname|given.?name/i, "first_name"],
  [/last.?name|lname|surname|family.?name/i, "last_name"],
  [/^name$|full.?name/i, "full_name"],

  // Contact
  [/e.?mail/i, "email"],
  [/phone|telephone|mobile|cell/i, "phone"],

  // Address
  [/^city$|city.?name/i, "city"],
  [/state|province/i, "state"],
  [/country/i, "country"],
  [/zip|postal/i, "zip_code"],
  [/address.?line.?1|street/i, "address_line1"],

  // Links
  [/linkedin/i, "linkedin_url"],
  [/github/i, "github_url"],
  [/website|portfolio|personal.?site/i, "website_url"],

  // Education
  [/school|university|institution|college/i, "education.school"],
  [/degree/i, "education.degree"],
  [/major|field.?of.?study|program/i, "education.major"],
  [/gpa|grade/i, "education.gpa"],
  [/graduation|grad.?date|end.?date/i, "education.end_date"],

  // Work
  [/company|employer|organization/i, "experience.company"],
  [/job.?title|position|role/i, "experience.title"],

  // Authorization & Status
  [/authorized.?to.?work|work.?auth|legally.?auth/i, "work_authorization"],
  [/sponsor|visa.?sponsor|require.?sponsor/i, "needs_sponsorship"],
  [/citizen|permanent.?residen|immigration|status.?in.?canada|status.?in.?us|current.?status/i, "immigration_status"],
  [/relocat|willing.?to.?relocat/i, "willing_to_relocate"],
  [/remote|work.?remotely|open.?to.?remote/i, "open_to_remote"],
  [/18.?years|age|over.?18|legally.?of.?age/i, "over_18"],
  [/previously.?work|worked.?here|former.?employee/i, "previously_worked"],
  [/background.?check|consent.?to.?background/i, "consent_background_check"],
  [/drug.?test|drug.?screen/i, "consent_drug_test"],
  [/non.?compete|non.?disclosure|nda/i, "no_noncompete"],
  [/notice.?period|when.?can.?you.?start/i, "notice_period"],
  [/hear.?about|how.?did.?you.?find|referral.?source/i, "referral_source"],

  // Other
  [/salary|compensation|pay|desired.?salary/i, "salary_expectation"],
  [/start.?date|earliest.?start|available.?date/i, "start_date"],
  [/gender/i, "gender"],
  [/pronoun/i, "pronouns"],
  [/veteran/i, "veteran_status"],
  [/disability|handicap/i, "disability_status"],
  [/race|ethnicity/i, "ethnicity"],
];
