import {
  LayoutDashboard,
  Building2,
  Zap,
  FileSignature,
  Wrench,
  Hammer,
  Users,
  Calendar,
  CalendarDays,
  Receipt,
  CreditCard,
  UserCircle,
  MessageSquare,
  Shield,
  ClipboardCheck,
  TrendingUp,
  Inbox,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  description: string;
  adminOnly?: boolean;
}

export interface NavDropdown {
  type: "dropdown";
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  items: NavItem[];
}

export interface NavLink {
  type: "link";
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export type NavElement = NavDropdown | NavLink;

export const navigationConfig: NavElement[] = [
  {
    type: "link",
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    type: "link",
    label: "Leads",
    path: "/leads",
    icon: TrendingUp,
  },
  {
    type: "link",
    label: "Inbox",
    path: "/communications",
    icon: Inbox,
  },
  {
    type: "dropdown",
    label: "Properties",
    icon: Building2,
    items: [
      {
        path: "/properties",
        label: "All Properties",
        icon: Building2,
        description: "View and manage all properties",
      },
      {
        path: "/utilities",
        label: "Utilities",
        icon: Zap,
        description: "Track bills and usage",
      },
      {
        path: "/documents",
        label: "Documents",
        icon: FileSignature,
        description: "Leases and agreements",
      },
    ],
  },
  {
    type: "dropdown",
    label: "Operations",
    icon: Wrench,
    items: [
      {
        path: "/maintenance",
        label: "Maintenance",
        icon: Hammer,
        description: "Work orders and repairs",
      },
      {
        path: "/vendors",
        label: "Vendors",
        icon: Users,
        description: "Contractor management",
      },
      {
        path: "/visits",
        label: "Log Visit",
        icon: Calendar,
        description: "Record property visits",
      },
      {
        path: "/bookings",
        label: "Bookings",
        icon: CalendarDays,
        description: "Reservations and guests",
      },
    ],
  },
  {
    type: "dropdown",
    label: "Financials",
    icon: Receipt,
    items: [
      {
        path: "/expenses",
        label: "Expenses",
        icon: Receipt,
        description: "Track spending",
      },
      {
        path: "/charges",
        label: "Monthly Charges",
        icon: CreditCard,
        description: "Owner billing",
        adminOnly: true,
      },
    ],
  },
  {
    type: "dropdown",
    label: "Owners",
    icon: UserCircle,
    adminOnly: true,
    items: [
      {
        path: "/owners",
        label: "Owner Directory",
        icon: UserCircle,
        description: "Property owners",
      },
      {
        path: "/owner-conversations",
        label: "Owner Intel",
        icon: MessageSquare,
        description: "Communication insights",
      },
      {
        path: "/owner-portal-management",
        label: "Owner Portal",
        icon: Building2,
        description: "Send portal invites",
      },
    ],
  },
  {
    type: "dropdown",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
    items: [
      {
        path: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Admin overview and tools",
      },
      {
        path: "/admin?tab=users",
        label: "User Management",
        icon: Users,
        description: "Manage user accounts",
      },
      {
        path: "/admin?tab=applications",
        label: "Job Applications",
        icon: UserCircle,
        description: "Review applications",
      },
      {
        path: "/admin?tab=faqs",
        label: "FAQ Management",
        icon: MessageSquare,
        description: "Manage FAQs",
      },
      {
        path: "/admin?tab=bugs",
        label: "Bug Tracker",
        icon: ClipboardCheck,
        description: "Track reported bugs",
      },
      {
        path: "/admin?tab=calendar",
        label: "Calendar",
        icon: CalendarDays,
        description: "Discovery call scheduling",
      },
      {
        path: "/admin?tab=holiday-emails",
        label: "Holiday Emails",
        icon: Calendar,
        description: "Schedule holiday emails",
      },
      {
        path: "/admin?tab=google-reviews",
        label: "Google Reviews",
        icon: MessageSquare,
        description: "Review conversion campaign",
      },
      {
        path: "/admin?tab=gbp",
        label: "Google Business Profile",
        icon: Building2,
        description: "Reviews & posts automation",
      },
    ],
  },
];
