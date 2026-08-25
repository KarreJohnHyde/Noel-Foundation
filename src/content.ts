export type ProgramSlug = "childrens-health" | "education" | "womens-livelihoods";

export type Program = {
  slug: ProgramSlug;
  eyebrow: string;
  title: string;
  shortTitle: string;
  summary: string;
  statement: string;
  image: string;
  imageAlt: string;
  accent: string;
  soft: string;
  support: string[];
  csrOptions: string[];
  outcome: string;
  focusAreas?: string[];
};

export const contact = {
  phoneDisplay: "+91 94442 45151",
  phoneHref: "+919444245151",
  email: "info@noelfoundation.org",
  location: "Chennai, Tamil Nadu, India",
  address: [
    "G2 - 305, KG Signature City",
    "200 Feet Bypass Road, Maduravoyal",
    "Chennai - 600095, Tamil Nadu, India",
  ],
  website: "https://noelfoundation.in/",
};

export const programs: Program[] = [
  {
    slug: "childrens-health",
    eyebrow: "Children's health",
    title: "Giving children with congenital heart disease a chance to live",
    shortTitle: "Children's Health",
    summary:
      "Coordinated pediatric heart-care support for children and families navigating diagnosis, treatment and recovery.",
    statement: "More children treated. More families supported. More futures protected.",
    image: "/images/pediatric-care-visit.jpg",
    imageAlt:
      "A Noel Foundation representative speaking with a child and caregiver during a hospital visit",
    accent: "#c94f00",
    soft: "#fff1e6",
    support: [
      "Medical screening and diagnosis",
      "Cardiology consultations and diagnostic investigations",
      "Financial support for pediatric heart surgeries",
      "Hospital coordination and family guidance",
      "Pre-operative, post-operative and recovery support",
    ],
    csrOptions: [
      "Sponsor a child",
      "Sponsor surgeries",
      "Fund diagnostic camps",
      "Support recovery",
      "Adopt a heart-care program",
    ],
    outcome: "Timely medical support with coordinated care for the child and family.",
  },
  {
    slug: "education",
    eyebrow: "Education",
    title: "Opening pathways for first-generation learners",
    shortTitle: "Education",
    summary:
      "Practical support that helps learners from low-income families access education, continue learning and build capability.",
    statement: "Access to education -> completion -> capability -> economic opportunity.",
    image: "/images/education-outreach.jpg",
    imageAlt: "A child receiving a school bag during a Noel Foundation education outreach program",
    accent: "#183996",
    soft: "#eef2ff",
    support: [
      "Educational sponsorships and essential school expenses",
      "Learning materials and school supplies",
      "Digital learning support",
      "Mentoring, guidance and career exposure",
      "Life-skills and leadership opportunities",
    ],
    csrOptions: [
      "Sponsor a child",
      "Support a school",
      "Fund learning resources",
      "Enable digital education",
      "Build an education centre",
    ],
    outcome: "Learners stay connected to education and gain pathways toward opportunity.",
  },
  {
    slug: "womens-livelihoods",
    eyebrow: "Women's livelihoods",
    title: "Skills that create income. Income that creates independence.",
    shortTitle: "Women's Livelihoods",
    summary:
      "Market-oriented skills, tools and linkages that help women move toward sustainable income and enterprise.",
    statement: "Train -> Equip -> Connect -> Earn -> Sustain.",
    image: "/images/community-food-support.jpg",
    imageAlt: "Women participating in a Noel Foundation community support initiative in Chennai",
    accent: "#a83e00",
    soft: "#fff7df",
    support: [
      "Market-oriented skill training",
      "Entrepreneurship and financial literacy",
      "Start-up equipment and toolkits",
      "Product development and market linkage",
      "Employment, self-employment and micro-enterprise pathways",
    ],
    csrOptions: [
      "Train a woman",
      "Equip a woman",
      "Create a micro-enterprise",
      "Sponsor a training centre",
      "Build a women's livelihood program",
    ],
    outcome: "Women build capability, access earning pathways and strengthen household resilience.",
    focusAreas: [
      "Baking & food processing",
      "Tailoring",
      "Beauty & wellness",
      "Handicrafts",
      "Digital skills",
      "Micro-enterprise development",
    ],
  },
];

