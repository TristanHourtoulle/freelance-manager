"use client"

import { useTranslations } from "next-intl"
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { SerializedExpense } from "@/hooks/use-expenses"

interface ExpenseListProps {
  expenses: SerializedExpense[]
  onEdit: (expense: SerializedExpense) => void
  onDelete: (expense: SerializedExpense) => void
}

const CATEGORY_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  SOFTWARE: "default",
  HARDWARE: "secondary",
  TRAVEL: "outline",
  OFFICE: "secondary",
  MARKETING: "default",
  LEGAL: "outline",
  OTHER: "secondary",
}

export function ExpenseList({ expenses, onEdit, onDelete }: ExpenseListProps) {
  const t = useTranslations("expenses")

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-muted-foreground">{t("emptyState")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyStateHint")}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("dateCol")}</TableHead>
          <TableHead>{t("descriptionCol")}</TableHead>
          <TableHead>{t("categoryCol")}</TableHead>
          <TableHead>{t("clientCol")}</TableHead>
          <TableHead className="text-right">{t("amountCol")}</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
            <TableCell className="max-w-[250px] truncate">
              {expense.description}
              {expense.recurring && (
                <Badge variant="outline" className="ml-2">
                  {t("recurringBadge")}
                </Badge>
              )}
              {expense.taxDeductible && (
                <Badge variant="outline" className="ml-2">
                  {t("taxDeductibleCol")}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant={CATEGORY_VARIANT[expense.category] ?? "secondary"}
              >
                {t(`categories.${expense.category}`)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {expense.clientName ?? "--"}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {expense.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              EUR
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(expense)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(expense)}
                >
                  <TrashIcon className="size-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
