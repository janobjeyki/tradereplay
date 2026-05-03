export const START_PLAN_KEY = 'start'
export const START_PLAN_LABEL = 'Start'
export const START_PLAN_PRICE_UZS = 99000

export const PLANS = [
  { key: START_PLAN_KEY, label: START_PLAN_LABEL, price: START_PLAN_PRICE_UZS },
] as const

export type PlanKey = typeof PLANS[number]['key']
