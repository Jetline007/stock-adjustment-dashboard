// src/components/VarianceUpload.tsx
import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";

interface VarianceUploadProps {
  onDataLoaded: (stocktakeData: any[], systemData: any[]) => void;
}

function cleanNumber(val: unknown) {
  if (val === null || val === undefined) return 0;
  const n = Number(String(val).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Stocktake sheet header variations happen a lot.
 * We support common alternatives so your dashboard doesn't break.
 */
function pick(row: any, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

/**
 * Convert any expiry format to YYYYMMDD (string) if possible.
 * - If already YYYYMMDD → keep it
 * - If YYYY-MM-DD → convert to YYYYMMDD
 * - Otherwise keep original string
 */
function normalizeExpiryToYYYYMMDD(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{8}$/.test(s)) return s; // already YYYYMMDD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "");
  return s;
}

function normalizeStocktakeRows(rows: any[]) {
  return (rows || [])
    .map((r) => {
      const productCode = String(
        pick(r, ["Product Code", "ProductCode", "Code", "SKU", "Sku"]),
      ).trim();

      const productName = String(
        pick(r, ["Product Name", "ProductName", "Description", "Item", "Name"]),
      ).trim();

      const bin = String(
        pick(r, ["Bin", "BIN", "Location", "Bin Location"]),
      ).trim();

      const unit = String(pick(r, ["Unit", "UOM", "UoM", "Units"])).trim();

      const batchSN = String(
        pick(r, [
          "BatchSN",
          "Batch/SN",
          "Batch",
          "Serial",
          "Serial No",
          "Batch No",
        ]),
      ).trim();

      const expiryRaw = pick(r, [
        "ExpiryDate_YYYYMMDD",
        "Expiry Date",
        "Expiry",
        "ExpiryDate",
      ]);
      const expiryYYYYMMDD = normalizeExpiryToYYYYMMDD(expiryRaw);

      const stocktakeQty = cleanNumber(
        pick(r, [
          "Stocktake Quantity",
          "Stocktake Qty",
          "Count",
          "Qty",
          "Quantity",
        ]),
      );

      // Return with EXACT headers that App.tsx expects in handleDataLoaded normalization
      return {
        "Product Code": productCode,
        "Product Name": productName,
        Bin: bin,
        Unit: unit,
        BatchSN: batchSN,
        ExpiryDate_YYYYMMDD: expiryYYYYMMDD,
        "Stocktake Quantity": stocktakeQty,
      };
    })
    .filter((r) => String(r["Product Code"]).trim().length > 0);
}

function normalizeSystemRows(rows: any[]) {
  return (rows || [])
    .map((r) => {
      const productCode = String(
        pick(r, ["Product Code", "ProductCode", "Code", "SKU", "Sku"]),
      ).trim();

      const systemQty = cleanNumber(
        pick(r, [
          "System Quantity",
          "System Qty",
          "SystemQty",
          "On Hand",
          "OnHand",
          "Qty",
        ]),
      );

      return {
        "Product Code": productCode,
        "System Quantity": systemQty,
      };
    })
    .filter((r) => String(r["Product Code"]).trim().length > 0);
}

export function VarianceUpload({ onDataLoaded }: VarianceUploadProps) {
  const stocktakeFileRef = useRef<HTMLInputElement>(null);
  const systemFileRef = useRef<HTMLInputElement>(null);

  const [stocktakeFile, setStocktakeFile] = useState<File | null>(null);
  const [systemFile, setSystemFile] = useState<File | null>(null);

  const handleStocktakeUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) setStocktakeFile(file);
  };

  const handleSystemUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSystemFile(file);
  };

  const processFiles = () => {
    if (!stocktakeFile) {
      alert("Please upload the Stocktake CSV file");
      return;
    }

    Papa.parse(stocktakeFile, {
      header: true,
      skipEmptyLines: true,
      complete: (stocktakeResults) => {
        const normalizedStocktake = normalizeStocktakeRows(
          (stocktakeResults?.data as any[]) || [],
        );

        if (systemFile) {
          Papa.parse(systemFile, {
            header: true,
            skipEmptyLines: true,
            complete: (systemResults) => {
              const normalizedSystem = normalizeSystemRows(
                (systemResults?.data as any[]) || [],
              );

              onDataLoaded(normalizedStocktake, normalizedSystem);
            },
            error: (error) => {
              console.error("Error parsing System CSV:", error);
              alert("Error parsing System CSV file");
            },
          });
        } else {
          onDataLoaded(normalizedStocktake, []);
        }
      },
      error: (error) => {
        console.error("Error parsing Stocktake CSV:", error);
        alert("Error parsing Stocktake CSV file");
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Stock Audit Files</CardTitle>
        <CardDescription>
          Upload your stocktake count and optionally your system stock for
          variance analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Stocktake Count (Required)
            </label>

            <input
              type="file"
              accept=".csv"
              ref={stocktakeFileRef}
              onChange={handleStocktakeUpload}
              className="hidden"
            />

            <Button
              onClick={() => stocktakeFileRef.current?.click()}
              variant={stocktakeFile ? "outline" : "default"}
              className="w-full"
            >
              {stocktakeFile ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                  {stocktakeFile.name}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Stocktake CSV
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              System Stock (Optional)
            </label>

            <input
              type="file"
              accept=".csv"
              ref={systemFileRef}
              onChange={handleSystemUpload}
              className="hidden"
            />

            <Button
              onClick={() => systemFileRef.current?.click()}
              variant={systemFile ? "outline" : "secondary"}
              className="w-full"
            >
              {systemFile ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                  {systemFile.name}
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Upload System CSV
                </>
              )}
            </Button>
          </div>
        </div>

        <Button
          onClick={processFiles}
          disabled={!stocktakeFile}
          className="w-full"
          size="lg"
        >
          Process Files & Generate Report
        </Button>

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
          <p className="font-medium mb-1">Note:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              Stocktake CSV will be normalized to: Product Code, Product Name,
              Bin, Unit, BatchSN, ExpiryDate_YYYYMMDD, Stocktake Quantity
            </li>
            <li>
              System CSV (optional) will be normalized to: Product Code, System
              Quantity
            </li>
            <li>
              Files will be matched by Product Code for variance calculation
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
