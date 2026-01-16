import { useMemo } from "react";

export type EmailClassification = "important" | "promotional" | "normal";

interface EmailInfo {
  fromName: string;
  from: string;
  subject: string;
  snippet?: string;
}

// Promotional senders - specific known promotional contacts
const PROMOTIONAL_SENDERS = [
  "deb hofstede",
  "cutco",
  "marketing",
  "newsletter",
  "noreply",
  "no-reply",
  "promotions",
  "sales@",
  "deals@",
  "offers@",
  "promo@",
];

// Promotional keywords in subject/body
const PROMOTIONAL_KEYWORDS = [
  "bonus",
  "deal",
  "sale",
  "offer",
  "discount",
  "limited time",
  "act now",
  "free gift",
  "exclusive offer",
  "unsubscribe",
  "don't miss",
  "last chance",
  "special offer",
  "save now",
  "clearance",
  "% off",
  "coupon",
  "promo code",
  "flash sale",
  "black friday",
  "cyber monday",
];

// Important senders/patterns
const IMPORTANT_SENDERS = [
  "peachhaus",
  "support",
  "customer",
  "inquiry",
  "booking",
  "reservation",
  "property",
  "tenant",
  "owner",
  "maintenance",
  "urgent",
  "emergency",
];

// Important keywords
const IMPORTANT_KEYWORDS = [
  "urgent",
  "asap",
  "emergency",
  "important",
  "bug",
  "issue",
  "problem",
  "help",
  "support ticket",
  "customer inquiry",
  "property inquiry",
  "booking request",
  "maintenance request",
  "repair",
  "broken",
  "leak",
  "not working",
  "payment",
  "invoice",
  "contract",
  "lease",
  "move-in",
  "move-out",
];

export function classifyEmail(email: EmailInfo): EmailClassification {
  const fromLower = email.from.toLowerCase();
  const fromNameLower = email.fromName.toLowerCase();
  const subjectLower = email.subject.toLowerCase();
  const snippetLower = email.snippet?.toLowerCase() || "";
  
  // Check for promotional first (these get deprioritized)
  const isPromotionalSender = PROMOTIONAL_SENDERS.some(sender => 
    fromLower.includes(sender) || fromNameLower.includes(sender)
  );
  
  const hasPromotionalKeyword = PROMOTIONAL_KEYWORDS.some(keyword => 
    subjectLower.includes(keyword) || snippetLower.includes(keyword)
  );
  
  if (isPromotionalSender || hasPromotionalKeyword) {
    return "promotional";
  }
  
  // Check for important
  const isImportantSender = IMPORTANT_SENDERS.some(sender => 
    fromLower.includes(sender) || fromNameLower.includes(sender)
  );
  
  const hasImportantKeyword = IMPORTANT_KEYWORDS.some(keyword => 
    subjectLower.includes(keyword) || snippetLower.includes(keyword)
  );
  
  if (isImportantSender || hasImportantKeyword) {
    return "important";
  }
  
  return "normal";
}

export function getClassificationColor(classification: EmailClassification) {
  switch (classification) {
    case "important":
      return {
        borderColor: "border-l-emerald-500",
        bgColor: "bg-emerald-50/40 dark:bg-emerald-950/20",
        opacity: "opacity-100",
        avatarBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
        badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      };
    case "promotional":
      return {
        borderColor: "border-l-gray-300 border-dashed",
        bgColor: "bg-gray-50/40 dark:bg-gray-900/20",
        opacity: "opacity-45",
        avatarBg: "bg-gradient-to-br from-gray-400 to-gray-500",
        badgeClass: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
      };
    case "normal":
    default:
      return {
        borderColor: "border-l-blue-400",
        bgColor: "",
        opacity: "opacity-100",
        avatarBg: "bg-gradient-to-br from-blue-500 to-blue-600",
        badgeClass: "",
      };
  }
}

export function getClassificationLabel(classification: EmailClassification) {
  switch (classification) {
    case "important":
      return "Priority";
    case "promotional":
      return "Promo";
    case "normal":
    default:
      return null;
  }
}

interface ClassifiedEmail<T> extends EmailInfo {
  classification: EmailClassification;
  originalEmail: T;
}

export function useEmailClassification<T extends EmailInfo>(emails: T[]) {
  return useMemo(() => {
    const classified: ClassifiedEmail<T>[] = emails.map(email => ({
      ...email,
      classification: classifyEmail(email),
      originalEmail: email,
    }));
    
    // Sort: important first, then normal, then promotional
    const sorted = [...classified].sort((a, b) => {
      const order = { important: 0, normal: 1, promotional: 2 };
      return order[a.classification] - order[b.classification];
    });
    
    // Get counts
    const counts = {
      important: classified.filter(e => e.classification === "important").length,
      promotional: classified.filter(e => e.classification === "promotional").length,
      normal: classified.filter(e => e.classification === "normal").length,
      total: classified.length,
    };
    
    return { classified, sorted, counts };
  }, [emails]);
}
