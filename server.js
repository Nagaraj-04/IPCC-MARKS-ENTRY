const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parse } = require('json2csv');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

let subjectDetails = {};
let uploadedStudents = [];

// Validate IPCC Subject Code
app.post('/validate-subject', express.json(), (req, res) => {
  const { subjectCode, semester, section } = req.body;
  if (!subjectCode.toLowerCase().startsWith('ipcc')) {
    return res.status(400).json({ error: 'Invalid IPCC subject code.' });
  }
  subjectDetails = { subjectCode, semester, section };
  res.json({ message: 'Subject code validated.' });
});

// Handle CSV Upload
app.post('/uploads', upload.single('csvFile'), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, 'uploads', 'student.csv');

  fs.rename(tempPath, targetPath, err => {
    if (err) return res.status(500).json({ error: 'Failed to upload file.' });
    console.log("CSV uploaded and moved to:", targetPath);
    res.json({ message: 'CSV uploaded successfully.' });
  });
});

// Return student list for marks entry
app.get('/api/students', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', 'student.csv');
  const students = [];

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Student CSV file not found.' });
  }

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      let name = row.Name || row.name || row.NAME || '';
      let usn = row.USN || row.usn || row.Usn || '';
      if (name && usn) {
        students.push({ name: name.trim(), usn: usn.trim() });
      }
    })
    .on('end', () => {
      if (students.length === 0) {
        console.log("⚠️ CSV loaded but no valid students found. Check the headers.");
        return res.status(500).json({ error: 'No valid students found in the file.' });
      }
      uploadedStudents = students;
      console.log(`✅ Loaded ${students.length} students.`);
      res.json(students);
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err);
      res.status(500).json({ error: 'Error reading student file.' });
    });
});

// Save marks back to CSV
app.post('/api/save-marks', (req, res) => {
  const studentsWithMarks = req.body;
  const fields = ['name', 'usn', 'cia1', 'cia2', 'cia3', 'aat', 'quiz', 'lab'];
  const csvData = parse(studentsWithMarks, { fields });

  fs.writeFile(path.join(__dirname, 'uploads', 'student.csv'), csvData, (err) => {
    if (err) {
      console.error("Error saving marks:", err);
      return res.status(500).json({ message: 'Error saving marks.' });
    }
    console.log(`✅ Marks saved for ${studentsWithMarks.length} students.`);
    res.json({ message: 'Marks saved successfully.' });
  });
});

// Catch-all route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
