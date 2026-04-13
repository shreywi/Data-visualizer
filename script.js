const DATASET_FILES = {
  students: "data/students.csv",
  sales: "data/sales.csv",
  expenses: "data/expenses.csv",
};

const DATASET_LABELS = {
  students: "Students",
  sales: "Sales",
  expenses: "Expenses",
};

// Fallback data keeps the app usable even if browser blocks local fetch from file://.
const CSV_FALLBACK = {
  students: `Name,Math,Physics,English
Aman,85,72,90
Riya,78,88,76
Karan,92,81,70
Neha,67,74,82
Arjun,88,69,91`,
  sales: `Month,Revenue,Profit,Customers
Jan,12000,3000,200
Feb,15000,4200,260
Mar,18000,5000,310
Apr,14000,3500,240
May,20000,6200,400`,
  expenses: `Category,Amount
Food,450
Transport,200
Shopping,800
Bills,600
Entertainment,300`,
};

const fileInput = document.getElementById("csv-upload");
const datasetSelect = document.getElementById("dataset-select");
const pieColumnSelect = document.getElementById("pie-column-select");
const activeSourceEl = document.getElementById("active-source");

const totalRowsEl = document.getElementById("total-rows");
const totalColumnsEl = document.getElementById("total-columns");
const avgValueEl = document.getElementById("avg-value");
const maxValueEl = document.getElementById("max-value");

const barCanvas = document.getElementById("bar-chart");
const pieCanvas = document.getElementById("pie-chart");
const barEmptyEl = document.getElementById("bar-empty");
const pieEmptyEl = document.getElementById("pie-empty");

const tableHead = document.querySelector("#data-table thead");
const tableBody = document.querySelector("#data-table tbody");

let headers = [];
let rowObjects = [];
let numericColumns = [];
let barChart = null;
let pieChart = null;

function parseCSV(text) {
  const sanitized = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    const next = sanitized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function toNumber(raw) {
  const cleaned = String(raw || "").trim().replace(/,/g, "");
  if (cleaned === "") {
    return NaN;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function detectNumericColumns(currentHeaders, records) {
  return currentHeaders.filter((column) => {
    const values = records
      .map((row) => String(row[column] ?? "").trim())
      .filter((value) => value !== "");

    if (values.length === 0) {
      return false;
    }

    return values.every((value) => Number.isFinite(toNumber(value)));
  });
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function getFlattenedNumericValues(records, columns) {
  const values = [];

  records.forEach((row) => {
    columns.forEach((column) => {
      const num = toNumber(row[column]);
      if (Number.isFinite(num)) {
        values.push(num);
      }
    });
  });

  return values;
}

function updateStats() {
  totalRowsEl.textContent = String(rowObjects.length);
  totalColumnsEl.textContent = String(headers.length);

  const numericValues = getFlattenedNumericValues(rowObjects, numericColumns);

  if (numericValues.length === 0) {
    avgValueEl.textContent = "N/A";
    maxValueEl.textContent = "N/A";
    return;
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);
  const avg = total / numericValues.length;
  const max = Math.max(...numericValues);

  avgValueEl.textContent = formatCompactNumber(avg);
  maxValueEl.textContent = formatCompactNumber(max);
}

function renderTable() {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (headers.length === 0) {
    return;
  }

  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });
  tableHead.appendChild(headRow);

  if (rowObjects.length === 0) {
    const emptyRow = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.textContent = "No data rows found in this CSV.";
    emptyRow.appendChild(td);
    tableBody.appendChild(emptyRow);
    return;
  }

  rowObjects.forEach((row) => {
    const tr = document.createElement("tr");

    headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = row[header] ?? "";
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}

function getBarChartData() {
  if (numericColumns.length === 0) {
    return null;
  }

  const labels = [];
  const averages = [];

  numericColumns.forEach((column) => {
    const values = rowObjects
      .map((row) => toNumber(row[column]))
      .filter((num) => Number.isFinite(num));

    if (values.length === 0) {
      return;
    }

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    labels.push(column);
    averages.push(Number(avg.toFixed(2)));
  });

  if (labels.length === 0) {
    return null;
  }

  return { labels, values: averages };
}

function setChartVisibility(chartCanvas, emptyEl, isVisible) {
  chartCanvas.classList.toggle("hidden", !isVisible);
  emptyEl.classList.toggle("hidden", isVisible);
}

function renderBarChart() {
  if (barChart) {
    barChart.destroy();
    barChart = null;
  }

  const data = getBarChartData();

  if (!data) {
    setChartVisibility(barCanvas, barEmptyEl, false);
    return;
  }

  setChartVisibility(barCanvas, barEmptyEl, true);

  barChart = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Average",
          data: data.values,
          borderRadius: 8,
          backgroundColor: [
            "rgba(61,214,207,0.75)",
            "rgba(46,168,240,0.75)",
            "rgba(114,227,157,0.75)",
            "rgba(247,191,77,0.75)",
            "rgba(255,118,118,0.75)",
          ],
          borderColor: "rgba(200, 231, 255, 0.55)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#dcecff",
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#b8ccec",
          },
          grid: {
            color: "rgba(145, 176, 227, 0.15)",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#b8ccec",
          },
          grid: {
            color: "rgba(145, 176, 227, 0.15)",
          },
        },
      },
    },
  });
}

