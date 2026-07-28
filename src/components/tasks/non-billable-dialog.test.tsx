import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { NonBillableDialog } from "./non-billable-dialog"
import { NON_BILLABLE_REASON_LABELS } from "@/domain/tasks/billability"

function renderDialog(
  overrides: Partial<Parameters<typeof NonBillableDialog>[0]> = {},
) {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  const utils = render(
    <NonBillableDialog
      open
      taskCount={1}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onCancel, onConfirm, ...utils }
}

describe("NonBillableDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog({ open: false })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("titles with the singular wording for one task", () => {
    renderDialog()

    expect(
      screen.getByRole("dialog", {
        name: "Marquer 1 tâche comme non facturable",
      }),
    ).toBeInTheDocument()
  })

  it("titles with the plural wording for several tasks", () => {
    renderDialog({ taskCount: 12 })

    expect(
      screen.getByRole("dialog", {
        name: "Marquer 12 tâches comme non facturable",
      }),
    ).toBeInTheDocument()
  })

  it("renders every reason from the shared label map", () => {
    renderDialog()

    for (const label of Object.values(NON_BILLABLE_REASON_LABELS)) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument()
    }
  })

  it("keeps confirm disabled until a reason is selected", () => {
    renderDialog()

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: "Geste commercial" }))

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeEnabled()
  })

  it("confirms with the reason and a null note when the note is empty", () => {
    const { onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole("radio", { name: "Travail non facturé" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(onConfirm).toHaveBeenCalledWith("NON_BILLED_WORK", null)
  })

  it("requires a non-empty note for the OTHER reason", () => {
    const { onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Une note est requise pour la raison « Autre ».",
    )

    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: "   " },
    })
    expect(screen.getByRole("button", { name: "Confirmer" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: "  Contexte précis  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(onConfirm).toHaveBeenCalledWith("OTHER", "Contexte précis")
  })

  it("cancels on Escape", () => {
    const { onCancel } = renderDialog()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onCancel).toHaveBeenCalled()
  })

  it("disables confirm while the mutation is pending", () => {
    renderDialog({ isPending: true })

    fireEvent.click(screen.getByRole("radio", { name: "Geste commercial" }))

    expect(screen.getByRole("button", { name: "…" })).toBeDisabled()
  })
})
