import {
  BadgeCheck,
  Banknote,
  BookUser,
  Briefcase,
  FileText,
  Home,
  Landmark,
  Plane,
  Receipt,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type DocStatus = "verified" | "pending" | "issue" | "missing";

export interface DocumentItem {
  id: string;
  name: string;
  icon: LucideIcon;
  status: DocStatus;
  confidence?: number;
  extracted?: { label: string; value: string }[];
  issue?: string;
}

export const documents: DocumentItem[] = [
  {
    id: "passport",
    name: "Passport",
    icon: Plane,
    status: "verified",
    confidence: 98,
    extracted: [
      { label: "Full Name", value: "John A. Carter" },
      { label: "Date of Birth", value: "14 Mar 1992" },
      { label: "Nationality", value: "United Kingdom" },
      { label: "Expiry", value: "22 Aug 2031" },
    ],
  },
  {
    id: "visa",
    name: "Visa",
    icon: BadgeCheck,
    status: "verified",
    confidence: 96,
    extracted: [
      { label: "Type", value: "Skilled Worker" },
      { label: "Valid Until", value: "05 Jan 2028" },
    ],
  },
  {
    id: "employment",
    name: "Employment Letter",
    icon: Briefcase,
    status: "verified",
    confidence: 94,
    extracted: [
      { label: "Company", value: "Northwind Labs" },
      { label: "Role", value: "Senior Product Designer" },
      { label: "Start Date", value: "12 Feb 2022" },
      { label: "Contract", value: "Permanent" },
    ],
  },
  {
    id: "payslip",
    name: "Payslip",
    icon: Receipt,
    status: "issue",
    confidence: 71,
    issue: "Payslip is older than 60 days.",
    extracted: [
      { label: "Employer", value: "Northwind Labs" },
      { label: "Net Monthly", value: "£6,420" },
      { label: "Period", value: "Aug 2026" },
    ],
  },
  {
    id: "bank",
    name: "Bank Statement",
    icon: Landmark,
    status: "pending",
    confidence: 0,
  },
  {
    id: "tax",
    name: "Tax Documents",
    icon: FileText,
    status: "missing",
  },
  {
    id: "utility",
    name: "Utility Bill",
    icon: Zap,
    status: "verified",
    confidence: 92,
    extracted: [
      { label: "Provider", value: "Octopus Energy" },
      { label: "Address", value: "42 Rowan Lane, London" },
      { label: "Issued", value: "02 Oct 2026" },
    ],
  },
  {
    id: "reference",
    name: "Rental Reference",
    icon: BookUser,
    status: "missing",
  },
];

export const profile = {
  name: "John Carter",
  firstName: "John",
  photoInitials: "JC",
  occupation: "Senior Product Designer",
  nationality: "United Kingdom",
  monthlyIncome: "£6,420",
  address: "42 Rowan Lane, London E2",
  employment: "Northwind Labs · Permanent",
  visa: "Skilled Worker · Valid to 2028",
};

export const journey = [
  { id: "identity", name: "Identity", done: true },
  { id: "income", name: "Income", done: true },
  { id: "employment", name: "Employment", done: true },
  { id: "residence", name: "Residence", done: false, active: true },
  { id: "review", name: "Review", done: false, locked: true },
];

export const timeline = [
  { name: "Application Created", date: "Oct 2", done: true, icon: FileText },
  { name: "Identity Verified", date: "Oct 3", done: true, icon: BadgeCheck },
  { name: "Employment Verified", date: "Oct 4", done: true, icon: Briefcase },
  { name: "Income Verified", date: "Oct 5", done: true, icon: Banknote },
  { name: "Residence Verified", date: "Pending", done: false, icon: Home },
  { name: "Application Ready", date: "—", done: false, icon: BadgeCheck },
];

export const improvements = [
  { title: "Upload latest bank statement", impact: 5 },
  { title: "Replace outdated payslip", impact: 4 },
  { title: "Add rental reference letter", impact: 3 },
];

export const insights = [
  {
    title: "You're 6% away from Excellent",
    body: "Adding a recent bank statement will unlock the highest confidence tier.",
  },
];

export const confidence = 94;
