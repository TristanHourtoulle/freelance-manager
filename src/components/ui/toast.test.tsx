import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ToastProvider, useToast } from "@/components/providers/toast-provider"

function ToastTrigger({
  variant = "success" as const,
  title = "Test toast",
  duration,
}: {
  variant?: "success" | "error" | "warning" | "info"
  title?: string
  duration?: number
}) {
  const { toast } = useToast()
  return (
    <button onClick={() => toast({ variant, title, duration })}>Trigger</button>
  )
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a success toast", () => {
    renderWithProvider(<ToastTrigger variant="success" title="Success!" />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })

    expect(screen.getByText("Success!")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("renders an error toast", () => {
    renderWithProvider(<ToastTrigger variant="error" title="Error occurred" />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })

    expect(screen.getByText("Error occurred")).toBeInTheDocument()
  })

  it("renders a warning toast", () => {
    renderWithProvider(<ToastTrigger variant="warning" title="Warning!" />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })

    expect(screen.getByText("Warning!")).toBeInTheDocument()
  })

  it("renders an info toast", () => {
    renderWithProvider(<ToastTrigger variant="info" title="Info message" />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })

    expect(screen.getByText("Info message")).toBeInTheDocument()
  })

  it("auto-dismisses after duration", () => {
    renderWithProvider(<ToastTrigger title="Temporary" duration={3000} />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })
    expect(screen.getByText("Temporary")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3200)
    })

    expect(screen.queryByText("Temporary")).not.toBeInTheDocument()
  })

  it("dismisses on X button click", () => {
    renderWithProvider(<ToastTrigger title="Dismissable" duration={60000} />)

    act(() => {
      fireEvent.click(screen.getByText("Trigger"))
    })
    expect(screen.getByText("Dismissable")).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByLabelText("Dismiss"))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryByText("Dismissable")).not.toBeInTheDocument()
  })

  it("stacks max 3 toasts and removes oldest", () => {
    function MultiTrigger() {
      const { toast } = useToast()
      return (
        <>
          <button
            onClick={() =>
              toast({ variant: "info", title: "Toast 1", duration: 60000 })
            }
          >
            T1
          </button>
          <button
            onClick={() =>
              toast({ variant: "info", title: "Toast 2", duration: 60000 })
            }
          >
            T2
          </button>
          <button
            onClick={() =>
              toast({ variant: "info", title: "Toast 3", duration: 60000 })
            }
          >
            T3
          </button>
          <button
            onClick={() =>
              toast({ variant: "info", title: "Toast 4", duration: 60000 })
            }
          >
            T4
          </button>
        </>
      )
    }

    renderWithProvider(<MultiTrigger />)

    act(() => {
      fireEvent.click(screen.getByText("T1"))
      fireEvent.click(screen.getByText("T2"))
      fireEvent.click(screen.getByText("T3"))
      fireEvent.click(screen.getByText("T4"))
    })

    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument()
    expect(screen.getByText("Toast 2")).toBeInTheDocument()
    expect(screen.getByText("Toast 3")).toBeInTheDocument()
    expect(screen.getByText("Toast 4")).toBeInTheDocument()
  })
})
