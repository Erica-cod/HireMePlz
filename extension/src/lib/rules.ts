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

  // Authorization
  [/authorized.?to.?work|work.?auth|legally.?auth/i, "work_authorization"],
  [/sponsor|visa.?sponsor/i, "needs_sponsorship"],

  // Other
  [/salary|compensation|pay/i, "salary_expectation"],
  [/start.?date|earliest.?start|available/i, "start_date"],
  [/gender/i, "gender"],
  [/veteran/i, "veteran_status"],
  [/disability|handicap/i, "disability_status"],
  [/race|ethnicity/i, "ethnicity"],
];
