import { describe, expect, it } from "vitest"
import { computeTaskGroupPricing, priceForActualDays } from "./pricing"

describe("task group pricing", () => {
  it("totals captured days and DAILY pricing without inventing missing effort", () => {
    expect(
      computeTaskGroupPricing(
        [{ actualDays: 1.5 }, { actualDays: null }, { actualDays: 0.5 }],
        { billingMode: "DAILY", rate: 300 },
      ),
    ).toEqual({
      capturedTasks: 2,
      missingTasks: 1,
      totalDays: 2,
      totalPrice: 600,
      complete: false,
    })
  })

  it("converts captured days to eight-hour quantities for HOURLY clients", () => {
    expect(priceForActualDays(1.5, { billingMode: "HOURLY", rate: 75 })).toBe(
      900,
    )
  })

  it("keeps effort visible but does not invent a per-task price for FIXED clients", () => {
    expect(
      computeTaskGroupPricing([{ actualDays: 2 }], {
        billingMode: "FIXED",
        rate: 0,
      }),
    ).toEqual({
      capturedTasks: 1,
      missingTasks: 0,
      totalDays: 2,
      totalPrice: null,
      complete: true,
    })
  })
})
