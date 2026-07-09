import * as React from "react"
import { cn } from "@/lib/utils"

const checkboxCellOffset =
  "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto" data-autonnel-ui="table-wrap">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm text-foreground", className)}
      data-autonnel-ui="table"
      {...props}
    />
  </div>
))
Table.displayName = "AutonnelTable"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b", className)}
    data-autonnel-ui="table-header"
    {...props}
  />
))
TableHeader.displayName = "AutonnelTableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    data-autonnel-ui="table-body"
    {...props}
  />
))
TableBody.displayName = "AutonnelTableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    data-autonnel-ui="table-footer"
    {...props}
  />
))
TableFooter.displayName = "AutonnelTableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    data-autonnel-ui="table-row"
    {...props}
  />
))
TableRow.displayName = "AutonnelTableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground",
      checkboxCellOffset,
      className
    )}
    data-autonnel-ui="table-head"
    {...props}
  />
))
TableHead.displayName = "AutonnelTableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-2 align-middle", checkboxCellOffset, className)}
    data-autonnel-ui="table-cell"
    {...props}
  />
))
TableCell.displayName = "AutonnelTableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    data-autonnel-ui="table-caption"
    {...props}
  />
))
TableCaption.displayName = "AutonnelTableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
