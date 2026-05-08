export const WIZARD_STEPS = [
  { step: 1, label: "Define Scope", path: "/" },
  { step: 2, label: "Parameters", path: "/parameters" },
  { step: 3, label: "Review", path: "/review" },
] as const;

export const MAIN_NAV_ITEMS = [
  { id: "home", label: "Home", path: "/", icon: "H" },
  { id: "clients", label: "Clients", path: "/clients", icon: "C" },
  { id: "drafts", label: "Drafts", path: "/drafts", icon: "D" },
  { id: "history", label: "History", path: "/history", icon: "H" },
] as const;
