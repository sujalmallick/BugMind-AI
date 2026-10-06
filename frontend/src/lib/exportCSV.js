// Spreadsheet apps execute cells starting with these characters as formulas
// (e.g. =HYPERLINK(...)). Test data is user- and AI-written, so prefix such
// cells with a quote to keep them as plain text (OWASP CSV injection).
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function neutralizeFormula(value) {
  if (typeof value !== "string") return value;
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value;
}

export function exportTestCasesCSV(
  testCases,
  fileName = "BugMind_TestCases"
) {
  if (!testCases || testCases.length === 0) {
    alert("No test cases available to export.");
    return;
  }

  const headers = [
    "ID",
    "Description",
    "Module",
    "Category",
    "Priority",
    "Status",
  ];

  const rows = testCases.map((tc) => [
    tc.id ?? "",
    tc.description ?? "",
    tc.module ?? "",
    tc.category ?? "",
    tc.priority ?? "",
    tc.status ?? "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => `"${neutralizeFormula(String(cell)).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = `${fileName}_${
    new Date().toISOString().split("T")[0]
  }.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}
