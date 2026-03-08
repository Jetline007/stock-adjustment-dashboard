// src/components/DataTable.tsx
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArrowUpDown, Download } from "lucide-react";

interface DataTableProps {
  title: string;
  data: any[];
  maxRows?: number;
  highlightEmpty?: boolean;
}

function isCellEmpty(value: any) {
  // 0 is NOT empty (important for quantities)
  if (value === 0) return false;

  if (value === null || value === undefined) return true;

  // Strings: treat whitespace, N/A, NA, etc as empty
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "") return true;
    if (v === "n/a" || v === "na") return true;
    if (v === "null" || v === "undefined") return true;
  }

  return false;
}

function toDisplayValue(value: any) {
  // show blank for empty values
  return isCellEmpty(value) ? "" : String(value);
}

function escapeCsvValue(value: any) {
  // CSV safe output: wrap in quotes and escape any quotes inside
  const s = toDisplayValue(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function DataTable({
  title,
  data,
  maxRows = 10,
  highlightEmpty = false,
}: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const handleSort = (column: string) => {
    setCurrentPage(1);
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedAndFilteredData = useMemo(() => {
    let filtered = data.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    );

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a?.[sortColumn];
        const bVal = b?.[sortColumn];

        // Keep empties last (so missing data stands out)
        const aEmpty = isCellEmpty(aVal);
        const bEmpty = isCellEmpty(bVal);
        if (aEmpty && !bEmpty) return 1;
        if (!aEmpty && bEmpty) return -1;

        // Numeric sort if both numbers
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal ?? "").toLowerCase();
        const bStr = String(bVal ?? "").toLowerCase();

        return sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [data, sortColumn, sortDirection, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedAndFilteredData.length / maxRows),
  );

  const paginatedData = sortedAndFilteredData.slice(
    (currentPage - 1) * maxRows,
    currentPage * maxRows,
  );

  const exportToCSV = () => {
    const csvContent = [
      columns.map((c) => escapeCsvValue(c)).join(","),
      ...sortedAndFilteredData.map((row) =>
        columns.map((col) => escapeCsvValue(row?.[col])).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column)}
                      className="h-8 px-2"
                    >
                      {column}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedData.map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map((column) => {
                    const value = row?.[column];
                    const empty = isCellEmpty(value);

                    const cellClass =
                      highlightEmpty && empty
                        ? "bg-red-100 border border-red-300"
                        : "";

                    return (
                      <TableCell key={column} className={cellClass}>
                        {toDisplayValue(value)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * maxRows + 1} to{" "}
              {Math.min(currentPage * maxRows, sortedAndFilteredData.length)} of{" "}
              {sortedAndFilteredData.length} entries
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
