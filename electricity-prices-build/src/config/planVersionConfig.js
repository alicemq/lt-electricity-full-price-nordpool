export const planVersions = {
  "2023-01-01": {
    "Four zones": ["Smart"],
    "Two zones": ["Standart", "Home", "Home plus"],
    "Single zone": ["Standart", "Home", "Home plus"]
  },
  "2025-01-01": {
    "Four zones": ["Smart"],
    "Two zones": ["Standart", "Home", "Home plus"],
    "Single zone": ["Standart", "Home", "Home plus"]
  },
  "2025-07-01": {
    "Four zones": ["Standart", "Effective"],
    "Two zones": ["Standart", "Home", "Effective"],
    "Single zone": ["Standart", "Home", "Effective"]
  },
  "2026-01-01": {
    "Four zones": ["Standart", "Effective"],
    "Two zones": ["Standart", "Home", "Effective"],
    "Single zone": ["Standart", "Home", "Effective"]
  }
};

export const planMigrations = {
  "Smart": "Standart",
  "Home plus": "Home"
};

export function getAvailablePlans(date, zone) {
  const validVersion = Object.keys(planVersions)
    .filter(d => d <= date)
    .sort()
    .pop() || Object.keys(planVersions)[0];
  
  return planVersions[validVersion][zone] || [];
}

export function getMigratedPlan(oldPlan, date) {
  if (date >= "2025-07-01" && planMigrations[oldPlan]) {
    return planMigrations[oldPlan];
  }
  return oldPlan;
}