function generatePieColors(count) {
  const colors = [];
  for (let i = 0; i < count; i += 1) {
    const hue = Math.round((360 / Math.max(count, 1)) * i);
    colors.push(`hsla(${hue}, 78%, 58%, 0.82)`);
  }
  return colors;
}

function getPieChartData(selectedColumn) {
  if (!selectedColumn) {
    return null;
  }

  if (numericColumns.includes(selectedColumn)) {
    const labelColumn = headers.find((header) => !numericColumns.includes(header));
    const labels = [];
    const values = [];

    rowObjects.forEach((row, index) => {
      const num = toNumber(row[selectedColumn]);
      if (!Number.isFinite(num)) {
        return;
      }

      const defaultLabel = `Row ${index + 1}`;
      const labelSource = labelColumn ? row[labelColumn] : "";
      labels.push(labelSource && String(labelSource).trim() ? labelSource : defaultLabel);
      values.push(num);
    });

    if (values.length === 0) {
      return null;
    }

    return { labels, values };
  }

  const frequencyMap = new Map();

  rowObjects.forEach((row) => {
    const raw = String(row[selectedColumn] ?? "").trim();
    const key = raw || "(empty)";
    frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
  });

  const labels = Array.from(frequencyMap.keys());
  const values = Array.from(frequencyMap.values());

  if (values.length === 0) {
    return null;
  }

  return { labels, values };
}

function populatePieColumnSelect() {
  pieColumnSelect.innerHTML = "";

  headers.forEach((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    pieColumnSelect.appendChild(option);
  });

  if (headers.length === 0) {
    return;
  }

  const preferredColumn = numericColumns[0] || headers[0];
  pieColumnSelect.value = preferredColumn;
}

function renderPieChart() {
  if (pieChart) {
    pieChart.destroy();
    pieChart = null;
  }

  const selectedColumn = pieColumnSelect.value;
  const data = getPieChartData(selectedColumn);

  if (!data) {
    setChartVisibility(pieCanvas, pieEmptyEl, false);
    return;
  }

  setChartVisibility(pieCanvas, pieEmptyEl, true);

  pieChart = new Chart(pieCanvas, {
    type: "pie",
    data: {
      labels: data.labels,
      datasets: [
        {
          data: data.values,
          backgroundColor: generatePieColors(data.values.length),
          borderColor: "rgba(8, 14, 25, 0.75)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#dcecff",
            boxWidth: 12,
          },
        },
      },
    },
  });
}

function toRowObjects(parsedRows) {
  if (parsedRows.length === 0) {
    return { parsedHeaders: [], parsedRecords: [] };
  }

  const parsedHeaders = parsedRows[0].map((header, index) => {
    const name = String(header || "").trim();
    return name || `Column ${index + 1}`;
  });

  const parsedRecords = parsedRows.slice(1).map((row) => {
    const item = {};

    parsedHeaders.forEach((header, index) => {
      item[header] = String(row[index] ?? "").trim();
    });

    return item;
  });

  return { parsedHeaders, parsedRecords };
}

function applyDataset(csvText, sourceLabel) {
  const parsed = parseCSV(csvText);
  const { parsedHeaders, parsedRecords } = toRowObjects(parsed);

  headers = parsedHeaders;
  rowObjects = parsedRecords;
  numericColumns = detectNumericColumns(headers, rowObjects);

  activeSourceEl.textContent = `Loaded: ${sourceLabel}`;

  populatePieColumnSelect();
  updateStats();
  renderBarChart();
  renderPieChart();
  renderTable();
}

async function loadExampleDataset(datasetKey) {
  const label = DATASET_LABELS[datasetKey] || datasetKey;
  const path = DATASET_FILES[datasetKey];

  let csvText = "";

  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }
    csvText = await response.text();
  } catch (error) {
    csvText = CSV_FALLBACK[datasetKey] || "";
  }

  if (!csvText) {
    applyDataset("", `${label} (no data)`);
    return;
  }

  applyDataset(csvText, `${label} (example)`);
}

function readUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected file."));

    reader.readAsText(file);
  });
}

datasetSelect.addEventListener("change", async (event) => {
  const selected = event.target.value;
  if (!selected) {
    return;
  }

  await loadExampleDataset(selected);
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const csvText = await readUploadedFile(file);
    applyDataset(csvText, `${file.name} (uploaded)`);
  } catch (error) {
    applyDataset("", `${file.name} (failed to load)`);
  }
});

pieColumnSelect.addEventListener("change", () => {
  renderPieChart();
});

loadExampleDataset(datasetSelect.value);
