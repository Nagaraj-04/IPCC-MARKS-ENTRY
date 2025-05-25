const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parse } = require('json2csv');
const os = require('os');

const app = express();
const PORT = 5000;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

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

  const updatedMarks = studentsWithMarks.map(student => {
    // Convert values safely to numbers or default to 0
    const cia1 = +student.cia1 || 0;
    const cia2 = +student.cia2 || 0;
    const cia3 = +student.cia3 || 0;
    const aat = +student.aat || 0;
    const quiz = +student.quiz || 0;
    const lab = +student.lab || 0;

    // Reduced scores
    const cia1Reduced = Math.round((cia1 / 50) * 10);
    const cia2Reduced = Math.round((cia2 / 50) * 10);
    const cia3Reduced = Math.round((cia3 / 50) * 10);
    const quizReduced = Math.round((quiz / 30) * 10);

    // Combined out of 50
    const combinedOutOf50 = cia1Reduced + cia2Reduced + cia3Reduced + aat + quizReduced;

    // Final reduced out of 30
    const finalReduced = Math.round((combinedOutOf50 / 50) * 30 * 100) / 100; // rounded to 2 decimals

    // Total marks out of 50
    const totalMarksOutOf50 = finalReduced + lab;

    // Grand total (whole number)
    const grandTotal = Math.round(totalMarksOutOf50);

    return {
      ...student,
      cia1_out_of_10: cia1Reduced,
      cia2_out_of_10: cia2Reduced,
      cia3_out_of_10: cia3Reduced,
      quiz_out_of_10: quizReduced,
      combined_out_of_50: combinedOutOf50,
      final_reduced_out_of_30: finalReduced,
      total_marks_out_of_50: totalMarksOutOf50,
      grand_total: grandTotal
    };
  });

  const fields = [
    'name', 'usn',
    'cia1', 'cia1_out_of_10',
    'cia2', 'cia2_out_of_10',
    'cia3', 'cia3_out_of_10',
    'aat', 'quiz', 'quiz_out_of_10',
    'combined_out_of_50',
    'final_reduced_out_of_30',
    'lab',
    'total_marks_out_of_50',
    'grand_total'
  ];

  const csvData = parse(updatedMarks, { fields });

  fs.writeFile(path.join(__dirname, 'uploads', 'student.csv'), csvData, (err) => {
    if (err) {
      console.error("Error saving marks:", err);
      return res.status(500).json({ message: 'Error saving marks.' });
    }
    console.log(`✅ All marks calculated and saved for ${updatedMarks.length} students.`);
    res.json({ message: 'Marks saved with all calculated fields.' });
  });
});

// Route to download the updated student CSV
app.get('/download', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', 'student.csv');

  if (fs.existsSync(filePath)) {
    res.download(filePath, 'student_marks.csv', (err) => {
      if (err) {
        console.error('❌ Error sending file:', err);
        res.status(500).send('Error downloading the file.');
      }
    });
  } else {
    res.status(404).send('File not found.');
  }
});


// Catch-all route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`🚀 Server is running on:`);
  console.log(`- Local: http://localhost:${PORT}`);
  console.log(`- Network: http://${localIP}:${PORT}`);
});