export const approach = [
  {
    number: "01",
    title: "Identify",
    description: "Understand community needs and identify vulnerable beneficiaries with care.",
  },
  {
    number: "02",
    title: "Equip",
    description: "Provide healthcare, education, skills, resources and opportunities.",
  },
  {
    number: "03",
    title: "Empower",
    description: "Build confidence, capability and practical pathways to independence.",
  },
  {
    number: "04",
    title: "Connect",
    description: "Create access to hospitals, schools, employers, markets and institutions.",
  },
  {
    number: "05",
    title: "Sustain",
    description: "Track outcomes, learn from delivery and strengthen long-term impact.",
  },
];

export const values = [
  {
    title: "Need-driven",
    description: "Programs begin with a clearly understood community need.",
    icon: "compass",
  },
  {
    title: "Impact-focused",
    description: "Every partnership is designed around meaningful outcomes.",
    icon: "trend",
  },
  {
    title: "Community-based",
    description: "Solutions are shaped with people, not simply delivered to them.",
    icon: "people",
  },
  {
    title: "Transparent",
    description: "Reporting and responsible resource use are built into delivery.",
    icon: "report",
  },
  {
    title: "Scalable",
    description: "Strong models are designed to reach more people responsibly.",
    icon: "layers",
  },
  {
    title: "Sustainable",
    description: "The goal is lasting capability, not one-time assistance alone.",
    icon: "leaf",
  },
];

export const partnershipModels = [
  {
    title: "Program Sponsorship",
    description: "Fund an entire project or program end-to-end.",
  },
  {
    title: "Beneficiary Sponsorship",
    description: "Support identified children, students or women.",
  },
  {
    title: "Project Partnership",
    description: "Co-create and implement a customized CSR initiative.",
  },
  {
    title: "Employee Engagement",
    description: "Connect employees with volunteering and community engagement.",
  },
  {
    title: "Strategic Partnership",
    description: "Build multi-year programs with measurable outcomes.",
  },
];

export const sdgs = [
  { number: "01", label: "No Poverty", programs: "Livelihoods" },
  { number: "03", label: "Good Health", programs: "Children's Health" },
  { number: "04", label: "Quality Education", programs: "Education" },
  { number: "05", label: "Gender Equality", programs: "Women's Livelihoods" },
  { number: "08", label: "Decent Work", programs: "Livelihoods" },
  { number: "10", label: "Reduced Inequalities", programs: "All programs" },
];

export const programStories = [
  {
    tag: "Children's Health",
    title: "When timely care becomes possible",
    description:
      "A coordinated journey can help a family move from uncertainty to consultation, treatment support and recovery guidance.",
    image: "/images/family-medical-support.jpg",
    imageAlt: "A Noel Foundation representative meeting a child and caregiver in a hospital room",
    href: "/programs/childrens-health",
  },
  {
    tag: "Education",
    title: "A school kit can open a bigger door",
    description:
      "School materials, mentoring and sustained support help first-generation learners stay connected to opportunity.",
    image: "/images/student-kit-distribution.jpg",
    imageAlt: "A Noel Foundation education outreach event where a child receives a school bag",
    href: "/programs/education",
  },
  {
    tag: "Community",
    title: "Support that reaches the household",
    description:
      "Community-based work responds to immediate needs while building pathways toward longer-term resilience.",
    image: "/images/food-kit-distribution.jpg",
    imageAlt:
      "Noel Foundation volunteers distributing essential supplies during a community outreach initiative",
    href: "/programs/womens-livelihoods",
  },
];

export const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/noelfoundation/" },
  { label: "Instagram", href: "https://www.instagram.com/noelfoundation/" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/noel-foundation-india/about/",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UCg2yxkn1OvSaxhUh_RSLdBw",
  },
];
