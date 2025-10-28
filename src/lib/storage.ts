import { Property, Visit, Expense } from "@/types";

const STORAGE_KEYS = {
  PROPERTIES: "property_central_properties",
  VISITS: "property_central_visits",
  EXPENSES: "property_central_expenses",
};

export const storage = {
  // Properties
  getProperties: (): Property[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
    return data ? JSON.parse(data) : [];
  },
  
  saveProperties: (properties: Property[]) => {
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  },

  addProperty: (property: Omit<Property, "id" | "createdAt">): Property => {
    const properties = storage.getProperties();
    const newProperty: Property = {
      ...property,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    properties.push(newProperty);
    storage.saveProperties(properties);
    return newProperty;
  },

  deleteProperty: (id: string) => {
    const properties = storage.getProperties().filter(p => p.id !== id);
    storage.saveProperties(properties);
  },

  // Visits
  getVisits: (): Visit[] => {
    const data = localStorage.getItem(STORAGE_KEYS.VISITS);
    return data ? JSON.parse(data) : [];
  },

  saveVisits: (visits: Visit[]) => {
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(visits));
  },

  addVisit: (visit: Omit<Visit, "id" | "createdAt">): Visit => {
    const visits = storage.getVisits();
    const newVisit: Visit = {
      ...visit,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    visits.push(newVisit);
    storage.saveVisits(visits);
    return newVisit;
  },

  deleteVisit: (id: string) => {
    const visits = storage.getVisits().filter(v => v.id !== id);
    storage.saveVisits(visits);
  },

  // Expenses
  getExpenses: (): Expense[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  },

  saveExpenses: (expenses: Expense[]) => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  },

  addExpense: (expense: Omit<Expense, "id" | "createdAt">): Expense => {
    const expenses = storage.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    expenses.push(newExpense);
    storage.saveExpenses(expenses);
    return newExpense;
  },

  deleteExpense: (id: string) => {
    const expenses = storage.getExpenses().filter(e => e.id !== id);
    storage.saveExpenses(expenses);
  },
};
