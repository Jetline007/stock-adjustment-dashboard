import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Upload } from "lucide-react";
import Papa from "papaparse";

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = results.data[0] as string[];
          const rows = results.data.slice(1) as string[][];
          
          const parsedData = rows
            .filter((row) => row.some((cell) => cell !== ""))
            .map((row) => {
              const obj: any = {};
              headers.forEach((header, index) => {
                const value = row[index];
                obj[header] = isNaN(Number(value)) ? value : Number(value);
              });
              return obj;
            });

          onDataLoaded(parsedData);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file. Please check the file format.");
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload CSV Data</CardTitle>
        <CardDescription>
          Import your Google Sheets CSV file to generate automated analytics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          size="lg"
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose CSV File
        </Button>
      </CardContent>
    </Card>
  );
}
