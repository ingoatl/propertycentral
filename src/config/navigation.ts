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
    ],
  },
  {
    type: "link",
    label: "Admin",
    path: "/admin",
    icon: Shield,
    adminOnly: true,
  },
];
