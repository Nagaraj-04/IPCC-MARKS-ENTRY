const form = document.getElementById("uploadForm");
const messageDiv = document.getElementById("message");
const tableDiv = document.getElementById("csvTable");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("csvFile");
  const formData = new FormData();
  formData.append("csvFile", fileInput.files[0]);

  const res = await fetch("http://localhost:5000/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (data.content) {
    messageDiv.innerHTML = `<p style="color: green;">${data.message}</p>`;
    renderTable(data.content);
  } else {
    messageDiv.innerHTML = `<p style="color: red;">${data.message}</p>`;
  }
});

function renderTable(csv) {
  const rows = csv.trim().split("\n").map(row => row.split(","));
  const headers = rows[0];
  let table = "<table><tr>";
  headers.forEach(header => table += `<th>${header}</th>`);
  table += "</tr>";

  for (let i = 1; i < rows.length; i++) {
    table += "<tr>";
    rows[i].forEach((cell, j) => {
      if (j >= 2) {
        table += `<td><input type="text" value="${cell.trim()}" /></td>`;
      } else {
        table += `<td>${cell.trim()}</td>`;
      }
    });
    table += "</tr>";
  }

  table += "</table>";
  tableDiv.innerHTML = table;
}
