const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

let students = [];
let uploadedFilePath = '';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    uploadedFilePath = path.join(__dirname, 'uploads', uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

app.post('/uploads', upload.single('csvFile'), (req, res) => {
  students = [];

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      if (row.Name && row.USN) {
        students.push({ Name: row.Name.trim(), USN: row.USN.trim() });
      }
    })
    .on('end', () => {
      res.json({ message: 'CSV uploaded successfully' });
    });
});

app.get('/students', (req, res) => {
  if (!students.length) return res.status(404).json({ message: 'No students found' });
  res.json({ students });
});

app.post('/submit-marks', (req, res) => {
  const submittedData = req.body;

  if (!students.length || !Array.isArray(submittedData)) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const updatedCSV = ['Name,USN,CIA1,CIA2,CIA3,AAT,Quiz,Lab'];

  submittedData.forEach((entry, i) => {
    const s = students[i];
    const line = `${s.Name},${s.USN},${entry.cia1},${entry.cia2},${entry.cia3},${entry.aat},${entry.quiz},${entry.lab}`;
    updatedCSV.push(line);
  });

  fs.writeFileSync(uploadedFilePath, updatedCSV.join('\n'));

  res.json({ message: 'Marks saved to CSV successfully' });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
