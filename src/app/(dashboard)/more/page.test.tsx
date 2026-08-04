import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: h.refresh }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import MorePage from "./page"

describe("MorePage", () => {
  it("exposes task groups from the mobile navigation", async () => {
    const user = userEvent.setup()
    render(<MorePage />)

    await user.click(screen.getByRole("button", { name: /Groupes de tasks/ }))

    expect(h.push).toHaveBeenCalledWith("/task-groups")
  })
})
